"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { toast } from "~/hooks/use-toast";
import useTableStore from "~/stores/table.store";
import useMenuStore from "~/stores/menu.store";
import { runWithBlockingLoading } from "~/lib/blocking-loading";
import * as ClientTableResponse from "shared/types/responses/client/table";
import { Copy, Check, Clock, AlertTriangle, Trash2, ArrowRight } from "lucide-react";

type ClientOrder = ClientTableResponse.Get["result"]["tableContexts"][number]["orders"][number];

export default function OrderPaymentPanel({
  order,
}: {
  order: ClientOrder;
}) {
  const { clientTable } = useTableStore();
  const { clientMenuCategories } = useMenuStore();
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isBusy, setIsBusy] = useState(false);

  const totalDurationRef = useRef<number>(0);
  const copiedAccountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedAmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTriggeredCancelRef = useRef<boolean>(false);

  const menus = clientMenuCategories ? clientMenuCategories.flatMap((menuCategory) => menuCategory.menus) : [];
  const expectedTransferAmount = order.payment.expectedTransferAmount ?? order.payment.amount ?? 0;
  const originalAmount = order.payment.originalAmount ?? expectedTransferAmount;
  const paymentCode = order.payment.paymentCode ?? null;
  const expiresAt = typeof order.payment.expiresAt === "number" ? order.payment.expiresAt : null;

  const clearTableContextIfLastOrder = () => {
    const activeContext = clientTable?.tableContexts[0];
    if (!clientTable || !activeContext || activeContext.orders.filter((candidate) => candidate.deletedAt === null).length > 1) {
      return false;
    }

    useTableStore.setState({
      clientTable: {
        ...clientTable,
        tableContexts: [],
      },
      isLoaded: true,
      error: false,
    });
    void useMenuStore.getState().clientLoad({});
    return true;
  };

  // Handle countdown timer & auto-cancellation
  useEffect(() => {
    if (!expiresAt) return;

    const calculateTimeLeft = () => {
      const diff = expiresAt - Date.now();
      return Math.max(0, diff);
    };

    const initialDiff = calculateTimeLeft();
    setTimeLeft(initialDiff);
    totalDurationRef.current = initialDiff;

    // Check if already expired on load
    if (initialDiff <= 0 && !hasTriggeredCancelRef.current) {
      hasTriggeredCancelRef.current = true;
      void handleAutoCancel();
      return;
    }

    const timer = setInterval(() => {
      const diff = calculateTimeLeft();
      setTimeLeft(diff);
      
      if (diff <= 0) {
        clearInterval(timer);
        if (!hasTriggeredCancelRef.current) {
          hasTriggeredCancelRef.current = true;
          void handleAutoCancel();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    return () => {
      if (copiedAccountTimerRef.current) clearTimeout(copiedAccountTimerRef.current);
      if (copiedAmountTimerRef.current) clearTimeout(copiedAmountTimerRef.current);
    };
  }, []);

  const handleAutoCancel = async () => {
    if (isBusy) return;
    setIsBusy(true);

    toast({
      title: "입금 기한이 만료되었습니다.",
      description: "주문이 자동으로 취소되었습니다. 다시 주문해 주세요.",
      variant: "destructive",
    });

    try {
      await useTableStore.getState().clientCancelOrder({
        orderId: order.id,
      });
      if (clearTableContextIfLastOrder()) {
        return;
      }

      if (clientTable?.id) {
        await useTableStore.getState().clientGetTable({ tableId: clientTable.id });
      }
    } catch (err) {
      console.error("Auto cancel failed:", err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancelOrder = async () => {
    if (isBusy) return;
    setIsBusy(true);

    try {
      await runWithBlockingLoading(async () => {
        const cancelled = await useTableStore.getState().clientCancelOrder({
          orderId: order.id,
        });
        if (!cancelled) {
          toast({
            title: "주문 취소에 실패했습니다.",
            description: "직원에게 문의해 주세요.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "주문이 취소되었습니다.",
          description: "메뉴 탐색 화면으로 돌아갑니다.",
        });

        if (clearTableContextIfLastOrder()) {
          return;
        }

        if (clientTable?.id) {
          await useTableStore.getState().clientGetTable({ tableId: clientTable.id });
        }
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleTossPayment = () => {
    window.open(`supertoss://send?amount=${expectedTransferAmount}&bank=토스뱅크&accountNo=100012345678`, "_blank");
  };

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText("1000-1234-5678");
    } catch {
      toast({
        title: "계좌정보를 복사하지 못했습니다.",
        description: "다시 시도해주세요.",
        variant: "destructive",
      });
      return;
    }

    setCopiedAccount(true);
    toast({
      title: "계좌번호가 복사되었습니다.",
      description: "토스뱅크 1000-1234-5678",
    });
    if (copiedAccountTimerRef.current) clearTimeout(copiedAccountTimerRef.current);
    copiedAccountTimerRef.current = setTimeout(() => {
      setCopiedAccount(false);
      copiedAccountTimerRef.current = null;
    }, 2000);
  };

  const copyAmount = async () => {
    try {
      await navigator.clipboard.writeText(expectedTransferAmount.toString());
    } catch {
      toast({
        title: "입금액을 복사하지 못했습니다.",
        description: "다시 시도해주세요.",
        variant: "destructive",
      });
      return;
    }

    setCopiedAmount(true);
    toast({
      title: "입금액이 복사되었습니다.",
      description: `${expectedTransferAmount.toLocaleString()}원`,
    });
    if (copiedAmountTimerRef.current) clearTimeout(copiedAmountTimerRef.current);
    copiedAmountTimerRef.current = setTimeout(() => {
      setCopiedAmount(false);
      copiedAmountTimerRef.current = null;
    }, 2000);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const isLowTime = timeLeft > 0 && timeLeft <= 120000; // 2 minutes or less
  const isExpired = expiresAt !== null && timeLeft <= 0;
  const progress = expiresAt && totalDurationRef.current > 0
    ? Math.min(100, Math.max(0, (timeLeft / totalDurationRef.current) * 100))
    : 0;

  return (
    <div className="w-full max-w-[600px] bg-white dark:bg-slate-900 min-h-[92vh] fc justify-between px-4 py-6 overflow-y-auto no-scrollbar">
      <div>
        {/* Header */}
        <div className="space-y-1 text-center mb-6 pt-4">
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">
            결제 및 입금 대기 중
          </h2>
          <p className="text-xs text-slate-400 font-bold">
            아래 정보를 확인하고 이체를 완료해 주세요.
          </p>
        </div>

        {/* Timer Box */}
        {expiresAt && (
          <div className="w-full bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col items-center justify-center space-y-2 relative overflow-hidden mb-6 shadow-inner">
            <div className="flex items-center space-x-2">
              <Clock className={`h-4 w-4 ${isLowTime || isExpired ? "text-destructive animate-pulse" : "text-primary"}`} />
              <span className={`text-xs font-bold ${isExpired ? "text-destructive" : "text-slate-500"}`}>
                {isExpired ? "입금 기한 만료" : "남은 입금 기한"}
              </span>
            </div>
            <span className={`text-4xl font-black tracking-wider ${
              isExpired || isLowTime
                ? "text-destructive animate-pulse"
                : "text-primary"
            }`}>
              {isExpired ? "00:00" : formatTime(timeLeft)}
            </span>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-850 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isLowTime ? "bg-destructive animate-pulse" : "bg-primary"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Receipt Container */}
        <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 rounded-2xl p-5 mb-6 flex flex-col gap-4 relative overflow-hidden">
          {/* Itemized Table */}
          <div className="grid w-full grid-cols-2 gap-y-2.5 pb-4 border-b border-dashed border-slate-200 dark:border-slate-800 text-xs font-semibold">
            <span className="text-slate-400 dark:text-slate-300 font-bold">주문금액</span>
            <span className="text-right text-slate-800 dark:text-slate-100">{originalAmount.toLocaleString()}원</span>

            <span className="text-slate-400 dark:text-slate-300 font-bold">결제코드 차감</span>
            <span className="text-right text-red-500">
              {paymentCode !== null ? `-${paymentCode.toLocaleString()}원` : "0원"}
            </span>

            <span className="text-slate-400 dark:text-slate-300 font-bold">입금 예정 시각</span>
            <span className="text-right text-slate-800 dark:text-slate-100">
              {expiresAt ? new Date(expiresAt).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              }) : "-"}
            </span>
          </div>

          {/* Account Box */}
          <div className="space-y-1.5 pt-1">
            <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-300 pl-0.5 uppercase tracking-wider">
              ⋅ 입금 계좌
            </span>
            <button
              onClick={copyAccount}
              className="flex w-full items-center justify-between overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-[0.99] shadow-sm cursor-pointer"
            >
              <div className="flex flex-col text-left">
                <span className="text-xs text-slate-400 font-bold leading-none mb-1">토스뱅크</span>
                <span className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">
                  1000-1234-5678
                </span>
                <span className="text-[10px] text-slate-400 mt-1 leading-none">예금주: 연컴 홈런포차</span>
              </div>
              <div className="flex items-center space-x-1 text-slate-400 hover:text-primary transition-colors shrink-0 pl-4 border-l border-slate-100 dark:border-slate-800 h-8">
                <span className="text-xs font-bold">{copiedAccount ? "복사 완료" : "복사"}</span>
                {copiedAccount ? (
                  <Check className="h-4 w-4 text-emerald-500 stroke-[3px]" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </div>
            </button>
          </div>

          {/* Target Amount Box */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-300 pl-0.5 uppercase tracking-wider">
              ⋅ 정확히 보낼 금액
            </span>
            <button
              onClick={copyAmount}
              className="flex w-full items-center justify-between overflow-hidden rounded-xl border border-brand-100 dark:border-brand-900 bg-brand-50/40 dark:bg-brand-950/20 p-4 transition-all hover:bg-brand-50 dark:hover:bg-brand-950/30 active:scale-[0.99] shadow-sm cursor-pointer"
            >
              <span className="text-2xl font-black text-primary dark:text-brand-400">
                {expectedTransferAmount.toLocaleString()}원
              </span>
              <div className="flex items-center space-x-1 text-primary dark:text-brand-400 shrink-0 pl-4 border-l border-brand-100 dark:border-brand-900 h-8">
                <span className="text-xs font-bold">{copiedAmount ? "복사 완료" : "복사"}</span>
                {copiedAmount ? (
                  <Check className="h-4 w-4 text-emerald-500 stroke-[3px]" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Warning Alert Banner */}
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-100/50 dark:border-red-900/30 text-destructive dark:text-rose-500 rounded-2xl p-4 flex items-start gap-3 text-xs leading-relaxed font-semibold mb-6">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p>
            주문금액이 아니라 결제코드가 차감된 <strong className="underline decoration-2">입금액을 1원 단위까지 정확하게</strong> 이체해 주세요. 입금액이 다를 경우 입금 자동 확인이 지연되거나 지불 취소 처리가 필요할 수 있습니다.
          </p>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fc gap-3 w-full">
        <Button
          onClick={handleTossPayment}
          disabled={isBusy}
          className="w-full py-4 h-auto rounded-xl bg-primary hover:bg-brand-600 text-white font-extrabold text-sm shadow-[0_8px_20px_rgba(0,61,155,0.2)] hover:shadow-[0_12px_28px_rgba(0,61,155,0.3)] transition-all duration-300 active:scale-[0.98] cursor-pointer flex justify-center items-center gap-2"
        >
          <span>토스 앱으로 간편 송금</span>
          <ArrowRight className="h-4 w-4 stroke-[3px]" />
        </Button>
        <Button
          variant="outline"
          onClick={handleCancelOrder}
          disabled={isBusy}
          className="w-full py-4 h-auto rounded-xl border-destructive/20 text-destructive dark:text-rose-500 hover:bg-destructive/5 dark:hover:bg-rose-950/25 font-bold cursor-pointer transition-colors flex justify-center items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          <span>주문 취소하기</span>
        </Button>
      </div>
    </div>
  );
}
