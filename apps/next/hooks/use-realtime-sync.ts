import { useEffect } from "react";

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
      socket.onmessage = (event) => {
        const hint = JSON.parse(String(event.data)) as RealtimeHint;
        if (hint.scope === scope) {
          onHint(hint);
        }
      };
      socket.onclose = () => {
        if (!closed) {
          window.setTimeout(connect, 1000);
        }
      };
    };

    const onFocus = () => onHint(null);
    window.addEventListener("focus", onFocus);
    connect();

    return () => {
      closed = true;
      window.removeEventListener("focus", onFocus);
      socket?.close();
    };
  }, [scope, onHint]);
}
