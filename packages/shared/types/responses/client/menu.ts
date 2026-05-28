import * as Schema from "db/schema";

export type MenuBundleItem = Pick<Schema.MenuBundleItem, "bundleMenuId" | "componentMenuId" | "quantity"> & {
  componentMenu?: Pick<Schema.Menu, "id" | "name" | "nameEn" | "quantity" | "available"> | null;
};

export type Menu = Pick<
  Schema.Menu,
  | "id"
  | "name"
  | "nameEn"
  | "image"
  | "description"
  | "descriptionEn"
  | "price"
  | "quantity"
  | "available"
  | "menuCategoryId"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
> & {
  bundleItems?: MenuBundleItem[];
  bundleAvailableQuantity?: number | null;
};

export type Get = {
  result: (Schema.MenuCategory & {
    menus: Menu[]
  })[];
}
