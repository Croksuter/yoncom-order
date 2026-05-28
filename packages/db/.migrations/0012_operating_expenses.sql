CREATE TABLE `operatingExpenses` (
  `id` text PRIMARY KEY NOT NULL,
  `label` text NOT NULL,
  `amount` integer NOT NULL,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL,
  `deletedAt` integer
);
