import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import useTableStore from "~/stores/table.store";
import type * as AdminClientNoticeSettingsRequest from "shared/types/requests/admin/client-notice-settings";

type NoticeSettingsForm = AdminClientNoticeSettingsRequest.Update["clientNoticeSettings"];
const noticePreviewCopies = [0, 1];

export default function ClientNoticeSettingsModal({
  openState,
  setOpenState,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
}) {
  const { clientNoticeSettings } = useTableStore();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [form, setForm] = useState<NoticeSettingsForm>({
    description: clientNoticeSettings?.description ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const previewText = form.description.trim() || "공지 문구를 입력하면 고객 화면에 표시됩니다.";

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 112), 224)}px`;
  };

  useEffect(() => {
    if (!openState) return;
    setForm({
      description: useTableStore.getState().clientNoticeSettings?.description ?? "",
    });
    requestAnimationFrame(resizeTextarea);
  }, [openState]);

  useEffect(() => {
    resizeTextarea();
  }, [form.description]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      const result = await useTableStore.getState().updateClientNoticeSettings({
        clientNoticeSettings: form,
      });
      if (result) {
        setOpenState(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={openState} onOpenChange={setOpenState} debugName="client-notice-settings">
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex max-h-[86vh] flex-col">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 px-6 py-5 text-left">
            <DialogTitle className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
              고객 헤더 공지
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-slate-400 dark:text-slate-300">
              고객 주문 화면 헤더 하단에 표시됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">공지 문구</span>
              <textarea
                ref={textareaRef}
                value={form.description}
                onChange={(event) => setForm({ description: event.target.value })}
                className="max-h-56 min-h-28 w-full resize-none whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm font-semibold leading-relaxed text-slate-700 shadow-sm outline-none transition-colors [overflow-wrap:anywhere] placeholder:text-slate-400 focus:border-rose-400 focus:ring-1 focus:ring-rose-400 dark:border-slate-800 dark:text-slate-200"
                maxLength={500}
                placeholder="예: 주문 전 알레르기 유발 재료를 확인해주세요."
                rows={4}
                wrap="soft"
              />
            </label>

            <div className="relative h-10 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-rose-200/80 bg-[linear-gradient(90deg,rgba(255,241,242,0.94),rgba(254,205,211,0.98),rgba(255,228,230,0.94))] text-sm text-rose-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_8px_24px_rgba(244,63,94,0.12)]">
              <div className="client-notice-marquee absolute inset-y-0 left-0 flex w-max items-center whitespace-nowrap">
                {noticePreviewCopies.map((copy) => (
                  <span key={copy} className="px-6">{previewText}</span>
                ))}
              </div>
              <style jsx>{`
                @keyframes client-notice-marquee {
                  0% { transform: translateX(32rem); }
                  100% { transform: translateX(-100%); }
                }

                .client-notice-marquee {
                  animation: client-notice-marquee 33s linear infinite;
                }
              `}</style>
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
            <Button type="submit" disabled={isSaving} className="rounded-xl bg-rose-500 font-extrabold text-white hover:bg-rose-600">
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
