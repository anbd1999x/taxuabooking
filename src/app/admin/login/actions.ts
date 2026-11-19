"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requestIp } from "@/lib/ip-block";
import { rateLimit, refundLimit, resetLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { normalizeVnPhone } from "@/lib/phone";
import {
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  invalidateSessionCache,
} from "@/lib/auth";

// Chống dò mật khẩu: sai ≤ 5 lần / 15 phút cho mỗi (IP, tài khoản) và ≤ 30 lần / 15 phút cho mỗi IP.
const FAIL_WIN = 15 * 60_000;
const FAIL_USER = 5;
const FAIL_IP = 30;

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Vui lòng nhập đầy đủ thông tin." };
  }

  const ip = requestIp(await headers()) ?? "unknown";
  const userKey = `login-fail:${ip}:${parsed.data.username.toLowerCase()}`;
  const ipKey = `login-fail-ip:${ip}`;
  // GHI lượt TRƯỚC khi so mật khẩu (bcrypt chậm ⇒ request song song không lọt qua cùng lúc);
  // quá số lần thì từ chối luôn, kể cả khi lần này đúng. Đăng nhập đúng mới hoàn lại / xoá bộ đếm.
  const userOk = rateLimit(userKey, FAIL_USER, FAIL_WIN);
  const ipOk = userOk && rateLimit(ipKey, FAIL_IP, FAIL_WIN);
  if (!userOk || !ipOk) {
    if (userOk) refundLimit(userKey); // chặn vì IP ⇒ không tính thêm lượt cho tài khoản
    return { error: "Sai quá nhiều lần. Vui lòng thử lại sau 15 phút." };
  }

  // Chủ homestay tự đăng ký dùng email hoặc SĐT làm tên đăng nhập ⇒ thử thêm dạng chuẩn hoá của SĐT
  // (gõ "+84 912 345 678" vẫn khớp "0912345678") và cột email.
  const login = parsed.data.username;
  const phoneForm = /^[+\d][\d\s.\-()]{8,}$/.test(login) ? normalizeVnPhone(login) : null;
  const user =
    (await prisma.adminUser.findUnique({ where: { username: login } })) ??
    (phoneForm && phoneForm !== login ? await prisma.adminUser.findUnique({ where: { username: phoneForm } }) : null) ??
    (login.includes("@") ? await prisma.adminUser.findUnique({ where: { email: login } }) : null);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Sai tên đăng nhập hoặc mật khẩu." };
  }
  resetLimit(userKey);
  refundLimit(ipKey);
  if (!user.active) {
    return { error: "Tài khoản đã bị khoá." };
  }

  const token = await createSessionToken({
    sub: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  });
  invalidateSessionCache(user.id); // vừa mở khoá / đổi vai trò ⇒ không dùng kết quả cache cũ
  await setSessionCookie(token);
  // CTV & chủ dịch vụ về khu vực riêng; admin về trang quản trị.
  // Nhân viên: lễ tân homestay (staffArea "phong") về Quản lý phòng, còn lại về trang xe (tự chuyển sang soát vé nếu chủ không có xe).
  const staffHome = user.staffArea === "phong" ? "/admin/provider/phong" : "/admin/provider/xe";
  redirect(user.role === "CTV" ? "/admin/ctv" : user.role === "PROVIDER" ? "/admin/provider" : user.role === "STAFF" ? staffHome : "/admin");
}
