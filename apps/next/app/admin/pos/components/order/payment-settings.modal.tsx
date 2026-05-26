import { FormEvent, useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { buildTossTransferUrl, normalizePaymentSettings } from "~/lib/payment-settings";
import useTableStore from "~/stores/table.store";
import type * as AdminPaymentSettingsRequest from "shared/types/requests/admin/payment-settings";

type PaymentSettingsForm = AdminPaymentSettingsRequest.Update["paymentSettings"];

export default function PaymentSettingsModal({
  openState,
  setOpenState,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
}) {
  const { paymentSettings } = useTableStore();
  const normalizedSettings = normalizePaymentSettings(paymentSettings);
  const [form, setForm] = useState<PaymentSettingsForm>({
    bankName: normalizedSettings.bankName,
    accountNumber: normalizedSettings.accountNumber,
    accountHolder: normalizedSettings.accountHolder,
    tossTransferUrlTemplate: normalizedSettings.tossTransferUrlTemplate,
    depositGuide: normalizedSettings.depositGuide,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!openState) return;

    const nextSettings = normalizePaymentSettings(useTableStore.getState().paymentSettings);
    setForm({
      bankName: nextSettings.bankName,
      accountNumber: nextSettings.accountNumber,
      accountHolder: nextSettings.accountHolder,
      tossTransferUrlTemplate: nextSettings.tossTransferUrlTemplate,
      depositGuide: nextSettings.depositGuide,
    });
  }, [openState]);

  const updateField = (key: keyof PaymentSettingsForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      const result = await useTableStore.getState().updatePaymentSettings({ paymentSettings: form });
      if (result) {
        setOpenState(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const previewSettings = normalizePaymentSettings(form);
  const previewTossUrl = buildTossTransferUrl(previewSettings, 23999);

  return (
    <Dialog open={openState} onOpenChange={setOpenState} debugName="payment-settings">
      <DialogContent className="max-w-xl rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex max-h-[86vh] flex-col">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 px-6 py-5 text-left">
            <DialogTitle className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
              입금 안내 설정
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-slate-400 dark:text-slate-300">
              고객 결제 화면에 표시되는 계좌, Toss 송금 URL, 안내 문구
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">은행명</span>
                <Input
                  value={form.bankName}
                  onChange={(event) => updateField("bankName", event.target.value)}
                  className="rounded-xl font-bold"
                  maxLength={80}
                  required
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">계좌번호</span>
                <Input
                  value={form.accountNumber}
                  onChange={(event) => updateField("accountNumber", event.target.value)}
                  className="rounded-xl font-bold"
                  maxLength={80}
                  required
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">예금주</span>
              <Input
                value={form.accountHolder}
                onChange={(event) => updateField("accountHolder", event.target.value)}
                className="rounded-xl font-bold"
                maxLength={80}
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Toss 송금 URL</span>
              <Input
                value={form.tossTransferUrlTemplate}
                onChange={(event) => updateField("tossTransferUrlTemplate", event.target.value)}
                className="rounded-xl font-mono text-xs"
                maxLength={500}
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">입금 안내 문구</span>
              <textarea
                value={form.depositGuide}
                onChange={(event) => updateField("depositGuide", event.target.value)}
                className="min-h-28 w-full resize-none rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm font-semibold leading-relaxed text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-800 dark:text-slate-200"
                maxLength={1000}
                required
              />
            </label>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300">
              <div className="flex justify-between gap-3">
                <span>고객 표시 계좌</span>
                <span className="text-right font-extrabold text-slate-800 dark:text-slate-100">
                  {previewSettings.bankName} {previewSettings.accountNumber}
                </span>
              </div>
              <div className="mt-2 break-all font-mono text-[11px] text-slate-400">
                {previewTossUrl}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 dark:border-slate-800 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenState(false)}
              disabled={isSaving}
              className="rounded-xl font-bold"
            >
              취소
            </Button>
            <Button type="submit" disabled={isSaving} className="rounded-xl bg-brand-500 font-extrabold hover:bg-brand-600">
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
