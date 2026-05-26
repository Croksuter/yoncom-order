CREATE TABLE `bankTransactions` (
	`id` text PRIMARY KEY NOT NULL,
	`dedupeKey` text NOT NULL,
	`amount` integer NOT NULL,
	`depositor` text NOT NULL,
	`receivedAt` integer NOT NULL,
	`rawText` text NOT NULL,
	`source` text DEFAULT 'MANUAL' NOT NULL,
	`status` text DEFAULT 'UNMATCHED' NOT NULL,
	`matchedPaymentId` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`matchedPaymentId`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bankTransactions_dedupeKey_unique` ON `bankTransactions` (`dedupeKey`);--> statement-breakpoint
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
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE `paymentCodeLeases` (
	`code` integer PRIMARY KEY NOT NULL,
	`paymentId` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `paymentCodeLeases_paymentId_unique` ON `paymentCodeLeases` (`paymentId`);--> statement-breakpoint
CREATE TABLE `scopeRevisions` (
	`scope` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tableSessions` (
	`id` text PRIMARY KEY NOT NULL,
	`tableId` text NOT NULL,
	`tableContextId` text NOT NULL,
	`csrfToken` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`revokedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`tableId`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tableContextId`) REFERENCES `tableContexts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `menuCategories` ADD `nameEn` text;--> statement-breakpoint
ALTER TABLE `menuCategories` ADD `descriptionEn` text;--> statement-breakpoint
ALTER TABLE `menus` ADD `nameEn` text;--> statement-breakpoint
ALTER TABLE `menus` ADD `descriptionEn` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `clientOrderId` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `displayNumber` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `status` text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `expiresAt` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `cancelReason` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `cancelledAt` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `cancelledByUserId` text REFERENCES users(id);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_clientOrderId_unique` ON `orders` (`clientOrderId`);--> statement-breakpoint
ALTER TABLE `payments` ADD `status` text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `paymentCode` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `originalAmount` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `expectedTransferAmount` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `expiresAt` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `paidAt` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `matchedBankTransactionId` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `matchedBy` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `depositorHint` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `refundAmount` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `refundRequestedAt` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `refundedAt` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `refundHandledByUserId` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `payments` ADD `refundNote` text;