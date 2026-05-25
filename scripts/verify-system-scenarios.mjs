import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const runToken = Date.now().toString(36).slice(-6);
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const artifactDir = join(root, "artifacts", "system-scenario-verification");
const reportPath = join(artifactDir, `${runId}.json`);
const ledgerPath = join(artifactDir, `${runId}.md`);
const baseUrl = process.env.YONCOM_VERIFY_BASE_URL ?? "http://localhost:3000";
const now = Date.now();
const twelveHoursMs = 12 * 60 * 60 * 1000;
const oneHourMs = 60 * 60 * 1000;
const oneMinuteMs = 60 * 1000;

const env = {
  ...parseEnvFile(join(root, ".env")),
  ...parseEnvFile(join(root, ".env.local")),
  ...process.env,
};

const d1Config = {
  accountId: env.CLOUDFLARE_ACCOUNT_ID,
  databaseId: env.CLOUDFLARE_DATABASE_ID,
  token: env.CLOUDFLARE_D1_TOKEN,
};

if (!d1Config.accountId || !d1Config.databaseId || !d1Config.token) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_D1_TOKEN are required.");
}

const d1Endpoint = `https://api.cloudflare.com/client/v4/accounts/${d1Config.accountId}/d1/database/${d1Config.databaseId}/query`;
const report = {
  runId,
  runToken,
  startedAt: new Date(now).toISOString(),
  baseUrl,
  artifacts: { reportPath, ledgerPath },
  scenarios: [],
  browserTargets: {},
  contractNotes: [],
};

let idCounter = 0;
let contextTableName = "tableContexts";
let paymentHasOrderId = true;
const columns = new Map();

await main();

