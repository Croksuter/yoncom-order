CREATE TABLE `tableSessions` (
  `id` text PRIMARY KEY NOT NULL,
  `tableId` text NOT NULL REFERENCES `tables`(`id`),
  `tableContextId` text NOT NULL REFERENCES `tableContexts`(`id`),
  `csrfToken` text NOT NULL,
  `expiresAt` integer NOT NULL,
  `revokedAt` integer,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `tableSessions_table_active_idx` ON `tableSessions` (`tableId`, `tableContextId`, `revokedAt`, `expiresAt`);--> statement-breakpoint
CREATE TABLE `mutationRequests` (
  `id` text PRIMARY KEY NOT NULL,
  `actorScope` text NOT NULL,
  `idempotencyKey` text NOT NULL,
  `requestHash` text NOT NULL,
  `status` text NOT NULL,
  `resultJson` text,
  `revision` integer,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `mutationRequests_scope_key_idx` ON `mutationRequests` (`actorScope`, `idempotencyKey`);--> statement-breakpoint
CREATE TABLE `scopeRevisions` (
  `scope` text PRIMARY KEY NOT NULL,
  `revision` integer NOT NULL,
  `updatedAt` integer NOT NULL
);--> statement-breakpoint
CREATE TABLE `domainEvents` (
  `id` text PRIMARY KEY NOT NULL,
  `scope` text NOT NULL,
  `revision` integer NOT NULL,
  `type` text NOT NULL,
  `entityType` text,
  `entityId` text,
  `payloadJson` text,
  `mutationId` text,
  `createdAt` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `domainEvents_scope_revision_idx` ON `domainEvents` (`scope`, `revision`);--> statement-breakpoint
CREATE INDEX `domainEvents_scope_created_idx` ON `domainEvents` (`scope`, `createdAt`);--> statement-breakpoint
CREATE INDEX `orders_table_context_idx` ON `orders` (`tableContextId`);--> statement-breakpoint
CREATE INDEX `payments_order_status_idx` ON `payments` (`orderId`, `status`);--> statement-breakpoint
CREATE INDEX `menuOrders_order_status_idx` ON `menuOrders` (`orderId`, `status`);--> statement-breakpoint
CREATE INDEX `tableContexts_table_active_idx` ON `tableContexts` (`tableId`, `deletedAt`);
