import { AdminDataLoader } from "./admin-data-loader";
import { redirect } from "next/navigation";
import { requireAdminUser, toPublicSessionUser } from "~/lib/server/auth-session";
import DashboardLayout from "./dashboard-layout";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminUser();

  if (admin.response || !admin.user) {
    redirect("/auth");
  }

  return (
    <AdminDataLoader>
      <DashboardLayout user={toPublicSessionUser(admin.user)}>{children}</DashboardLayout>
    </AdminDataLoader>
  );
}
