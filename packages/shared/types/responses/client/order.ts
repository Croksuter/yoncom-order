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

export type Get = {
  result: Schema.Order & {
    menuOrders: Schema.MenuOrder[];
    payment: Schema.Payment;
  };
};
export type Remove = {
  result: string;
};
