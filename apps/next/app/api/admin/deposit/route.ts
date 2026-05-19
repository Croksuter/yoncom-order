import { createValidation } from "shared/types/requests/admin/deposit";
import { fail, ok, routeError } from "~/lib/server/api";
import { markDepositPaid } from "~/lib/server/d1-mutations";

export async function POST(request: Request) {
  try {
    const query = createValidation.parse(await request.json());
    const result = await markDepositPaid(query.amount, query.bank, query.name, query.timestamp);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}
