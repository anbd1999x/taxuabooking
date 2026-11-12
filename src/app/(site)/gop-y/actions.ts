"use server";

import { getSettings } from "@/lib/queries";
import { parseTrustPopup, soloVoice, TRUST_POPUP_KEY, visiblePeople } from "@/lib/trust-popup";
import { revalidatePath } from "next/cache";
import type { FeedbackType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCustomer } from "@/lib/customer";

export interface SubmitState {
  ok?: boolean;
  error?: string;
  code?: string;
}

const VALID_TYPES: FeedbackType[] = ["IDEA", "BUG", "SERVICE", "OTHER"];

/** Gửi góp ý mới (cần đăng nhập). Trả về mã góp ý để hiện màn cảm ơn. */
export async function submitFeedback(_prev: SubmitState, fd: FormData): Promise<SubmitState> {
  const customer = await getCustomer();
  if (!customer) return { error: "Bạn cần đăng nhập để gửi góp ý." };

  const typeRaw = String(fd.get("type") ?? "IDEA") as FeedbackType;
  const type = VALID_TYPES.includes(typeRaw) ? typeRaw : "IDEA";
  const message = String(fd.get("message") ?? "").trim().slice(0, 1000);
  if (message.length < 15) {
    const trust = parseTrustPopup((await getSettings())[TRUST_POPUP_KEY]);
    return { error: soloVoice("Viết thêm chút nữa nhé (ít nhất 15 ký tự) để tụi mình hiểu rõ.", visiblePeople(trust).length === 1) };
  }
  const moodRaw = Math.round(Number(fd.get("mood")));
  const mood = moodRaw >= 1 && moodRaw <= 5 ? moodRaw : null;
  const anon = fd.get("anon") === "1";
  const areas = String(fd.get("areas") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 10);
  const screenshotRaw = String(fd.get("screenshot") ?? "").trim();
  const screenshot = screenshotRaw.startsWith("/uploads/") ? screenshotRaw : null;

  const created = await prisma.feedback.create({
    data: {
      customerId: customer.id,
      authorName: customer.name || "Khách",
      anon,
      type,
      mood,
      areas,
      message,
      screenshot,
      status: "NEW",
    },
    select: { id: true },
  });
  // Người gửi tự tính 1 phiếu cho góp ý của mình.
  await prisma.feedbackVote
    .create({ data: { feedbackId: created.id, customerId: customer.id } })
    .catch(() => {});

  revalidatePath("/gop-y");
  return { ok: true, code: "GY-" + created.id.slice(-5).toUpperCase() };
}

/** Bật/tắt bình chọn cho một góp ý (cần đăng nhập). */
export async function toggleVote(feedbackId: string): Promise<{ ok?: boolean; voted?: boolean; error?: string }> {
  const customer = await getCustomer();
  if (!customer) return { error: "Bạn cần đăng nhập để bình chọn." };
  if (!feedbackId) return { error: "Thiếu góp ý." };

  const existing = await prisma.feedbackVote.findUnique({
    where: { feedbackId_customerId: { feedbackId, customerId: customer.id } },
  });
  if (existing) {
    await prisma.feedbackVote.delete({ where: { id: existing.id } });
    revalidatePath("/gop-y");
    return { ok: true, voted: false };
  }
  await prisma.feedbackVote.create({ data: { feedbackId, customerId: customer.id } }).catch(() => {});
  revalidatePath("/gop-y");
  return { ok: true, voted: true };
}

/** Gửi một bình luận công khai dưới góp ý (cần đăng nhập). */
export async function addComment(feedbackId: string, contentRaw: string): Promise<{ ok?: boolean; error?: string }> {
  const customer = await getCustomer();
  if (!customer) return { error: "Bạn cần đăng nhập để bình luận." };
  const content = (contentRaw ?? "").trim().slice(0, 500);
  if (!feedbackId || !content) return { error: "Nội dung bình luận trống." };

  const fb = await prisma.feedback.findUnique({ where: { id: feedbackId }, select: { id: true, hidden: true } });
  if (!fb || fb.hidden) return { error: "Góp ý không tồn tại." };

  await prisma.feedbackComment.create({
    data: {
      feedbackId,
      customerId: customer.id,
      authorName: customer.name || "Khách",
      content,
    },
  });
  revalidatePath("/gop-y");
  return { ok: true };
}