async function main() {
  await waitForServer();
  await loadSchemaFacts();
  const ids = await setupFixtures();

  report.browserTargets = {
    clientTableUrl: `${baseUrl}/client/table/${ids.s5Table}`,
    adminPosUrl: `${baseUrl}/admin/pos`,
    adminCookerUrl: `${baseUrl}/admin/cooker`,
  };

  await scenario("S1", "Happy path: order -> auto match -> ready -> picked up -> vacate", async (s) => {
    let customer;
    await step(s, "issue table session and verify 12h expiry", async () => {
      customer = await issueTableSession(ids.s1Table);
      const delta = Math.abs(customer.body.result.expiresAt - (Date.now() + twelveHoursMs));
      assert(delta < 2 * oneMinuteMs, "table session expiresAt is not within 12h tolerance", { delta });
      return {
        tableId: ids.s1Table,
        tableContextId: customer.body.result.tableContextId,
        expiresAtDeltaMs: delta,
      };
    });

    const order = await step(s, "create customer order and verify payment code lease", async () => {
      const response = await apiJson("POST", "/api/order", {
        body: {
          tableId: ids.s1Table,
          clientOrderId: `client-${runToken}-s1`,
          menuOrders: [{ menuId: ids.s1Menu, quantity: 1 }],
        },
        cookies: customer.cookies,
        csrf: customer.csrf,
        idempotencyKey: `idem-${runToken}-s1-create`,
      });
      assert(response.status === 200, "order create failed", response);
      const payment = response.body.result.payment;
      assert(payment.paymentCode >= 1 && payment.paymentCode <= 99, "payment code out of range", payment);
      assert(payment.expectedTransferAmount === payment.originalAmount - payment.paymentCode, "expected amount mismatch", payment);
      const leases = await queryRows(
        "SELECT code, paymentId FROM paymentCodeLeases WHERE paymentId = ?",
        [payment.id],
      );
      assert(leases.length === 1, "payment code lease was not reserved", { leases, payment });
      const menuOrders = await queryRows("SELECT id, status FROM menuOrders WHERE orderId = ? AND deletedAt IS NULL", [
        response.body.result.orderId,
      ]);
      assert(menuOrders.length === 1, "created order should have one menu order", { menuOrders });
      return {
        orderId: response.body.result.orderId,
        menuOrderId: menuOrders[0].id,
        payment,
        lease: leases[0],
      };
    });

    await step(s, "ingest exact transfer and verify auto match", async () => {
      const response = await apiJson("POST", "/api/admin/deposit", {
        body: {
          amount: order.payment.expectedTransferAmount,
          bank: "SCENARIO_BANK",
          timestamp: Date.now(),
          name: `입금자${runToken}`,
          rawText: `scenario ${runToken} exact transfer`,
          source: "MANUAL",
          dedupeKey: `s1:${runToken}:exact`,
        },
        cookies: ids.adminCookies,
        csrf: ids.adminCsrf,
        idempotencyKey: `idem-${runToken}-s1-deposit`,
      });
      assert(response.status === 200, "deposit ingest failed", response);
      assert(response.body.result.status === "AUTO_MATCHED", "deposit was not auto matched", response.body);
      const [payment] = await queryRows(
        "SELECT status, paid, matchedBankTransactionId, matchedBy FROM payments WHERE id = ?",
        [order.payment.id],
      );
      assert(payment.status === "PAID" && Number(payment.paid) === 1, "payment was not marked PAID", payment);
      assert(payment.matchedBy === "AUTO_MATCHED", "payment matchedBy mismatch", payment);
      const leases = await queryRows("SELECT * FROM paymentCodeLeases WHERE paymentId = ?", [order.payment.id]);
      assert(leases.length === 0, "payment code lease was not released", leases);
      return { bankTransactionId: response.body.result.bankTransactionId, payment };
    });

    await step(s, "complete and pick up menu order through admin APIs", async () => {
      const complete = await apiJson("PUT", "/api/admin/order/complete", {
        body: { menuOrderId: order.menuOrderId },
        cookies: ids.adminCookies,
        csrf: ids.adminCsrf,
        idempotencyKey: `idem-${runToken}-s1-ready`,
      });
      assert(complete.status === 200, "complete order failed", complete);
      const pickup = await apiJson("PUT", "/api/admin/order/pick-up", {
        body: { menuOrderId: order.menuOrderId },
        cookies: ids.adminCookies,
        csrf: ids.adminCsrf,
        idempotencyKey: `idem-${runToken}-s1-pickup`,
      });
      assert(pickup.status === 200, "pick-up order failed", pickup);
      const [row] = await queryRows("SELECT status FROM menuOrders WHERE id = ?", [order.menuOrderId]);
      assert(row.status === "PICKED_UP", "menu order did not reach PICKED_UP", row);
      return { menuOrderStatus: row.status };
    });

    await step(s, "vacate table and reject old table session", async () => {
      const vacate = await apiJson("PUT", "/api/admin/table/vacate", {
        body: { tableId: ids.s1Table },
        cookies: ids.adminCookies,
        csrf: ids.adminCsrf,
        idempotencyKey: `idem-${runToken}-s1-vacate`,
      });
      assert(vacate.status === 200, "vacate failed", vacate);
      const sync = await apiJson("GET", `/api/sync/table?tableId=${ids.s1Table}&afterRevision=0`, {
        cookies: customer.cookies,
      });
      assert(sync.status === 403 && sync.body.error === "Invalid table session", "old table session was not rejected", sync);
      return { vacateStatus: vacate.status, oldSessionSyncStatus: sync.status };
    });
  });

  await scenario("S2", "Concurrency and idempotency", async (s) => {
    const sessionA = await issueTableSession(ids.s2TableA);
    const sessionB = await issueTableSession(ids.s2TableB);
    const payloadA = {
      tableId: ids.s2TableA,
      clientOrderId: `client-${runToken}-s2a`,
      menuOrders: [{ menuId: ids.s2Menu, quantity: 1 }],
    };
    const payloadB = {
      tableId: ids.s2TableB,
      clientOrderId: `client-${runToken}-s2b`,
      menuOrders: [{ menuId: ids.s2Menu, quantity: 1 }],
    };

    const race = await step(s, "race two orders against one remaining stock", async () => {
      const [a, b] = await Promise.all([
        apiJson("POST", "/api/order", {
          body: payloadA,
          cookies: sessionA.cookies,
          csrf: sessionA.csrf,
          idempotencyKey: `idem-${runToken}-s2-a`,
        }),
        apiJson("POST", "/api/order", {
          body: payloadB,
          cookies: sessionB.cookies,
          csrf: sessionB.csrf,
          idempotencyKey: `idem-${runToken}-s2-b`,
        }),
      ]);
      const statuses = [a.status, b.status].sort((x, y) => x - y);
      assert(statuses[0] === 200 && statuses[1] === 409, "race should produce exactly one success and one stock conflict", { a, b });
      const success = a.status === 200 ? a : b;
      const failed = a.status === 409 ? a : b;
      assert(failed.body.error === "Menu Not Enough", "failed race response should be Menu Not Enough", failed.body);
      const [menu] = await queryRows("SELECT quantity FROM menus WHERE id = ?", [ids.s2Menu]);
      assert(Number(menu.quantity) === 0, "stock should not go negative and should end at zero", menu);
      const activeOrders = await queryRows(
        `SELECT o.id FROM orders o INNER JOIN menuOrders mo ON mo.orderId = o.id WHERE mo.menuId = ? AND o.deletedAt IS NULL`,
        [ids.s2Menu],
      );
      assert(activeOrders.length === 1, "only one active order should exist for one unit of stock", activeOrders);
      const leases = await queryRows("SELECT * FROM paymentCodeLeases WHERE paymentId = ?", [success.body.result.payment.id]);
      assert(leases.length === 1, "successful order should retain one active lease", leases);
      return { success: success.body.result, failed: failed.body, remainingQuantity: Number(menu.quantity) };
    });

    await step(s, "retry same clientOrderId without duplicate stock decrement", async () => {
      const successWasA = race.success.orderId
        ? (await queryRows("SELECT tableContextId FROM orders WHERE id = ?", [race.success.orderId]))[0]?.tableContextId === ids.s2ContextA
        : false;
      const session = successWasA ? sessionA : sessionB;
      const payload = successWasA ? payloadA : payloadB;
      const retry = await apiJson("POST", "/api/order", {
        body: payload,
        cookies: session.cookies,
        csrf: session.csrf,
        idempotencyKey: `idem-${runToken}-s2-retry`,
      });
      assert(retry.status === 200, "idempotent retry failed", retry);
      assert(retry.body.result.orderId === race.success.orderId, "idempotent retry returned a different order", {
        retry: retry.body.result,
        first: race.success,
      });
      const [menu] = await queryRows("SELECT quantity FROM menus WHERE id = ?", [ids.s2Menu]);
      assert(Number(menu.quantity) === 0, "retry changed stock", menu);
      return { orderId: retry.body.result.orderId, remainingQuantity: Number(menu.quantity) };
    });
  });

  await scenario("S3", "Bank transaction exception handling and manual matching", async (s) => {
    const duplicate = await step(s, "same amount duplicate candidates stay NEEDS_REVIEW", async () => {
      const response = await apiJson("POST", "/api/admin/deposit", {
        body: {
          amount: 14995,
          bank: "KB",
          timestamp: Date.now(),
          name: "홍길동",
          rawText: "홍길동 14995",
          source: "MANUAL",
          dedupeKey: `s3:${runToken}:duplicate`,
        },
        cookies: ids.adminCookies,
        csrf: ids.adminCsrf,
        idempotencyKey: `idem-${runToken}-s3-dup`,
      });
      assert(response.status === 200, "duplicate deposit ingest failed", response);
      assert(response.body.result.status === "NEEDS_REVIEW", "duplicate candidates should need review", response.body);
      assert(response.body.result.candidateCount >= 2, "duplicate candidate count should be >= 2", response.body);
      const rows = await queryRows("SELECT status, paid FROM payments WHERE id IN (?, ?)", [
        storedPaymentId(ids.s3OrderA, ids.s3PaymentA),
        storedPaymentId(ids.s3OrderB, ids.s3PaymentB),
      ]);
      assert(rows.every((row) => row.status === "PENDING" && Number(row.paid) === 0), "duplicate candidates were auto paid", rows);
      return response.body.result;
    });

    await step(s, "original amount and within-100 amount are exposed as review candidates", async () => {
      const original = await apiJson("POST", "/api/admin/deposit", {
        body: {
          amount: 10000,
          bank: "KB",
          timestamp: Date.now(),
          name: "이몽룡",
          rawText: "이몽룡 10000",
          source: "MANUAL",
          dedupeKey: `s3:${runToken}:original`,
        },
        cookies: ids.adminCookies,
        csrf: ids.adminCsrf,
        idempotencyKey: `idem-${runToken}-s3-original`,
      });
      assert(original.status === 200, "original amount ingest failed", original);
      assert(original.body.result.status === "NEEDS_REVIEW", "original amount should need review", original.body);
      const within = await apiJson("POST", "/api/admin/deposit", {
        body: {
          amount: 9995,
          bank: "KB",
          timestamp: Date.now(),
          name: "이몽룡",
          rawText: "이몽룡 9995",
          source: "MANUAL",
          dedupeKey: `s3:${runToken}:within100`,
        },
        cookies: ids.adminCookies,
        csrf: ids.adminCsrf,
        idempotencyKey: `idem-${runToken}-s3-within`,
      });
      assert(within.status === 200, "within-100 amount ingest failed", within);
      assert(within.body.result.status === "NEEDS_REVIEW", "within-100 amount should need review", within.body);
      const pending = await apiJson("GET", "/api/admin/deposit", {
        cookies: ids.adminCookies,
      });
      assert(pending.status === 200, "pending deposit list failed", pending);
      const transactions = pending.body.result.transactions;
      const originalTx = transactions.find((tx) => tx.id === original.body.result.bankTransactionId);
      const withinTx = transactions.find((tx) => tx.id === within.body.result.bankTransactionId);
      assert(originalTx?.candidates?.some((candidate) => candidate.reason === "ORIGINAL_AMOUNT"), "ORIGINAL_AMOUNT candidate missing", originalTx);
      assert(withinTx?.candidates?.some((candidate) => candidate.reason === "WITHIN_100"), "WITHIN_100 candidate missing", withinTx);
      return {
        originalBankTransactionId: original.body.result.bankTransactionId,
        withinBankTransactionId: within.body.result.bankTransactionId,
        duplicateBankTransactionId: duplicate.bankTransactionId,
      };
    });

    await step(s, "manual confirm links transaction and payment", async () => {
      const response = await apiJson("PUT", "/api/admin/deposit/confirm", {
        body: {
          bankTransactionId: duplicate.bankTransactionId,
          paymentId: storedPaymentId(ids.s3OrderA, ids.s3PaymentA),
        },
        cookies: ids.adminCookies,
        csrf: ids.adminCsrf,
        idempotencyKey: `idem-${runToken}-s3-confirm`,
      });
      assert(response.status === 200, "manual confirm failed", response);
      const [transaction] = await queryRows(
        "SELECT status, matchedPaymentId FROM bankTransactions WHERE id = ?",
        [duplicate.bankTransactionId],
      );
      const [payment] = await queryRows(
        "SELECT status, paid, matchedBankTransactionId, matchedBy FROM payments WHERE id = ?",
        [storedPaymentId(ids.s3OrderA, ids.s3PaymentA)],
      );
      assert(
        transaction.status === "AUTO_MATCHED" &&
          transaction.matchedPaymentId === storedPaymentId(ids.s3OrderA, ids.s3PaymentA),
        "transaction not linked",
        transaction,
      );
      assert(payment.status === "PAID" && Number(payment.paid) === 1, "payment not paid by manual confirm", payment);
      assert(payment.matchedBy === "MANUAL_REVIEW", "manual confirm matchedBy mismatch", payment);
      return { transaction, payment };
    });
  });

  await scenario("S4", "Security and attack prevention", async (s) => {
    const sessionA = await issueTableSession(ids.s4TableA);
    const sessionB = await issueTableSession(ids.s4TableB);

    await step(s, "valid CSRF but missing table session is rejected", async () => {
      const response = await apiJson("POST", "/api/order", {
        body: {
          tableId: ids.s4TableA,
          clientOrderId: `client-${runToken}-s4-no-session`,
          menuOrders: [{ menuId: ids.s4Menu, quantity: 1 }],
        },
        cookies: { yoncom_csrf: sessionA.csrf },
        csrf: sessionA.csrf,
        idempotencyKey: `idem-${runToken}-s4-nosess`,
      });
      assert(response.status === 401 && response.body.error === "Table session required", "missing table session should be 401", response);
      return { status: response.status, error: response.body.error };
    });

    await step(s, "wrong table session cannot cancel another table order", async () => {
      const response = await apiJson("DELETE", "/api/order", {
        body: { orderId: ids.s4OrderB },
        cookies: sessionA.cookies,
        csrf: sessionA.csrf,
        idempotencyKey: `idem-${runToken}-s4-cross`,
      });
      assert(response.status === 403 && response.body.error === "Invalid table session", "cross-table cancel should be 403", response);
      return { status: response.status, error: response.body.error };
    });

    await step(s, "missing CSRF header is rejected before mutation", async () => {
      const response = await apiJson("POST", "/api/order", {
        body: {
          tableId: ids.s4TableA,
          clientOrderId: `client-${runToken}-s4-csrf`,
          menuOrders: [{ menuId: ids.s4Menu, quantity: 1 }],
        },
        cookies: sessionA.cookies,
        idempotencyKey: `idem-${runToken}-s4-csrf`,
      });
      assert(response.status === 403 && response.body.error === "CSRF token required", "missing CSRF should be 403", response);
      return { status: response.status, error: response.body.error };
    });

    await step(s, "over-32KB JSON body is rejected", async () => {
      const response = await apiJson("POST", "/api/order", {
        rawBody: JSON.stringify({
          tableId: ids.s4TableA,
          clientOrderId: `client-${runToken}-s4-large`,
          menuOrders: [{ menuId: ids.s4Menu, quantity: 1 }],
          filler: "x".repeat(33 * 1024),
        }),
        cookies: sessionA.cookies,
        csrf: sessionA.csrf,
        idempotencyKey: `idem-${runToken}-s4-large`,
      });
      assert(response.status === 413 && response.body.error === "Request body too large", "large body should be 413", response);
      return { status: response.status, error: response.body.error };
    });

    await step(s, "table-session-only admin access is rejected and non-admin session is forbidden", async () => {
      const tableOnly = await apiJson("PUT", "/api/admin/order/cancel", {
        body: { orderId: ids.s4OrderB, cancelReason: "attack" },
        cookies: sessionB.cookies,
        csrf: sessionB.csrf,
        idempotencyKey: `idem-${runToken}-s4-admin-table`,
      });
      const nonAdmin = await apiJson("PUT", "/api/admin/order/cancel", {
        body: { orderId: ids.s4OrderB, cancelReason: "attack" },
        cookies: ids.nonAdminCookies,
        csrf: ids.nonAdminCsrf,
        idempotencyKey: `idem-${runToken}-s4-admin-user`,
      });
      assert(tableOnly.status === 401 && tableOnly.body.error === "Unauthorized", "table-session-only admin access should be unauthorized", tableOnly);
      assert(nonAdmin.status === 403 && nonAdmin.body.error === "Forbidden", "non-admin auth should be forbidden", nonAdmin);
      report.contractNotes.push({
        scenario: "S4",
        note: "Spec says customer table-session-only admin call returns 403, but current requireAdmin contract returns 401 without yoncom_session and 403 only for authenticated non-admin users.",
      });
      return {
        tableSessionOnly: { status: tableOnly.status, error: tableOnly.body.error },
        nonAdminSession: { status: nonAdmin.status, error: nonAdmin.body.error },
      };
    });
  });

  await scenario("S5", "Sync and resiliency", async (s) => {
    const session = await issueTableSession(ids.s5Table);

    await step(s, "initial sync returns snapshot", async () => {
      const response = await apiJson("GET", `/api/sync/table?tableId=${ids.s5Table}&afterRevision=0`, {
        cookies: session.cookies,
      });
      assert(response.status === 200, "initial sync failed", response);
      assert(response.body.result.snapshot?.table?.id === ids.s5Table, "initial sync snapshot missing table", response.body);
      return {
        revision: response.body.result.revision,
        eventCount: response.body.result.events.length,
        hasSnapshot: Boolean(response.body.result.snapshot),
      };
    });

    await ensureScopeBaseline(ids.s5Table);
    const beforeReady = await getScopeRevision(`table:${ids.s5Table}`);
    await step(s, "events after known revision arrive in ascending order without snapshot", async () => {
      const ready = await apiJson("PUT", "/api/admin/order/complete", {
        body: { menuOrderId: ids.s5MenuOrder },
        cookies: ids.adminCookies,
        csrf: ids.adminCsrf,
        idempotencyKey: `idem-${runToken}-s5-ready`,
      });
      assert(ready.status === 200, "ready mutation failed", ready);
      const response = await apiJson("GET", `/api/sync/table?tableId=${ids.s5Table}&afterRevision=${beforeReady}`, {
        cookies: session.cookies,
      });
      assert(response.status === 200, "incremental sync failed", response);
      const events = response.body.result.events;
      assert(events.length >= 1, "incremental sync missed ready event", response.body);
      assert(events.every((event, index) => index === 0 || event.revision > events[index - 1].revision), "events not strictly ascending", events);
      assert(events.some((event) => event.type === "menuOrder.ready"), "menuOrder.ready event missing", events);
      assert(response.body.result.snapshot === null, "incremental sync should not include snapshot", response.body);
      return { afterRevision: beforeReady, eventTypes: events.map((event) => event.type), snapshot: response.body.result.snapshot };
    });

    await step(s, "artificial event gap returns hard snapshot", async () => {
      const gapScope = `table:${ids.s5GapTable}`;
      await queryRows(
        `INSERT OR REPLACE INTO scopeRevisions (scope, revision, updatedAt) VALUES (?, ?, ?)`,
        [gapScope, 6, Date.now()],
      );
      await queryRows(
        `INSERT INTO domainEvents (id, scope, revision, type, entityType, entityId, payloadJson, mutationId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ids.s5GapEvent, gapScope, 6, "menuOrder.ready", "menuOrder", ids.s5GapMenuOrder, JSON.stringify({ tableId: ids.s5GapTable }), null, Date.now()],
      );
      const gapSession = await issueTableSession(ids.s5GapTable);
      const response = await apiJson("GET", `/api/sync/table?tableId=${ids.s5GapTable}&afterRevision=1`, {
        cookies: gapSession.cookies,
      });
      assert(response.status === 200, "gap sync failed", response);
      assert(response.body.result.gap === true, "gap flag should be true", response.body);
      assert(response.body.result.snapshot?.table?.id === ids.s5GapTable, "gap sync should include snapshot", response.body);
      return {
        gap: response.body.result.gap,
        revision: response.body.result.revision,
        snapshotTableId: response.body.result.snapshot.table.id,
      };
    });

    await step(s, "other table session cannot read this table snapshot", async () => {
      const other = await issueTableSession(ids.s4TableA);
      const response = await apiJson("GET", `/api/sync/table?tableId=${ids.s5Table}&afterRevision=0`, {
        cookies: other.cookies,
      });
      assert(response.status === 403 && response.body.error === "Invalid table session", "cross-table sync should be rejected", response);
      return { status: response.status, error: response.body.error };
    });
  });

  report.finishedAt = new Date().toISOString();
  report.ok = report.scenarios.every((s) => s.status === "passed");
  await writeArtifacts();
  console.log(`system scenario verification report: ${reportPath}`);
  console.log(`system scenario verification ledger: ${ledgerPath}`);
  if (!report.ok) {
    process.exitCode = 1;
  }
}

async function setupFixtures() {
  const ids = makeFixtureIds();
  const ts = Date.now();

  await insertRow("users", {
    id: ids.adminUser,
    role: "ADMIN",
    name: `Scenario Admin ${runToken}`,
    email: `scenario.admin.${runToken}@yoncom.local`,
    password: "not-used-by-direct-session",
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  });
  await insertRow("users", {
    id: ids.nonAdminUser,
    role: "USER",
    name: `Scenario User ${runToken}`,
    email: `scenario.user.${runToken}@yoncom.local`,
    password: "not-used-by-direct-session",
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  });
  await queryRows(
    "INSERT OR REPLACE INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    [ids.adminSession, ids.adminUser, ts + oneHourMs],
  );
  await queryRows(
    "INSERT OR REPLACE INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    [ids.nonAdminSession, ids.nonAdminUser, ts + oneHourMs],
  );

  ids.adminCsrf = `csrf-${runToken}-admin`;
  ids.adminCookies = { yoncom_session: ids.adminSession, yoncom_csrf: ids.adminCsrf };
  ids.nonAdminCsrf = `csrf-${runToken}-user`;
  ids.nonAdminCookies = { yoncom_session: ids.nonAdminSession, yoncom_csrf: ids.nonAdminCsrf };

  await insertRow("menuCategories", {
    id: ids.category,
    name: `검증 카테고리 ${runToken}`,
    description: "System scenario verification category",
    userId: ids.adminUser,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  });

  await insertRows("menus", [
    menu(ids.s1Menu, "S1 자동매칭 메뉴", 87654, 5),
    menu(ids.s2Menu, "S2 동시성 메뉴", 76543, 1),
    menu(ids.s3Menu, "S3 입금예외 메뉴", 15000, 9),
    menu(ids.s4Menu, "S4 보안 메뉴", 65432, 9),
    menu(ids.s5Menu, "S5 동기화 메뉴", 54321, 9),
    menu(ids.s5GapMenu, "S5 갭 동기화 메뉴", 43210, 9),
  ]);

  await insertRows("tables", [
    table(ids.s1Table, 8101, "S1 Happy"),
    table(ids.s2TableA, 8102, "S2 A"),
    table(ids.s2TableB, 8103, "S2 B"),
    table(ids.s3TableA, 8104, "S3 A"),
    table(ids.s3TableB, 8105, "S3 B"),
    table(ids.s3TableC, 8106, "S3 C"),
    table(ids.s4TableA, 8107, "S4 A"),
    table(ids.s4TableB, 8108, "S4 B"),
    table(ids.s5Table, 8109, "S5 Live"),
    table(ids.s5GapTable, 8110, "S5 Gap"),
  ]);

  const contextRows = [
    context(ids.s1Context, ids.s1Table),
    context(ids.s2ContextA, ids.s2TableA),
    context(ids.s2ContextB, ids.s2TableB),
    context(ids.s3ContextA, ids.s3TableA),
    context(ids.s3ContextB, ids.s3TableB),
    context(ids.s3ContextC, ids.s3TableC),
    context(ids.s4ContextA, ids.s4TableA),
    context(ids.s4ContextB, ids.s4TableB),
    context(ids.s5Context, ids.s5Table),
    context(ids.s5GapContext, ids.s5GapTable),
  ];
  await insertRows(contextTableName, contextRows);
  if (contextTableName === "tableContexts" && await tableExists("tableContext")) {
    await insertRows("tableContext", contextRows);
  }

  await insertManualOrderSet({
    orderId: ids.s3OrderA,
    paymentId: ids.s3PaymentA,
    menuOrderId: ids.s3MenuOrderA,
    tableContextId: ids.s3ContextA,
    menuId: ids.s3Menu,
    originalAmount: 15000,
    expectedTransferAmount: 14995,
    paymentCode: 5,
    displayNumber: 7101,
  });
  await insertManualOrderSet({
    orderId: ids.s3OrderB,
    paymentId: ids.s3PaymentB,
    menuOrderId: ids.s3MenuOrderB,
    tableContextId: ids.s3ContextB,
    menuId: ids.s3Menu,
    originalAmount: 15000,
    expectedTransferAmount: 14995,
    paymentCode: 5,
    displayNumber: 7102,
  });
  await insertManualOrderSet({
    orderId: ids.s3OrderC,
    paymentId: ids.s3PaymentC,
    menuOrderId: ids.s3MenuOrderC,
    tableContextId: ids.s3ContextC,
    menuId: ids.s3Menu,
    originalAmount: 10000,
    expectedTransferAmount: 9990,
    paymentCode: 10,
    displayNumber: 7103,
  });
  await insertManualOrderSet({
    orderId: ids.s4OrderB,
    paymentId: ids.s4PaymentB,
    menuOrderId: ids.s4MenuOrderB,
    tableContextId: ids.s4ContextB,
    menuId: ids.s4Menu,
    originalAmount: 20000,
    expectedTransferAmount: 19991,
    paymentCode: 9,
    displayNumber: 7201,
  });
  await insertManualOrderSet({
    orderId: ids.s5Order,
    paymentId: ids.s5Payment,
    menuOrderId: ids.s5MenuOrder,
    tableContextId: ids.s5Context,
    menuId: ids.s5Menu,
    originalAmount: 54321,
    expectedTransferAmount: 54320,
    paymentCode: 1,
    displayNumber: 7301,
    paid: true,
  });
  await insertManualOrderSet({
    orderId: ids.s5GapOrder,
    paymentId: ids.s5GapPayment,
    menuOrderId: ids.s5GapMenuOrder,
    tableContextId: ids.s5GapContext,
    menuId: ids.s5GapMenu,
    originalAmount: 43210,
    expectedTransferAmount: 43209,
    paymentCode: 1,
    displayNumber: 7302,
    paid: true,
  });

  return ids;

  function menu(id, name, price, quantity) {
    return {
      id,
      name,
      image: "https://example.com/verification-menu.png",
      description: "Scenario verification menu",
      price,
      quantity,
      available: 1,
      menuCategoryId: ids.category,
      userId: ids.adminUser,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    };
  }

  function table(id, key, name) {
    return {
      id,
      key,
      name: `${name} ${runToken}`,
      seats: 4,
      userId: ids.adminUser,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    };
  }

  function context(id, tableId) {
    return {
      id,
      tableId,
      userId: ids.adminUser,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    };
  }
}

async function insertManualOrderSet({
  orderId,
  paymentId,
  menuOrderId,
  tableContextId,
  menuId,
  originalAmount,
  expectedTransferAmount,
  paymentCode,
  displayNumber,
  paid = false,
}) {
  const ts = Date.now();
  await insertRow("orders", {
    id: orderId,
    clientOrderId: `manual-${orderId}`,
    displayNumber,
    status: "ACTIVE",
    expiresAt: ts + 5 * oneMinuteMs,
    cancelReason: null,
    cancelledAt: null,
    cancelledByUserId: null,
    tableContextId,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  });
  await insertRow("payments", {
    id: paymentHasOrderId ? paymentId : orderId,
    paid: paid ? 1 : 0,
    amount: expectedTransferAmount,
    method: paid ? "SCENARIO PAID" : "미결제",
    bank: paid ? "SCENARIO" : null,
    depositor: paid ? "검증" : null,
    orderId,
    status: paid ? "PAID" : "PENDING",
    paymentCode,
    originalAmount,
    expectedTransferAmount,
    expiresAt: ts + 5 * oneMinuteMs,
    paidAt: paid ? ts : null,
    matchedBankTransactionId: null,
    matchedBy: paid ? "MANUAL" : null,
    depositorHint: null,
    refundAmount: null,
    refundRequestedAt: null,
    refundedAt: null,
    refundHandledByUserId: null,
    refundNote: null,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  });
  await insertRow("menuOrders", {
    id: menuOrderId,
    quantity: 1,
    status: "PENDING",
    orderId,
    menuId,
    userId: null,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  });
}

async function issueTableSession(tableId) {
  const response = await apiJson("POST", "/api/table/session", {
    body: { tableId },
  });
  assert(response.status === 200, "table session issue failed", response);
  const cookies = parseSetCookie(response.setCookie);
  assert(cookies.yoncom_table_session && cookies.yoncom_csrf, "table session cookies missing", { setCookie: response.setCookie });
  return {
    body: response.body,
    cookies,
    csrf: cookies.yoncom_csrf,
  };
}

async function scenario(id, title, fn) {
  const entry = {
    id,
    title,
    status: "running",
    startedAt: new Date().toISOString(),
    steps: [],
  };
  report.scenarios.push(entry);
  try {
    await fn(entry);
    entry.status = "passed";
  } catch (error) {
    entry.status = "failed";
    entry.error = serializeError(error);
    throw error;
  } finally {
    entry.finishedAt = new Date().toISOString();
  }
}

async function step(scenarioEntry, label, fn) {
  const entry = {
    label,
    status: "running",
    startedAt: new Date().toISOString(),
  };
  scenarioEntry.steps.push(entry);
  try {
    const evidence = await fn();
    entry.status = "passed";
    entry.evidence = sanitizeEvidence(evidence);
    return evidence;
  } catch (error) {
    entry.status = "failed";
    entry.error = serializeError(error);
    throw error;
  } finally {
    entry.finishedAt = new Date().toISOString();
  }
}

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = sanitizeEvidence(details);
    throw error;
  }
}

async function apiJson(method, path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set("origin", baseUrl);
  if (method !== "GET" && method !== "HEAD") {
    headers.set("content-type", "application/json");
  }
  if (options.csrf) {
    headers.set("x-csrf-token", options.csrf);
  }
  if (options.idempotencyKey) {
    headers.set("idempotency-key", options.idempotencyKey);
  }
  const cookieHeader = formatCookies(options.cookies ?? {});
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return {
    status: response.status,
    body,
    setCookie: getSetCookie(response.headers),
  };
}

function getSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const value = headers.get("set-cookie");
  return value ? splitCombinedSetCookie(value) : [];
}

function splitCombinedSetCookie(value) {
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]+)/g).map((part) => part.trim()).filter(Boolean);
}

function parseSetCookie(lines) {
  const cookies = {};
  for (const line of lines) {
    const first = line.split(";")[0];
    const index = first.indexOf("=");
    if (index > 0) {
      cookies[first.slice(0, index)] = first.slice(index + 1);
    }
  }
  return cookies;
}

function formatCookies(cookies) {
  return Object.entries(cookies)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      const response = await fetch(`${baseUrl}/api/menu`, { cache: "no-store" });
      if (response.status < 500) return;
    } catch {
      // Retry until the dev server is reachable.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server not reachable at ${baseUrl}`);
}

async function loadSchemaFacts() {
  if (!(await tableExists("tableContexts")) && (await tableExists("tableContext"))) {
    contextTableName = "tableContext";
  }
  for (const table of [
    "users",
    "sessions",
    "menuCategories",
    "menus",
    "tables",
    contextTableName,
    "orders",
    "payments",
    "menuOrders",
    "paymentCodeLeases",
    "bankTransactions",
    "scopeRevisions",
    "domainEvents",
  ]) {
    columns.set(table, await getColumns(table));
  }
  paymentHasOrderId = columns.get("payments").has("orderId");
}

async function tableExists(tableName) {
  const rows = await queryRows("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [tableName]);
  return rows.length > 0;
}

async function getColumns(tableName) {
  const rows = await queryRows(`PRAGMA table_info(${quoteIdentifier(tableName)})`);
  return new Set(rows.map((row) => row.name));
}

async function insertRows(tableName, rows) {
  for (const row of rows) {
    await insertRow(tableName, row);
  }
}

async function insertRow(tableName, row) {
  const tableColumns = columns.get(tableName) ?? await getColumns(tableName);
  columns.set(tableName, tableColumns);
  const insertColumns = Object.keys(row).filter((column) => tableColumns.has(column));
  if (insertColumns.length === 0) return;
  const columnSql = insertColumns.map(quoteIdentifier).join(", ");
  const placeholders = insertColumns.map(() => "?").join(", ");
  await queryRows(
    `INSERT OR REPLACE INTO ${quoteIdentifier(tableName)} (${columnSql}) VALUES (${placeholders})`,
    insertColumns.map((column) => row[column]),
  );
}

async function getScopeRevision(scope) {
  const rows = await queryRows("SELECT revision FROM scopeRevisions WHERE scope = ? LIMIT 1", [scope]);
  return Number(rows[0]?.revision ?? 0);
}

async function ensureScopeBaseline(tableId) {
  const scope = `table:${tableId}`;
  const revision = await getScopeRevision(scope);
  if (revision > 0) {
    return revision;
  }

  await queryRows(
    "INSERT OR REPLACE INTO scopeRevisions (scope, revision, updatedAt) VALUES (?, ?, ?)",
    [scope, 1, Date.now()],
  );
  await queryRows(
    `INSERT INTO domainEvents (id, scope, revision, type, entityType, entityId, payloadJson, mutationId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nextId(), scope, 1, "verification.baseline", "table", tableId, JSON.stringify({ tableId }), null, Date.now()],
  );
  return 1;
}

async function queryRows(sql, params = []) {
  const response = await fetch(d1Endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${d1Config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const payload = await response.json().catch(() => null);
  const result = payload?.result?.[0];
  if (!response.ok || !payload?.success || !result?.success) {
    const message =
      result?.error ??
      payload?.errors?.map((error) => error.message).join(", ") ??
      `D1 query failed with ${response.status}`;
    throw new Error(message.replace(/accounts\/[^/]+/g, "accounts/[redacted]").replace(/database\/[^/]+/g, "database/[redacted]"));
  }
  return result.results ?? [];
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const values = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    values[key] = value;
  }
  return values;
}

function makeFixtureIds() {
  const names = [
    "adminUser",
    "nonAdminUser",
    "category",
    "s1Table",
    "s1Context",
    "s1Menu",
    "s2TableA",
    "s2TableB",
    "s2ContextA",
    "s2ContextB",
    "s2Menu",
    "s3TableA",
    "s3TableB",
    "s3TableC",
    "s3ContextA",
    "s3ContextB",
    "s3ContextC",
    "s3Menu",
    "s3OrderA",
    "s3OrderB",
    "s3OrderC",
    "s3PaymentA",
    "s3PaymentB",
    "s3PaymentC",
    "s3MenuOrderA",
    "s3MenuOrderB",
    "s3MenuOrderC",
    "s4TableA",
    "s4TableB",
    "s4ContextA",
    "s4ContextB",
    "s4Menu",
    "s4OrderB",
    "s4PaymentB",
    "s4MenuOrderB",
    "s5Table",
    "s5Context",
    "s5Menu",
    "s5Order",
    "s5Payment",
    "s5MenuOrder",
    "s5GapTable",
    "s5GapContext",
    "s5GapMenu",
    "s5GapOrder",
    "s5GapPayment",
    "s5GapMenuOrder",
    "s5GapEvent",
  ];
  const ids = {};
  for (const name of names) {
    ids[name] = nextId();
  }
  ids.adminSession = `sess_${runToken}_admin`;
  ids.nonAdminSession = `sess_${runToken}_user`;
  return ids;
}

function nextId() {
  idCounter += 1;
  return `v${runToken}${idCounter.toString(36).padStart(3, "0")}`.padEnd(15, "x").slice(0, 15);
}

function storedPaymentId(orderId, paymentId) {
  return paymentHasOrderId ? paymentId : orderId;
}

function sanitizeEvidence(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitizeEvidence);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/token|authorization|password|secret/i.test(key))
        .map(([key, nested]) => [key, sanitizeEvidence(nested)]),
    );
  }
  return value;
}

function serializeError(error) {
  return sanitizeEvidence({
    message: error instanceof Error ? error.message : String(error),
    details: error?.details,
  });
}

async function writeArtifacts() {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(ledgerPath, renderLedger(report));
}

function renderLedger(data) {
  const lines = [
    "# Yoncom Order System Scenario Verification",
    "",
    `- runId: ${data.runId}`,
    `- runToken: ${data.runToken}`,
    `- startedAt: ${data.startedAt}`,
    `- finishedAt: ${data.finishedAt ?? ""}`,
    `- baseUrl: ${data.baseUrl}`,
    `- status: ${data.ok ? "passed" : "failed"}`,
    "",
    "## Scenario Plan",
    "",
    "1. S1 Happy path: table session, customer order, payment lease, bank auto match, ready, picked up, vacate, old-session reject.",
    "2. S2 Concurrency/idempotency: one-stock race, failed lease release, same clientOrderId retry.",
    "3. S3 Bank exception/manual matching: duplicate exact amount, original amount, within-100 candidate, manual confirm.",
    "4. S4 Security guards: table session, cross-table isolation, CSRF, payload size, admin auth.",
    "5. S5 Sync resiliency: initial snapshot, incremental event order, artificial gap snapshot, cross-table sync rejection.",
    "",
    "## Execution",
    "",
  ];

  for (const scenarioEntry of data.scenarios) {
    lines.push(`### ${scenarioEntry.id} ${scenarioEntry.title}`);
    lines.push(`- status: ${scenarioEntry.status}`);
    for (const stepEntry of scenarioEntry.steps) {
      lines.push(`- ${stepEntry.status}: ${stepEntry.label}`);
      if (stepEntry.error) {
        lines.push(`  - error: ${stepEntry.error.message}`);
      }
    }
    lines.push("");
  }

  if (data.contractNotes.length > 0) {
    lines.push("## Contract Notes");
    lines.push("");
    for (const note of data.contractNotes) {
      lines.push(`- ${note.scenario}: ${note.note}`);
    }
    lines.push("");
  }

  lines.push("## Browser Targets");
  lines.push("");
  for (const [key, value] of Object.entries(data.browserTargets)) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push("");
  lines.push(`JSON evidence: ${data.artifacts.reportPath}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}
