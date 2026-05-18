import { notMigrated } from "~/lib/server/responses";

export async function PUT() {
  return notMigrated("PUT /api/admin/order", {
    requiresAdmin: true,
    schema: "AdminOrderRequest.paidValidation",
  });
}

export async function DELETE() {
  return notMigrated("DELETE /api/admin/order", {
    requiresAdmin: true,
    hotspot: "deleteOrder",
  });
}
