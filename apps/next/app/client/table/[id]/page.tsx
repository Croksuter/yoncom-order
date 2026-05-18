"use client";

import { use, useEffect } from "react";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import Footer from "./components/footer";
import Header from "./components/header";
import Menus from "./components/menu/menus";
import ShopIntro from "./components/shop.intro";

type ClientTablePageProps = {
  params: Promise<{ id: string }>;
};

export default function ClientTablePage({ params }: ClientTablePageProps) {
  const { id } = use(params);
  const { clientTable } = useTableStore();
  const { clientMenuCategories } = useMenuStore();

  useEffect(() => {
    void useTableStore.getState().clientGetTable({ tableId: id });
  }, [id]);

  useEffect(() => {
    if (!clientTable) {
      return;
    }

    void useMenuStore.getState().clientLoad({});
  }, [clientTable]);

  return (
    <main className="h-screen w-screen items-center justify-center overflow-hidden fc">
      {clientTable && clientMenuCategories ? (
        <>
          <Header />
          <div className="w-full max-w-[600px] flex-1 overflow-hidden px-2 fc">
            <ShopIntro tableName={clientTable.name} tableSeats={clientTable.seats} />
            <Menus menuCategories={clientMenuCategories} />
            <Footer />
          </div>
        </>
      ) : (
        <div className="p-6 text-center">
          <h1 className="text-xl font-bold">존재하지 않는 테이블입니다.</h1>
          <p className="mt-2 text-sm text-slate-500">tableId: {id}</p>
        </div>
      )}
    </main>
  );
}
