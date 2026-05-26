import { updateValidation } from "shared/types/requests/admin/payment-settings";
import { fail, guardUnsafeRequest, mutationOk, ok, parseJsonBody, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { getPaymentSettings, updatePaymentSettings } from "~/lib/server/d1-mutations";

export async function GET() {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    return ok(await getPaymentSettings());
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, updateValidation);
    const result = await updatePaymentSettings(query.paymentSettings);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return mutationOk(result);
  } catch (error) {
    return routeError(error);
  }
}
