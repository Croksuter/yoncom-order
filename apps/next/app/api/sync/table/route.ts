import { z } from "zod";
import { fail, ok, parseSearchParams, routeError } from "~/lib/server/api";
import { getClientNoticeSettings, getPaymentSettings } from "~/lib/server/d1-mutations";
import { getDomainEventsAfter, getScopeRevision, tableScope } from "~/lib/server/sync-events";
import { requireTableSession } from "~/lib/server/table-session";
import { getAuthorizedClientTable } from "~/lib/server/table-queries";

const syncValidation = z.object({
  tableId: z.string().length(15),
  afterRevision: z.coerce.number().int().min(0).default(0),
}).strict();

export async function GET(request: Request) {
  try {
    const { tableId, afterRevision } = parseSearchParams(request, syncValidation);
    const tableSession = await requireTableSession(request, tableId);
    if (tableSession.response) return tableSession.response;

    const scope = tableScope(tableId);
    const revision = await getScopeRevision(scope);
    const events = await getDomainEventsAfter(scope, afterRevision);
    const hasGap = events.length > 0 && events[0].revision > afterRevision + 1;
    const settingsChanged = events.some((event) => (
      event.type === "paymentSettings.updated" ||
      event.type === "clientNoticeSettings.updated"
    ));
    const needsSnapshot = afterRevision === 0 || hasGap || settingsChanged;
    const table = needsSnapshot
      ? await getAuthorizedClientTable(tableId, tableSession.session.tableContextId)
      : null;

    if (needsSnapshot && !table) {
      return fail("Table Not Found", 404);
    }

    return ok({
      scope,
      revision,
      events,
      snapshot: needsSnapshot ? {
        table,
        paymentSettings: await getPaymentSettings(),
        clientNoticeSettings: await getClientNoticeSettings(),
      } : null,
      gap: hasGap,
    });
  } catch (error) {
    return routeError(error);
  }
}
