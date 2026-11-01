"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function s(v: FormDataEntryValue | null): string | undefined {
  const t = typeof v === "string" ? v.trim() : "";
  return t || undefined;
}

function revalidate() {
  revalidatePath("/nha-hang");
  revalidatePath("/cafe");
  revalidatePath("/admin/places");
}

export async function upsertPlace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = s(formData.get("id"));
  const name = s(formData.get("name"));
  const kind = s(formData.get("kind"));
  const area = s(formData.get("area"));
  if (!name) return { error: "Vui lòng nhập tên quán." };
  if (kind !== "RESTAURANT" && kind !== "CAFE") return { error: "Loại quán không hợp lệ." };
  if (!area) return { error: "Vui lòng nhập khu vực." };

  const data = {
    name,
    kind,
    area,
    address: s(formData.get("address")) ?? null,
    phone: s(formData.get("phone")) ?? null,
    price: s(formData.get("price")) ?? null,
    hours: s(formData.get("hours")) ?? null,
    tags: s(formData.get("tags")) ?? null,
    desc: s(formData.get("desc")) ?? null,
    sortOrder: Number(formData.get("sortOrder")) || 0,
    published: formData.get("published") === "on",
  };

  try {
    if (id) await prisma.place.update({ where: { id }, data });
    else await prisma.place.create({ data });
  } catch {
    return { error: "Lưu quán thất bại." };
  }
  revalidate();
  return { ok: true, message: id ? "Đã lưu quán" : "Đã thêm quán" };
}

export async function deletePlace(formData: FormData): Promise<void> {
  const id = s(formData.get("id"));
  if (!id) return;
  await prisma.place.delete({ where: { id } }).catch(() => {});
  revalidate();
}
