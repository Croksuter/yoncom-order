export interface Env {
  REALTIME_HUB: DurableObjectNamespace<RealtimeHub>;
  DB: D1Database;
  REALTIME_NOTIFY_SECRET: string;
}

type RealtimeHint = {
  type: string;
  scope: string;
  revision: number;
  eventId: string;
};

export class RealtimeHub implements DurableObject {
  private readonly sessions = new Map<WebSocket, Set<string>>();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/realtime/socket") {
      if (request.headers.get("upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }

      const scope = url.searchParams.get("scope");
      if (!scope) {
        return new Response("scope required", { status: 400 });
      }
      const authorized = await this.authorizeScope(request, scope);
      if (!authorized) {
        trace("worker", "realtime.socket.reject", { scope });
        return new Response("Forbidden", { status: 403 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.accept(server, request, scope);
      trace("worker", "realtime.socket.accept", { scope });
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/internal/realtime/notify" && request.method === "POST") {
      const authorization = request.headers.get("authorization");
      if (authorization !== `Bearer ${this.env.REALTIME_NOTIFY_SECRET}`) {
        return new Response("Unauthorized", { status: 401 });
      }

      const hint = await request.json<RealtimeHint>();
      trace("worker", "realtime.notify.received", hint);
      this.broadcast(hint);
      return Response.json({ result: "ok" });
    }

    return new Response("Not found", { status: 404 });
  }

  private accept(socket: WebSocket, request: Request, scope: string) {
    socket.accept();
    this.sessions.set(socket, new Set([scope]));
    socket.addEventListener("message", (event) => {
      void this.handleClientMessage(socket, request, event);
    });
    socket.addEventListener("close", () => this.sessions.delete(socket));
    socket.addEventListener("error", () => this.sessions.delete(socket));
  }

  private async handleClientMessage(socket: WebSocket, request: Request, event: MessageEvent) {
    let message: { type?: string; scope?: string };
    try {
      message = JSON.parse(String(event.data)) as { type?: string; scope?: string };
    } catch {
      socket.close(1003, "Invalid message");
      return;
    }

    if (message.type === "ping") {
      trace("worker", "realtime.client.ping", {});
      socket.send(JSON.stringify({ type: "pong" }));
      return;
    }

    if (message.type === "ack") {
      trace("worker", "realtime.client.ack", { scope: message.scope ?? null });
      return;
    }

    if (message.type === "subscribe" && message.scope) {
      if (!(await this.authorizeScope(request, message.scope))) {
        trace("worker", "realtime.subscribe.reject", { scope: message.scope });
        socket.close(1008, "Forbidden scope");
        return;
      }
      this.sessions.get(socket)?.add(message.scope);
      trace("worker", "realtime.subscribe.accept", { scope: message.scope });
      return;
    }

    socket.close(1003, "Unsupported message");
  }

  private async authorizeScope(request: Request, scope: string) {
    if (scope === "venue:default") {
      const sessionId = cookie(request, "yoncom_session");
      if (!sessionId) return false;
      const user = await this.env.DB.prepare(
        `SELECT u.id
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > ? AND u.role = 'ADMIN' AND u.deletedAt IS NULL
         LIMIT 1`,
      ).bind(sessionId, Date.now()).first();
      return !!user;
    }

    if (scope.startsWith("table:")) {
      const tableId = scope.slice("table:".length);
      const sessionId = cookie(request, "yoncom_table_session");
      if (!sessionId) return false;
      const session = await this.env.DB.prepare(
        `SELECT id
         FROM tableSessions
         WHERE id = ? AND tableId = ? AND revokedAt IS NULL AND expiresAt > ?
         LIMIT 1`,
      ).bind(sessionId, tableId, Date.now()).first();
      return !!session;
    }

    return false;
  }

  private broadcast(hint: RealtimeHint) {
    let delivered = 0;
    for (const [socket, scopes] of this.sessions.entries()) {
      if (!scopes.has(hint.scope)) continue;
      try {
        socket.send(JSON.stringify(hint));
        delivered += 1;
      } catch {
        this.sessions.delete(socket);
      }
    }
    trace("worker", "realtime.broadcast", { ...hint, delivered });
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const id = env.REALTIME_HUB.idFromName("venue:default");
    return env.REALTIME_HUB.get(id).fetch(request);
  },
};

function cookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  return header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? null;
}

function trace(layer: "worker", event: string, fields: Record<string, unknown>) {
  console.log(`[yoncom-trace] ${JSON.stringify({
    ts: new Date().toISOString(),
    clockMs: Date.now(),
    layer,
    event,
    ...fields,
  })}`);
}
