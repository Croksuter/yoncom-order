import { Card } from "~/components/ui/card";
import * as ClientMenuResponse from "shared/types/responses/client/menu";
import { useState } from "react";
import CartAddModal from "../cart/cart.add.modal";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import { toast } from "~/hooks/use-toast";
import { API_BASE_URL } from "shared/constants";

export default function MenuInstance({ menu }: { menu: ClientMenuResponse.Get["result"][number]["menus"][number] }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      {menu.quantity <= 0 || !menu.available
        ? ( // 품절
          <Card className="fc mb-3 p-4 bg-gray-50 [&_*]:text-gray-300">
            <div className="fr justify-between items-center bg-none h-full">
              <div className="fr items-center">
                <img src={menu.image ? menu.image : "/favicon.ico"} alt="" width={50} height={50} className="rounded-md aspect-square w-[50px] h-[50px]" />
                <div className="fc ml-4 flex-1">
                  <h1 className="font-bold text-xl flex items-center">{menu.name}</h1>
                  <span className="text-sm">{menu.description}</span>
                </div>
              </div>
              <span className="text-md min-w-fit ml-2">{menu.price.toLocaleString()}원</span>
            </div>
          </Card>
        ) : (
          <Card
            className="fc mb-3 p-4 hover:cursor-pointer hover:bg-gray-100"
            onClick={async () => {
              const res = await useMenuStore.getState().clientLoad({});
              if (!res) {
                toast({
                  title: "메뉴 정보를 불러오는데 실패했습니다.",
                  description: "다시 시도해주세요.",
                  variant: "destructive",
                });
                return;
              }
              const updatedMenuCategories = useMenuStore.getState().clientMenuCategories;
              const updatedMenuState = updatedMenuCategories?.flatMap((m) => m.menus).find((m) => m.id === menu.id);
              console.debug("updatedMenuState", updatedMenuState);
              if (!updatedMenuState?.available || updatedMenuState.quantity <= 0) {
                toast({
                  title: "메뉴가 품절 또는 비활성화 되었습니다.",
                  description: "다른 메뉴를 주문해주세요.",
                  variant: "destructive",
                });
                return;
              }
              setModalOpen(true);
            }}
          >
            <div className="fr justify-between items-center bg-none h-full">
              <div className="fr items-center">
                <img src={menu.image ? menu.image : "/favicon.ico"} alt="" width={50} height={50} className="rounded-md aspect-square w-[50px] h-[50px]" />
                <div className="fc ml-4 flex-1">
                  <h1 className="font-bold text-xl flex items-center">{menu.name}</h1>
                  <span className="text-sm">{menu.description}</span>
                </div>
              </div>
              <span className="text-md min-w-fit ml-2">{menu.price.toLocaleString()}원</span>
            </div>
          </Card>
        )}
      <CartAddModal
        menu={menu}
        openState={modalOpen}
        setOpenState={setModalOpen}
      />
    </>
  );
}