import { AdminDataLoader } from "./admin-data-loader";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminDataLoader>{children}</AdminDataLoader>;
}
