import { beforeEach, describe, expect, it, vi } from "vitest";

function guardedPost(url: string, body?: unknown, headers: HeadersInit = {}) {
  return new Request(url, {
    method: "POST",
    headers: {
      origin: "http://order.test",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("implemented auth route handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/auth/sign-in rejects unknown users", async () => {
    const findFirst = vi.fn(async () => null);
    vi.doMock("~/lib/server/db", () => ({
      getDb: () => ({
        query: {
          users: {
            findFirst,
          },
        },
      }),
    }));

    const { POST } = await import("~/app/api/auth/sign-in/route");
    const response = await POST(guardedPost(
      "http://order.test/api/auth/sign-in",
      {
        email: "missing@example.com",
        password: "demo-admin-1234",
      },
    ));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid credentials" });
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("POST /api/auth/sign-up rejects duplicate users", async () => {
    const findFirst = vi.fn(async () => ({
      id: "demo_user_admin",
      email: "demo.admin@yoncom.local",
    }));
    vi.doMock("~/lib/server/db", () => ({
      getDb: () => ({
        query: {
          users: {
            findFirst,
          },
        },
      }),
    }));

    const { POST } = await import("~/app/api/auth/sign-up/route");
    const response = await POST(guardedPost(
      "http://order.test/api/auth/sign-up",
      {
        name: "Demo Admin",
        email: "demo.admin@yoncom.local",
        password: "demo-admin-1234",
      },
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "User with that email already exists." });
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("POST /api/auth/sign-out clears the local auth cookie", async () => {
    const { POST } = await import("~/app/api/auth/sign-out/route");
    const response = await POST(guardedPost("http://order.test/api/auth/sign-out", undefined, {
      cookie: "yoncom_csrf=csrf-token",
      "x-csrf-token": "csrf-token",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result: "Success" });
    expect(response.headers.getSetCookie().join("\n")).toContain("yoncom_session=");
  });
});
