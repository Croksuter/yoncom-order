import { z } from "zod";

export const createValidation = z.object({
  amount: z.number().int().min(1).max(10_000_000),
  bank: z.string().trim().min(1).max(80).default("MANUAL"),
  timestamp: z.number().int(),
  name: z.string().trim().min(1).max(80),
  rawText: z.string().max(500).optional(),
  source: z.enum(["KB_PUSH", "KB_SMS", "SELENIUM", "MANUAL"]).default("MANUAL"),
  dedupeKey: z.string().min(1).max(160).optional(),
}).strict();
export type Create = z.infer<typeof createValidation>;

export const confirmValidation = z.object({
  bankTransactionId: z.string().length(15),
  paymentId: z.string().length(15),
}).strict();
export type Confirm = z.infer<typeof confirmValidation>;

export const ignoreValidation = z.object({
  bankTransactionId: z.string().length(15),
}).strict();
export type Ignore = z.infer<typeof ignoreValidation>;
