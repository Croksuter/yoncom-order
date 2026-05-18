import { notMigrated } from "~/lib/server/responses";

export async function GET() {
  return notMigrated("GET /api/admin/table", {
    requiresAdmin: true,
    schema: "AdminTableRequest.getValidation",
  });
}

export async function POST() {
  return notMigrated("POST /api/admin/table", {
    requiresAdmin: true,
    schema: "AdminTableRequest.createValidation",
  });
}

export async function PUT() {
  return notMigrated("PUT /api/admin/table", {
    requiresAdmin: true,
    schema: "AdminTableRequest.updateValidation",
  });
}

export async function DELETE() {
  return notMigrated("DELETE /api/admin/table", {
    requiresAdmin: true,
    schema: "AdminTableRequest.removeValidation",
  });
}
