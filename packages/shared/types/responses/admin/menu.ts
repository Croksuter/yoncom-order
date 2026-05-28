import * as Schema from "db/schema";
import type { MenuBundleItem } from "../client/menu";

export type Menu = Schema.Menu & {
  bundleItems?: MenuBundleItem[];
  bundleAvailableQuantity?: number | null;
};

export type Create = {
  result: string;
}

export type Update = {
  result: string;
}

export type Remove = {
  result: string;
}

export type Get = {
  result: (Schema.MenuCategory & {
    menus: Menu[];
  })[];
}
