"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface ReviewState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/** Khách gửi đánh giá cho một quán — chờ admin duyệt mới hiển thị. */
export async function submitPlaceReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const placeId = String(formData.get("placeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const rating = Math.min(5, Math.max(1, Number(formData.get("rating")) || 5));

  if (!placeId) return { error: "Thiếu thông tin quán." };
  if (!name) return { error: "Vui lòng nhập tên của bạn." };
  if (content.length < 10) return { error: "Nội dung đánh giá quá ngắn (tối thiểu 10 ký tự)." };
  if (content.length > 2000) return { error: "Nội dung quá dài (tối đa 2000 ký tự)." };

  const place = await prisma.place.findUnique({ where: { id: placeId }, select: { id: true } });
  if (!place) return { error: "Quán không tồn tại." };

  // Chặn spam thô: tối đa 3 đánh giá chờ duyệt cùng tên trên một quán.
  const pending = await prisma.placeReview.count({ where: { placeId, name, approved: false } });
  if (pending >= 3) return { error: "Bạn đã gửi nhiều đánh giá đang chờ duyệt." };

  await prisma.placeReview.create({ data: { placeId, name: name.slice(0, 80), rating, content } });
  revalidatePath("/admin/places");
  return { ok: true, message: "Đã gửi! Đánh giá sẽ hiển thị sau khi được duyệt." };
}
