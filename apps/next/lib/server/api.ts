import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { csrfCookieName } from "~/lib/server/auth-session";
import { executeD1, queryD1 } from "~/lib/server/db";
import { getTraceHeaderName, summarizePath, traceEvent } from "~/lib/verification-trace";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const maxJsonBodyBytes = 32 * 1024;
const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{8,128}$/;
const rateWindowMs = 60_000;
const rateMaxRequests = 120;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export const authRouteRateLimit = { scope: "auth", maxRequests: 20, windowMs: rateWindowMs } as const;
export const tableSessionRouteRateLimit = { scope: "table-session", maxRequests: 30, windowMs: rateWindowMs } as const;

type RateLimitOptions = {
  key?: string;
  maxRequests?: number;
  scope?: string;
  windowMs?: number;
};

type IdempotencyRecord = {
  requestHash: string;
  status: string;
  resultJson: string | null;
  revision: number | null;
};

type MutationResult = {
  error?: string;
  status: number;
  result?: unknown;
  mutationId?: string;
  revision?: number;
  affectedScopes?: string[];
};

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function normalizeHeaderValue(value: string | null) {
  return value?.trim().replace(/^"|"$/g, "") || null;
}

function getForwardedHeaderValue(request: Request, key: "host" | "proto") {
  const forwarded = firstHeaderValue(request.headers.get("forwarded"));
  if (!forwarded) return null;

  const prefix = `${key}=`;
  const part = forwarded
    .split(";")
    .map((segment) => segment.trim())
    .find((segment) => segment.toLowerCase().startsWith(prefix));

  return normalizeHeaderValue(part?.slice(prefix.length) ?? null);
}

function getRequestAssociatedHosts(request: Request) {
  const requestUrl = new URL(request.url);
  return new Set(
    [
      requestUrl.host,
      firstHeaderValue(request.headers.get("host")),
      firstHeaderValue(request.headers.get("x-forwarded-host")),
      getForwardedHeaderValue(request, "host"),
    ].filter((host): host is string => !!host),
  );
}

function originFromParts(protocol: string | null, host: string | null) {
  const normalizedProtocol = normalizeHeaderValue(protocol)?.replace(/:$/, "");
  if (!host || (normalizedProtocol !== "http" && normalizedProtocol !== "https")) {
    return null;
  }

  try {
    return new URL(`${normalizedProtocol}://${host}`).origin;
  } catch {
    return null;
  }
}

function isSameRequestOrigin(request: Request, origin: string | null) {
  if (!origin) return false;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") {
    return false;
  }

  const requestUrl = new URL(request.url);
  const requestOrigin = requestUrl.origin;
  if (origin === requestOrigin) {
    return true;
  }

  const forwardedProto =
    firstHeaderValue(request.headers.get("x-forwarded-proto")) ?? getForwardedHeaderValue(request, "proto");
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host")) ?? getForwardedHeaderValue(request, "host");
  const forwardedOrigin = originFromParts(forwardedProto, forwardedHost);
  if (forwardedOrigin && origin === forwardedOrigin) {
    return true;
  }

  return getRequestAssociatedHosts(request).has(originUrl.host);
}

export function ok<T>(result: T, status = 200) {
  traceEvent("server", "api.response.ok", { status });
  return NextResponse.json({ result }, { status });
}

export function mutationOk<T extends {
  result?: unknown;
  status: number;
  mutationId?: string;
  revision?: number;
  affectedScopes?: string[];
}>(mutation: T) {
  traceEvent("server", "api.response.mutation", {
    status: mutation.status,
    mutationId: mutation.mutationId,
    revision: mutation.revision,
    affectedScopes: mutation.affectedScopes,
  });
  return NextResponse.json(
    {
      result: mutation.result,
      mutationId: mutation.mutationId,
      revision: mutation.revision,
      affectedScopes: mutation.affectedScopes,
    },
    { status: mutation.status },
  );
}

export function fail(error: string, status = 500) {
  traceEvent("server", "api.response.fail", { status, error });
  return NextResponse.json({ error }, { status });
}

