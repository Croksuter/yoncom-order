import { z } from "zod";

export const bundleItemValidation = z.object({
  componentMenuId: z.string().length(15),
  quantity: z.number().int().min(1).max(99),
}).strict();

export const updateValidation = z.object({
  bundleMenuId: z.string().length(15),
  items: z.array(bundleItemValidation).max(50),
}).strict();
export type Update = z.infer<typeof updateValidation>;
