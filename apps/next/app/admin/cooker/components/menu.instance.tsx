import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { dateDiffString } from "~/lib/date";
import * as Schema from "db/schema";

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
      <Card className="rounded-xl my-3" onClick={onClick}>
        <CardHeader className="py-2 px-3 rounded-t-xl fr justify-between" style={{
            background: "linear-gradient(to right, #323232, #FFFFFF)",
          }}>
          <CardTitle className="text-white">{order.tableName}</CardTitle>
          <div className="!-m-1 !p-0">{
            dateDiffString(now, order.timestamp).startsWith("-") 
              ? "00:00" 
              : dateDiffString(now, order.timestamp)
          }</div>
        </CardHeader>
        <CardContent className="fr px-4 py-2 items-end">
          <ul className="flex-1">
            <li className="text-lg my-1">{order.menuName} <b>x{order.quantity}</b>
            </li>
          </ul>
        </CardContent>
      </Card>
    </>
  )
}