import { featureUnavailable } from "~/lib/server/responses";
import { requireAdmin } from "~/lib/server/auth-session";
import { guardUnsafeRequest } from "~/lib/server/api";

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true, json: false });
  if (guardError) return guardError;

  return featureUnavailable("admin-image-upload", {
    requiresAdmin: true,
    schema: "AdminImageRequest.uploadValidation",
    reason: "Image storage is not configured in the Next.js runtime.",
  });
}
