import { paidValidation, removeValidation } from "shared/types/requests/admin/order";
import { fail, ok, routeError } from "~/lib/server/api";
import { requireAdmin, requireAdminUser } from "~/lib/server/auth-session";
import { cancelOrder, markOrderPaid } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    const query = paidValidation.parse(await request.json());
    const result = await markOrderPaid(query.orderId);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdminUser();
  if (admin.response) return admin.response;

  try {
    const query = removeValidation.parse(await request.json());
    const result = await cancelOrder(query.orderId, {
      allowPaid: true,
      adminUserId: admin.user?.id ?? null,
      cancelReason: query.cancelReason,
    });

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}
