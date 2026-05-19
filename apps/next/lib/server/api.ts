import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export function ok<T>(result: T, status = 200) {
  return NextResponse.json({ result }, { status });
}

export function fail(error: string, status = 500) {
  return NextResponse.json({ error }, { status });
}

export function parseSearchParams<T>(request: Request, schema: ZodSchema<T>) {
  const url = new URL(request.url);
  const values = Object.fromEntries(url.searchParams.entries());
  return schema.parse(values);
}

export function routeError(error: unknown) {
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
