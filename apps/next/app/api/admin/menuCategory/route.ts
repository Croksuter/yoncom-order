import { notMigrated } from "~/lib/server/responses";

export async function POST() {
  return notMigrated("POST /api/admin/menuCategory", {
    requiresAdmin: true,
    schema: "AdminMenuCategoryRequest.createValidation",
  });
}

export async function PUT() {
  return notMigrated("PUT /api/admin/menuCategory", {
    requiresAdmin: true,
    schema: "AdminMenuCategoryRequest.updateValidation",
  });
}

export async function DELETE() {
  return notMigrated("DELETE /api/admin/menuCategory", {
    requiresAdmin: true,
    schema: "AdminMenuCategoryRequest.removeValidation",
  });
}
