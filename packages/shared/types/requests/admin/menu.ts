import { z } from "zod";

export const createValidation = z.object({
  menuOptions: z.object({
    name: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().max(80).optional().nullable(),
    image: z.string().max(500),
    description: z.string().trim().min(1).max(500),
    descriptionEn: z.string().trim().max(500).optional().nullable(),
    price: z.number().int().min(0).max(10_000_000),
    quantity: z.number().int().min(0).max(10_000),
    menuCategoryId: z.string().length(15),
    available: z.boolean(),
  }).strict(),
}).strict();
export type Create = z.infer<typeof createValidation>;

export const updateValidation = z.object({
  menuId: z.string().length(15),
  menuOptions: z.object({
    name: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().max(80).optional().nullable(),
    image: z.string().max(500),
    description: z.string().trim().min(1).max(500),
    descriptionEn: z.string().trim().max(500).optional().nullable(),
    price: z.number().int().min(0).max(10_000_000),
    quantity: z.number().int().min(0).max(10_000),
    menuCategoryId: z.string().length(15),
    available: z.boolean(),
  }).strict(),
}).strict();
export type Update = z.infer<typeof updateValidation>;

export const removeValidation = z.object({
  menuId: z.string().length(15),
}).strict();
export type Remove = z.infer<typeof removeValidation>;

export const getValidation = z.object({}).strict();
export type Get = z.infer<typeof getValidation>;
