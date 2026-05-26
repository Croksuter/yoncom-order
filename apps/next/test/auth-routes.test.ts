import { beforeEach, describe, expect, it, vi } from "vitest";
import { Scrypt } from "lucia";

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
    vi.doUnmock("~/lib/server/auth-session");
    vi.doUnmock("~/lib/server/db");
    vi.doUnmock("next/headers");
  });

  it("POST /api/auth/sign-in rejects unknown users", async () => {
    const findFirst = vi.fn(async () => null);
    vi.doMock("~/lib/server/db", () => ({
      executeD1: vi.fn(),
      queryD1: vi.fn(async () => [{ name: "enabled" }]),
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

  it("POST /api/auth/sign-in returns 429 after the configured auth limit", async () => {
    const findFirst = vi.fn(async () => null);
    vi.doMock("~/lib/server/db", () => ({
      executeD1: vi.fn(),
      queryD1: vi.fn(async () => [{ name: "enabled" }]),
      getDb: () => ({
        query: {
          users: {
            findFirst,
          },
        },
      }),
    }));

    const { POST } = await import("~/app/api/auth/sign-in/route");
    let response: Response | null = null;
    for (let attempt = 0; attempt < 21; attempt += 1) {
      response = await POST(guardedPost(
        "http://order.test/api/auth/sign-in",
        {
          email: "missing@example.com",
          password: "demo-admin-1234",
        },
        {
          "cf-connecting-ip": "203.0.113.20",
          "x-forwarded-for": `198.51.100.${attempt}`,
        },
      ));
    }

    expect(response?.status).toBe(429);
    await expect(response?.json()).resolves.toEqual({ error: "Too many requests" });
    expect(findFirst).toHaveBeenCalledTimes(20);
  });

  it("POST /api/auth/sign-in rejects disabled admin users without revealing activation state", async () => {
    const password = "demo-admin-1234";
    const executeD1 = vi.fn();
    const findFirst = vi.fn(async () => ({
      id: "demo_user_admin",
      email: "demo.admin@yoncom.local",
      password: await new Scrypt().hash(password),
      role: "ADMIN",
      enabled: false,
      deletedAt: null,
    }));
    vi.doMock("~/lib/server/db", () => ({
      executeD1,
      queryD1: vi.fn(async () => [{ name: "enabled" }]),
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
        email: "demo.admin@yoncom.local",
        password,
      },
    ));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid credentials" });
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(executeD1).not.toHaveBeenCalled();
  });

  it("POST /api/auth/sign-in allows enabled admin users and creates a session", async () => {
    const password = "demo-admin-1234";
    const executeD1 = vi.fn(async () => undefined);
    const findFirst = vi.fn(async () => ({
      id: "demo_user_admin",
      email: "demo.admin@yoncom.local",
      password: await new Scrypt().hash(password),
      role: "ADMIN",
      enabled: true,
      deletedAt: null,
    }));
    vi.doMock("~/lib/server/db", () => ({
      executeD1,
      queryD1: vi.fn(async () => [{ name: "enabled" }]),
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
        email: "demo.admin@yoncom.local",
        password,
      },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result: "Success" });
    expect(executeD1).toHaveBeenCalledWith(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
      expect.arrayContaining(["demo_user_admin"]),
    );
    expect(response.headers.getSetCookie().join("\n")).toContain("yoncom_session=");
  });

  it("POST /api/auth/sign-up rejects duplicate users", async () => {
    const findFirst = vi.fn(async () => ({
      id: "demo_user_admin",
      email: "demo.admin@yoncom.local",
    }));
    vi.doMock("~/lib/server/db", () => ({
      executeD1: vi.fn(),
      queryD1: vi.fn(async () => [{ name: "enabled" }]),
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

  it("POST /api/auth/sign-up returns 429 after the configured auth limit", async () => {
    const findFirst = vi.fn(async () => ({
      id: "demo_user_admin",
      email: "demo.admin@yoncom.local",
    }));
    vi.doMock("~/lib/server/db", () => ({
      executeD1: vi.fn(),
      queryD1: vi.fn(async () => [{ name: "enabled" }]),
      getDb: () => ({
        query: {
          users: {
            findFirst,
          },
        },
      }),
    }));

    const { POST } = await import("~/app/api/auth/sign-up/route");
    let response: Response | null = null;
    for (let attempt = 0; attempt < 21; attempt += 1) {
      response = await POST(guardedPost(
        "http://order.test/api/auth/sign-up",
        {
          name: "Demo Admin",
          email: "demo.admin@yoncom.local",
          password: "demo-admin-1234",
        },
        {
          "cf-connecting-ip": "203.0.113.21",
          "x-forwarded-for": `198.51.100.${attempt}`,
        },
      ));
    }

    expect(response?.status).toBe(429);
    await expect(response?.json()).resolves.toEqual({ error: "Too many requests" });
    expect(findFirst).toHaveBeenCalledTimes(20);
  });

  it("POST /api/auth/sign-up creates disabled admin candidates", async () => {
    const findFirst = vi.fn(async () => null);
    const values = vi.fn(async () => undefined);
    const insert = vi.fn(() => ({ values }));
    vi.doMock("~/lib/server/db", () => ({
      executeD1: vi.fn(),
      queryD1: vi.fn(async () => [{ name: "enabled" }]),
      getDb: () => ({
        query: {
          users: {
            findFirst,
          },
        },
        insert,
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

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result: "Success" });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      name: "Demo Admin",
      email: "demo.admin@yoncom.local",
      role: "ADMIN",
      enabled: false,
    }));
    expect(values.mock.calls[0][0].password).not.toBe("demo-admin-1234");
  });

  it("GET /api/auth/session returns only the public session profile", async () => {
    vi.doMock("~/lib/server/auth-session", async () => {
      const actual = await vi.importActual<typeof import("~/lib/server/auth-session")>("~/lib/server/auth-session");
      return {
        ...actual,
        getSessionUser: vi.fn(async () => ({
          id: "demo_user_admin",
          name: "Demo Admin",
          email: "demo.admin@yoncom.local",
          role: "ADMIN",
          enabled: true,
          password: "hashed-password",
          deletedAt: null,
          createdAt: 1,
          updatedAt: 1,
        })),
      };
    });

    const { GET } = await import("~/app/api/auth/session/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      result: "Success",
      user: {
        id: "demo_user_admin",
        name: "Demo Admin",
        email: "demo.admin@yoncom.local",
        role: "ADMIN",
      },
    });
    expect(body.user).not.toHaveProperty("enabled");
    expect(body.user).not.toHaveProperty("password");
    expect(body.user).not.toHaveProperty("deletedAt");
  });

  it("getSessionUser requires enabled users at the D1 session boundary", async () => {
    const queryD1 = vi.fn(async (sql: string) => (
      sql.includes("PRAGMA table_info") ? [{ name: "enabled" }] : []
    ));
    vi.doMock("next/headers", () => ({
      cookies: vi.fn(async () => ({
        get: vi.fn(() => ({ value: "session_active" })),
      })),
    }));
    vi.doMock("~/lib/server/db", () => ({
      executeD1: vi.fn(),
      queryD1,
    }));

    const { getSessionUser } = await import("~/lib/server/auth-session");
    await expect(getSessionUser()).resolves.toBeNull();

    expect(queryD1).toHaveBeenCalledTimes(2);
    expect(queryD1.mock.calls[1][0]).toContain("u.enabled = 1");
  });

  it("ensureUserEnabledColumn adds the gated-login column when D1 has not migrated yet", async () => {
    const executeD1 = vi.fn(async () => undefined);
    const queryD1 = vi.fn(async () => []);
    vi.doMock("~/lib/server/db", () => ({
      executeD1,
      queryD1,
    }));

    const { ensureUserEnabledColumn } = await import("~/lib/server/auth-session");
    await ensureUserEnabledColumn();

    expect(queryD1).toHaveBeenCalledWith('PRAGMA table_info("users")');
    expect(executeD1).toHaveBeenCalledWith('ALTER TABLE "users" ADD "enabled" integer DEFAULT false NOT NULL');
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
