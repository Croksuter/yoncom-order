import { vi } from "vitest";

export type D1Request = {
  url: string;
  method: string;
  authorization: string | null;
  sql: string;
  params: unknown[];
  batch?: Array<{ sql: string; params: unknown[] }>;
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
  const mutationRequests = new Map<string, {
    requestHash: string;
    status: string;
    resultJson: string | null;
    revision: number | null;
  }>();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      sql?: string;
      params?: unknown[];
      batch?: Array<{ sql: string; params: unknown[] }>;
    };
    const request = {
      url,
      method: init?.method ?? "GET",
      authorization: headers.get("authorization"),
      sql: body.batch ? "" : body.sql ?? "",
      params: body.batch ? [] : body.params ?? [],
      ...(body.batch ? { batch: body.batch } : {}),
    };
    requests.push(request);
    const idempotencyResponse = handleMutationRequestSql(request, mutationRequests);
    if (idempotencyResponse) {
      return idempotencyResponse;
    }
    return resolver(request);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, requests };
}

function handleMutationRequestSql(
  request: D1Request,
  mutationRequests: Map<string, {
    requestHash: string;
    status: string;
    resultJson: string | null;
    revision: number | null;
  }>,
) {
  if (request.sql.startsWith("INSERT INTO mutationRequests")) {
    const key = `${request.params[1]}:${request.params[2]}`;
    if (mutationRequests.has(key)) {
      return d1Failure("UNIQUE constraint failed: mutationRequests.actorScope, mutationRequests.idempotencyKey");
    }
    mutationRequests.set(key, {
      requestHash: String(request.params[3]),
      status: String(request.params[4]),
      resultJson: null,
      revision: null,
    });
    return d1Success([], { duration: 1, changes: 1 });
  }

  if (request.sql.startsWith("SELECT requestHash, status, resultJson, revision")) {
    const key = `${request.params[0]}:${request.params[1]}`;
    const record = mutationRequests.get(key);
    return d1Success(record ? [record] : []);
  }

  if (request.sql.startsWith("UPDATE mutationRequests")) {
    const updateKey = `${request.params[4]}:${request.params[5]}`;
    const record = mutationRequests.get(updateKey);
    if (record) {
      mutationRequests.set(updateKey, {
        requestHash: record.requestHash,
        status: String(request.params[0]),
        resultJson: request.params[1] === null ? null : String(request.params[1]),
        revision: request.params[2] === null ? null : Number(request.params[2]),
      });
    }
    return d1Success([], { duration: 1, changes: record ? 1 : 0 });
  }

  if (request.sql.startsWith("DELETE FROM mutationRequests")) {
    const key = `${request.params[0]}:${request.params[1]}`;
    mutationRequests.delete(key);
    return d1Success([], { duration: 1, changes: 1 });
  }

  return null;
}

export function stubCloudflareEnv() {
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account_123");
  vi.stubEnv("CLOUDFLARE_DATABASE_ID", "database_456");
  vi.stubEnv("CLOUDFLARE_D1_TOKEN", "token_789");
}
