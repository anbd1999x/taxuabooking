"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncRoomIcal } from "@/lib/ical-sync";

export interface IcalActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function s(v: FormDataEntryValue | null): string {
  return v == null ? "" : String(v).trim();
}

/** Bật đồng bộ iCal cho một phòng: sinh token bí mật cho link xuất lịch. */
export async function enableRoomIcal(formData: FormData): Promise<void> {
  const roomId = s(formData.get("roomId"));
  const serviceId = s(formData.get("serviceId"));
  if (!roomId) return;
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { icalToken: true } });
  if (room && !room.icalToken) {
    await prisma.room.update({ where: { id: roomId }, data: { icalToken: randomBytes(16).toString("hex") } });
  }
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

/** Thêm một nguồn iCal từ OTA (link .ics) cho phòng. */
export async function addIcalSource(_prev: IcalActionState, formData: FormData): Promise<IcalActionState> {
  const roomId = s(formData.get("roomId"));
  const serviceId = s(formData.get("serviceId"));
  const label = s(formData.get("label")) || "OTA";
  const url = s(formData.get("url"));
  if (!roomId) return { error: "Thiếu phòng." };
  if (!/^https?:\/\/.+/i.test(url)) return { error: "Link iCal không hợp lệ (phải bắt đầu http/https)." };
  try {
    await prisma.roomIcalSource.create({ data: { roomId, label, url } });
  } catch {
    return { error: "Không lưu được nguồn iCal." };
  }
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
  return { ok: true, message: "Đã thêm. Bấm “Đồng bộ ngay” để kéo lịch về." };
}

export async function deleteIcalSource(formData: FormData): Promise<void> {
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (!id) return;
  // Gỡ các ngày đã khoá bởi nguồn này rồi xoá nguồn.
  const src = await prisma.roomIcalSource.findUnique({ where: { id }, select: { roomId: true } });
  if (src) {
    await prisma.roomDayStatus.deleteMany({ where: { roomId: src.roomId, note: `OTA#${id}` } });
  }
  await prisma.roomIcalSource.delete({ where: { id } }).catch(() => {});
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

/** Kéo lịch ngay cho tất cả nguồn của một phòng. */
export async function syncRoomIcalNow(formData: FormData): Promise<void> {
  const roomId = s(formData.get("roomId"));
  const serviceId = s(formData.get("serviceId"));
  if (!roomId) return;
  await syncRoomIcal(roomId);
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin/availability");
}
