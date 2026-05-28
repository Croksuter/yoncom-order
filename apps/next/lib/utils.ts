import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as ClientTableResponse from "shared/types/responses/client/table";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import * as AdminMenuResponse from "shared/types/responses/admin/menu";
import { isPaymentPaid } from "./order-status";
import { getMenuOrderProgress } from "./menu-order-progress";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function filterTables(tables: AdminTableResponse.Get["result"], option: {
  deleted?: boolean;
  active?: boolean;
}) {
  return tables.filter((table) => {
    return (
      (option.deleted === undefined) 
      || (option.deleted ? table.deletedAt !== null : table.deletedAt === null)
    ) && (
      (option.active === undefined) 
      || (option.active ? table.tableContexts.some((tableContext) => tableContext.deletedAt === null) : table.tableContexts.every((tableContext) => tableContext.deletedAt !== null))
    );
  });
}

export function filterOrders(orders: ClientTableResponse.Get["result"]["tableContexts"][number]["orders"], option: {
  paid?: boolean;
  cancelled?: boolean;
  done?: boolean;
}) {
  return orders.filter((order) => {
    return (
      (
        (option.paid === undefined) 
        || (isPaymentPaid(order.payment) === option.paid)
      ) && (
        (option.cancelled === undefined) 
        || (option.cancelled ? order.deletedAt !== null : order.deletedAt === null)
      ) && (
        (option.done === undefined) 
        || (option.done
          ? order.menuOrders.every((mO) => getMenuOrderProgress(mO).pendingQuantity === 0)
          : order.menuOrders.some((mO) => getMenuOrderProgress(mO).pendingQuantity > 0))
      )
    );
  });
}

export function filterMenuOrders(menuOrders: ClientTableResponse.Get["result"]["tableContexts"][number]["orders"][number]["menuOrders"], option: {
  done: boolean;
}) {
  return menuOrders.filter((menuOrder) => {
    return option.done ? getMenuOrderProgress(menuOrder).pendingQuantity === 0 : getMenuOrderProgress(menuOrder).pendingQuantity > 0
  });
}

export function filterMenus(menus: AdminMenuResponse.Get["result"][number]["menus"], option: {
  deleted?: boolean;
  categoryId?: string;
}) {
  return menus.filter((menu) => {
    return (
      (option.deleted === undefined) 
      || (option.deleted ? menu.deletedAt !== null : menu.deletedAt === null)
    ) && (
      (option.categoryId === undefined) 
      || (option.categoryId ? menu.menuCategoryId === option.categoryId : true)
    )
  });
}
