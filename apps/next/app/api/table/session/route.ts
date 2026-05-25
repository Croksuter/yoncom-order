import { z } from "zod";
import { guardUnsafeRequest, parseJsonBody, routeError } from "~/lib/server/api";
import { resolveTableSessionAccess } from "~/lib/server/table-session";

const sessionValidation = z.object({
  tableId: z.string().length(15),
}).strict();

export async function POST(request: Request) {
  const guardError = guardUnsafeRequest(request, { csrf: false, idempotency: false });
  if (guardError) return guardError;

  try {
    const { tableId } = await parseJsonBody(request, sessionValidation);
    const result = await resolveTableSessionAccess(request, tableId);
    return result.response;
  } catch (error) {
    return routeError(error);
  }
}
