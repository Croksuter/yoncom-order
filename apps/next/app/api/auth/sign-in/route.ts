import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { Scrypt } from "lucia";
import { userRole, users } from "db/schema";
import { signInValidation } from "shared/types/requests/client/auth";
import { authResponse, ensureUserEnabledColumn, isUserEnabled } from "~/lib/server/auth-session";
import { getDb } from "~/lib/server/db";
import { authRouteRateLimit, guardUnsafeRequest, parseJsonBody, routeError } from "~/lib/server/api";

export async function POST(request: Request) {
  const guardError = guardUnsafeRequest(request, { csrf: false, idempotency: false, rateLimit: authRouteRateLimit });
  if (guardError) return guardError;

  try {
    const { email, password } = await parseJsonBody(request, signInValidation);
    await ensureUserEnabledColumn();

    const user = await getDb().query.users.findFirst({
      where: and(eq(users.email, email), isNull(users.deletedAt)),
    });

    if (
      !user ||
      user.role !== userRole.ADMIN ||
      !isUserEnabled(user) ||
      !(await new Scrypt().verify(user.password, password))
    ) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return await authResponse({ result: "Success" }, user.id);
  } catch (error) {
    return routeError(error);
  }
}
