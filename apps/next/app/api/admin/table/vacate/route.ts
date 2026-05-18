import { notMigrated } from "~/lib/server/responses";

export async function PUT() {
  return notMigrated("PUT /api/admin/table/vacate", {
    requiresAdmin: true,
    schema: "AdminTableRequest.vacateValidation",
  });
}
