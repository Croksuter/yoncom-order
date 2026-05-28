import { FormEvent, useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import useTableStore from "~/stores/table.store";
import type * as AdminOrderWorkflowSettingsRequest from "shared/types/requests/admin/order-workflow-settings";

type OrderWorkflowSettingsForm = AdminOrderWorkflowSettingsRequest.Update["orderWorkflowSettings"];

export default function OrderWorkflowSettingsModal({
  openState,
  setOpenState,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
}) {
  const { orderWorkflowSettings } = useTableStore();
  const [form, setForm] = useState<OrderWorkflowSettingsForm>({
    autoPickUpOnCookComplete: orderWorkflowSettings?.autoPickUpOnCookComplete ?? false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!openState) return;
    const settings = useTableStore.getState().orderWorkflowSettings;
    setForm({
      autoPickUpOnCookComplete: settings?.autoPickUpOnCookComplete ?? false,
    });
    if (!settings) {
      void useTableStore.getState().loadOrderWorkflowSettings();
    }
  }, [openState]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      const result = await useTableStore.getState().updateOrderWorkflowSettings({
        orderWorkflowSettings: form,
      });
      if (result) {
        setOpenState(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={openState} onOpenChange={setOpenState} debugName="order-workflow-settings">
      <DialogContent className="max-w-md rounded-3xl border-slate-200 bg-white p-0 dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b border-slate-100 px-6 py-5 text-left dark:border-slate-800">
            <DialogTitle className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
              주문 처리 설정
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-slate-400 dark:text-slate-300">
              조리완료 후 수령완료 처리 방식
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-sm font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
              <Checkbox
                checked={form.autoPickUpOnCookComplete}
                onCheckedChange={(checked) => setForm({ autoPickUpOnCookComplete: checked === true })}
                disabled={isSaving}
              />
              조리완료 시 바로 수령완료 처리
            </label>
          </div>

          <DialogFooter className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenState(false)}
              disabled={isSaving}
              className="rounded-xl font-bold"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-brand-500 font-bold text-white hover:bg-brand-600"
            >
              {isSaving ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
