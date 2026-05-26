import { beforeEach, describe, expect, it, vi } from "vitest";
import { installD1FetchMock, stubCloudflareEnv } from "./helpers/d1";

describe("server API request guard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

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

  it("rate limits by cf-connecting-ip before x-forwarded-for", async () => {
    const { guardUnsafeRequest } = await import("~/lib/server/api");
    const rateLimit = { scope: "test-cf-priority", maxRequests: 1, windowMs: 60_000 };

    const first = guardUnsafeRequest(
      new Request("http://order.test/api/auth/sign-in", {
        method: "POST",
        headers: {
          origin: "http://order.test",
          "cf-connecting-ip": "203.0.113.10",
          "x-forwarded-for": "198.51.100.1",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { rateLimit },
    );
    const second = guardUnsafeRequest(
      new Request("http://order.test/api/auth/sign-in", {
        method: "POST",
        headers: {
          origin: "http://order.test",
          "cf-connecting-ip": "203.0.113.10",
          "x-forwarded-for": "198.51.100.2",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { rateLimit },
    );

    expect(first).toBeNull();
    expect(second?.status).toBe(429);
    await expect(second?.json()).resolves.toEqual({ error: "Too many requests" });
  });

  it("replays successful idempotent mutations for the same key and body", async () => {
    stubCloudflareEnv();
    installD1FetchMock(({ sql }) => {
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const { runIdempotentMutation } = await import("~/lib/server/api");
    const body = { orderId: "order_1234567890" };
    const mutate = vi.fn(async () => ({
      status: 200,
      result: { ok: true },
      mutationId: "mutation_123",
      revision: 7,
      affectedScopes: ["venue:default"],
    }));

    const first = await runIdempotentMutation(idempotentRequest(body), "admin:order:paid", body, mutate);
    const second = await runIdempotentMutation(idempotentRequest(body), "admin:order:paid", body, mutate);

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("rejects reused idempotency keys with a different body", async () => {
    stubCloudflareEnv();
    installD1FetchMock(({ sql }) => {
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const { runIdempotentMutation } = await import("~/lib/server/api");
    const mutate = vi.fn(async () => ({ status: 200, result: { ok: true } }));

    await runIdempotentMutation(
      idempotentRequest({ orderId: "order_1234567890" }),
      "admin:order:paid",
      { orderId: "order_1234567890" },
      mutate,
    );
    const conflict = await runIdempotentMutation(
      idempotentRequest({ orderId: "order_changed01" }),
      "admin:order:paid",
      { orderId: "order_changed01" },
      mutate,
    );

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(conflict).toEqual({ error: "Idempotency conflict", status: 409 });
  });
});

function idempotentRequest(body: unknown) {
  return new Request("http://order.test/api/admin/order", {
    method: "PUT",
    headers: {
      origin: "http://order.test",
      "content-type": "application/json",
      "idempotency-key": "idem-test-key",
    },
    body: JSON.stringify(body),
  });
}
