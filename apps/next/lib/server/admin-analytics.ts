import { isNull } from "drizzle-orm";
import { bankTransactions, menuBundleItems, menuCategories } from "db/schema";
import { buildAdminAnalytics } from "~/lib/analytics";
import { enrichMenuCategoriesWithBundles } from "~/lib/server/d1-mutations";
import { getDb } from "~/lib/server/db";
import { getTablesWithRelations } from "~/lib/server/table-queries";
import type * as AdminAnalyticsRequest from "shared/types/requests/admin/analytics";

export async function getAdminAnalytics(query: AdminAnalyticsRequest.Get) {
  const db = getDb();
  const categories = await db.query.menuCategories.findMany({
    where: isNull(menuCategories.deletedAt),
    with: { menus: true },
  });
  const enrichedCategories = await enrichMenuCategoriesWithBundles(categories);
  const allMenus = enrichedCategories.flatMap((category) => category.menus);

  return buildAdminAnalytics({
    from: query.from,
    to: query.to,
    bucket: query.bucket,
    tables: await getTablesWithRelations(),
    categories: enrichedCategories.map((category) => ({ id: category.id, name: category.name })),
    menus: allMenus,
    bundleItems: await db.select().from(menuBundleItems),
    bankTransactions: await db.select().from(bankTransactions),
  });
}
