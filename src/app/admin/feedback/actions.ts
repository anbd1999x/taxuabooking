"use server";

import { revalidatePath } from "next/cache";
import type { FeedbackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import type { FormResult } from "@/components/admin/ActionForm";
import { FB_OWNER_KEY, FB_POSTS_KEY, FB_PROFILE_KEY } from "@/lib/feedback";

async function requireAdmin(): Promise<void> {
  const s = await getSession();
  if (!s || s.role !== "ADMIN") throw new Error("Không có quyền.");
}

const VALID_STATUS: FeedbackStatus[] = ["NEW", "REVIEW", "PLAN", "DONE"];

function revalidate() {
  revalidatePath("/admin/feedback");
  revalidatePath("/gop-y");
}

export async function setFeedbackStatus(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "") as FeedbackStatus;
  if (id && VALID_STATUS.includes(status)) {
    await prisma.feedback.update({ where: { id }, data: { status } });
  }
  revalidate();
}

export async function togglePin(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (id) {
    const f = await prisma.feedback.findUnique({ where: { id }, select: { pinned: true } });
    if (f) await prisma.feedback.update({ where: { id }, data: { pinned: !f.pinned } });
  }
  revalidate();
}

export async function toggleHidden(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (id) {
    const f = await prisma.feedback.findUnique({ where: { id }, select: { hidden: true } });
    if (f) await prisma.feedback.update({ where: { id }, data: { hidden: !f.hidden } });
  }
  revalidate();
}

export async function deleteFeedback(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (id) await prisma.feedback.delete({ where: { id } });
  revalidate();
}

/** Lưu trả lời chính thức (hiện khung xanh dưới góp ý). */
export async function replyFeedback(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const reply = String(fd.get("reply") ?? "").trim().slice(0, 1000);
  if (!id) return { error: "Thiếu góp ý." };
  await prisma.feedback.update({ where: { id }, data: { reply: reply || null } });
  revalidate();
  return { ok: true, message: reply ? "Đã lưu trả lời." : "Đã xoá trả lời." };
}

/** Lưu cấu hình khối "Góp ý qua Facebook" (link trang + danh sách bài JSON). */
export async function saveFbConfig(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireAdmin();
  const profile = String(fd.get("profile") ?? "").trim();
  const owner = String(fd.get("owner") ?? "").trim();
  const postsRaw = String(fd.get("posts") ?? "").trim();

  if (postsRaw) {
    try {
      const parsed = JSON.parse(postsRaw);
      if (!Array.isArray(parsed)) return { error: "Danh sách bài phải là JSON dạng mảng [...]." };
    } catch {
      return { error: "JSON danh sách bài không hợp lệ. Kiểm tra lại dấu ngoặc/ phẩy." };
    }
  }

  await prisma.$transaction([
    prisma.siteSetting.upsert({ where: { key: FB_PROFILE_KEY }, create: { key: FB_PROFILE_KEY, value: profile }, update: { value: profile } }),
    prisma.siteSetting.upsert({ where: { key: FB_OWNER_KEY }, create: { key: FB_OWNER_KEY, value: owner }, update: { value: owner } }),
    prisma.siteSetting.upsert({ where: { key: FB_POSTS_KEY }, create: { key: FB_POSTS_KEY, value: postsRaw }, update: { value: postsRaw } }),
  ]);
  revalidate();
  return { ok: true, message: "Đã lưu khối Facebook (cập nhật trang công khai trong ~1 phút)." };
}
