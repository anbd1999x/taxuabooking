import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Đã đăng nhập (phiên còn hiệu lực THẬT — getSession kiểm cả tài khoản còn active trong DB) ⇒ về khu của mình.
 * Việc này chuyển từ proxy (edge chỉ thấy JWT còn hạn) về đây: tài khoản bị khoá vẫn mở được form đăng nhập,
 * không bị kẹt vòng chuyển hướng login ⇄ trang chủ khu quản trị.
 */
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (s) redirect(s.role === "CTV" ? "/admin/ctv" : s.role === "PROVIDER" ? "/admin/provider" : s.role === "STAFF" || s.role === "DEMO" ? "/admin/provider/xe" : "/admin");
  return <>{children}</>;
}
