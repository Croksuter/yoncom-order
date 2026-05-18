"use client";

import Inventories from "./components/inventory/inventories";
import Orders from "./components/order/orders";
import Tables from "./components/table/tables";

export default function AdminPosPage() {
  return (
    <main className="flex h-screen w-screen bg-white p-2">
      <div className="h-full w-1/4">
        <Orders />
      </div>
      <div className="h-full w-1/2 items-center justify-center fc">
        <Tables />
      </div>
      <div className="flex h-full w-1/4 items-center justify-center">
        <Inventories />
      </div>
    </main>
  );
}
