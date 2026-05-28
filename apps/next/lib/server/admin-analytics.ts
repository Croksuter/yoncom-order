import { isNull } from "drizzle-orm";
import { bankTransactionStatus, bankTransactions, menuBundleItems, menuCategories, menuOrderStatus, orderStatus, paymentStatus } from "db/schema";
import { buildAdminAnalytics } from "~/lib/analytics";
import { enrichMenuCategoriesWithBundles, ensureMenuProfitabilityColumns, now, quoteIdentifier, updateD1Rows } from "~/lib/server/d1-mutations";
import { executeD1, queryD1, getDb } from "~/lib/server/db";
import { venueScope } from "~/lib/server/sync-events";
import { getTablesWithRelations } from "~/lib/server/table-queries";
import type * as AdminAnalyticsRequest from "shared/types/requests/admin/analytics";

export async function getAdminAnalytics(query: AdminAnalyticsRequest.Get) {
  const db = getDb();
  await ensureMenuProfitabilityColumns();
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

function uniqueIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function placeholders(length: number) {
  return Array.from({ length }, () => "?").join(", ");
}

export async function deleteAdminAnalyticsRecords(query: AdminAnalyticsRequest.DeleteRecords) {
  const orderIds = uniqueIds(query.orderIds);
  const directPaymentIds = uniqueIds(query.paymentIds);

  if (orderIds.length === 0 && directPaymentIds.length === 0) {
    return { error: "No records selected", status: 400 };
  }

  const timestamp = now();
  const orderPaymentRows = orderIds.length > 0
    ? await queryD1<{ id: string }>(
      `SELECT id FROM ${quoteIdentifier("payments")} WHERE orderId IN (${placeholders(orderIds.length)}) AND deletedAt IS NULL`,
      orderIds,
    )
    : [];
  const paymentIds = uniqueIds([...directPaymentIds, ...orderPaymentRows.map((row) => row.id)]);

  if (orderIds.length > 0) {
    await updateD1Rows(
      "menuOrders",
      { status: menuOrderStatus.CANCELLED, deletedAt: timestamp, updatedAt: timestamp },
      `orderId IN (${placeholders(orderIds.length)}) AND deletedAt IS NULL`,
      orderIds,
    );
    await updateD1Rows(
      "orders",
      {
        status: orderStatus.CANCELLED,
        cancelReason: "analytics record cleanup",
        cancelledAt: timestamp,
        deletedAt: timestamp,
        updatedAt: timestamp,
      },
      `id IN (${placeholders(orderIds.length)}) AND deletedAt IS NULL`,
      orderIds,
    );
  }

  if (paymentIds.length > 0) {
    await updateD1Rows(
      "payments",
      { paid: 0, status: paymentStatus.CANCELLED, deletedAt: timestamp, updatedAt: timestamp },
      `id IN (${placeholders(paymentIds.length)}) AND deletedAt IS NULL`,
      paymentIds,
    );
    await updateD1Rows(
      "bankTransactions",
      { status: bankTransactionStatus.NEEDS_REVIEW, matchedPaymentId: null },
      `matchedPaymentId IN (${placeholders(paymentIds.length)})`,
      paymentIds,
    );
    await executeD1(
      `DELETE FROM ${quoteIdentifier("paymentCodeLeases")} WHERE paymentId IN (${placeholders(paymentIds.length)})`,
      paymentIds,
    );
  }

  return {
    result: `Deleted ${orderIds.length} order records and ${paymentIds.length} payment records`,
    status: 200,
    affectedScopes: [venueScope],
  };
}
