import { generateId } from "lucia";
import { NextResponse } from "next/server";
import { csrfCookieName } from "~/lib/server/auth-session";
import { fail, getRequestCookie } from "~/lib/server/api";
import { executeD1, queryD1 } from "~/lib/server/db";

export const tableSessionCookieName = "yoncom_table_session";
const tableSessionMaxAgeSeconds = 60 * 60 * 12;

type ActiveTableContext = {
  tableId: string;
  tableContextId: string;
};

type TableSessionRow = {
  id: string;
  tableId: string;
  tableContextId: string;
  csrfToken: string;
  expiresAt: number;
  revokedAt: number | null;
};

export async function issueTableSession(tableId: string) {
  const [context] = await queryD1<ActiveTableContext>(
    `SELECT t.id AS tableId, tc.id AS tableContextId
     FROM tables t
     INNER JOIN tableContexts tc ON tc.tableId = t.id
     WHERE t.id = ? AND t.deletedAt IS NULL AND tc.deletedAt IS NULL
     ORDER BY tc.createdAt DESC
     LIMIT 1`,
    [tableId],
  );

  if (!context) {
    return { error: "Active table session not available", status: 409 as const };
  }

  const now = Date.now();
  const sessionId = generateId(40);
  const csrfToken = generateId(40);
  await executeD1(
    `INSERT INTO tableSessions
      (id, tableId, tableContextId, csrfToken, expiresAt, revokedAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      sessionId,
      context.tableId,
      context.tableContextId,
      csrfToken,
      now + tableSessionMaxAgeSeconds * 1000,
      now,
      now,
    ],
  );

  const response = NextResponse.json({
    result: {
      tableId: context.tableId,
      tableContextId: context.tableContextId,
      expiresAt: now + tableSessionMaxAgeSeconds * 1000,
    },
  });
  response.cookies.set(tableSessionCookieName, sessionId, {
    httpOnly: true,
    maxAge: tableSessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
  });
  response.cookies.set(csrfCookieName, csrfToken, {
    httpOnly: false,
    maxAge: tableSessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
  });

  return { response };
}

export async function requireTableSession(request: Request, tableId: string) {
  const sessionId = getRequestCookie(request, tableSessionCookieName);
  if (!sessionId) {
    return {
      session: null,
      response: fail("Table session required", 401),
    };
  }

  const [session] = await queryD1<TableSessionRow>(
    `SELECT *
     FROM tableSessions
     WHERE id = ? AND tableId = ? AND revokedAt IS NULL AND expiresAt > ?
     LIMIT 1`,
    [sessionId, tableId, Date.now()],
  );

  if (!session) {
    return {
      session: null,
      response: fail("Invalid table session", 403),
    };
  }

  return { session, response: null };
}

export async function requireTableSessionForOrder(request: Request, orderId: string) {
  const [row] = await queryD1<{ tableId: string }>(
    `SELECT tc.tableId
     FROM orders o
     INNER JOIN tableContexts tc ON tc.id = o.tableContextId
     WHERE o.id = ?
     LIMIT 1`,
    [orderId],
  );

  if (!row?.tableId) {
    return {
      session: null,
      response: fail("Order Not Found", 404),
    };
  }

  return await requireTableSession(request, row.tableId);
}

export async function revokeTableSessions(tableId: string, tableContextId?: string | null) {
  const now = Date.now();
  if (tableContextId) {
    await executeD1(
      "UPDATE tableSessions SET revokedAt = ?, updatedAt = ? WHERE tableId = ? AND tableContextId = ? AND revokedAt IS NULL",
      [now, now, tableId, tableContextId],
    );
    return;
  }

  await executeD1(
    "UPDATE tableSessions SET revokedAt = ?, updatedAt = ? WHERE tableId = ? AND revokedAt IS NULL",
    [now, now, tableId],
  );
}
