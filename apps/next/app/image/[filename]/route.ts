import { fail, routeError } from "~/lib/server/api";
import { getImageContentType, readStoredImage } from "~/lib/server/image-storage";

type ImageRouteContext = {
  params: Promise<{ filename: string }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: ImageRouteContext) {
  const { filename } = await params;

  try {
    const bytes = await readStoredImage(filename);

    return new Response(bytes, {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-type": getImageContentType(filename),
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fail("Image Not Found", 404);
    }

    return routeError(error);
  }
}
