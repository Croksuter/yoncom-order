import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { generateId } from "lucia";
import { relations } from "drizzle-orm";

export const userRole = {
  UNVERIFIED: "UNVERIFIED",
  ADMIN: "ADMIN",
  USER: "USER",
} as const;
export type UserRole = (typeof userRole)[keyof typeof userRole];
export const menuOrderStatus = {
  PENDING: "PENDING",
  READY: "READY",
  PICKED_UP: "PICKED_UP",
  CANCELLED: "CANCELLED",
} as const;
export type MenuOrderStatus =
  (typeof menuOrderStatus)[keyof typeof menuOrderStatus];

export const orderStatus = {
  ACTIVE: "ACTIVE",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;
export type OrderStatus = (typeof orderStatus)[keyof typeof orderStatus];

export const paymentStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  MANUAL_REVIEW: "MANUAL_REVIEW",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
  REFUND_PENDING: "REFUND_PENDING",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof paymentStatus)[keyof typeof paymentStatus];

export const bankTransactionStatus = {
  UNMATCHED: "UNMATCHED",
  AUTO_MATCHED: "AUTO_MATCHED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  IGNORED: "IGNORED",
} as const;
export type BankTransactionStatus =
  (typeof bankTransactionStatus)[keyof typeof bankTransactionStatus];

export const bankTransactionSource = {
  KB_PUSH: "KB_PUSH",
  KB_SMS: "KB_SMS",
  SELENIUM: "SELENIUM",
  MANUAL: "MANUAL",
} as const;
export type BankTransactionSource =
  (typeof bankTransactionSource)[keyof typeof bankTransactionSource];

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId(15)),
  role: text("role").notNull().$type<UserRole>().default(userRole.UNVERIFIED),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),

  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  deletedAt: integer("deletedAt"),
});

export type User = typeof users.$inferSelect;

export const menuCategories = sqliteTable("menuCategories", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId(15)),
  name: text("name").notNull(),
  nameEn: text("nameEn"),
  description: text("description").notNull(),
  descriptionEn: text("descriptionEn"),

  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  deletedAt: integer("deletedAt"),
});

export const menuCategoriesRelations = relations(
  menuCategories,
  ({ many }) => ({
    menus: many(menus),
  }),
);

export type MenuCategory = typeof menuCategories.$inferSelect;

export const menus = sqliteTable("menus", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId(15)),
  name: text("name").notNull(),
  nameEn: text("nameEn"),
  image: text("image").notNull(),
  description: text("description").notNull(),
  descriptionEn: text("descriptionEn"),
  price: integer("price").notNull(),
  quantity: integer("quantity").notNull(),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
  menuCategoryId: text("menuCategoryId")
    .notNull()
    .references(() => menuCategories.id),

  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  deletedAt: integer("deletedAt"),
});

export const menusRelations = relations(menus, ({ one, many }) => ({
  menuOrders: many(menuOrders),
  bundleItems: many(menuBundleItems, {
    relationName: "bundleMenu",
  }),
  bundleComponentItems: many(menuBundleItems, {
    relationName: "componentMenu",
  }),
  firstOrderRuleMenuCounts: many(firstOrderRuleMenuCounts),
  menuCategory: one(menuCategories, {
    fields: [menus.menuCategoryId],
    references: [menuCategories.id],
  }),
}));

export type Menu = typeof menus.$inferSelect;

