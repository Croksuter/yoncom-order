import { isNull } from "drizzle-orm";
import { bankTransactionStatus, bankTransactions, menuBundleItems, menuCategories, menuOrderStatus, orderStatus, paymentStatus } from "db/schema";
import { buildAdminAnalytics } from "~/lib/analytics";
import { enrichMenuCategoriesWithBundles, ensureMenuProfitabilityColumns, getD1Columns, newId, now, quoteIdentifier, updateD1Rows } from "~/lib/server/d1-mutations";
import { executeD1, queryD1, getDb } from "~/lib/server/db";
import { venueScope } from "~/lib/server/sync-events";
import { getTablesWithRelations } from "~/lib/server/table-queries";
import type * as AdminAnalyticsRequest from "shared/types/requests/admin/analytics";
import type * as AdminAnalyticsResponse from "shared/types/responses/admin/analytics";

type OperatingExpenseDbRow = AdminAnalyticsResponse.OperatingExpenseRow & {
  deletedAt?: number | string | null;
};

type AnalyticsSettingsDbRow = {
  id: string;
  targetMarginBps: number;
  createdAt: number | string;
  updatedAt: number | string;
};

let operatingExpensesTableEnsured = false;
let analyticsSettingsTableEnsured = false;
const analyticsSettingsId = "default";
const defaultTargetMarginBps = 3500;

async function ensureOperatingExpensesTable() {
  if (operatingExpensesTableEnsured) {
    return;
  }

  await executeD1(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier("operatingExpenses")} (
      ${quoteIdentifier("id")} TEXT PRIMARY KEY NOT NULL,
      ${quoteIdentifier("label")} TEXT NOT NULL,
      ${quoteIdentifier("amount")} INTEGER NOT NULL,
      ${quoteIdentifier("createdAt")} INTEGER NOT NULL,
      ${quoteIdentifier("updatedAt")} INTEGER NOT NULL,
      ${quoteIdentifier("deletedAt")} INTEGER
    )
  `);
  operatingExpensesTableEnsured = true;
}

function normalizeOperatingExpense(row: OperatingExpenseDbRow): AdminAnalyticsResponse.OperatingExpenseRow {
  return {
    id: row.id,
    label: row.label,
    amount: Number(row.amount),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  };
}

export async function getOperatingExpenses() {
  await ensureOperatingExpensesTable();
  const rows = await queryD1<OperatingExpenseDbRow>(
    `SELECT id, label, amount, createdAt, updatedAt
     FROM ${quoteIdentifier("operatingExpenses")}
     WHERE deletedAt IS NULL
     ORDER BY createdAt ASC, id ASC`,
  );
  return rows.map(normalizeOperatingExpense);
}

async function ensureAnalyticsSettingsTable() {
  if (analyticsSettingsTableEnsured) {
    return;
  }

  await executeD1(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier("analyticsSettings")} (
      ${quoteIdentifier("id")} TEXT PRIMARY KEY NOT NULL,
      ${quoteIdentifier("targetMarginBps")} INTEGER DEFAULT 3500 NOT NULL,
      ${quoteIdentifier("createdAt")} INTEGER NOT NULL,
      ${quoteIdentifier("updatedAt")} INTEGER NOT NULL
    )
  `);
  analyticsSettingsTableEnsured = true;
}

function normalizeTargetMarginBps(value: number | null | undefined) {
  return Math.min(Math.max(Number.isFinite(value ?? Number.NaN) ? Math.round(value ?? defaultTargetMarginBps) : defaultTargetMarginBps, 0), 9500);
}

export async function getAnalyticsSettings() {
  await ensureAnalyticsSettingsTable();
  const [settings] = await queryD1<AnalyticsSettingsDbRow>(
    `SELECT id, targetMarginBps, createdAt, updatedAt
     FROM ${quoteIdentifier("analyticsSettings")}
     WHERE id = ?
     LIMIT 1`,
    [analyticsSettingsId],
  );

  return {
    targetMarginBps: normalizeTargetMarginBps(settings?.targetMarginBps ?? defaultTargetMarginBps),
  };
}

