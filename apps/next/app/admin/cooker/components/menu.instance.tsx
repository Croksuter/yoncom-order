import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button";
import { dateDiffString } from "~/lib/date";
import { CheckCircle2Icon } from "lucide-react";

export default function MenuInstance({ 
  order,
  onClick,
}: { 
  order: {
    menuId: string;
    menuName: string;
    menuPrice: number;
    quantity: number;
    status: string;
    tableName: string;
    timestamp: number;
  }
  onClick: () => void;
}) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Card className="rounded-xl my-3 hover:cursor-pointer" onClick={onClick}>
        <CardHeader className="flex flex-wrap justify-between gap-2 rounded-t-xl px-3 py-2" style={{
            background: "linear-gradient(to right, #323232, #FFFFFF)",
          }}>
          <CardTitle className="whitespace-nowrap text-white">{order.tableName}</CardTitle>
          <div className="shrink-0 !p-0">{
            dateDiffString(now, order.timestamp).startsWith("-") 
              ? "00:00" 
              : dateDiffString(now, order.timestamp)
          }</div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <ul className="min-w-0 flex-1">
            <li className="my-1 text-lg [word-break:keep-all]">{order.menuName} <b>x{order.quantity}</b>
            </li>
          </ul>
          <Button
            type="button"
            size="sm"
            className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
            aria-label={`${order.tableName} ${order.menuName} 조리 완료`}
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
          >
            <CheckCircle2Icon />
            조리 완료
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
