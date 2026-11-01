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

  // Slug: tự tạo từ tên nếu để trống; đảm bảo duy nhất.
  const slugify = (t: string) =>
    t.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  let slug = s(formData.get("slug"));
  slug = slug ? slugify(slug) : slugify(name);
  if (!slug) return { error: "Không tạo được đường dẫn từ tên quán." };
  const dup = await prisma.place.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } });
  if (dup) return { error: `Đường dẫn "${slug}" đã dùng cho quán khác — hãy đổi slug.` };

  const data = {
    name,
    kind,
    slug,
    area,
    address: s(formData.get("address")) ?? null,
    phone: s(formData.get("phone")) ?? null,
    price: s(formData.get("price")) ?? null,
    hours: s(formData.get("hours")) ?? null,
    tags: s(formData.get("tags")) ?? null,
    desc: s(formData.get("desc")) ?? null,
    content: s(formData.get("content")) ?? null,
    coverImage: s(formData.get("coverImage")) ?? null,
    images: s(formData.get("images")) ?? null,
    mapUrl: s(formData.get("mapUrl")) ?? null,
    sortOrder: Number(formData.get("sortOrder")) || 0,
    published: formData.get("published") === "on",
  };

  try {
    if (id) await prisma.place.update({ where: { id }, data });
    else await prisma.place.create({ data });
  } catch {
    return { error: "Lưu quán thất bại." };
  }
  revalidatePath(`/nha-hang/${slug}`);
  revalidatePath(`/cafe/${slug}`);
  revalidate();
  return { ok: true, message: id ? "Đã lưu quán" : "Đã thêm quán" };
}

export async function approvePlaceReview(formData: FormData): Promise<void> {
  const id = s(formData.get("id"));
  if (!id) return;
  await prisma.placeReview.update({ where: { id }, data: { approved: true } }).catch(() => {});
  revalidate();
}

export async function deletePlaceReview(formData: FormData): Promise<void> {
  const id = s(formData.get("id"));
  if (!id) return;
  await prisma.placeReview.delete({ where: { id } }).catch(() => {});
  revalidate();
}

export async function deletePlace(formData: FormData): Promise<void> {
  const id = s(formData.get("id"));
  if (!id) return;
  await prisma.place.delete({ where: { id } }).catch(() => {});
  revalidate();
}
