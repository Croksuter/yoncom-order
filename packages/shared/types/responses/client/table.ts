import * as Schema from "db/schema";

export type Get = {
  result: Schema.Table & {
    paymentSettings?: Schema.PaymentSettings;
    tableContexts: (Schema.TableContext & {
      orders: (Schema.Order & {
        menuOrders: Schema.MenuOrder[];
        payment: Schema.Payment;
      })[];
    })[];
  };
};
