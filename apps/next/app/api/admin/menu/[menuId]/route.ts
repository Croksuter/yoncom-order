import { notMigrated } from "~/lib/server/responses";

type AdminMenuDetailRouteContext = {
  params: Promise<{ menuId: string }>;
};

export async function GET(
  _request: Request,
  { params }: AdminMenuDetailRouteContext,
) {
  const { menuId } = await params;

  return notMigrated("GET /api/admin/menu/:menuId", {
    menuId,
    requiresAdmin: true,
  });
}
