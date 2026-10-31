"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sheetCsvUrl, syncServiceSheet } from "@/lib/sheet-sync";

export interface SheetActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function s(v: FormDataEntryValue | null): string {
  return v == null ? "" : String(v).trim();
}

/** Lưu (hoặc xoá) link Google Sheet lịch phòng của một homestay. */
export async function saveSheetUrl(_prev: SheetActionState, formData: FormData): Promise<SheetActionState> {
  const serviceId = s(formData.get("serviceId"));
  const url = s(formData.get("sheetUrl"));
  if (!serviceId) return { error: "Thiếu homestay." };
  if (url && (!/^https:\/\/docs\.google\.com\//i.test(url) || !sheetCsvUrl(url))) {
    return { error: "Link không phải Google Sheet hợp lệ (cần dạng https://docs.google.com/spreadsheets/d/...)." };
  }
  await prisma.service.update({
    where: { id: serviceId },
    data: { sheetUrl: url || null, ...(url ? {} : { sheetSyncedAt: null, sheetSyncResult: null }) },
  });
  revalidatePath(`/admin/services/${serviceId}`);
  return { ok: true, message: url ? "Đã lưu link. Bấm “Đồng bộ ngay” để kéo lịch về." : "Đã gỡ link Google Sheet." };
}

/** Kéo lịch phòng từ Google Sheet về ngay cho một homestay. */
export async function syncServiceSheetNow(_prev: SheetActionState, formData: FormData): Promise<SheetActionState> {
  const serviceId = s(formData.get("serviceId"));
  if (!serviceId) return { error: "Thiếu homestay." };
  const r = await syncServiceSheet(serviceId);
  revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin/availability");
  if (!r.ok) return { error: r.error || "Đồng bộ thất bại." };

  const parts: string[] = [`✅ ${r.summary}.`];
  if (r.syncedTabs.length) parts.push(`Tháng: ${r.syncedTabs.join(", ")}.`);
  if (r.unmatchedRows.length) parts.push(`Bỏ qua ${r.unmatchedRows.length} dòng không khớp: ${r.unmatchedRows.join(", ")}.`);
  if (r.missingRooms.length) parts.push(`${r.missingRooms.length} phòng trong app không thấy trong sheet: ${r.missingRooms.join(", ")}.`);
  return { ok: true, message: parts.join(" ") };
}
