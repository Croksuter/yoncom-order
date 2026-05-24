import { useEffect } from "react";
import { traceEvent } from "~/lib/verification-trace";

export type RealtimeHint = {
  type: string;
  scope: string;
  revision: number;
  eventId: string;
};

export function realtimeWebSocketUrl(
  scope: string,
  origin: string,
  endpoint = process.env.NEXT_PUBLIC_REALTIME_SOCKET_URL,
) {
  const configuredEndpoint = endpoint?.trim();
  if (!configuredEndpoint) {
    return null;
  }

  const url = new URL(configuredEndpoint, origin);
  url.searchParams.set("scope", scope);
  if (url.protocol === "https:") {
    url.protocol = "wss:";
  } else if (url.protocol === "http:") {
    url.protocol = "ws:";
  }
  return url.toString();
}

export function useRealtimeSync(scope: string | null, onHint: (hint: RealtimeHint | null) => void) {
  useEffect(() => {
    if (!scope || typeof window === "undefined") return;

    let closed = false;
    const socketUrl = realtimeWebSocketUrl(scope, window.location.origin);
    let socket: WebSocket | null = null;

    const connect = () => {
      if (!socketUrl) {
        traceEvent("client", "realtime.socket.disabled", { scope });
        return;
      }

      socket = new WebSocket(socketUrl);
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
      socket.onerror = () => {
        traceEvent("client", "realtime.socket.error", { scope });
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
