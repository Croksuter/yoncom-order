import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";

export default function useOrder(orderId: string) {
  const { tables } = useTableStore();
  const { menus } = useMenuStore();

  const order = tables.flatMap(
    (table) => table.tableContexts.flatMap(
      (tableContext) => tableContext.orders)
    ).find((order) => order.id === orderId);
  if (!order) throw new Error(`Order with orderId(${orderId}) not found`);

  const menuOrders = order.menuOrders;
  const menuOrderInfos = menuOrders.map((menuOrder) => {
    const menu = menus.find((menu) => menu.id === menuOrder.menuId);
    if (!menu) throw new Error(`Menu with menuId(${menuOrder.menuId}) not found`);
    return {
      menuId: menuOrder.menuId,
      menuName: menu.name,
      menuPrice: menu.price,
      quantity: menuOrder.quantity,
      totalPrice: menu.price * menuOrder.quantity,
    }
  });

  const totalPrice = menuOrderInfos.reduce((acc, menuOrderInfo) => acc + menuOrderInfo.totalPrice, 0);

  return {
    order,
    menuOrderInfos,
    totalPrice,
  }
}