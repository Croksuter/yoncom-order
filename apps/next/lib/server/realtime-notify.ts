import type { DomainEventRecord } from "~/lib/server/sync-events";

export async function notifyRealtime(events: DomainEventRecord[]) {
  const url = process.env.REALTIME_NOTIFY_URL;
  const secret = process.env.REALTIME_NOTIFY_SECRET;
  if (!url || !secret || events.length === 0) return;

  await Promise.all(events.map(async (event) => {
    await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: event.type,
        scope: event.scope,
        revision: event.revision,
        eventId: event.id,
      }),
      cache: "no-store",
    }).catch(() => null);
  }));
}
