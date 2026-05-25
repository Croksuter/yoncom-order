import { describe, expect, it } from "vitest";

describe("server API request guard", () => {
  it("accepts same-origin requests forwarded through an HTTPS tunnel", async () => {
    const { guardUnsafeRequest } = await import("~/lib/server/api");

    const response = guardUnsafeRequest(
      new Request("http://localhost:3000/api/table/session", {
        method: "POST",
        headers: {
          origin: "https://abc.devtunnels.ms",
          host: "localhost:3000",
          "x-forwarded-host": "abc.devtunnels.ms",
          "x-forwarded-proto": "https",
          "content-type": "application/json",
        },
        body: JSON.stringify({ tableId: "table_123456789" }),
      }),
    );

    expect(response).toBeNull();
  });

  it("rejects unrelated origins even when forwarded headers are present", async () => {
    const { guardUnsafeRequest } = await import("~/lib/server/api");

    const response = guardUnsafeRequest(
      new Request("http://localhost:3000/api/table/session", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          host: "localhost:3000",
          "x-forwarded-host": "abc.devtunnels.ms",
          "x-forwarded-proto": "https",
          "content-type": "application/json",
        },
        body: JSON.stringify({ tableId: "table_123456789" }),
      }),
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: "Origin required" });
  });
});
