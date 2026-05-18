import { notMigrated } from "~/lib/server/responses";

export async function POST() {
  return notMigrated("POST /api/admin/deposit", {
    requiresAdmin: true,
    schema: "AdminDepositRequest.createValidation",
  });
}
