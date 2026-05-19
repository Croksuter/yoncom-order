import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Scrypt } from "lucia";

const root = resolve(process.cwd(), "../..");
const now = Date.now();
const oneMinute = 60 * 1000;
const oneHour = 60 * oneMinute;

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((rawLine) => rawLine.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        let value = line.slice(index + 1).trim();

        if (
          (value.startsWith("\"") && value.endsWith("\"")) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        return [key, value];
      }),
  );
}

function fixtureId(label) {
  const id = `demo_${label}`.padEnd(15, "0");

  if (id.length !== 15) {
    throw new Error(`Fixture id must be exactly 15 chars: ${id}`);
  }

  return id;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

const env = {
  ...parseEnvFile(join(root, ".env")),
  ...parseEnvFile(join(root, ".env.local")),
};

const accountId = env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = env.CLOUDFLARE_DATABASE_ID;
const token = env.CLOUDFLARE_D1_TOKEN;

if (!accountId || !databaseId || !token) {
  throw new Error("Cloudflare D1 env vars are required: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_D1_TOKEN");
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

async function query(sql, params = []) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
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
    throw new Error(message);
  }

  return result.results ?? [];
}

async function tableExists(tableName) {
  try {
    await query(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`);
    return true;
  } catch {
    return false;
  }
}

async function columnExists(tableName, columnName) {
  try {
    await query(`SELECT ${columnName} FROM ${quoteIdentifier(tableName)} LIMIT 0`);
    return true;
  } catch {
    return false;
  }
}

async function getExistingColumns(tableName, candidateColumns) {
  const columns = [];

  for (const columnName of candidateColumns) {
    if (await columnExists(tableName, columnName)) {
      columns.push(columnName);
    }
  }

  return columns;
}

async function resolveTableContextName() {
  if (await tableExists("tableContexts")) {
    return "tableContexts";
  }

  if (await tableExists("tableContext")) {
    return "tableContext";
  }

  throw new Error("Neither tableContexts nor tableContext exists in D1.");
}

let liveColumns = {};

async function upsertRows(tableName, rows) {
  if (rows.length === 0) {
    return;
  }

  const columns = Object.keys(rows[0]).filter((column) => liveColumns[tableName]?.includes(column) ?? true);
  if (columns.length === 0) {
    return;
  }
  const columnSql = columns.map(quoteIdentifier).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO ${quoteIdentifier(tableName)} (${columnSql}) VALUES (${placeholders})`;

  for (const row of rows) {
    await query(sql, columns.map((column) => row[column]));
  }
}

const categoryIds = {
  meals: fixtureId("cat_meal"),
  drinks: fixtureId("cat_drink"),
  sweets: fixtureId("cat_sweet"),
};

const menuIds = {
  bibimbap: fixtureId("menu_bibim"),
  jeyuk: fixtureId("menu_jeyuk"),
  stew: fixtureId("menu_stew"),
  ade: fixtureId("menu_ade"),
  coffee: fixtureId("menu_coffe"),
  brownie: fixtureId("menu_brown"),
};

const tableIds = {
  window: fixtureId("table_win1"),
  family: fixtureId("table_fam1"),
  bar: fixtureId("table_bar1"),
  terrace: fixtureId("table_terr"),
};

const contextIds = {
  window: fixtureId("ctx_win1"),
  family: fixtureId("ctx_fam1"),
  barClosed: fixtureId("ctx_barold"),
};

const orderIds = {
  live: fixtureId("ord_live1"),
  paid: fixtureId("ord_paid1"),
  cooking: fixtureId("ord_cook1"),
};

const paymentIds = {
  live: fixtureId("pay_live1"),
  paid: fixtureId("pay_paid1"),
  cooking: fixtureId("pay_cook1"),
};

const bankTransactionIds = {
  review: fixtureId("bt_review1"),
};

const menuOrderIds = {
  liveBibimbap: fixtureId("mo_bibim1"),
  liveAde: fixtureId("mo_ade1"),
  liveBrownie: fixtureId("mo_brown1"),
  paidJeyuk: fixtureId("mo_jeyuk1"),
  paidCoffee: fixtureId("mo_coffe1"),
  cookingStew: fixtureId("mo_stew1"),
  cookingAde: fixtureId("mo_ade2"),
};

const userIds = {
  admin: fixtureId("user_admin"),
};

const imageUrls = {
  bibimbap: "https://upload.wikimedia.org/wikipedia/commons/4/44/Dolsot-bibimbap.jpg",
  jeyuk: "https://upload.wikimedia.org/wikipedia/commons/8/8b/Jeyuk-bokkeum.jpg",
  stew: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Korean_stew-Kimchi_jjigae-01.jpg",
  ade: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Orange_juice_1.jpg",
  coffee: "https://upload.wikimedia.org/wikipedia/commons/d/df/Cold_Brew_Coffee.jpg",
  brownie: "https://upload.wikimedia.org/wikipedia/commons/6/68/Chocolatebrownie.JPG",
};

const contextTableName = await resolveTableContextName();
const paymentCodeLeasesExists = await tableExists("paymentCodeLeases");
const bankTransactionsExists = await tableExists("bankTransactions");
liveColumns = {
  users: await getExistingColumns("users", ["id", "role", "name", "email", "password", "createdAt", "updatedAt", "deletedAt"]),
  menuCategories: await getExistingColumns("menuCategories", ["id", "name", "description", "userId", "createdAt", "updatedAt", "deletedAt"]),
  menus: await getExistingColumns("menus", ["id", "name", "image", "description", "price", "quantity", "available", "menuCategoryId", "userId", "createdAt", "updatedAt", "deletedAt"]),
  tables: await getExistingColumns("tables", ["id", "key", "name", "seats", "userId", "createdAt", "updatedAt", "deletedAt"]),
  [contextTableName]: await getExistingColumns(contextTableName, ["id", "tableId", "userId", "createdAt", "updatedAt", "deletedAt"]),
  orders: await getExistingColumns("orders", ["id", "clientOrderId", "displayNumber", "status", "expiresAt", "tableContextId", "paymentId", "userId", "createdAt", "updatedAt", "deletedAt"]),
  payments: await getExistingColumns("payments", ["id", "paid", "amount", "method", "bank", "depositor", "orderId", "status", "paymentCode", "originalAmount", "expectedTransferAmount", "expiresAt", "paidAt", "matchedBankTransactionId", "matchedBy", "depositorHint", "userId", "createdAt", "updatedAt", "deletedAt"]),
  menuOrders: await getExistingColumns("menuOrders", ["id", "quantity", "status", "orderId", "menuId", "userId", "createdAt", "updatedAt", "deletedAt"]),
  paymentCodeLeases: paymentCodeLeasesExists ? await getExistingColumns("paymentCodeLeases", ["code", "paymentId", "expiresAt", "createdAt"]) : [],
  bankTransactions: bankTransactionsExists ? await getExistingColumns("bankTransactions", ["id", "dedupeKey", "amount", "depositor", "receivedAt", "rawText", "source", "status", "matchedPaymentId", "createdAt"]) : [],
};
const passwordHash = await new Scrypt().hash("demo-admin-1234");

await upsertRows("users", [
  {
    id: userIds.admin,
    role: "ADMIN",
    name: "운영 관리자",
    email: "demo.admin@yoncom.local",
    password: passwordHash,
    createdAt: now - 14 * 24 * oneHour,
    updatedAt: now - 10 * oneMinute,
    deletedAt: null,
  },
]);

await upsertRows("menuCategories", [
  {
    id: categoryIds.meals,
    name: "한식 식사",
    description: "점심과 저녁 주문에 맞춘 든든한 한식 메뉴",
    userId: userIds.admin,
    createdAt: now - 12 * 24 * oneHour,
    updatedAt: now - 2 * oneHour,
    deletedAt: null,
  },
  {
    id: categoryIds.drinks,
    name: "음료",
    description: "식사와 함께 주문하기 좋은 차가운 음료와 커피",
    userId: userIds.admin,
    createdAt: now - 12 * 24 * oneHour,
    updatedAt: now - 2 * oneHour,
    deletedAt: null,
  },
  {
    id: categoryIds.sweets,
    name: "디저트",
    description: "식후에 나누기 좋은 작은 디저트",
    userId: userIds.admin,
    createdAt: now - 12 * 24 * oneHour,
    updatedAt: now - 2 * oneHour,
    deletedAt: null,
  },
]);

await upsertRows("menus", [
  {
    id: menuIds.bibimbap,
    name: "참기름 비빔밥",
    image: imageUrls.bibimbap,
    description: "계절 나물, 약고추장, 반숙 계란을 올린 대표 식사 메뉴",
    price: 9500,
    quantity: 24,
    available: 1,
    menuCategoryId: categoryIds.meals,
    createdAt: now - 10 * 24 * oneHour,
    updatedAt: now - 20 * oneMinute,
    deletedAt: null,
  },
  {
    id: menuIds.jeyuk,
    name: "제육 덮밥",
    image: imageUrls.jeyuk,
    description: "매콤한 돼지고기 볶음과 따뜻한 밥, 계절 반찬 구성",
    price: 10500,
    quantity: 18,
    available: 1,
    menuCategoryId: categoryIds.meals,
    createdAt: now - 10 * 24 * oneHour,
    updatedAt: now - 20 * oneMinute,
    deletedAt: null,
  },
  {
    id: menuIds.stew,
    name: "김치찌개 정식",
    image: imageUrls.stew,
    description: "잘 익은 김치와 돼지고기를 넣고 끓인 1인 정식",
    price: 11000,
    quantity: 12,
    available: 1,
    menuCategoryId: categoryIds.meals,
    createdAt: now - 10 * 24 * oneHour,
    updatedAt: now - 20 * oneMinute,
    deletedAt: null,
  },
  {
    id: menuIds.ade,
    name: "청귤 에이드",
    image: imageUrls.ade,
    description: "청귤청과 탄산수를 섞은 산뜻한 시그니처 음료",
    price: 5500,
    quantity: 30,
    available: 1,
    menuCategoryId: categoryIds.drinks,
    createdAt: now - 10 * 24 * oneHour,
    updatedAt: now - 20 * oneMinute,
    deletedAt: null,
  },
  {
    id: menuIds.coffee,
    name: "콜드브루 커피",
    image: imageUrls.coffee,
    description: "12시간 저온 추출한 고소한 콜드브루",
    price: 5000,
    quantity: 22,
    available: 1,
    menuCategoryId: categoryIds.drinks,
    createdAt: now - 10 * 24 * oneHour,
    updatedAt: now - 20 * oneMinute,
    deletedAt: null,
  },
  {
    id: menuIds.brownie,
    name: "흑임자 브라우니",
    image: imageUrls.brownie,
    description: "진한 초콜릿 브라우니에 흑임자 크림을 더한 디저트",
    price: 6500,
    quantity: 8,
    available: 1,
    menuCategoryId: categoryIds.sweets,
    createdAt: now - 10 * 24 * oneHour,
    updatedAt: now - 20 * oneMinute,
    deletedAt: null,
  },
]);

await upsertRows("tables", [
  {
    id: tableIds.window,
    key: 1,
    name: "창가 2인석",
    seats: 2,
    userId: userIds.admin,
    createdAt: now - 30 * 24 * oneHour,
    updatedAt: now - 25 * oneMinute,
    deletedAt: null,
  },
  {
    id: tableIds.family,
    key: 2,
    name: "가족 4인석",
    seats: 4,
    userId: userIds.admin,
    createdAt: now - 30 * 24 * oneHour,
    updatedAt: now - 25 * oneMinute,
    deletedAt: null,
  },
  {
    id: tableIds.bar,
    key: 3,
    name: "바 좌석 1번",
    seats: 1,
    userId: userIds.admin,
    createdAt: now - 30 * 24 * oneHour,
    updatedAt: now - 25 * oneMinute,
    deletedAt: null,
  },
  {
    id: tableIds.terrace,
    key: 4,
    name: "테라스 4인석",
    seats: 4,
    userId: userIds.admin,
    createdAt: now - 30 * 24 * oneHour,
    updatedAt: now - 25 * oneMinute,
    deletedAt: null,
  },
]);

await upsertRows(contextTableName, [
  {
    id: contextIds.window,
    tableId: tableIds.window,
    createdAt: now - 38 * oneMinute,
    updatedAt: now - 4 * oneMinute,
    deletedAt: null,
  },
  {
    id: contextIds.family,
    tableId: tableIds.family,
    createdAt: now - 92 * oneMinute,
    updatedAt: now - 18 * oneMinute,
    deletedAt: null,
  },
  {
    id: contextIds.barClosed,
    tableId: tableIds.bar,
    createdAt: now - 4 * oneHour,
    updatedAt: now - 150 * oneMinute,
    deletedAt: now - 150 * oneMinute,
  },
]);

await upsertRows("orders", [
  {
    id: orderIds.live,
    clientOrderId: "demo-client-live",
    displayNumber: 1,
    status: "ACTIVE",
    expiresAt: now + 20 * oneMinute,
    tableContextId: contextIds.window,
    createdAt: now - 31 * oneMinute,
    updatedAt: now - 7 * oneMinute,
    deletedAt: null,
  },
  {
    id: orderIds.paid,
    clientOrderId: "demo-client-paid",
    displayNumber: 2,
    status: "ACTIVE",
    expiresAt: now - 79 * oneMinute,
    tableContextId: contextIds.family,
    createdAt: now - 84 * oneMinute,
    updatedAt: now - 21 * oneMinute,
    deletedAt: null,
  },
  {
    id: orderIds.cooking,
    clientOrderId: "demo-client-cook",
    displayNumber: 3,
    status: "ACTIVE",
    expiresAt: now - 8 * oneMinute,
    tableContextId: contextIds.family,
    createdAt: now - 13 * oneMinute,
    updatedAt: now - 3 * oneMinute,
    deletedAt: null,
  },
]);

await upsertRows("payments", [
  {
    id: liveColumns.payments.includes("orderId") ? paymentIds.live : orderIds.live,
    paid: 0,
    amount: 36499,
    method: "미결제",
    bank: null,
    depositor: null,
    orderId: orderIds.live,
    status: "PENDING",
    paymentCode: 1,
    originalAmount: 36500,
    expectedTransferAmount: 36499,
    expiresAt: now + 20 * oneMinute,
    paidAt: null,
    matchedBankTransactionId: null,
    matchedBy: null,
    depositorHint: "김하린",
    createdAt: now - 31 * oneMinute,
    updatedAt: now - 7 * oneMinute,
    deletedAt: null,
  },
  {
    id: liveColumns.payments.includes("orderId") ? paymentIds.paid : orderIds.paid,
    paid: 1,
    amount: 30998,
    method: "신한은행 박준호",
    bank: "신한은행",
    depositor: "박준호",
    orderId: orderIds.paid,
    status: "PAID",
    paymentCode: 2,
    originalAmount: 31000,
    expectedTransferAmount: 30998,
    expiresAt: now - 79 * oneMinute,
    paidAt: now - 78 * oneMinute,
    matchedBankTransactionId: null,
    matchedBy: "MANUAL",
    depositorHint: "박준호",
    createdAt: now - 84 * oneMinute,
    updatedAt: now - 21 * oneMinute,
    deletedAt: null,
  },
  {
    id: liveColumns.payments.includes("orderId") ? paymentIds.cooking : orderIds.cooking,
    paid: 1,
    amount: 27497,
    method: "현장 카드 결제",
    bank: "현장 카드",
    depositor: "가족 4인석",
    orderId: orderIds.cooking,
    status: "PAID",
    paymentCode: 3,
    originalAmount: 27500,
    expectedTransferAmount: 27497,
    expiresAt: now - 8 * oneMinute,
    paidAt: now - 7 * oneMinute,
    matchedBankTransactionId: null,
    matchedBy: "MANUAL",
    depositorHint: "가족 4인석",
    createdAt: now - 13 * oneMinute,
    updatedAt: now - 3 * oneMinute,
    deletedAt: null,
  },
]);

await upsertRows("menuOrders", [
  {
    id: menuOrderIds.liveBibimbap,
    quantity: 2,
    status: "PENDING",
    orderId: orderIds.live,
    menuId: menuIds.bibimbap,
    createdAt: now - 31 * oneMinute,
    updatedAt: now - 7 * oneMinute,
    deletedAt: null,
  },
  {
    id: menuOrderIds.liveAde,
    quantity: 2,
    status: "PENDING",
    orderId: orderIds.live,
    menuId: menuIds.ade,
    createdAt: now - 30 * oneMinute,
    updatedAt: now - 7 * oneMinute,
    deletedAt: null,
  },
  {
    id: menuOrderIds.liveBrownie,
    quantity: 1,
    status: "READY",
    orderId: orderIds.live,
    menuId: menuIds.brownie,
    createdAt: now - 29 * oneMinute,
    updatedAt: now - 11 * oneMinute,
    deletedAt: null,
  },
  {
    id: menuOrderIds.paidJeyuk,
    quantity: 2,
    status: "PICKED_UP",
    orderId: orderIds.paid,
    menuId: menuIds.jeyuk,
    createdAt: now - 83 * oneMinute,
    updatedAt: now - 48 * oneMinute,
    deletedAt: null,
  },
  {
    id: menuOrderIds.paidCoffee,
    quantity: 2,
    status: "PICKED_UP",
    orderId: orderIds.paid,
    menuId: menuIds.coffee,
    createdAt: now - 82 * oneMinute,
    updatedAt: now - 48 * oneMinute,
    deletedAt: null,
  },
  {
    id: menuOrderIds.cookingStew,
    quantity: 2,
    status: "PENDING",
    orderId: orderIds.cooking,
    menuId: menuIds.stew,
    createdAt: now - 12 * oneMinute,
    updatedAt: now - 3 * oneMinute,
    deletedAt: null,
  },
  {
    id: menuOrderIds.cookingAde,
    quantity: 1,
    status: "PENDING",
    orderId: orderIds.cooking,
    menuId: menuIds.ade,
    createdAt: now - 12 * oneMinute,
    updatedAt: now - 3 * oneMinute,
    deletedAt: null,
  },
]);

if (paymentCodeLeasesExists) {
  await upsertRows("paymentCodeLeases", [
    {
      code: 1,
      paymentId: liveColumns.payments.includes("orderId") ? paymentIds.live : orderIds.live,
      expiresAt: now + 20 * oneMinute,
      createdAt: now - 31 * oneMinute,
    },
  ]);
}

if (bankTransactionsExists) {
  await upsertRows("bankTransactions", [
    {
      id: bankTransactionIds.review,
      dedupeKey: "demo:manual:review:36500:김하린",
      amount: 36500,
      depositor: "김하린",
      receivedAt: now - 2 * oneMinute,
      rawText: "국민은행 김하린 36,500원",
      source: "MANUAL",
      status: "NEEDS_REVIEW",
      matchedPaymentId: null,
      createdAt: now - 2 * oneMinute,
    },
  ]);
}

const fixtureTables = ["users", "menuCategories", "menus", "tables", contextTableName, "orders", "payments", "menuOrders"]
  .concat(paymentCodeLeasesExists ? ["paymentCodeLeases"] : [])
  .concat(bankTransactionsExists ? ["bankTransactions"] : []);
const counts = {};
for (const tableName of fixtureTables) {
  if (liveColumns[tableName]?.includes("id")) {
    counts[tableName] = (await query(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)} WHERE id LIKE ?`, ["demo_%"]))[0]?.count ?? 0;
  } else {
    counts[tableName] = (await query(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`))[0]?.count ?? 0;
  }
}

console.log(JSON.stringify({
  ok: true,
  contextTableName,
  counts,
  demoAdmin: {
    email: "demo.admin@yoncom.local",
    password: "demo-admin-1234",
  },
  urls: {
    pos: "/admin/pos",
    cooker: "/admin/cooker",
    clientWindowTable: `/client/table/${tableIds.window}`,
    clientFamilyTable: `/client/table/${tableIds.family}`,
  },
}, null, 2));
