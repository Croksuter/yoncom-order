CREATE TABLE `paymentSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`bankName` text NOT NULL,
	`accountNumber` text NOT NULL,
	`accountHolder` text NOT NULL,
	`tossTransferUrlTemplate` text NOT NULL,
	`depositGuide` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
