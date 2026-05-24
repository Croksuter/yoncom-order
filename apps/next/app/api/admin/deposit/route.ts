import { createValidation } from "shared/types/requests/admin/deposit";
import { fail, guardUnsafeRequest, mutationOk, ok, parseJsonBody, routeError } from "~/lib/server/api";
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
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, createValidation);
    const result = await ingestBankTransaction({
      amount: query.amount,
      bank: query.bank ?? "MANUAL",
      depositor: query.name ?? "UNKNOWN",
      timestamp: query.timestamp,
      rawText: query.rawText,
      source: query.source ?? "MANUAL",
      dedupeKey: query.dedupeKey,
    });

    if (result.error) {
      return fail(result.error, result.status);
    }

    return mutationOk(result);
  } catch (error) {
    return routeError(error);
  }
}
