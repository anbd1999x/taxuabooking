"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toDTO, type PlaceInput, type PlaceDTO } from "./place-dto";

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function clean(v: string | undefined | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function slugify(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function revalidate(slug?: string) {
  revalidatePath("/nha-hang");
  revalidatePath("/cafe");
  revalidatePath("/admin/places");
  if (slug) {
    revalidatePath(`/nha-hang/${slug}`);
    revalidatePath(`/cafe/${slug}`);
  }
}

/** Lưu (tạo/sửa) một quán. Trả về bản ghi đã lưu cho client cập nhật tại chỗ. */
export async function savePlace(input: PlaceInput): Promise<ActionState & { place?: PlaceDTO }> {
  const name = clean(input.name);
  const kind = input.kind === "CAFE" ? "CAFE" : input.kind === "RESTAURANT" ? "RESTAURANT" : "";
  const area = clean(input.area);
  if (!name) return { error: "Nhập tên quán trước khi lưu." };
  if (!kind) return { error: "Loại quán không hợp lệ." };
  if (!area) return { error: "Chọn khu vực cho quán." };
  const desc = clean(input.desc);
  if (desc.length > 160) return { error: "Mô tả ngắn tối đa 160 ký tự." };

  const slug = clean(input.slug) ? slugify(input.slug!) : slugify(name);
  if (!slug) return { error: "Không tạo được đường dẫn từ tên quán." };
  const dup = await prisma.place.findFirst({
    where: { slug, ...(input.id ? { id: { not: input.id } } : {}) },
    select: { id: true },
  });
  if (dup) return { error: `Đường dẫn "${slug}" đã dùng cho quán khác — hãy đổi slug.` };

  const open = clean(input.open);
  const close = clean(input.close);
  const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const images = (input.images ?? []).map((u) => u.trim()).filter(Boolean);

  const data = {
    name,
    kind,
    slug,
    area,
    address: clean(input.address) || null,
    phone: clean(input.phone) || null,
    zalo: clean(input.zalo) || null,
    price: clean(input.price) || null,
    hours: open && close ? `${open}–${close}` : null,
    hoursWeekend: clean(input.hoursWeekend) || null,
    booking: clean(input.booking) || null,
    tags: tags.length ? tags.join(", ") : null,
    desc: desc || null,
    content: clean(input.content) || null,
    coverImage: clean(input.coverImage) || null,
    images: images.length ? images.join("|") : null,
    mapUrl: clean(input.mapUrl) || null,
    sortOrder: Number(input.sortOrder) || 0,
    published: !!input.published,
  };

  let saved;
  try {
    saved = input.id
      ? await prisma.place.update({ where: { id: input.id }, data })
      : await prisma.place.create({ data });
  } catch {
    return { error: "Lưu quán thất bại." };
  }
  revalidate(slug);
  return {
    ok: true,
    message: input.id ? `Đã lưu "${name}"` : `Đã tạo "${name}"`,
    place: toDTO(saved),
  };
}

/** Bật/tắt hiển thị một quán. */
export async function togglePlacePublished(id: string, published: boolean): Promise<ActionState> {
  if (!id) return { error: "Thiếu quán." };
  try {
    await prisma.place.update({ where: { id }, data: { published } });
  } catch {
    return { error: "Không đổi được trạng thái." };
  }
  revalidate();
  return { ok: true };
}

/** Thao tác hàng loạt: hiện / ẩn / xoá nhiều quán. */
export async function bulkPlaces(ids: string[], op: "show" | "hide" | "delete"): Promise<ActionState> {
  const list = (ids ?? []).filter(Boolean);
  if (!list.length) return { error: "Chưa chọn quán nào." };
  try {
    if (op === "delete") await prisma.place.deleteMany({ where: { id: { in: list } } });
    else await prisma.place.updateMany({ where: { id: { in: list } }, data: { published: op === "show" } });
  } catch {
    return { error: "Thao tác hàng loạt thất bại." };
  }
  revalidate();
  return { ok: true };
}

/** Xoá một quán. */
export async function removePlace(id: string): Promise<ActionState> {
  if (!id) return { error: "Thiếu quán." };
  try {
    await prisma.place.delete({ where: { id } });
  } catch {
    return { error: "Xoá quán thất bại." };
  }
  revalidate();
  return { ok: true };
}

// ── Đánh giá quán (PlaceReview) ─────────────────────────────────────────────

export async function approvePlaceReview(formData: FormData): Promise<void> {
  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";
  if (!id) return;
  await prisma.placeReview.update({ where: { id }, data: { approved: true } }).catch(() => {});
  revalidate();
}

export async function deletePlaceReview(formData: FormData): Promise<void> {
  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";
  if (!id) return;
  await prisma.placeReview.delete({ where: { id } }).catch(() => {});
  revalidate();
}