export async function getAdminAnalytics(query: AdminAnalyticsRequest.Get) {
  const db = getDb();
  await ensureMenuProfitabilityColumns();
  const categories = await db.query.menuCategories.findMany({
    where: isNull(menuCategories.deletedAt),
    with: { menus: true },
  });
  const enrichedCategories = await enrichMenuCategoriesWithBundles(categories);
  const allMenus = enrichedCategories.flatMap((category) => category.menus);
  const settings = await getAnalyticsSettings();

  return buildAdminAnalytics({
    from: query.from,
    to: query.to,
    bucket: query.bucket,
    tables: await getTablesWithRelations(),
    categories: enrichedCategories.map((category) => ({ id: category.id, name: category.name })),
    menus: allMenus,
    bundleItems: await db.select().from(menuBundleItems),
    bankTransactions: await db.select().from(bankTransactions),
    operatingExpenses: await getOperatingExpenses(),
    targetMarginBps: settings.targetMarginBps,
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
  const paymentColumns = await getD1Columns("payments");
  const orderPaymentRows = orderIds.length > 0 && paymentColumns.has("orderId")
    ? await queryD1<{ id: string }>(
      `SELECT id FROM ${quoteIdentifier("payments")} WHERE (orderId IN (${placeholders(orderIds.length)}) OR id IN (${placeholders(orderIds.length)})) AND deletedAt IS NULL`,
      [...orderIds, ...orderIds],
    )
    : orderIds.length > 0
      ? await queryD1<{ id: string }>(
        `SELECT id FROM ${quoteIdentifier("payments")} WHERE id IN (${placeholders(orderIds.length)}) AND deletedAt IS NULL`,
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

export async function saveAdminAnalyticsSettings(query: AdminAnalyticsRequest.SaveAnalyticsSettings) {
  await ensureOperatingExpensesTable();
  await ensureAnalyticsSettingsTable();
  const timestamp = now();
  const rowsById = new Map<string, { id: string; label: string; amount: number }>();

  if (query.operatingExpenses !== undefined) {
    for (const expense of query.operatingExpenses) {
      const id = expense.id?.trim() || newId();
      rowsById.set(id, {
        id,
        label: expense.label.trim(),
        amount: expense.amount,
      });
    }

    const rows = [...rowsById.values()];
    const existingRows = await queryD1<{ id: string }>(
      `SELECT id FROM ${quoteIdentifier("operatingExpenses")} WHERE deletedAt IS NULL`,
    );
    const nextIds = new Set(rows.map((row) => row.id));
    const removedIds = existingRows.map((row) => row.id).filter((id) => !nextIds.has(id));

    if (removedIds.length > 0) {
      await updateD1Rows(
        "operatingExpenses",
        { deletedAt: timestamp, updatedAt: timestamp },
        `id IN (${placeholders(removedIds.length)}) AND deletedAt IS NULL`,
        removedIds,
      );
    }

    for (const row of rows) {
      await executeD1(
        `INSERT INTO ${quoteIdentifier("operatingExpenses")}
          (id, label, amount, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET
          label = excluded.label,
          amount = excluded.amount,
          updatedAt = excluded.updatedAt,
          deletedAt = NULL`,
        [row.id, row.label, row.amount, timestamp, timestamp],
      );
    }
  }

  if (query.targetMarginBps !== undefined) {
    const targetMarginBps = normalizeTargetMarginBps(query.targetMarginBps);
    await executeD1(
      `INSERT INTO ${quoteIdentifier("analyticsSettings")}
        (id, targetMarginBps, createdAt, updatedAt)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        targetMarginBps = excluded.targetMarginBps,
        updatedAt = excluded.updatedAt`,
      [analyticsSettingsId, targetMarginBps, timestamp, timestamp],
    );
  }

  const settings = await getAnalyticsSettings();

  return {
    result: {
      operatingExpenses: await getOperatingExpenses(),
      targetMarginBps: settings.targetMarginBps,
    },
    status: 200,
    affectedScopes: [venueScope],
  };
}

export const saveAdminAnalyticsOperatingExpenses = saveAdminAnalyticsSettings;
