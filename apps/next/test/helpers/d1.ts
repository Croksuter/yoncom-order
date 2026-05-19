import { vi } from "vitest";

export type D1Request = {
  url: string;
  method: string;
  authorization: string | null;
  sql: string;
  params: unknown[];
};

export function d1Success(results: unknown[], meta: Record<string, unknown> = { duration: 1 }) {
  return Response.json({
    success: true,
    errors: [],
    result: [
      {
        success: true,
        results,
        meta,
      },
    ],
  });
}

export function d1Failure(message: string, status = 200) {
  return Response.json(
    {
      success: status < 400,
      errors: status >= 400 ? [{ message }] : [],
      result: [
        {
          success: false,
          error: message,
          results: [],
          meta: { duration: 1 },
        },
      ],
    },
    { status },
  );
}

export function installD1FetchMock(
  resolver: (request: D1Request) => Response | Promise<Response>,
) {
  const requests: D1Request[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      sql?: string;
      params?: unknown[];
    };
    const request = {
      url,
      method: init?.method ?? "GET",
      authorization: headers.get("authorization"),
      sql: body.sql ?? "",
      params: body.params ?? [],
    };
    requests.push(request);
    return resolver(request);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, requests };
}

export function stubCloudflareEnv() {
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account_123");
  vi.stubEnv("CLOUDFLARE_DATABASE_ID", "database_456");
  vi.stubEnv("CLOUDFLARE_D1_TOKEN", "token_789");
}
