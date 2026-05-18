import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { toast } from "~/hooks/use-toast";
import { ClipboardPasteIcon } from "lucide-react";

export default function OrderPaymentModal({
  openState, setOpenState,
  amount,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
  amount: number;
}) {
  const copyAccount = () => {
    // TODO: 토스 이체 계좌 변경 필요
    // navigator.clipboard.writeText("국민은행 11110204273566");
    // navigator.clipboard.writeText("국민은행 94580201548620");
    navigator.clipboard.writeText("국민은행 94580201548620");
    toast({
      title: "계좌정보가 복사되었습니다.",
    });
  }

  const copyAmount = () => {
    navigator.clipboard.writeText(amount.toString());
    toast({
      title: "입금액이 복사되었습니다.",
    });
  }

  const handleConfirm = async () => {
    handleClose();
  }

  const handleClose = () => {
    setOpenState(false);
  }

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className="w-[96%] border-blue-500 border-2 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">직접 이체</DialogTitle>
          <DialogDescription>
            <div className="fc w-full mt-4 justify-between *:my-2">
              <div className="fc items-end justify-between *:mt-1">
                <span className="w-full leading-8 font-bold text-start text-lg">⋅ 입금 계좌</span>
                <div
                  onClick={copyAccount}
                  className="fr w-full oveflow-hidden rounded-lg bg-gray-200 p-2 justify-center mb-2 items-center"
                >
                  <span className="truncate text-gray-600 text-xl font-semibold hover:cursor-pointer">국민은행 94580201548620</span>
                  <ClipboardPasteIcon className="text-gray-600 scale-75 w-fit mt-[2px]" />
                </div>
              </div>
              <div className="fc items-end justify-between *:mt-1">
                <span className="w-full leading-8 font-bold text-start text-lg">⋅ 입금 금액</span>
                <div
                  onClick={copyAmount}
                  className="fr w-full oveflow-hidden rounded-lg bg-blue-100 p-2 justify-center mb-2 items-center"
                >
                  <span className="truncate text-blue-500 text-3xl font-bold hover:cursor-pointer">{amount.toLocaleString()}원</span>
                  <ClipboardPasteIcon className="text-blue-500 w-fit scale-110 ml-2 mt-[2px]" />
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="fr *:flex-1 *:mx-2 *:h-14 *:rounded-2xl *:text-lg">
          {/* <Button variant="outline" onClick={handleClose}>취소</Button> */}
          <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleConfirm}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}