"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin } from "@/lib/auth";

export interface AccountState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function s(v: FormDataEntryValue | null): string | undefined {
  const t = v == null ? undefined : String(v).trim();
  return t ? t : undefined;
}

/** Số tiền (đồng) từ ô nhập; rỗng/không hợp lệ ⇒ null. */
function money(v: FormDataEntryValue | null): number | null {
  const t = v == null ? "" : String(v).replace(/[^\d]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function createAccount(_prev: AccountState, formData: FormData): Promise<AccountState> {
  await requireAdmin();
  const username = s(formData.get("username"))?.toLowerCase();
  const password = s(formData.get("password"));
  const name = s(formData.get("name"));
  const phone = s(formData.get("phone")) ?? null;
  const role = s(formData.get("role"));
  if (!username || !password || !name) return { error: "Nhập đủ tên đăng nhập, mật khẩu, họ tên." };
  if (role !== "CTV" && role !== "PROVIDER") return { error: "Vai trò không hợp lệ." };
  if (password.length < 4) return { error: "Mật khẩu tối thiểu 4 ký tự." };

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) return { error: "Tên đăng nhập đã tồn tại." };

  // CTV thuộc một chủ cơ sở (tuỳ chọn).
  let providerId: string | null = null;
  if (role === "CTV") {
    providerId = s(formData.get("providerId")) ?? null;
    if (providerId) {
      const prov = await prisma.adminUser.findUnique({ where: { id: providerId } });
      if (!prov || prov.role !== "PROVIDER") return { error: "Chủ cơ sở không hợp lệ." };
    }
  }

  // Hoa hồng cố định/đơn (chỉ áp dụng cho CTV).
  const commissionPerOrder = role === "CTV" ? money(formData.get("commissionPerOrder")) : null;

  try {
    await prisma.adminUser.create({
      data: { username, name, phone, role, providerId, commissionPerOrder, passwordHash: await hashPassword(password) },
    });
  } catch {
    return { error: "Tạo tài khoản thất bại." };
  }
  revalidatePath("/admin/accounts");
  return { ok: true, message: `Đã tạo tài khoản ${role === "CTV" ? "CTV" : "chủ dịch vụ"}` };
}

export async function toggleAccountActive(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = s(formData.get("id"));
  if (!id) return;
  const u = await prisma.adminUser.findUnique({ where: { id } });
  if (!u || u.role === "ADMIN") return; // không khoá admin
  await prisma.adminUser.update({ where: { id }, data: { active: !u.active } });
  revalidatePath("/admin/accounts");
}

/** Đặt mức hoa hồng cố định/đơn cho một CTV (admin). Rỗng = không có (0). */
export async function setCtvCommission(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = s(formData.get("id"));
  if (!id) return;
  const u = await prisma.adminUser.findUnique({ where: { id } });
  if (!u || u.role !== "CTV") return;
  await prisma.adminUser.update({ where: { id }, data: { commissionPerOrder: money(formData.get("commissionPerOrder")) } });
  revalidatePath("/admin/accounts");
}

export async function resetAccountPassword(_prev: AccountState, formData: FormData): Promise<AccountState> {
  await requireAdmin();
  const id = s(formData.get("id"));
  const password = s(formData.get("password"));
  if (!id || !password || password.length < 4) return { error: "Mật khẩu tối thiểu 4 ký tự." };
  const u = await prisma.adminUser.findUnique({ where: { id } });
  if (!u || u.role === "ADMIN") return { error: "Không đổi được." };
  await prisma.adminUser.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  revalidatePath("/admin/accounts");
  return { ok: true, message: "Đã đổi mật khẩu" };
}

/**
 * SỬA TOÀN BỘ tài khoản CTV / chủ dịch vụ: họ tên, tên đăng nhập, SĐT, vai trò, chủ cơ sở
 * (CTV), hoa hồng/đơn (CTV), mật khẩu (để trống = giữ), hoạt động, và DỊCH VỤ SỞ HỮU (chủ
 * dịch vụ — gán/gỡ Service.ownerId). Vai trò mới có hiệu lực từ lần đăng nhập sau (JWT).
 */
export async function updateAccount(_prev: AccountState, formData: FormData): Promise<AccountState> {
  await requireAdmin();
  const id = s(formData.get("id"));
  if (!id) return { error: "Thiếu tài khoản." };
  const u = await prisma.adminUser.findUnique({
    where: { id },
    include: { _count: { select: { ownedServices: true, ctvs: true } } },
  });
  if (!u || u.role === "ADMIN") return { error: "Không sửa được tài khoản này." };

  const username = s(formData.get("username"))?.toLowerCase();
  const name = s(formData.get("name"));
  const phone = s(formData.get("phone")) ?? null;
  const role = s(formData.get("role"));
  const password = s(formData.get("password"));
  const active = formData.get("active") === "on";
  if (!username || !name) return { error: "Nhập đủ tên đăng nhập và họ tên." };
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return { error: "Tên đăng nhập 3–40 ký tự: chữ thường không dấu, số, . _ -" };
  if (role !== "CTV" && role !== "PROVIDER") return { error: "Vai trò không hợp lệ." };
  if (password && password.length < 4) return { error: "Mật khẩu tối thiểu 4 ký tự." };

  if (username !== u.username) {
    const dup = await prisma.adminUser.findUnique({ where: { username } });
    if (dup) return { error: "Tên đăng nhập đã tồn tại." };
  }

  // Đổi chủ dịch vụ → CTV: phải gỡ hết CTV đang thuộc họ (dịch vụ sở hữu được gỡ bên dưới).
  if (u.role === "PROVIDER" && role === "CTV" && u._count.ctvs > 0) {
    return { error: `Chủ dịch vụ này đang có ${u._count.ctvs} CTV — chuyển các CTV sang chủ khác trước khi đổi vai trò.` };
  }

  let providerId: string | null = null;
  if (role === "CTV") {
    providerId = s(formData.get("providerId")) ?? null;
    if (providerId) {
      if (providerId === id) return { error: "CTV không thể thuộc chính mình." };
      const prov = await prisma.adminUser.findUnique({ where: { id: providerId } });
      if (!prov || prov.role !== "PROVIDER") return { error: "Chủ cơ sở không hợp lệ." };
    }
  }

  // Dịch vụ sở hữu (chỉ chủ dịch vụ). CTV ⇒ gỡ hết.
  const serviceIds = role === "PROVIDER" ? formData.getAll("serviceIds").map(String).filter(Boolean) : [];

  try {
    await prisma.$transaction([
      prisma.adminUser.update({
        where: { id },
        data: {
          username,
          name,
          phone,
          role,
          active,
          providerId,
          commissionPerOrder: role === "CTV" ? money(formData.get("commissionPerOrder")) : null,
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        },
      }),
      // Gỡ dịch vụ không còn tick, gán dịch vụ mới tick.
      prisma.service.updateMany({
        where: { ownerId: id, id: { notIn: serviceIds } },
        data: { ownerId: null },
      }),
      ...(serviceIds.length
        ? [prisma.service.updateMany({ where: { id: { in: serviceIds } }, data: { ownerId: id } })]
        : []),
    ]);
  } catch {
    return { error: "Lưu tài khoản thất bại." };
  }
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/services");
  return { ok: true, message: `Đã lưu tài khoản ${name}` };
}

export async function deleteAccount(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = s(formData.get("id"));
  if (!id) return;
  const u = await prisma.adminUser.findUnique({ where: { id } });
  if (!u || u.role === "ADMIN") return;
  await prisma.adminUser.delete({ where: { id } });
  revalidatePath("/admin/accounts");
}
