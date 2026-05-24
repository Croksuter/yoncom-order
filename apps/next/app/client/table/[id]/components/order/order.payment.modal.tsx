import { useState, useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, BottomSheetContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { toast } from "~/hooks/use-toast";
import { Copy, Check, Clock, AlertTriangle } from "lucide-react";

export default function OrderPaymentModal({
  openState, setOpenState,
  originalAmount,
  paymentCode,
  expectedTransferAmount,
  expiresAt,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
  originalAmount: number;
  paymentCode: number | null;
  expectedTransferAmount: number;
  expiresAt: number | null;
}) {
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  
  const totalDurationRef = useRef<number>(0);
  const copiedAccountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedAmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    
    const calculateTimeLeft = () => {
      const diff = expiresAt - Date.now();
      return Math.max(0, diff);
    };

    const initialDiff = calculateTimeLeft();
    setTimeLeft(initialDiff);
    totalDurationRef.current = initialDiff;

    const timer = setInterval(() => {
      const diff = calculateTimeLeft();
      setTimeLeft(diff);
      if (diff <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    return () => {
      if (copiedAccountTimerRef.current) {
        clearTimeout(copiedAccountTimerRef.current);
      }
      if (copiedAmountTimerRef.current) {
        clearTimeout(copiedAmountTimerRef.current);
      }
    };
  }, []);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = expiresAt && totalDurationRef.current > 0
    ? Math.min(100, Math.max(0, (timeLeft / totalDurationRef.current) * 100))
    : 0;

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText("국민은행 94580201548620");
    } catch {
      toast({
        title: "계좌정보를 복사하지 못했습니다.",
        description: "브라우저 권한을 확인한 뒤 다시 시도해주세요.",
        variant: "destructive",
      });
      return;
    }

    setCopiedAccount(true);
    toast({
      title: "계좌정보가 복사되었습니다.",
      description: "국민은행 94580201548620",
    });
    if (copiedAccountTimerRef.current) {
      clearTimeout(copiedAccountTimerRef.current);
    }
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
        description: "브라우저 권한을 확인한 뒤 다시 시도해주세요.",
        variant: "destructive",
      });
      return;
    }

    setCopiedAmount(true);
    toast({
      title: "입금액이 복사되었습니다.",
      description: `${expectedTransferAmount.toLocaleString()}원`,
    });
    if (copiedAmountTimerRef.current) {
      clearTimeout(copiedAmountTimerRef.current);
    }
    copiedAmountTimerRef.current = setTimeout(() => {
      setCopiedAmount(false);
      copiedAmountTimerRef.current = null;
    }, 2000);
  };

  const handleConfirm = () => {
    handleClose();
  };

  const handleClose = () => {
    setOpenState(false);
  };

  const isLowTime = timeLeft > 0 && timeLeft <= 120000; // 2 minutes or less
  const isExpired = expiresAt !== null && timeLeft <= 0;

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <BottomSheetContent className="fc justify-between max-h-[85vh] overflow-y-auto no-scrollbar">
        {/* Drag Handle */}
        <div className="w-full flex justify-center pb-4">
          <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="space-y-1 text-center mb-6">
          <DialogTitle className="text-2xl font-black text-slate-800 dark:text-slate-100">
            입금 정보 안내
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400 font-medium">
            입금액과 입금 계좌를 다시 한 번 확인해주세요.
          </DialogDescription>
        </div>

        {/* Timer Box */}
        {expiresAt && (
          <div className="w-full bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center space-y-2 relative overflow-hidden mb-6 shadow-inner">
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
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
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
        <div className="bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 mb-6 flex flex-col gap-4 relative overflow-hidden">
          {/* Receipt Dotted Border separator */}
          <div className="grid w-full grid-cols-2 gap-y-2.5 pb-4 border-b border-dashed border-slate-200 dark:border-slate-800 text-xs">
            <span className="font-bold text-slate-400 dark:text-slate-500">주문금액</span>
            <span className="text-right font-bold text-slate-800 dark:text-slate-100">{originalAmount.toLocaleString()}원</span>
            
            <span className="font-bold text-slate-400 dark:text-slate-500">결제코드</span>
            <span className="text-right font-bold text-slate-500 dark:text-slate-400">
              {paymentCode !== null ? `${paymentCode}원 차감` : "-"}
            </span>

            <span className="font-bold text-slate-400 dark:text-slate-500">입금 예정 시각</span>
            <span className="text-right font-bold text-slate-800 dark:text-slate-100">
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
            <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 pl-0.5 uppercase tracking-wider">
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
            <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 pl-0.5 uppercase tracking-wider">
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

        {/* Warning Alert banner */}
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-100/50 dark:border-red-900/30 text-destructive dark:text-rose-500 rounded-2xl p-4 flex items-start gap-3 text-xs leading-relaxed font-semibold mb-6">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p>
            주문금액이 아니라 결제코드가 차감된 <strong className="underline decoration-2">입금액을 1원 단위까지 정확하게</strong> 이체해 주세요. 입금액이 다를 경우 입금 확인이 불가능합니다.
          </p>
        </div>

        {/* Sticky Footer */}
        <Button
          className="w-full py-4 h-auto rounded-xl bg-primary hover:bg-brand-600 text-white font-extrabold text-sm shadow-[0_8px_20px_rgba(0,61,155,0.2)] hover:shadow-[0_12px_28px_rgba(0,61,155,0.3)] transition-all duration-300 active:scale-[0.98] cursor-pointer"
          onClick={handleConfirm}
        >
          확인했습니다
        </Button>
      </BottomSheetContent>
    </Dialog>
  );
}
