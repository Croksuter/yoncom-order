import type { DomainEventRecord } from "~/lib/server/sync-events";
import { traceDurationMs, traceEvent } from "~/lib/verification-trace";

export async function notifyRealtime(events: DomainEventRecord[]) {
  const url = process.env.REALTIME_NOTIFY_URL;
  const secret = process.env.REALTIME_NOTIFY_SECRET;
  if (!url || !secret || events.length === 0) {
    traceEvent("server", "realtime.notify.skip", {
      hasUrl: !!url,
      hasSecret: !!secret,
      eventCount: events.length,
    });
    return;
  }

  await Promise.all(events.map(async (event) => {
    const startedAt = Date.now();
    traceEvent("server", "realtime.notify.start", {
      eventId: event.id,
      scope: event.scope,
      revision: event.revision,
      type: event.type,
    });
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
    }).then((response) => {
      traceEvent("server", "realtime.notify.end", {
        eventId: event.id,
        status: response.status,
        durationMs: traceDurationMs(startedAt),
      });
    }).catch((error) => {
      traceEvent("server", "realtime.notify.error", {
        eventId: event.id,
        durationMs: traceDurationMs(startedAt),
        message: error instanceof Error ? error.message : "unknown",
      });
    });
  }));
}
