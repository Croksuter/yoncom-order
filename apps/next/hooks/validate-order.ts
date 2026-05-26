import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import { toast } from "./use-toast";
import useCartStore, { CartState } from "~/stores/cart.store";
import * as ClientMenuResponse from "shared/types/responses/client/menu";
import { useTranslation } from "~/hooks/use-translation";

export function useValidateOrder() {
  const { clientTable } = useTableStore();
  const { menus, clientLoad } = useMenuStore();
  const { t } = useTranslation();

  return async function validateOrder(menuOrders: CartState["menuOrders"]) {
    const beforeMenus = JSON.parse(JSON.stringify(menus)) as ClientMenuResponse.Menu[];
    const success = await clientLoad({});

    if (!success) {
      toast({
        title: t("menu_load_failed"),
        description: t("menu_load_failed_desc"),
        variant: "destructive",
      });
      return false;
    }

    const updatedMenus = success.result.flatMap((m) => m.menus);

    for (const menuOrder of menuOrders) {
      const beforeMenu = beforeMenus.find((m) => m.id === menuOrder.menuId);
      const updatedMenu = updatedMenus.find((m) => m.id === menuOrder.menuId);
      if (!updatedMenu) {
        toast({
          title: t("menu_deleted_alert"),
          description: t("menu_sold_out_alert_desc"),
          variant: "destructive",
        });
        useCartStore.getState().removeMenuOrder(menuOrder.menuId);
        return false;
      }
      const updatedAvailableQuantity = updatedMenu.bundleAvailableQuantity ?? updatedMenu.quantity;
      if (menuOrder.quantity > updatedAvailableQuantity) {
        toast({
          title: t("menu_quantity_changed_alert"),
          description: t("menu_load_failed_desc"),
          variant: "default",
        });
        return false;
      }
      if (beforeMenu?.price !== updatedMenu.price) {
        toast({
          title: t("menu_price_changed_alert"),
          description: t("menu_price_changed_desc"),
          variant: "default",
        });
        return false;
      }
      if (!updatedMenu.available || updatedAvailableQuantity <= 0) {
        toast({
          title: t("menu_sold_out_alert"),
          description: t("menu_sold_out_alert_desc"),
          variant: "destructive",
        });
        useCartStore.getState().removeMenuOrder(menuOrder.menuId);
        return false;
      }
    }

    return true;
  };
}
