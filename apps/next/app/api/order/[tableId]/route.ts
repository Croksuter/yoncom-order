import { notMigrated } from "~/lib/server/responses";

type OrderListRouteContext = {
  params: Promise<{ tableId: string }>;
};

export async function GET(_request: Request, { params }: OrderListRouteContext) {
  const { tableId } = await params;

  return notMigrated("GET /api/order/:tableId", { tableId });
}
