import { z } from "zod";

export const menuCountValidation = z.object({
  menuId: z.string().length(15),
  countAs: z.number().int().min(0).max(99),
}).strict();

export const updateValidation = z.object({
  rule: z.object({
    enabled: z.boolean(),
    requiredCount: z.number().int().min(1).max(999),
    menuCounts: z.array(menuCountValidation).max(200),
  }).strict(),
}).strict();
export type Update = z.infer<typeof updateValidation>;

export const getValidation = z.object({}).strict();
export type Get = z.infer<typeof getValidation>;
