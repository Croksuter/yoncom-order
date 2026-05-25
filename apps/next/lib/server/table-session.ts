import { generateId } from "lucia";
import { type NextResponse } from "next/server";
import { csrfCookieName } from "~/lib/server/auth-session";
import { fail, getRequestCookie } from "~/lib/server/api";
import { executeD1, queryD1 } from "~/lib/server/db";

export const tableSessionCookieName = "yoncom_table_session";
const tableSessionMaxAgeSeconds = 60 * 60 * 12;

type TableRow = {
  id: string;
  key: number;
  name: string;
  seats: number;
  createdAt: number | string;
  updatedAt: number | string;
  deletedAt: number | string | null;
};

type ActiveTableContext = {
  tableId: string;
  tableContextId: string;
};

export type TableSessionRow = {
  id: string;
  tableId: string;
  tableContextId: string;
  csrfToken: string;
  expiresAt: number;
  revokedAt: number | null;
};

export type IssuedTableSession = {
  tableId: string;
  tableContextId: string;
  expiresAt: number;
  sessionId: string;
  csrfToken: string;
};

async function getActiveTableContext(tableId: string) {
  const [context] = await queryD1<ActiveTableContext>(
    `SELECT tableId, id AS tableContextId
     FROM tableContexts
     WHERE tableId = ? AND deletedAt IS NULL
     ORDER BY createdAt DESC
     LIMIT 1`,
    [tableId],
  );

  return context ?? null;
}

async function getTable(tableId: string) {
  const [table] = await queryD1<TableRow>(
    "SELECT * FROM tables WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [tableId],
  );
  return table ?? null;
}

export async function getValidTableSession(request: Request, tableId: string) {
  const sessionId = getRequestCookie(request, tableSessionCookieName);
  if (!sessionId) {
    return null;
  }

  const [session] = await queryD1<TableSessionRow>(
    `SELECT ts.*
     FROM tableSessions ts
     INNER JOIN tableContexts tc ON tc.id = ts.tableContextId AND tc.deletedAt IS NULL
     WHERE ts.id = ? AND ts.tableId = ? AND ts.revokedAt IS NULL AND ts.expiresAt > ?
     LIMIT 1`,
    [sessionId, tableId, Date.now()],
  );

  return session ?? null;
}

export async function createTableSession(tableId: string, tableContextId: string): Promise<IssuedTableSession> {
  const timestamp = Date.now();
  const sessionId = generateId(40);
  const csrfToken = generateId(40);
  const expiresAt = timestamp + tableSessionMaxAgeSeconds * 1000;

  await executeD1(
    `INSERT INTO tableSessions
      (id, tableId, tableContextId, csrfToken, expiresAt, revokedAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
    [sessionId, tableId, tableContextId, csrfToken, expiresAt, timestamp, timestamp],
  );

  return { tableId, tableContextId, expiresAt, sessionId, csrfToken };
}

export function attachTableSessionCookies(response: NextResponse, session: IssuedTableSession) {
  response.cookies.set(tableSessionCookieName, session.sessionId, {
    httpOnly: true,
    maxAge: tableSessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
  });
  response.cookies.set(csrfCookieName, session.csrfToken, {
    httpOnly: false,
    maxAge: tableSessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
  });
  return response;
}

export async function resolveTableSessionAccess(request: Request, tableId: string) {
  const table = await getTable(tableId);
  if (!table) {
    return { response: fail("Table Not Found", 404) };
  }

  const session = await getValidTableSession(request, tableId);
  if (session) {
    return {
      response: Response.json({
        result: {
          state: "RESUMED" as const,
          table: {
            id: table.id,
            key: table.key,
            name: table.name,
            seats: table.seats,
            createdAt: Number(table.createdAt),
            updatedAt: Number(table.updatedAt),
            deletedAt: table.deletedAt === null ? null : Number(table.deletedAt),
          },
          tableId: session.tableId,
          tableContextId: session.tableContextId,
          expiresAt: session.expiresAt,
        },
      }),
      session,
    };
  }

  const context = await getActiveTableContext(tableId);
  if (!context) {
    return {
      response: Response.json({
        result: {
          state: "INACTIVE" as const,
          table: {
            id: table.id,
            key: table.key,
            name: table.name,
            seats: table.seats,
            createdAt: Number(table.createdAt),
            updatedAt: Number(table.updatedAt),
            deletedAt: table.deletedAt === null ? null : Number(table.deletedAt),
          },
          tableId: table.id,
          tableContextId: null,
          expiresAt: null,
        },
      }),
    };
  }

  return { response: fail("Table already in use", 403) };
}

export async function requireTableSession(request: Request, tableId: string) {
  const session = await getValidTableSession(request, tableId);
  if (!session) {
    return {
      session: null,
      response: fail("Table session required", 401),
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
