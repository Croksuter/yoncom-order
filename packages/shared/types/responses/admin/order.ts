import * as Schema from "db/schema";

export type Create = {
  result: string;
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

export type Paid = {
  result: string;
};

export type Complete = {
  result: string;
};

export type PickUp = {
  result: string;
};
