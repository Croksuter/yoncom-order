import { z } from "zod";

export const createValidation = z.object({
  menuCategoryOptions: z.object({
    name: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().max(80).optional().nullable(),
    description: z.string().max(500),
    descriptionEn: z.string().max(500).optional().nullable(),
  }).strict(),
}).strict();
export type Create = z.infer<typeof createValidation>;

export const updateValidation = z.object({
  menuCategoryId: z.string().length(15),
  menuCategoryOptions: z.object({
    name: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().max(80).optional().nullable(),
    description: z.string().max(500),
    descriptionEn: z.string().max(500).optional().nullable(),
  }).strict(),
}).strict();
export type Update = z.infer<typeof updateValidation>;

export const removeValidation = z.object({
  menuCategoryId: z.string().length(15),
}).strict();
export type Remove = z.infer<typeof removeValidation>;
