import { notMigrated } from "~/lib/server/responses";

export async function PUT() {
  return notMigrated("PUT /api/admin/image", {
    requiresAdmin: true,
    schema: "AdminImageRequest.uploadValidation",
    dependency: "R2_BUCKET",
  });
}
