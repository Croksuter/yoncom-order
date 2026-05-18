import { notMigrated } from "~/lib/server/responses";

export async function GET() {
  return notMigrated("GET /api/admin/menu", { requiresAdmin: true });
}

export async function POST() {
  return notMigrated("POST /api/admin/menu", {
    requiresAdmin: true,
    schema: "AdminMenuRequest.createValidation",
  });
}

export async function PUT() {
  return notMigrated("PUT /api/admin/menu", {
    requiresAdmin: true,
    schema: "AdminMenuRequest.updateValidation",
  });
}

export async function DELETE() {
  return notMigrated("DELETE /api/admin/menu", {
    requiresAdmin: true,
    schema: "AdminMenuRequest.removeValidation",
  });
}
