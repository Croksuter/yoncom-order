import { z } from "zod";

export const createValidation = z.object({
  tableId: z.string().length(15),
  menuOrders: z.array(
    z.object({
      menuId: z.string().length(15),
      quantity: z.number().int().min(1),
    }),
  ),
});
export type CreateOrder = z.infer<typeof createValidation>;

export const getValidation = z.object({
  orderId: z.string().length(15),
});
export type GetOrderQuery = z.infer<typeof getValidation>;

export const removeValidation = z.object({
  orderId: z.string().length(15),
  cancelReason: z.string().trim().min(1).max(200).optional(),
});

export type RemoveOrderQuery = z.infer<typeof removeValidation>;

export const paidValidation = z.object({
  orderId: z.string().length(15),
  paymentId: z.string().length(15).optional(),
});
export type PaidOrder = z.infer<typeof paidValidation>;

export const completeValidation = z.object({
  menuOrderId: z.string().length(15),
});

export type CompleteOrder = z.infer<typeof completeValidation>;

export const pickUpValidation = z.object({
  menuOrderId: z.string().length(15),
});

export type PickUpOrder = z.infer<typeof pickUpValidation>;

export const refundValidation = z.object({
  orderId: z.string().length(15),
  refundNote: z.string().trim().max(200).optional(),
});

export type RefundOrder = z.infer<typeof refundValidation>;
