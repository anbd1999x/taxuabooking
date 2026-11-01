"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, getSession } from "@/lib/auth";

export interface ProviderActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function s(v: FormDataEntryValue | null): string | undefined {
  const t = v == null ? undefined : String(v).trim();
  return t ? t : undefined;
}

function money(v: FormDataEntryValue | null): number | null {
  const t = v == null ? "" : String(v).replace(/[^\d]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function currentProviderId(): Promise<string | null> {
  const session = await getSession();
  if (!session || session.role !== "PROVIDER") return null;
  return session.sub;
}

export async function createMyCtv(_prev: ProviderActionState, formData: FormData): Promise<ProviderActionState> {
  const providerId = await currentProviderId();
  if (!providerId) return { error: "Chỉ chủ cơ sở mới tạo được CTV." };

  const username = s(formData.get("username"))?.toLowerCase();
  const password = s(formData.get("password"));
  const name = s(formData.get("name"));
  const phone = s(formData.get("phone")) ?? null;
  if (!username || !password || !name) return { error: "Nhập đủ tên đăng nhập, mật khẩu, họ tên." };
  if (password.length < 4) return { error: "Mật khẩu tối thiểu 4 ký tự." };

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) return { error: "Tên đăng nhập đã tồn tại." };

  try {
    await prisma.adminUser.create({
      data: { username, name, phone, role: "CTV", providerId, commissionPerOrder: money(formData.get("commissionPerOrder")), passwordHash: await hashPassword(password) },
    });
  } catch {
    return { error: "Tạo CTV thất bại." };
  }
  revalidatePath("/admin/provider/ctv");
  return { ok: true, message: "Đã tạo CTV" };
}

/** Chủ cơ sở đặt mức hoa hồng/đơn cho CTV của mình. */
export async function setMyCtvCommission(formData: FormData): Promise<void> {
  const id = s(formData.get("id"));
  if (!id || !(await ownCtv(id))) return;
  await prisma.adminUser.update({ where: { id }, data: { commissionPerOrder: money(formData.get("commissionPerOrder")) } });
  revalidatePath("/admin/provider/ctv");
}

/** Chỉ thao tác trên CTV thuộc chính chủ cơ sở này. */
async function ownCtv(id: string): Promise<boolean> {
  const providerId = await currentProviderId();
  if (!providerId) return false;
  const u = await prisma.adminUser.findUnique({ where: { id } });
  return !!u && u.role === "CTV" && u.providerId === providerId;
}

export async function toggleMyCtv(formData: FormData): Promise<void> {
  const id = s(formData.get("id"));
  if (!id || !(await ownCtv(id))) return;
  const u = await prisma.adminUser.findUnique({ where: { id } });
  await prisma.adminUser.update({ where: { id }, data: { active: !u!.active } });
  revalidatePath("/admin/provider/ctv");
}

export async function deleteMyCtv(formData: FormData): Promise<void> {
  const id = s(formData.get("id"));
  if (!id || !(await ownCtv(id))) return;
  await prisma.adminUser.delete({ where: { id } });
  revalidatePath("/admin/provider/ctv");
}
