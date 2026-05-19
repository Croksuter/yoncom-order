import { featureUnavailable } from "~/lib/server/responses";
import { requireAdmin } from "~/lib/server/auth-session";

export async function PUT() {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  return featureUnavailable("admin-image-upload", {
    requiresAdmin: true,
    schema: "AdminImageRequest.uploadValidation",
    reason: "Image storage is not configured in the Next.js runtime.",
  });
}
