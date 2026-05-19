import { featureUnavailable } from "~/lib/server/responses";
import { requireAdmin } from "~/lib/server/auth-session";

export async function GET() {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  return featureUnavailable("admin-payout-report", {
    requiresAdmin: true,
  });
}
