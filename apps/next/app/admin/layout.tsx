import { AdminDataLoader } from "./admin-data-loader";
import { userRole } from "db/schema";
import { redirect } from "next/navigation";
import { getSessionUser } from "~/lib/server/auth-session";
import DashboardLayout from "./dashboard-layout";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (!user || user.role !== userRole.ADMIN) {
    redirect("/auth");
  }

  return (
    <AdminDataLoader>
      <DashboardLayout>{children}</DashboardLayout>
    </AdminDataLoader>
  );
}

