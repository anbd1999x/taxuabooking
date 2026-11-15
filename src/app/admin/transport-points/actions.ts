"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormResult } from "@/components/admin/ActionForm";

/** Thêm / sửa một ĐIỂM CỐ ĐỊNH (điểm đón / điểm đến cho taxi, xe ôm). */
export async function saveTransportPoint(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireAdmin();
  const id = String(fd.get("id") ?? "").trim();
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  const area = String(fd.get("area") ?? "").trim().slice(0, 60) || null;
  const sortOrder = Number(fd.get("sortOrder")) || 0;
  const active = fd.get("active") === "on";
  if (name.length < 2) return { error: "Nhập tên điểm." };
  const dup = await prisma.transportPoint.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (dup) return { error: "Đã có điểm cùng tên." };
  if (id) await prisma.transportPoint.update({ where: { id }, data: { name, area, sortOrder, active } });
  else {
    const count = await prisma.transportPoint.count();
    await prisma.transportPoint.create({ data: { name, area, sortOrder: sortOrder || count + 1, active: true } });
  }
  revalidatePath("/admin/transport-points");
  return { ok: true, message: id ? "Đã lưu điểm" : "Đã thêm điểm" };
}

/** Xoá điểm: các chặng dùng điểm này của mọi bác tài bị xoá theo — chỉ cho xoá khi chưa có chặng nào. */
export async function deleteTransportPoint(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const used = await prisma.transportRoute.count({ where: { OR: [{ fromPointId: id }, { toPointId: id }] } });
  if (used > 0) throw new Error(`Điểm đang dùng trong ${used} chặng — bỏ tick "Hiện" để ẩn thay vì xoá.`);
  await prisma.transportPoint.delete({ where: { id } });
  revalidatePath("/admin/transport-points");
}
