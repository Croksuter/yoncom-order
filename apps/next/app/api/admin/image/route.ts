import { notMigrated } from "~/lib/server/responses";
import { requireAdmin } from "~/lib/server/auth-session";

export async function PUT() {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  return notMigrated("PUT /api/admin/image", {
    requiresAdmin: true,
    schema: "AdminImageRequest.uploadValidation",
    dependency: "R2_BUCKET",
  });
}
