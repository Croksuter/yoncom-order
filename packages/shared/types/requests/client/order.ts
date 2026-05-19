import { z } from "zod";

export const createValidation = z.object({
  tableId: z.string().length(15),
  clientOrderId: z.string().min(8).max(64),
  menuOrders: z.array(
    z.object({
      menuId: z.string().length(15),
      quantity: z.number().int().min(1),
    }),
  ),
});
export type Create = z.infer<typeof createValidation>;

export const getValidation = z.object({
  orderId: z.string().length(15),
  tableId: z.string().length(15),
});
export type Get = z.infer<typeof getValidation>;

export const removeValidation = z.object({
  orderId: z.string().length(15),
});

export type Remove = z.infer<typeof removeValidation>;
