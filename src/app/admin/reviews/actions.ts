"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function requireAdmin(): Promise<void> {
  const s = await getSession();
  if (!s || s.role !== "ADMIN") throw new Error("Không có quyền.");
}

export async function hideReview(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (id) await prisma.review.update({ where: { id }, data: { status: "HIDDEN" } });
  revalidatePath("/admin/reviews");
}

export async function showReview(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (id) await prisma.review.update({ where: { id }, data: { status: "APPROVED" } });
  revalidatePath("/admin/reviews");
}

export async function deleteReview(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (id) await prisma.review.delete({ where: { id } });
  revalidatePath("/admin/reviews");
}
