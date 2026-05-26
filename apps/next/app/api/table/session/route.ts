import { z } from "zod";
import { guardUnsafeRequest, parseJsonBody, routeError, tableSessionRouteRateLimit } from "~/lib/server/api";
import { getPaymentSettings } from "~/lib/server/d1-mutations";
import { resolveTableSessionAccess } from "~/lib/server/table-session";

const sessionValidation = z.object({
  tableId: z.string().length(15),
}).strict();

export async function POST(request: Request) {
  const guardError = guardUnsafeRequest(request, {
    csrf: false,
    idempotency: false,
    rateLimit: tableSessionRouteRateLimit,
  });
  if (guardError) return guardError;

  try {
    const { tableId } = await parseJsonBody(request, sessionValidation);
    const result = await resolveTableSessionAccess(request, tableId);
    if (!result.response.ok) {
      return result.response;
    }

    const body = (await result.response.clone().json().catch(() => null)) as { result?: Record<string, unknown> } | null;
    if (!body?.result) {
      return result.response;
    }

    return Response.json(
      {
        result: {
          ...body.result,
          paymentSettings: await getPaymentSettings(),
        },
      },
      {
        status: result.response.status,
        headers: new Headers(result.response.headers),
      },
    );
  } catch (error) {
    return routeError(error);
  }
}
