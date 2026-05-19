import { createValidation } from "shared/types/requests/admin/deposit";
import { fail, ok, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { getPendingBankTransactions, ingestBankTransaction } from "~/lib/server/d1-mutations";

export async function GET() {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    const result = await getPendingBankTransactions();

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    const query = createValidation.parse(await request.json());
    const result = await ingestBankTransaction({
      amount: query.amount,
      bank: query.bank,
      depositor: query.name,
      timestamp: query.timestamp,
      rawText: query.rawText,
      source: query.source,
      dedupeKey: query.dedupeKey,
    });

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}
