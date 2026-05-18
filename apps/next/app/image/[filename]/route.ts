import { notMigrated } from "~/lib/server/responses";

type ImageRouteContext = {
  params: Promise<{ filename: string }>;
};

export async function GET(_request: Request, { params }: ImageRouteContext) {
  const { filename } = await params;

  return notMigrated("GET /image/:filename", { filename, dependency: "R2_BUCKET" });
}