export const firstOrderRules = sqliteTable("firstOrderRules", {
  id: text("id").primaryKey().notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  requiredCount: integer("requiredCount").notNull().default(1),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const firstOrderRulesRelations = relations(firstOrderRules, ({ many }) => ({
  menuCounts: many(firstOrderRuleMenuCounts),
}));

export type FirstOrderRule = typeof firstOrderRules.$inferSelect;

export const firstOrderRuleMenuCounts = sqliteTable(
  "firstOrderRuleMenuCounts",
  {
    ruleId: text("ruleId")
      .notNull()
      .references(() => firstOrderRules.id, { onDelete: "cascade" }),
    menuId: text("menuId")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    countAs: integer("countAs").notNull().default(0),
    createdAt: integer("createdAt")
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updatedAt")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    primaryKey({ columns: [table.ruleId, table.menuId] }),
  ],
);

export const firstOrderRuleMenuCountsRelations = relations(firstOrderRuleMenuCounts, ({ one }) => ({
  rule: one(firstOrderRules, {
    fields: [firstOrderRuleMenuCounts.ruleId],
    references: [firstOrderRules.id],
  }),
  menu: one(menus, {
    fields: [firstOrderRuleMenuCounts.menuId],
    references: [menus.id],
  }),
}));

export type FirstOrderRuleMenuCount = typeof firstOrderRuleMenuCounts.$inferSelect;

export const menuBundleItems = sqliteTable(
  "menuBundleItems",
  {
    bundleMenuId: text("bundleMenuId")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    componentMenuId: text("componentMenuId")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: integer("createdAt")
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updatedAt")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    primaryKey({ columns: [table.bundleMenuId, table.componentMenuId] }),
  ],
);

export const menuBundleItemsRelations = relations(menuBundleItems, ({ one }) => ({
  bundleMenu: one(menus, {
    fields: [menuBundleItems.bundleMenuId],
    references: [menus.id],
    relationName: "bundleMenu",
  }),
  componentMenu: one(menus, {
    fields: [menuBundleItems.componentMenuId],
    references: [menus.id],
    relationName: "componentMenu",
  }),
}));

export type MenuBundleItem = typeof menuBundleItems.$inferSelect;

export const uploadedImages = sqliteTable("uploadedImages", {
  id: text("id").primaryKey().notNull(),
  originalName: text("originalName").notNull(),
  contentType: text("contentType").notNull(),
  extension: text("extension").notNull(),
  byteSize: integer("byteSize").notNull(),
  base64Size: integer("base64Size").notNull(),
  chunkCount: integer("chunkCount").notNull(),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type UploadedImage = typeof uploadedImages.$inferSelect;

export const uploadedImageChunks = sqliteTable(
  "uploadedImageChunks",
  {
    imageId: text("imageId")
      .notNull()
      .references(() => uploadedImages.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunkIndex").notNull(),
    data: text("data").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.imageId, table.chunkIndex] }),
  ],
);

export type UploadedImageChunk = typeof uploadedImageChunks.$inferSelect;

export const tables = sqliteTable("tables", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId(15)),
  key: integer("key").notNull(),
  name: text("name").notNull().unique(),
  seats: integer("seats").notNull(),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  deletedAt: integer("deletedAt"),
});

export const tablesRelations = relations(tables, ({ many }) => ({
  tableContexts: many(tableContexts),
}));

export type Table = typeof tables.$inferSelect;

export const tableContexts = sqliteTable("tableContexts", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId(15)),
  tableId: text("tableId")
    .notNull()
    .references(() => tables.id),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  deletedAt: integer("deletedAt"),
});

export const tableContextsRelations = relations(
  tableContexts,
  ({ one, many }) => ({
    table: one(tables, {
      fields: [tableContexts.tableId],
      references: [tables.id],
    }),
    orders: many(orders),
  }),
);

export type TableContext = typeof tableContexts.$inferSelect;

export const tableSessions = sqliteTable("tableSessions", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId(40)),
  tableId: text("tableId")
    .notNull()
    .references(() => tables.id),
  tableContextId: text("tableContextId")
    .notNull()
    .references(() => tableContexts.id),
  csrfToken: text("csrfToken").notNull(),
  expiresAt: integer("expiresAt").notNull(),
  revokedAt: integer("revokedAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const tableSessionsRelations = relations(tableSessions, ({ one }) => ({
  table: one(tables, {
    fields: [tableSessions.tableId],
    references: [tables.id],
  }),
  tableContext: one(tableContexts, {
    fields: [tableSessions.tableContextId],
    references: [tableContexts.id],
  }),
}));

export type TableSession = typeof tableSessions.$inferSelect;

export const orders = sqliteTable("orders", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId(15)),
  clientOrderId: text("clientOrderId").unique(),
  displayNumber: integer("displayNumber"),
  status: text("status")
    .notNull()
    .$type<OrderStatus>()
    .default(orderStatus.ACTIVE),
  expiresAt: integer("expiresAt"),
  cancelReason: text("cancelReason"),
  cancelledAt: integer("cancelledAt"),
  cancelledByUserId: text("cancelledByUserId").references(() => users.id),
  tableContextId: text("tableContextId")
    .notNull()
    .references(() => tableContexts.id),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  deletedAt: integer("deletedAt"),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tableContext: one(tableContexts, {
    fields: [orders.tableContextId],
    references: [tableContexts.id],
  }),
  payment: one(payments),
  menuOrders: many(menuOrders),
}));

export type Order = typeof orders.$inferSelect;

