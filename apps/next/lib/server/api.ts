import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { csrfCookieName } from "~/lib/server/auth-session";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const maxJsonBodyBytes = 32 * 1024;
const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{8,128}$/;
const rateWindowMs = 60_000;
const rateMaxRequests = 120;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function ok<T>(result: T, status = 200) {
  return NextResponse.json({ result }, { status });
}

export function mutationOk<T extends {
  result?: unknown;
  status: number;
  mutationId?: string;
  revision?: number;
  affectedScopes?: string[];
}>(mutation: T) {
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
  return NextResponse.json({ error }, { status });
}

export function parseSearchParams<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
): z.infer<TSchema> {
  const url = new URL(request.url);
  const values = Object.fromEntries(url.searchParams.entries());
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
    rateLimitKey?: string;
  } = {},
) {
  if (!unsafeMethods.has(request.method)) {
    return null;
  }

  const rateError = applyRateLimit(request, options.rateLimitKey);
  if (rateError) return rateError;

  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  if (!origin || origin !== requestOrigin) {
    return fail("Origin required", 403);
  }

  if (options.json !== false) {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return fail("JSON body required", 415);
    }
  }

  if (options.csrf) {
    const csrfCookie = getRequestCookie(request, csrfCookieName);
    const csrfHeader = request.headers.get("x-csrf-token");
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return fail("CSRF token required", 403);
    }
  }

  if (options.idempotency) {
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || !idempotencyKeyPattern.test(idempotencyKey)) {
      return fail("Idempotency-Key required", 400);
    }
  }

  return null;
}

export function getIdempotencyKey(request: Request) {
  return request.headers.get("idempotency-key");
}

function applyRateLimit(request: Request, overrideKey?: string) {
  const key = overrideKey ?? request.headers.get("x-forwarded-for") ?? "local";
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + rateWindowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > rateMaxRequests) {
    return fail("Too many requests", 429);
  }

  return null;
}

export function routeError(error: unknown) {
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
