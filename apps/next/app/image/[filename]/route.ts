import { featureUnavailable } from "~/lib/server/responses";

type ImageRouteContext = {
  params: Promise<{ filename: string }>;
};

export async function GET(_request: Request, { params }: ImageRouteContext) {
  const { filename } = await params;

  return featureUnavailable("image-read", {
    filename,
    reason: "Image storage is not configured in the Next.js runtime.",
  });
}
