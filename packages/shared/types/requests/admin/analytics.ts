import { z } from "zod";

export const getValidation = z.object({
  from: z.coerce.number().int().min(0),
  to: z.coerce.number().int().min(0),
  bucket: z.enum(["hour", "day"]).default("day"),
}).strict().refine((value) => value.to > value.from);

const recordIds = z.array(z.string().min(1)).max(100).default([]);

export const deleteRecordsValidation = z.object({
  orderIds: recordIds,
  paymentIds: recordIds,
}).strict().refine((value) => value.orderIds.length > 0 || value.paymentIds.length > 0);

const operatingExpenseValidation = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1).max(80),
  amount: z.coerce.number().int().min(0).max(100_000_000),
}).strict();

export const saveAnalyticsSettingsValidation = z.object({
  operatingExpenses: z.array(operatingExpenseValidation).max(50).optional(),
  targetMarginBps: z.coerce.number().int().min(0).max(9500).optional(),
}).strict().refine((value) => value.operatingExpenses !== undefined || value.targetMarginBps !== undefined);

export const saveOperatingExpensesValidation = saveAnalyticsSettingsValidation;

export type Get = z.infer<typeof getValidation>;
export type DeleteRecords = z.infer<typeof deleteRecordsValidation>;
export type SaveAnalyticsSettings = z.infer<typeof saveAnalyticsSettingsValidation>;
export type SaveOperatingExpenses = SaveAnalyticsSettings;
