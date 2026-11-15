"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCustomer } from "@/lib/customer";
import { getT } from "@/lib/i18n/server";

export interface ReviewState {
  ok?: boolean;
  error?: string;
}

export async function submitReview(_prev: ReviewState, fd: FormData): Promise<ReviewState> {
  const t = await getT();
  const customer = await getCustomer();
  if (!customer) return { error: t("Bạn cần đăng nhập để đánh giá.") };
  const serviceId = String(fd.get("serviceId") ?? "");
  const rating = Math.round(Number(fd.get("rating")));
  const comment = String(fd.get("comment") ?? "").trim().slice(0, 1000) || null;
  const path = String(fd.get("path") ?? "");
  if (!serviceId) return { error: t("Thiếu dịch vụ.") };
  if (!(rating >= 1 && rating <= 5)) return { error: t("Vui lòng chọn số sao (1–5).") };
  const svc = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } });
  if (!svc) return { error: t("Dịch vụ không tồn tại.") };
  await prisma.review.upsert({
    where: { serviceId_customerId: { serviceId, customerId: customer.id } },
    create: { serviceId, customerId: customer.id, rating, comment },
    update: { rating, comment, status: "APPROVED" },
  });
  if (path.startsWith("/")) revalidatePath(path);
  return { ok: true };
}
