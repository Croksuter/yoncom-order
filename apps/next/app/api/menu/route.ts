import { isNull } from "drizzle-orm";
import { menuCategories } from "db/schema";
import type * as Schema from "db/schema";
import { getValidation } from "shared/types/requests/client/menu";
import { ok, parseSearchParams, routeError } from "~/lib/server/api";
import { getDb } from "~/lib/server/db";
import { enrichMenuCategoriesWithBundles } from "~/lib/server/d1-mutations";
import type * as ClientMenuResponse from "shared/types/responses/client/menu";

type MenuWithBundles = Schema.Menu & {
  bundleItems?: ClientMenuResponse.MenuBundleItem[];
  bundleAvailableQuantity?: number | null;
};

type MenuCategoryWithMenus = Schema.MenuCategory & {
  menus: MenuWithBundles[];
};

function toClientMenuCategories(categories: MenuCategoryWithMenus[]): ClientMenuResponse.Get["result"] {
  return categories.map((category) => ({
    ...category,
    menus: category.menus.map((menu) => ({
      id: menu.id,
      name: menu.name,
      nameEn: menu.nameEn ?? null,
      image: menu.image,
      description: menu.description,
      descriptionEn: menu.descriptionEn ?? null,
      price: menu.price,
      quantity: menu.quantity,
      available: menu.available,
      menuCategoryId: menu.menuCategoryId,
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
      deletedAt: menu.deletedAt,
      bundleItems: menu.bundleItems,
      bundleAvailableQuantity: menu.bundleAvailableQuantity,
    })),
  }));
}

export async function GET(request: Request) {
  try {
    parseSearchParams(request, getValidation);

    const result = await getDb().query.menuCategories.findMany({
      where: isNull(menuCategories.deletedAt),
      with: {
        menus: true,
      },
    });

    return ok(toClientMenuCategories(await enrichMenuCategoriesWithBundles(result)));
  } catch (error) {
    return routeError(error);
  }
}
