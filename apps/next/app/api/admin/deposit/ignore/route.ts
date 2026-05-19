import { ignoreValidation } from "shared/types/requests/admin/deposit";
import { fail, ok, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { ignoreBankTransaction } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    const query = ignoreValidation.parse(await request.json());
    const result = await ignoreBankTransaction(query.bankTransactionId);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}
