import { create } from 'zustand';
import * as Schema from 'db/schema';
import * as ClientMenuRequest from "types/requests/client/menu";
import * as ClientMenuResponse from "types/responses/client/menu";
import * as AdminMenuRequest from "types/requests/admin/menu";
import * as AdminMenuResponse from "types/responses/admin/menu";
import * as AdminMenuCategoryRequest from "types/requests/admin/menuCategory";
import * as AdminMenuCategoryResponse from "types/responses/admin/menuCategory";
import * as AdminImageRequest from "types/requests/admin/image";
import * as AdminImageResponse from "types/responses/admin/image";
import queryStore, { api } from '~/lib/query';
import { toast } from '~/hooks/use-toast';

export type MenuState = {
  clientMenuCategories: ClientMenuResponse.Get["result"] | null;
  menuCategories: Schema.MenuCategory[];
  menus: Schema.Menu[];
  isLoaded: boolean;
  error: boolean;

  clientLoad: (query: ClientMenuRequest.Get) => Promise<ClientMenuResponse.Get | null>;
  adminLoad: (query: AdminMenuRequest.Get) => Promise<AdminMenuResponse.Get | null>;

  createMenu: (query: AdminMenuRequest.Create) => Promise<AdminMenuResponse.Create | null>;
  removeMenu: (query: AdminMenuRequest.Remove) => Promise<AdminMenuResponse.Remove | null>;
  updateMenu: (query: AdminMenuRequest.Update) => Promise<AdminMenuResponse.Update | null>;
  uploadImage: (file: File) => Promise<{ filename: string } | null>;

  createMenuCategory: (query: AdminMenuCategoryRequest.Create) => Promise<AdminMenuCategoryResponse.Create | null>;
  removeMenuCategory: (query: AdminMenuCategoryRequest.Remove) => Promise<AdminMenuCategoryResponse.Remove | null>;
  updateMenuCategory: (query: AdminMenuCategoryRequest.Update) => Promise<AdminMenuCategoryResponse.Update | null>;

  // 다른 store에서 사용하기 위해 노출. component에서 사용하지 않음.
  _setMenus: (menus: Schema.Menu[]) => void;
}

const useMenuStore = create<MenuState>((set, get) => ({
  clientMenuCategories: null,
  menuCategories: [],
  menus: [],
  isLoaded: false,
  error: false,

  clientLoad: async (query: ClientMenuRequest.Get) => queryStore<ClientMenuRequest.Get, ClientMenuResponse.Get>({
    route: "menu",
    method: "get",
    query,
    setter: set,
    onSuccess: (res) => set({
      clientMenuCategories: res.result,
      menus: res.result.flatMap((menuCategory) => menuCategory.menus),
    }),
  }),

  adminLoad: async (query: AdminMenuRequest.Get) => queryStore<AdminMenuRequest.Get, AdminMenuResponse.Get>({
    route: "admin/menu",
    method: "get",
    query,
    setter: set,
    onSuccess: (res) => set({
      menuCategories: res.result.map((menuCategory) => ({ ...menuCategory, menus: undefined })),
      menus: res.result.flatMap((menuCategory) => menuCategory.menus)
    })
  }),

  createMenu: async (query: AdminMenuRequest.Create) => queryStore<AdminMenuRequest.Create, AdminMenuResponse.Create>({
    route: "admin/menu",
    method: "post",
    query,
    setter: set,
    onSuccess: (res) => {
      toast({
        title: "메뉴 생성 완료",
        description: "메뉴가 성공적으로 생성되었습니다.",
        duration: 3000,
      });
      get().adminLoad({});
    }
  }),

  removeMenu: async (query: AdminMenuRequest.Remove) => queryStore<AdminMenuRequest.Remove, AdminMenuResponse.Remove>({
    route: "admin/menu",
    method: "delete",
    query,
    setter: set,
    onSuccess: (res) => {
      toast({
        title: "메뉴 삭제 완료",
        description: "메뉴가 성공적으로 삭제되었습니다.",
        duration: 3000,
      });
      get().adminLoad({});
    },
  }),

  updateMenu: async (query: AdminMenuRequest.Update) => queryStore<AdminMenuRequest.Update, AdminMenuResponse.Update>({
    route: "admin/menu",
    method: "put",
    query,
    setter: set,
    onSuccess: (res) => {
      toast({
        title: "메뉴 수정 완료",
        description: "메뉴가 성공적으로 수정되었습니다.",
        duration: 3000,
      });
      get().adminLoad({});
    },
  }),

  uploadImage: async (file: File): Promise<{ filename: string } | null> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.put('admin/image', {
      body: formData,
    }).json<{ result: { filename: string } }>();

    if (response.result?.filename) {
      return response.result;
    }

    return null;
  },

  createMenuCategory: async (query: AdminMenuCategoryRequest.Create) => queryStore<AdminMenuCategoryRequest.Create, AdminMenuCategoryResponse.Create>({
    route: "admin/menuCategory",
    method: "post",
    query,
    setter: set,
    onSuccess: (res) => {
      toast({
        title: "메뉴 카테고리 생성 완료",
        description: "메뉴 카테고리가 성공적으로 생성되었습니다.",
        duration: 3000,
      });
      get().adminLoad({});
    },
  }),

  removeMenuCategory: async (query: AdminMenuCategoryRequest.Remove) => queryStore<AdminMenuCategoryRequest.Remove, AdminMenuCategoryResponse.Remove>({
    route: "admin/menuCategory",
    method: "delete",
    query,
    setter: set,
    onSuccess: (res) => {
      toast({
      title: "메뉴 카테고리 삭제 완료",
      description: "메뉴 카테고리가 성공적으로 삭제되었습니다.",
      duration: 3000,
    });
      get().adminLoad({});
    },
  }),

  updateMenuCategory: async (query: AdminMenuCategoryRequest.Update) => queryStore<AdminMenuCategoryRequest.Update, AdminMenuCategoryResponse.Update>({
    route: "admin/menuCategory",
    method: "put",
    query,
    setter: set,
    onSuccess: (res) => toast({
      title: "메뉴 카테고리 수정 완료",
      description: "메뉴 카테고리가 성공적으로 수정되었습니다.",
      duration: 3000,
    }),
  }),

  _setMenus: (menus: Schema.Menu[]) => set({ menus }),
}));

export default useMenuStore;