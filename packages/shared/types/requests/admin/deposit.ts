import { z } from "zod";

export const createValidation = z.object({
  amount: z.number().int().nonnegative(),
  bank: z.string().default("MANUAL"),
  timestamp: z.number().int(),
  name: z.string(),
  rawText: z.string().optional(),
  source: z.enum(["KB_PUSH", "KB_SMS", "SELENIUM", "MANUAL"]).default("MANUAL"),
  dedupeKey: z.string().min(1).optional(),
});
export type Create = z.infer<typeof createValidation>;

export const confirmValidation = z.object({
  bankTransactionId: z.string().length(15),
  paymentId: z.string().length(15),
});
export type Confirm = z.infer<typeof confirmValidation>;

export const ignoreValidation = z.object({
  bankTransactionId: z.string().length(15),
});
export type Ignore = z.infer<typeof ignoreValidation>;
