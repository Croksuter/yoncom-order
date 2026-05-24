import { describe, expect, it } from "vitest";
import { realtimeWebSocketUrl } from "~/hooks/use-realtime-sync";

describe("realtime websocket URL resolution", () => {
  it("does not open a websocket in Next-only dev when no realtime endpoint is configured", () => {
    expect(realtimeWebSocketUrl("table:demo_table_fam1", "http://localhost:3000", "")).toBeNull();
    expect(realtimeWebSocketUrl("table:demo_table_fam1", "http://localhost:3000", undefined)).toBeNull();
  });

  it("maps configured HTTP worker endpoints to websocket URLs", () => {
    expect(
      realtimeWebSocketUrl(
        "table:demo_table_fam1",
        "http://localhost:3000",
        "http://127.0.0.1:8787/api/realtime/socket",
      ),
    ).toBe("ws://127.0.0.1:8787/api/realtime/socket?scope=table%3Ademo_table_fam1");
  });

  it("preserves configured secure websocket endpoints", () => {
    expect(
      realtimeWebSocketUrl(
        "venue:default",
        "https://order.example",
        "wss://realtime.example/api/realtime/socket?existing=1",
      ),
    ).toBe("wss://realtime.example/api/realtime/socket?existing=1&scope=venue%3Adefault");
  });
});
