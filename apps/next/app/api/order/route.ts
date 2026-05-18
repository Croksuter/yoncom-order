import { notMigrated } from "~/lib/server/responses";

export async function POST() {
  return notMigrated("POST /api/order", {
    schema: "ClientOrderRequest.createValidation",
    hotspot: "createOrder",
  });
}

export async function DELETE() {
  return notMigrated("DELETE /api/order", {
    schema: "ClientOrderRequest.removeValidation",
    hotspot: "removeOrder",
  });
}
