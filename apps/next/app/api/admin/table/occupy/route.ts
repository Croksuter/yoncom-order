import { notMigrated } from "~/lib/server/responses";

export async function PUT() {
  return notMigrated("PUT /api/admin/table/occupy", {
    requiresAdmin: true,
    schema: "AdminTableRequest.occupyValidation",
  });
}
