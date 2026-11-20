"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { hashPassword, getSession, invalidateSessionCache } from "@/lib/auth";
import { isSelfSignupProvider } from "@/lib/partner-access";
import { slugify } from "@/lib/utils";

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
  invalidateSessionCache(id); // khoá/mở CTV có hiệu lực ngay
  revalidatePath("/admin/provider/ctv");
}

export async function deleteMyCtv(formData: FormData): Promise<void> {
  const id = s(formData.get("id"));
  if (!id || !(await ownCtv(id))) return;
  await prisma.adminUser.delete({ where: { id } });
  invalidateSessionCache(id);
  revalidatePath("/admin/provider/ctv");
}

/**
 * Đối tác TỰ ĐĂNG KÝ bật chức năng "Quản lý thuê xe máy": tạo một tiệm xe máy (dịch vụ MOTORBIKE) của chính họ.
 * published=false — chỉ dùng để quản lý đội xe; muốn hiện trên website thì liên hệ sàn. Mỗi tài khoản một tiệm.
 */
export async function createMyMotoShop(): Promise<void> {
  const session = await getSession();
  if (!session || !(await isSelfSignupProvider(session))) throw new Error("Không có quyền.");
  const has = await prisma.service.findFirst({ where: { ownerId: session.sub, category: "MOTORBIKE" }, select: { id: true } });
  if (!has) {
    const title = `Tiệm xe máy ${session.name || ""}`.trim();
    const root = slugify(title) || "tiem-xe-may";
    let slug = root;
    for (let i = 2; await prisma.service.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${root}-${i}`;
    await prisma.service.create({
      data: { category: "MOTORBIKE", title, slug, summary: "", description: "", published: false, ownerId: session.sub },
    });
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/provider/xe");
}