export const payments = sqliteTable("payments", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId(15)),
  paid: integer("paid", { mode: "boolean" }).notNull().default(false),
  amount: integer("amount").notNull(),
  status: text("status")
    .notNull()
    .$type<PaymentStatus>()
    .default(paymentStatus.PENDING),
  paymentCode: integer("paymentCode"),
  originalAmount: integer("originalAmount"),
  expectedTransferAmount: integer("expectedTransferAmount"),
  expiresAt: integer("expiresAt"),
  paidAt: integer("paidAt"),
  matchedBankTransactionId: text("matchedBankTransactionId"),
  matchedBy: text("matchedBy"),
  depositorHint: text("depositorHint"),
  refundAmount: integer("refundAmount"),
  refundRequestedAt: integer("refundRequestedAt"),
  refundedAt: integer("refundedAt"),
  refundHandledByUserId: text("refundHandledByUserId").references(() => users.id),
  refundNote: text("refundNote"),
  bank: text("bank"),
  depositor: text("depositor"),
  orderId: text("orderId").references(() => orders.id),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  deletedAt: integer("deletedAt"),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export type Payment = typeof payments.$inferSelect;

export const paymentCodeLeases = sqliteTable("paymentCodeLeases", {
  code: integer("code").primaryKey().notNull(),
  paymentId: text("paymentId").notNull().unique(),
  expiresAt: integer("expiresAt").notNull(),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type PaymentCodeLease = typeof paymentCodeLeases.$inferSelect;

export const bankTransactions = sqliteTable("bankTransactions", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId(15)),
  dedupeKey: text("dedupeKey").notNull().unique(),
  amount: integer("amount").notNull(),
  depositor: text("depositor").notNull(),
  receivedAt: integer("receivedAt").notNull(),
  rawText: text("rawText").notNull(),
  source: text("source")
    .notNull()
    .$type<BankTransactionSource>()
    .default(bankTransactionSource.MANUAL),
  status: text("status")
    .notNull()
    .$type<BankTransactionStatus>()
    .default(bankTransactionStatus.UNMATCHED),
  matchedPaymentId: text("matchedPaymentId").references(() => payments.id),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const bankTransactionsRelations = relations(bankTransactions, ({ one }) => ({
  payment: one(payments, {
    fields: [bankTransactions.matchedPaymentId],
    references: [payments.id],
  }),
}));

export type BankTransaction = typeof bankTransactions.$inferSelect;

export const paymentSettings = sqliteTable("paymentSettings", {
  id: text("id").primaryKey().notNull(),
  bankName: text("bankName").notNull(),
  accountNumber: text("accountNumber").notNull(),
  accountHolder: text("accountHolder").notNull(),
  tossTransferUrlTemplate: text("tossTransferUrlTemplate").notNull(),
  depositGuide: text("depositGuide").notNull(),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type PaymentSettings = typeof paymentSettings.$inferSelect;

export const clientNoticeSettings = sqliteTable("clientNoticeSettings", {
  id: text("id").primaryKey().notNull(),
  description: text("description").notNull().default(""),
  descriptionEn: text("descriptionEn").notNull().default(""),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type ClientNoticeSettings = typeof clientNoticeSettings.$inferSelect;

export const menuOrders = sqliteTable("menuOrders", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId(15)),
  quantity: integer("quantity").notNull(),
  status: text("status")
    .notNull()
    .$type<MenuOrderStatus>()
    .default(menuOrderStatus.PENDING),
  orderId: text("orderId")
    .notNull()
    .references(() => orders.id),
  menuId: text("menuId")
    .notNull()
    .references(() => menus.id),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  deletedAt: integer("deletedAt"),
});

export const menuOrdersRelations = relations(menuOrders, ({ one }) => ({
  order: one(orders, {
    fields: [menuOrders.orderId],
    references: [orders.id],
  }),
  menu: one(menus, {
    fields: [menuOrders.menuId],
    references: [menus.id],
  }),
}));

export type MenuOrder = typeof menuOrders.$inferSelect;

export const mutationRequests = sqliteTable("mutationRequests", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId(15)),
  actorScope: text("actorScope").notNull(),
  idempotencyKey: text("idempotencyKey").notNull(),
  requestHash: text("requestHash").notNull(),
  status: text("status").notNull(),
  resultJson: text("resultJson"),
  revision: integer("revision"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type MutationRequest = typeof mutationRequests.$inferSelect;

export const scopeRevisions = sqliteTable("scopeRevisions", {
  scope: text("scope").primaryKey().notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type ScopeRevision = typeof scopeRevisions.$inferSelect;

export const domainEvents = sqliteTable("domainEvents", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId(15)),
  scope: text("scope").notNull(),
  revision: integer("revision").notNull(),
  type: text("type").notNull(),
  entityType: text("entityType"),
  entityId: text("entityId"),
  payloadJson: text("payloadJson"),
  mutationId: text("mutationId"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type DomainEvent = typeof domainEvents.$inferSelect;
