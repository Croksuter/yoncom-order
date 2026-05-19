import { featureUnavailable } from "~/lib/server/responses";
import { requireAdmin } from "~/lib/server/auth-session";

type AdminMenuDetailRouteContext = {
  params: Promise<{ menuId: string }>;
};

export async function GET(
  _request: Request,
  { params }: AdminMenuDetailRouteContext,
) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  const { menuId } = await params;

  return featureUnavailable("admin-menu-detail", {
    menuId,
    requiresAdmin: true,
  });
}
