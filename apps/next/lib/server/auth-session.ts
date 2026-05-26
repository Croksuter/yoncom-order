import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateId } from "lucia";
import { userRole, type User } from "db/schema";
import { executeD1, queryD1 } from "~/lib/server/db";

export const authCookieName = "yoncom_session";
export const csrfCookieName = "yoncom_csrf";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;
let userEnabledColumnEnsured = false;

export type PublicSessionUser = Pick<User, "id" | "name" | "email" | "role">;

export function isUserEnabled(user: { enabled?: boolean | number | null } | null | undefined) {
  const enabled = user?.enabled;
  return enabled === true || enabled === 1;
}

export function toPublicSessionUser(user: User): PublicSessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function ensureUserEnabledColumn() {
  if (userEnabledColumnEnsured) return;

  const columns = await queryD1<{ name: string }>('PRAGMA table_info("users")');
  if (!columns.some((column) => column.name === "enabled")) {
    try {
      await executeD1('ALTER TABLE "users" ADD "enabled" integer DEFAULT false NOT NULL');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("duplicate column")) {
        throw error;
      }
    }
  }

  userEnabledColumnEnsured = true;
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(authCookieName)?.value;

  if (!sessionId) {
    return null;
  }

  await ensureUserEnabledColumn();

  const [user] = await queryD1<User>(
    `SELECT u.*
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ? AND u.deletedAt IS NULL AND u.enabled = 1
     LIMIT 1`,
    [sessionId, Date.now()],
  );

  return user ?? null;
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

export async function authResponse(body: unknown, userId?: string) {
  const response = NextResponse.json(body);

  if (userId) {
    const sessionId = generateId(40);
    const csrfToken = generateId(40);
    const expiresAt = Date.now() + sessionMaxAgeSeconds * 1000;

    await executeD1(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
      [sessionId, userId, expiresAt],
    );

    response.cookies.set(authCookieName, sessionId, {
      httpOnly: true,
      maxAge: sessionMaxAgeSeconds,
      path: "/",
      sameSite: "lax",
    });
    response.cookies.set(csrfCookieName, csrfToken, {
      httpOnly: false,
      maxAge: sessionMaxAgeSeconds,
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}

export async function clearAuthResponse(body: unknown) {
  let cookieStore: Awaited<ReturnType<typeof cookies>> | null = null;
  try {
    cookieStore = await cookies();
  } catch {
    cookieStore = null;
  }
  const sessionId = cookieStore?.get(authCookieName)?.value;
  if (sessionId) {
    await executeD1("DELETE FROM sessions WHERE id = ?", [sessionId]);
  }

  const response = NextResponse.json(body);
  response.cookies.set(authCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });
  response.cookies.set(csrfCookieName, "", {
    httpOnly: false,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
