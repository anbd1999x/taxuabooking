import { getSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Trang đăng nhập (chưa có phiên) hiển thị không có sidebar.
  if (!session) {
    return <>{children}</>;
  }

  return (
    <AdminShell adminName={session.name} role={session.role}>
      {children}
    </AdminShell>
  );
}
