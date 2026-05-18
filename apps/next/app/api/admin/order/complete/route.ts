import { notMigrated } from "~/lib/server/responses";

export async function PUT() {
  return notMigrated("PUT /api/admin/order/complete", {
    requiresAdmin: true,
    schema: "AdminOrderRequest.completeValidation",
  });
}
