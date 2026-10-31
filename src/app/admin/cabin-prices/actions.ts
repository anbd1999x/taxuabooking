"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function s(v: FormDataEntryValue | null): string | undefined {
  const t = v == null ? undefined : String(v).trim();
  return t ? t : undefined;
}
function num(v: FormDataEntryValue | null): number | undefined {
  const t = s(v);
  if (t == null) return undefined;
  const n = Number(t.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export interface CabinPriceState {
  ok?: boolean;
  error?: string;
  message?: string;
}

export async function upsertCabinPrice(
  _prev: CabinPriceState,
  formData: FormData,
): Promise<CabinPriceState> {
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId")) ?? null; // null = bảng giá chung
  const pickupPoint = s(formData.get("pickupPoint"));
  if (!pickupPoint) return { error: "Vui lòng nhập điểm đón." };
  const tt = s(formData.get("ticketType"));
  const ticketType = (tt === "OUTBOUND" || tt === "RETURN" || tt === "ROUND_TRIP" ? tt : "ROUND_TRIP") as
    | "ROUND_TRIP"
    | "OUTBOUND"
    | "RETURN";
  const data = {
    serviceId,
    pickupPoint,
    destination: s(formData.get("destination")) ?? "Tà Xùa",
    ticketType,
    price: num(formData.get("price")) ?? 0,
    note: s(formData.get("note")) ?? null,
    sortOrder: num(formData.get("sortOrder")) ?? 0,
  };
  try {
    if (id) await prisma.cabinPriceRow.update({ where: { id }, data });
    else await prisma.cabinPriceRow.create({ data });
  } catch {
    return { error: "Lưu bảng giá thất bại." };
  }
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
  else revalidatePath("/admin/cabin-prices");
  revalidatePath("/");
  return { ok: true, message: id ? "Đã lưu dòng giá" : "Đã thêm dòng giá" };
}

export async function deleteCabinPrice(formData: FormData): Promise<void> {
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (id) await prisma.cabinPriceRow.delete({ where: { id } });
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
  else revalidatePath("/admin/cabin-prices");
  revalidatePath("/");
}
