ALTER TABLE `orders` ADD `clientOrderId` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `displayNumber` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `status` text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `expiresAt` integer;--> statement-breakpoint
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
UPDATE `payments`
SET
  `status` = CASE WHEN `paid` = 1 THEN 'PAID' ELSE 'PENDING' END,
  `originalAmount` = `amount`,
  `expectedTransferAmount` = `amount`
WHERE `originalAmount` IS NULL OR `expectedTransferAmount` IS NULL;--> statement-breakpoint
UPDATE `menuOrders`
SET `status` = 'PICKED_UP'
WHERE `status` = 'SERVED';--> statement-breakpoint
CREATE TABLE `paymentCodeLeases` (
  `code` integer PRIMARY KEY NOT NULL,
  `paymentId` text NOT NULL,
  `expiresAt` integer NOT NULL,
  `createdAt` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `paymentCodeLeases_paymentId_unique` ON `paymentCodeLeases` (`paymentId`);--> statement-breakpoint
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
);--> statement-breakpoint
CREATE UNIQUE INDEX `bankTransactions_dedupeKey_unique` ON `bankTransactions` (`dedupeKey`);
