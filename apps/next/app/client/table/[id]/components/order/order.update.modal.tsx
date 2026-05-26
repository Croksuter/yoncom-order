
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, BottomSheetContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import useCartStore, { CartState } from "~/stores/cart.store";
import { MinusIcon, PlusIcon } from "lucide-react";
import useMenuStore from "~/stores/menu.store";
import { useValidateOrder } from "~/hooks/validate-order";
import { runWithBlockingLoading } from "~/lib/blocking-loading";
import { useTranslation } from "~/hooks/use-translation";

export default function OrderUpdateModal({
  menuOrder,
  openState, setOpenState,
}: {
  menuOrder: CartState["menuOrders"][number];
  openState: boolean;
  setOpenState: any;
}) {
  const [quantity, setQuantity] = useState<number>(0);
  const [invalid, setInvalid] = useState(false);
  const [duringConfirm, setDuringConfirm] = useState(false);
  const validateOrder = useValidateOrder();
  const { t, language } = useTranslation();

  const { updateMenuOrder } = useCartStore();
  const { menus } = useMenuStore();

  useEffect(() => {
    setQuantity(menuOrder.quantity);
  }, [menuOrder]);

  const menu = menus.find((m) => m.id === menuOrder.menuId)!;
  const availableQuantity = menu.bundleAvailableQuantity ?? menu.quantity;

  const handleConfirm = async () => {
    if (duringConfirm) return;
    if (quantity < 0 || quantity > availableQuantity) {
      setInvalid(true);
      return;
    }

    setDuringConfirm(true);
    setInvalid(false);
    setOpenState(false);
    try {
      await runWithBlockingLoading(async () => {
        const isValid = await validateOrder([{ menuId: menu.id, quantity }]);
        if (!isValid) {
          setOpenState(true);
          return;
        }

        updateMenuOrder(menuOrder.menuId, { menuId: menuOrder.menuId, quantity });
      });
    } finally {
      setDuringConfirm(false);
    }
  }

  const handleClose = () => {
    if (duringConfirm) return;
    setInvalid(false);
    setQuantity(menuOrder.quantity);
    setOpenState(false);
  }

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <BottomSheetContent className="fc justify-between max-h-[85vh]">
        {/* Drag Handle */}
        <div className="w-full flex justify-center pb-4">
          <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="space-y-1 text-center mb-6">
          <DialogTitle className="text-2xl font-black text-slate-800 dark:text-slate-100">
            {language === "en" && menu.nameEn ? menu.nameEn : menu.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400 font-medium">
            {t("order_update_select_qty")}
          </DialogDescription>
        </div>

        {/* Quantity pills counter */}
        <div className="fc items-center justify-center space-y-3 mb-6 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-900/50">
          <div className="text-xs text-slate-400 dark:text-slate-300 font-bold uppercase tracking-wider">
            {t("order_update_qty_title")}
          </div>
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-full p-1.5 shadow-sm min-w-[150px]">
            <Button
              onClick={() => quantity > 0 && setQuantity(quantity - 1)}
              className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 p-0 flex items-center justify-center cursor-pointer"
              variant="ghost"
              disabled={duringConfirm}
            >
              <MinusIcon className="h-4 w-4 stroke-[3px]" />
            </Button>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100 w-10 text-center">
              {quantity}
            </span>
            <Button
              onClick={() => quantity < availableQuantity && setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 p-0 flex items-center justify-center cursor-pointer"
              variant="ghost"
              disabled={quantity >= availableQuantity || duringConfirm}
            >
              <PlusIcon className="h-4 w-4 stroke-[3px]" />
            </Button>
          </div>

          <span className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">
            {t("cart_available_qty")}<span className="text-slate-750 dark:text-slate-350">{availableQuantity}{t("order_history_item_unit")}</span>
          </span>
        </div>

        {invalid && (
          <p className="text-center text-xs text-destructive dark:text-rose-500 font-bold mb-4">
            {t("cart_invalid_qty")}
          </p>
        )}

        {/* Action Footer */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={duringConfirm}
            className="flex-1 py-4 h-auto rounded-xl border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={duringConfirm}
            className="flex-1 py-4 h-auto rounded-xl bg-primary hover:bg-brand-600 text-white font-extrabold text-sm shadow-[0_8px_20px_rgba(0,61,155,0.2)] hover:shadow-[0_12px_28px_rgba(0,61,155,0.3)] transition-all duration-300 active:scale-[0.98] cursor-pointer"
          >
            {t("order_update_btn")}
          </Button>
        </div>
      </BottomSheetContent>
    </Dialog>
  );
}
