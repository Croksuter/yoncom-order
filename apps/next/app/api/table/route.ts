import { notMigrated } from "~/lib/server/responses";

export async function GET() {
  return notMigrated("GET /api/table", {
    schema: "ClientTableRequest.getValidation",
  });
}
