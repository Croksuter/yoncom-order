import { ok, parseSearchParams, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { getPaymentSettings, getPendingBankTransactions } from "~/lib/server/d1-mutations";
import { getDb } from "~/lib/server/db";
import { getDomainEventsAfter, getScopeRevision, venueScope } from "~/lib/server/sync-events";
import { getTablesWithRelations } from "~/lib/server/table-queries";
import { isNull } from "drizzle-orm";
import { menuCategories } from "db/schema";
import { z } from "zod";

const syncValidation = z.object({
  afterRevision: z.coerce.number().int().min(0).default(0),
}).strict();

export async function GET(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    const { afterRevision } = parseSearchParams(request, syncValidation);
    const revision = await getScopeRevision(venueScope);
    const events = await getDomainEventsAfter(venueScope, afterRevision);
    const hasGap = events.length > 0 && events[0].revision > afterRevision + 1;
    const settingsChanged = events.some((event) => event.type === "paymentSettings.updated");
    const needsSnapshot = afterRevision === 0 || hasGap || settingsChanged;

    return ok({
      scope: venueScope,
      revision,
      events,
      snapshot: needsSnapshot ? {
        tables: await getTablesWithRelations(),
        menuCategories: await getDb().query.menuCategories.findMany({
          where: isNull(menuCategories.deletedAt),
          with: {
            menus: true,
          },
        }),
        bankTransactions: (await getPendingBankTransactions()).result,
        paymentSettings: await getPaymentSettings(),
      } : null,
      gap: hasGap,
    });
  } catch (error) {
    return routeError(error);
  }
}
