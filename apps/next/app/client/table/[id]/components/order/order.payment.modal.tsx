import { useState, useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
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

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = expiresAt && totalDurationRef.current > 0
    ? Math.min(100, Math.max(0, (timeLeft / totalDurationRef.current) * 100))
    : 0;

  const copyAccount = () => {
    navigator.clipboard.writeText("국민은행 94580201548620");
    setCopiedAccount(true);
    toast({
      title: "계좌정보가 복사되었습니다.",
      description: "국민은행 94580201548620",
    });
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const copyAmount = () => {
    navigator.clipboard.writeText(expectedTransferAmount.toString());
    setCopiedAmount(true);
    toast({
      title: "입금액이 복사되었습니다.",
      description: `${expectedTransferAmount.toLocaleString()}원`,
    });
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const handleConfirm = async () => {
    handleClose();
  };

  const handleClose = () => {
    setOpenState(false);
  };

  const isLowTime = timeLeft > 0 && timeLeft <= 120000; // 2 minutes or less
  const isExpired = expiresAt !== null && timeLeft <= 0;

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className="fixed bottom-0 top-auto left-0 translate-x-0 translate-y-0 w-full max-w-full rounded-t-[2rem] rounded-b-none border-t border-x border-b-0 border-brand-100 bg-background/95 backdrop-blur-lg p-6 pb-8 shadow-[0_-8px_30px_rgb(0,0,0,0.08)] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom sm:bottom-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-w-md sm:rounded-2xl sm:border sm:shadow-lg sm:p-6 smooth-transition fc justify-between min-h-[25rem] max-h-[85vh]">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl font-bold tracking-tight text-center text-foreground">
            입금 정보 안내
          </DialogTitle>
          
          {expiresAt && (
            <div className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2 relative overflow-hidden">
              <div className="flex items-center space-x-2">
                {isExpired ? (
                  <AlertTriangle className="h-5 w-5 text-destructive animate-bounce" />
                ) : (
                  <Clock className={`h-5 w-5 ${isLowTime ? "text-destructive animate-pulse" : "text-brand-500"}`} />
                )}
                <span className={`text-base font-semibold ${isExpired ? "text-destructive" : "text-muted-foreground"}`}>
                  {isExpired ? "입금 기한 만료" : "남은 입금 기한"}
                </span>
              </div>
              <span className={`text-3xl font-extrabold tracking-wider ${
                isExpired 
                  ? "text-destructive" 
                  : isLowTime 
                    ? "text-destructive animate-pulse" 
                    : "text-brand-600"
              }`}>
                {isExpired ? "00:00" : formatTime(timeLeft)}
              </span>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200/60 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    isLowTime ? "bg-destructive animate-pulse" : "bg-brand-500"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              {isLowTime && (
                <span className="text-xs text-destructive font-medium animate-pulse mt-1">
                  기한이 얼마 남지 않았습니다! 서둘러 입금해주세요.
                </span>
              )}
              {isExpired && (
                <span className="text-xs text-destructive font-medium mt-1">
                  입금 기한이 만료되었습니다. 주문이 자동 취소될 수 있습니다.
                </span>
              )}
            </div>
          )}

          <div className="w-full space-y-4 pt-2">
            <div className="grid w-full grid-cols-2 gap-y-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-sm">
              <span className="font-medium text-muted-foreground">주문금액</span>
              <span className="text-right font-semibold text-foreground">{originalAmount.toLocaleString()}원</span>
              
              <span className="font-medium text-muted-foreground">결제코드</span>
              <span className="text-right font-semibold text-slate-500 dark:text-slate-400">
                {paymentCode !== null ? `${paymentCode}원 차감` : "-"}
              </span>

              <span className="font-bold text-foreground">입금액</span>
              <span className="text-right font-bold text-brand-600 text-base">{expectedTransferAmount.toLocaleString()}원</span>
              
              <span className="font-medium text-muted-foreground">입금 예정 시각</span>
              <span className="text-right font-medium text-foreground">
                {expiresAt ? new Date(expiresAt).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                }) : "-"}
              </span>
            </div>

            {/* Account Information Section */}
            <div className="space-y-1.5">
              <span className="block text-sm font-bold text-foreground pl-0.5">⋅ 입금 계좌</span>
              <button
                onClick={copyAccount}
                className="flex w-full items-center justify-between overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 p-4 transition-all hover:bg-slate-100/70 dark:hover:bg-slate-900/50 active:scale-[0.99]"
              >
                <span className="truncate text-lg font-bold text-slate-700 dark:text-slate-200">
                  국민은행 94580201548620
                </span>
                <div className="flex items-center space-x-1 text-slate-500">
                  <span className="text-xs font-medium">{copiedAccount ? "복사 완료" : "복사"}</span>
                  {copiedAccount ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </div>
              </button>
            </div>

            {/* Target Amount Section */}
            <div className="space-y-1.5">
              <span className="block text-sm font-bold text-foreground pl-0.5">⋅ 정확히 보낼 금액</span>
              <button
                onClick={copyAmount}
                className="flex w-full items-center justify-between overflow-hidden rounded-xl border border-brand-100/50 dark:border-brand-900/30 bg-brand-50/50 dark:bg-brand-950/20 p-4 transition-all hover:bg-brand-50 dark:hover:bg-brand-950/30 active:scale-[0.99]"
              >
                <span className="text-2xl font-extrabold text-brand-600">
                  {expectedTransferAmount.toLocaleString()}원
                </span>
                <div className="flex items-center space-x-1 text-brand-600">
                  <span className="text-xs font-semibold">{copiedAmount ? "복사 완료" : "복사"}</span>
                  {copiedAmount ? (
                    <Check className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </div>
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed pl-0.5">
              ⚠️ 주문금액이 아니라 결제코드가 차감된 <strong className="text-brand-600 font-semibold">입금액을 정확하게</strong> 이체해 주세요. 입금액이 다를 경우 입금 확인이 되지 않습니다.
            </p>
          </div>
        </DialogHeader>

        <DialogFooter className="fr gap-3 mt-6 *:flex-1 *:h-12 *:rounded-xl *:text-base">
          <Button 
            className="bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/10 hover-lift active:scale-98 transition-all" 
            onClick={handleConfirm}
          >
            확인했습니다
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

