import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import * as ClientMenuResponse from "shared/types/responses/client/menu";
import MenuInstance from "./menu.instance";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";

export default function Menus({ menuCategories }: { menuCategories: ClientMenuResponse.Get["result"] }) {
  const { clientTable } = useTableStore();

  return (
    <Tabs
      className="w-full flex-1 fc overflow-hidden pb-2"
      defaultValue={menuCategories[0]?.id} 
    >
      <TabsList className="w-full h-fit justify-normal bg-blue-50">
        {menuCategories.map((menuCategory) => 
          <TabsTrigger 
            key={menuCategory.id} 
            value={menuCategory.id}
            className="text-lg font-semibold hover:bg-blue-100 hover:text-blue-600 m-1"
            onClick={() => {
              useMenuStore.getState().clientLoad({});
            }}
          >{menuCategory.name}</TabsTrigger>
        )}
      </TabsList>
      {menuCategories.map((menuCategory) => (
        <TabsContent className="flex-1 overflow-y-scroll" key={menuCategory.id} value={menuCategory.id}>
          {menuCategory.menus.filter((menu) => !menu.deletedAt).map((menu) =>
            <MenuInstance key={menu.id} menu={menu} />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}