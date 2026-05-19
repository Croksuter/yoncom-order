import * as Schema from "db/schema";

export type Create = {
  result: {
    orderId: string;
    displayNumber: number | null;
    payment: Pick<
      Schema.Payment,
      "id" | "status" | "originalAmount" | "paymentCode" | "expectedTransferAmount" | "expiresAt"
    >;
  };
};

export type CustomerOrder = Pick<
  Schema.Order,
  "id" | "displayNumber" | "status" | "createdAt" | "expiresAt" | "cancelReason" | "cancelledAt"
> & {
  payment: Pick<
    Schema.Payment,
    | "id"
    | "status"
    | "paid"
    | "originalAmount"
    | "expectedTransferAmount"
    | "paymentCode"
    | "expiresAt"
    | "paidAt"
    | "refundAmount"
    | "refundRequestedAt"
    | "refundedAt"
  >;
  menuOrders: Array<Pick<Schema.MenuOrder, "id" | "menuId" | "quantity" | "status"> & {
    menuName: string;
    price: number;
  }>;
};

export type Get = {
  result: {
    tableId: string;
    tableName: string;
    tableContextId: string | null;
    orders: CustomerOrder[];
  };
};
export type Remove = {
  result: string;
};
