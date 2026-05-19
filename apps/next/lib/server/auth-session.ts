import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { userRole, users } from "db/schema";
import { getDb } from "~/lib/server/db";

const authCookieName = "yoncom_session";

export async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(authCookieName)?.value;

  if (!userId) {
    return null;
  }

  return await getDb().query.users.findFirst({
    where: eq(users.id, userId),
  }) ?? null;
}

export async function requireAdmin() {
  const result = await requireAdminUser();
  return result.response;
}

export async function requireAdminUser() {
  const user = await getSessionUser();

  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (user.role !== userRole.ADMIN) {
    return { user: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, response: null };
}

export function authResponse(body: unknown, userId?: string) {
  const response = NextResponse.json(body);

  if (userId) {
    response.cookies.set(authCookieName, userId, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}

export function clearAuthResponse(body: unknown) {
  const response = NextResponse.json(body);
  response.cookies.set(authCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