export function parseSearchParams<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
): z.infer<TSchema> {
  const url = new URL(request.url);
  const values = Object.fromEntries(url.searchParams.entries());
  traceEvent("server", "api.request.search", {
    traceId: request.headers.get(getTraceHeaderName()),
    method: request.method,
    path: summarizePath(request.url),
    queryKeys: Object.keys(values).sort(),
  });
  return schema.parse(values);
}

export function getRequestCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const text = await request.text();
  traceEvent("server", "api.request.json", {
    traceId: request.headers.get(getTraceHeaderName()),
    method: request.method,
    path: summarizePath(request.url),
    bodyBytes: text.length,
  });
  if (text.length > maxJsonBodyBytes) {
    throw new ApiRequestError("Request body too large", 413);
  }

  const body = text ? JSON.parse(text) : null;
  return schema.parse(body);
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function guardUnsafeRequest(
  request: Request,
  options: {
    csrf?: boolean;
    idempotency?: boolean;
    json?: boolean;
    rateLimit?: RateLimitOptions;
    rateLimitKey?: string;
  } = {},
) {
  if (!unsafeMethods.has(request.method)) {
    return null;
  }

  const traceId = request.headers.get(getTraceHeaderName());
  const path = summarizePath(request.url);
  traceEvent("server", "api.guard.start", {
    traceId,
    method: request.method,
    path,
    requiresCsrf: !!options.csrf,
    requiresIdempotency: !!options.idempotency,
    requiresJson: options.json !== false,
  });

  const rateError = applyRateLimit(request, { ...options.rateLimit, key: options.rateLimit?.key ?? options.rateLimitKey });
  if (rateError) {
    traceEvent("server", "api.guard.block", { traceId, method: request.method, path, reason: "rate-limit" });
    return rateError;
  }

  const origin = request.headers.get("origin");
  if (!isSameRequestOrigin(request, origin)) {
    traceEvent("server", "api.guard.block", { traceId, method: request.method, path, reason: "origin" });
    return fail("Origin required", 403);
  }

  if (options.json !== false) {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      traceEvent("server", "api.guard.block", { traceId, method: request.method, path, reason: "content-type" });
      return fail("JSON body required", 415);
    }
  }

  if (options.csrf) {
    const csrfCookie = getRequestCookie(request, csrfCookieName);
    const csrfHeader = request.headers.get("x-csrf-token");
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      traceEvent("server", "api.guard.block", { traceId, method: request.method, path, reason: "csrf" });
      return fail("CSRF token required", 403);
    }
  }

  if (options.idempotency) {
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || !idempotencyKeyPattern.test(idempotencyKey)) {
      traceEvent("server", "api.guard.block", { traceId, method: request.method, path, reason: "idempotency-key" });
      return fail("Idempotency-Key required", 400);
    }
  }

  traceEvent("server", "api.guard.pass", {
    traceId,
    method: request.method,
    path,
    idempotencyKey: request.headers.get("idempotency-key"),
  });
  return null;
}

export function getIdempotencyKey(request: Request) {
  return request.headers.get("idempotency-key");
}

function getRateLimitClientKey(request: Request, overrideKey?: string) {
  return overrideKey
    ?? firstHeaderValue(request.headers.get("cf-connecting-ip"))
    ?? firstHeaderValue(request.headers.get("x-forwarded-for"))
    ?? "local";
}

function applyRateLimit(request: Request, options: RateLimitOptions = {}) {
  const scope = options.scope ?? "default";
  const key = `${scope}:${getRateLimitClientKey(request, options.key)}`;
  const now = Date.now();
  const windowMs = options.windowMs ?? rateWindowMs;
  const maxRequests = options.maxRequests ?? rateMaxRequests;
  const bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > maxRequests) {
    return fail("Too many requests", 429);
  }

  return null;
}

