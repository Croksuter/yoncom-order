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

export type Get = z.infer<typeof getValidation>;
export type DeleteRecords = z.infer<typeof deleteRecordsValidation>;
