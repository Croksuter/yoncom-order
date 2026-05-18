import { notMigrated } from "~/lib/server/responses";

type OrderDetailRouteContext = {
  params: Promise<{ tableId: string; orderId: string }>;
};

export async function GET(_request: Request, { params }: OrderDetailRouteContext) {
  const { tableId, orderId } = await params;

  return notMigrated("GET /api/order/:tableId/:orderId", { tableId, orderId });
}
