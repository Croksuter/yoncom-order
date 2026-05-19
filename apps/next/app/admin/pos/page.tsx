"use client";

import Inventories from "./components/inventory/inventories";
import Orders from "./components/order/orders";
import Tables from "./components/table/tables";

export default function AdminPosPage() {
  return (
    <main className="flex min-h-screen w-screen flex-col bg-white p-2 lg:h-screen lg:flex-row lg:overflow-hidden">
      <div className="min-h-[18rem] w-full lg:h-full lg:min-h-0 lg:w-1/4">
        <Orders />
      </div>
      <div className="min-h-[24rem] w-full items-center justify-center fc lg:h-full lg:min-h-0 lg:w-1/2">
        <Tables />
      </div>
      <div className="flex min-h-[18rem] w-full items-center justify-center lg:h-full lg:min-h-0 lg:w-1/4">
        <Inventories />
      </div>
    </main>
  );
}
