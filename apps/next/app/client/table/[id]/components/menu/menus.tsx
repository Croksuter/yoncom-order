import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import * as ClientMenuResponse from "shared/types/responses/client/menu";
import MenuInstance from "./menu.instance";
import useMenuStore from "~/stores/menu.store";
import type { UIEventHandler } from "react";

export default function Menus({
  menuCategories,
  onContentScroll,
  onCategoryChange,
}: {
  menuCategories: ClientMenuResponse.Get["result"];
  onContentScroll?: UIEventHandler<HTMLDivElement>;
  onCategoryChange?: () => void;
}) {
  return (
    <Tabs
      className="w-full flex-1 fc overflow-hidden pb-2"
      defaultValue={menuCategories[0]?.id}
    >
      <TabsList className="w-full h-auto justify-start bg-transparent overflow-x-auto no-scrollbar flex gap-2 pb-3 pt-2 px-1 border-b border-border/50 shrink-0">
        {menuCategories.map((menuCategory) => (
          <TabsTrigger
            key={menuCategory.id}
            value={menuCategory.id}
            className="flex-shrink-0 px-5 py-2 rounded-full text-xs font-bold transition-all duration-200 bg-secondary/80 text-slate-600 hover:bg-secondary hover:text-slate-800 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md cursor-pointer border-0 shadow-none ring-0 outline-none"
            onClick={() => {
              onCategoryChange?.();
              void useMenuStore.getState().clientLoad({});
            }}
          >
            {menuCategory.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {menuCategories.map((menuCategory) => (
        <TabsContent
          className="flex-1 overflow-y-auto no-scrollbar pt-4 pb-20 space-y-3"
          key={menuCategory.id}
          value={menuCategory.id}
          onScroll={onContentScroll}
        >
          <div className="grid grid-cols-1 gap-3">
            {menuCategory.menus.filter((menu) => !menu.deletedAt).map((menu) => (
              <MenuInstance key={menu.id} menu={menu} />
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
