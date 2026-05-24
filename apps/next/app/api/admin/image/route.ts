import { requireAdmin } from "~/lib/server/auth-session";
import { guardUnsafeRequest, ok, routeError } from "~/lib/server/api";
import { saveUploadedImage } from "~/lib/server/image-storage";
import { uploadValidation } from "shared/types/requests/admin/image";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true, json: false });
  if (guardError) return guardError;

  try {
    const formData = await request.formData();
    const query = uploadValidation.parse({
      file: formData.get("file"),
    });
    const filename = await saveUploadedImage(query.file);

    return ok({ filename: `/image/${filename}` });
  } catch (error) {
    return routeError(error);
  }
}
