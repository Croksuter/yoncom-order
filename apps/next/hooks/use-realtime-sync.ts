import { useEffect } from "react";
import { traceEvent } from "~/lib/verification-trace";

export type RealtimeHint = {
  type: string;
  scope: string;
  revision: number;
  eventId: string;
};

function websocketUrl(scope: string) {
  const url = new URL("/api/realtime/socket", window.location.origin);
  url.searchParams.set("scope", scope);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function useRealtimeSync(scope: string | null, onHint: (hint: RealtimeHint | null) => void) {
  useEffect(() => {
    if (!scope || typeof window === "undefined") return;

    let closed = false;
    let socket: WebSocket | null = null;

    const connect = () => {
      socket = new WebSocket(websocketUrl(scope));
      traceEvent("client", "realtime.socket.opening", { scope });
      socket.onopen = () => {
        traceEvent("client", "realtime.socket.open", { scope });
      };
      socket.onmessage = (event) => {
        const hint = JSON.parse(String(event.data)) as RealtimeHint;
        traceEvent("client", "realtime.socket.message", {
          scope: hint.scope,
          revision: hint.revision,
          eventId: hint.eventId,
          type: hint.type,
        });
        if (hint.scope === scope) {
          onHint(hint);
        }
      };
      socket.onclose = () => {
        traceEvent("client", "realtime.socket.close", { scope, reconnect: !closed });
        if (!closed) {
          window.setTimeout(connect, 1000);
        }
      };
    };

    const onFocus = () => {
      traceEvent("client", "realtime.focus.resync", { scope });
      onHint(null);
    };
    window.addEventListener("focus", onFocus);
    connect();

    return () => {
      closed = true;
      window.removeEventListener("focus", onFocus);
      socket?.close();
    };
  }, [scope, onHint]);
}
