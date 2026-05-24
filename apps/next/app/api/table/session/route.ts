import { z } from "zod";
import { guardUnsafeRequest, parseJsonBody, routeError } from "~/lib/server/api";
import { issueTableSession } from "~/lib/server/table-session";

const sessionValidation = z.object({
  tableId: z.string().length(15),
}).strict();

export async function POST(request: Request) {
  const guardError = guardUnsafeRequest(request, { csrf: false, idempotency: false });
  if (guardError) return guardError;

  try {
    const { tableId } = await parseJsonBody(request, sessionValidation);
    const result = await issueTableSession(tableId);
    if ("response" in result) return result.response;

    return Response.json({ error: result.error }, { status: result.status });
  } catch (error) {
    return routeError(error);
  }
}
