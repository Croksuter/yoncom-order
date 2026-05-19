import { beforeEach, describe, expect, it, vi } from "vitest";

describe("client queryStore network calls", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://order.test/api");
    vi.doMock("~/lib/ky-error-handler", () => ({
      default: vi.fn(),
    }));
  });

  it("sends GET requests with query params and reports loading/success states", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      expect(request.method).toBe("GET");
      expect(request.url).toBe("http://order.test/api/table?tableId=abc123456789012");
      expect(request.credentials).toBe("include");
      return Response.json({ result: { id: "abc123456789012" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: queryStore } = await import("~/lib/query");
    const setter = vi.fn();
    const onSuccess = vi.fn();

    const result = await queryStore({
      route: "table",
      method: "get",
      query: { tableId: "abc123456789012" },
      setter,
      onSuccess,
    });

    expect(result).toEqual({ result: { id: "abc123456789012" } });
    expect(onSuccess).toHaveBeenCalledWith({ result: { id: "abc123456789012" } });
    expect(setter).toHaveBeenNthCalledWith(1, { isLoaded: false, error: false });
    expect(setter).toHaveBeenNthCalledWith(2, { isLoaded: true, error: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends JSON mutation bodies for POST requests", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      expect(request.method).toBe("POST");
      expect(request.url).toBe("http://order.test/api/auth/sign-in");
      expect(request.headers.get("content-type")).toContain("application/json");
      expect(await request.json()).toEqual({
        email: "owner@example.com",
        password: "secret",
      });
      return Response.json({ result: "signed in" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: queryStore } = await import("~/lib/query");

    const result = await queryStore({
      route: "auth/sign-in",
      method: "post",
      query: { email: "owner@example.com", password: "secret" },
    });

    expect(result).toEqual({ result: "signed in" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("routes failed API responses through the error handler and returns null", async () => {
    const errorHandler = vi.fn();
    vi.doMock("~/lib/ky-error-handler", () => ({
      default: errorHandler,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        expect(request.method).toBe("POST");
        expect(request.url).toBe("http://order.test/api/order");
        await request.text();
        return Response.json({ error: "Invalid request" }, { status: 400 });
      }),
    );

    const { default: queryStore } = await import("~/lib/query");
    const setter = vi.fn();
    const onError = vi.fn();

    const result = await queryStore({
      route: "order",
      method: "post",
      query: { tableId: "abc123456789012", menuOrders: [] },
      setter,
      onError,
    });

    expect(result).toBeNull();
    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenLastCalledWith({ isLoaded: false, error: true });
  });
});