export async function runIdempotentMutation<TMutation extends MutationResult>(
  request: Request,
  actorScope: string,
  requestBody: unknown,
  mutate: () => Promise<TMutation>,
): Promise<TMutation> {
  const idempotencyKey = getIdempotencyKey(request);
  if (!idempotencyKey) {
    return mutate();
  }

  const requestHash = hashIdempotencyRequest(requestBody);
  const inserted = await insertIdempotencyRequest(actorScope, idempotencyKey, requestHash);
  if (!inserted) {
    const existing = await getIdempotencyRecord(actorScope, idempotencyKey);
    if (!existing) {
      return { error: "Idempotency conflict", status: 409 } as TMutation;
    }
    if (existing.requestHash !== requestHash) {
      return { error: "Idempotency conflict", status: 409 } as TMutation;
    }
    if (existing.status === "SUCCEEDED" && existing.resultJson) {
      return JSON.parse(existing.resultJson) as TMutation;
    }
    return { error: "Idempotency request in progress", status: 409 } as TMutation;
  }

  try {
    const result = await mutate();
    if (result.error || result.status < 200 || result.status >= 300) {
      await deleteIdempotencyRequest(actorScope, idempotencyKey);
      return result;
    }

    await executeD1(
      `UPDATE mutationRequests
       SET status = ?, resultJson = ?, revision = ?, updatedAt = ?
       WHERE actorScope = ? AND idempotencyKey = ?`,
      [
        "SUCCEEDED",
        JSON.stringify(result),
        result.revision ?? null,
        Date.now(),
        actorScope,
        idempotencyKey,
      ],
    );
    return result;
  } catch (error) {
    await deleteIdempotencyRequest(actorScope, idempotencyKey).catch(() => null);
    throw error;
  }
}

export async function idempotentMutationResponse<TMutation extends MutationResult>(
  request: Request,
  actorScope: string,
  requestBody: unknown,
  mutate: () => Promise<TMutation>,
) {
  const result = await runIdempotentMutation(request, actorScope, requestBody, mutate);
  if (result.error) {
    return fail(result.error, result.status);
  }
  return mutationOk(result);
}

function hashIdempotencyRequest(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForStableStringify(value));
}

function normalizeForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForStableStringify);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, normalizeForStableStringify(entryValue)]),
    );
  }
  return value;
}

async function insertIdempotencyRequest(actorScope: string, idempotencyKey: string, requestHash: string) {
  const now = Date.now();
  try {
    await executeD1(
      `INSERT INTO mutationRequests
        (id, actorScope, idempotencyKey, requestHash, status, resultJson, revision, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      [randomUUID(), actorScope, idempotencyKey, requestHash, "IN_PROGRESS", now, now],
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes("unique") || message.includes("constraint")) {
      return false;
    }
    throw error;
  }
}

async function getIdempotencyRecord(actorScope: string, idempotencyKey: string) {
  const [record] = await queryD1<IdempotencyRecord>(
    `SELECT requestHash, status, resultJson, revision
     FROM mutationRequests
     WHERE actorScope = ? AND idempotencyKey = ?
     LIMIT 1`,
    [actorScope, idempotencyKey],
  );
  return record ?? null;
}

async function deleteIdempotencyRequest(actorScope: string, idempotencyKey: string) {
  await executeD1("DELETE FROM mutationRequests WHERE actorScope = ? AND idempotencyKey = ?", [
    actorScope,
    idempotencyKey,
  ]);
}

export function routeError(error: unknown) {
  const errorName = error instanceof Error ? error.name : "Unknown";
  const message = error instanceof Error ? error.message : "Unknown route handler error";
  traceEvent("server", "api.route.error", {
    errorName,
    message: message
      .replace(/accounts\/[^/]+/g, "accounts/[redacted]")
      .replace(/database\/[^/]+/g, "database/[redacted]"),
  });

  if (error instanceof ApiRequestError) {
    return fail(error.message, error.status);
  }

  if (error instanceof ZodError) {
    return fail("Invalid request", 400);
  }

  if (
    error instanceof Error &&
    (error.message.includes("Cloudflare D1 environment variables") ||
      error.message.includes("Cloudflare D1 configuration"))
  ) {
    return fail("NEXT_DB_NOT_CONFIGURED", 503);
  }

  if (error instanceof Error) {
    console.error(
      error.message
        .replace(/accounts\/[^/]+/g, "accounts/[redacted]")
        .replace(/database\/[^/]+/g, "database/[redacted]"),
    );
  } else {
    console.error("Unknown route handler error");
  }

  return fail("DB Query Error", 500);
}
