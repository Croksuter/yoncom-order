import { generateId } from "lucia";
import { executeD1, queryD1 } from "~/lib/server/db";
import { notifyRealtime } from "~/lib/server/realtime-notify";
import { traceEvent } from "~/lib/verification-trace";

export const venueScope = "venue:default";

export function tableScope(tableId: string) {
  return `table:${tableId}`;
}

export type DomainEventRecord = {
  id: string;
  scope: string;
  revision: number;
  type: string;
  entityType: string | null;
  entityId: string | null;
  payloadJson: string | null;
  mutationId: string | null;
  createdAt: number;
};

export async function appendDomainEvent({
  scopes,
  type,
  entityType = null,
  entityId = null,
  payload = null,
  mutationId = null,
}: {
  scopes: string[];
  type: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: unknown;
  mutationId?: string | null;
}) {
  const events: DomainEventRecord[] = [];
  const createdAt = Date.now();
  const uniqueScopes = [...new Set(scopes)];
  traceEvent("server", "domain.event.append.start", {
    type,
    scopes: uniqueScopes,
    entityType,
    entityId,
    mutationId,
  });

  for (const scope of uniqueScopes) {
    const [revisionRow] = await queryD1<{ revision: number }>(
      `INSERT INTO scopeRevisions (scope, revision, updatedAt)
       VALUES (?, 1, ?)
       ON CONFLICT(scope) DO UPDATE SET revision = revision + 1, updatedAt = excluded.updatedAt
       RETURNING revision`,
      [scope, createdAt],
    );
    const revision = Number(revisionRow?.revision ?? 1);
    const event: DomainEventRecord = {
      id: generateId(15),
      scope,
      revision,
      type,
      entityType,
      entityId,
      payloadJson: payload == null ? null : JSON.stringify(payload),
      mutationId,
      createdAt,
    };

    await executeD1(
      `INSERT INTO domainEvents
        (id, scope, revision, type, entityType, entityId, payloadJson, mutationId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.scope,
        event.revision,
        event.type,
        event.entityType,
        event.entityId,
        event.payloadJson,
        event.mutationId,
        event.createdAt,
      ],
    );
    events.push(event);
    traceEvent("server", "domain.event.appended", {
      eventId: event.id,
      type: event.type,
      scope: event.scope,
      revision: event.revision,
      mutationId: event.mutationId,
    });
  }

  await notifyRealtime(events);
  traceEvent("server", "domain.event.append.end", {
    type,
    eventIds: events.map((event) => event.id),
    revisions: events.map((event) => ({ scope: event.scope, revision: event.revision })),
  });
  return events;
}

export async function getScopeRevision(scope: string) {
  const [row] = await queryD1<{ revision: number }>(
    "SELECT revision FROM scopeRevisions WHERE scope = ? LIMIT 1",
    [scope],
  );
  return Number(row?.revision ?? 0);
}

export async function getDomainEventsAfter(scope: string, afterRevision: number, limit = 100) {
  return await queryD1<DomainEventRecord>(
    `SELECT *
     FROM domainEvents
     WHERE scope = ? AND revision > ?
     ORDER BY revision ASC
     LIMIT ?`,
    [scope, afterRevision, limit],
  );
}

export function eventPayload<T>(event: Pick<DomainEventRecord, "payloadJson">): T | null {
  if (!event.payloadJson) return null;
  return JSON.parse(event.payloadJson) as T;
}
