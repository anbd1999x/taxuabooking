import "server-only";
import crypto from "node:crypto";
import { prisma } from "./prisma";
import { createSessionToken, hashPassword, invalidateSessionCache, setSessionCookie } from "./auth";
import { pushToAdmins } from "./push";

/**
 * Chủ homestay đăng nhập khu quản trị bằng Google (đã xác minh email) — KHÔNG cần đăng ký:
 * lần đầu tự tạo tài khoản PROVIDER `selfSignup` (username = email chữ thường), lần sau khớp lại đúng tài khoản cũ
 * theo email ⇒ dùng tiếp dữ liệu như tài khoản thường. Trả về trang cần chuyển tới, hoặc { error } để báo.
 */
export async function loginPartnerWithGoogle(info: { email: string; name: string }): Promise<{ next: string } | { error: string }> {
  const email = info.email.trim().toLowerCase();
  let user = await prisma.adminUser.findFirst({ where: { OR: [{ email }, { username: email }] } });
  let created = false;
  if (!user) {
    try {
      user = await prisma.adminUser.create({
        data: {
          username: email,
          email,
          name: (info.name || email.split("@")[0]).slice(0, 80),
          role: "PROVIDER",
          selfSignup: true,
          // Không dùng mật khẩu (đăng nhập bằng Google) — đặt chuỗi ngẫu nhiên để đăng nhập mật khẩu không vào được.
          passwordHash: await hashPassword(crypto.randomBytes(24).toString("hex")),
        },
      });
      created = true;
    } catch {
      // Hai lần bấm cùng lúc ⇒ bản ghi đã được tạo ở lần kia.
      user = await prisma.adminUser.findFirst({ where: { OR: [{ email }, { username: email }] } });
      if (!user) return { error: "create" };
    }
  }
  if (!user.active) return { error: "locked" };

  await setSessionCookie(await createSessionToken({ sub: user.id, username: user.username, name: user.name, role: user.role }));
  invalidateSessionCache(user.id);
  if (created) {
    void pushToAdmins({ title: "Đối tác mới đăng ký dùng thử", body: `${user.name} · ${email}`, url: "/admin/accounts", tag: `signup-${user.id}` }).catch(() => {});
  }
  if (user.role === "PROVIDER") return { next: "/admin/provider" };
  return { next: user.role === "CTV" ? "/admin/ctv" : user.role === "ADMIN" ? "/admin" : "/admin/provider/xe" };
}
