"use server";

import { redirect } from "next/navigation";
import { loginSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";

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

  const user = await prisma.adminUser.findUnique({
    where: { username: parsed.data.username },
  });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Sai tên đăng nhập hoặc mật khẩu." };
  }
  if (!user.active) {
    return { error: "Tài khoản đã bị khoá." };
  }

  const token = await createSessionToken({
    sub: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  });
  await setSessionCookie(token);
  // CTV & chủ dịch vụ về khu vực riêng; admin về trang quản trị.
  redirect(user.role === "CTV" ? "/admin/ctv" : user.role === "PROVIDER" ? "/admin/provider" : "/admin");
}
