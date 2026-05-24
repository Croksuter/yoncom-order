import { clearAuthResponse } from "~/lib/server/auth-session";
import { guardUnsafeRequest } from "~/lib/server/api";

export async function POST(request: Request) {
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: false, json: false });
  if (guardError) return guardError;

  return await clearAuthResponse({ result: "Success" });
}
