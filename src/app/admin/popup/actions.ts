"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import type { FormResult } from "@/components/admin/ActionForm";
import { TRUST_POPUP_KEY, type TrustPopupConfig } from "@/lib/trust-popup";

async function requireAdmin(): Promise<void> {
  const s = await getSession();
  if (!s || s.role !== "ADMIN") throw new Error("Không có quyền.");
}

export async function saveTrustPopup(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireAdmin();

  const person = (i: number) => ({
    name: String(fd.get(`name${i}`) ?? "").trim(),
    phone: String(fd.get(`phone${i}`) ?? "").trim(),
    facebook: String(fd.get(`facebook${i}`) ?? "").trim(),
    zalo: String(fd.get(`zalo${i}`) ?? "").trim(),
    avatar: String(fd.get(`avatar${i}`) ?? "").trim(),
  });

  const fiveRules = String(fd.get("fiveRules") ?? "")
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);

  const config: TrustPopupConfig = {
    enabled: fd.get("enabled") === "on",
    people: [person(1), person(2)],
    fiveRules,
  };

  if (!config.people[0].name || !config.people[1].name) {
    return { error: "Cần nhập tên cho cả 2 người." };
  }

  await prisma.siteSetting.upsert({
    where: { key: TRUST_POPUP_KEY },
    create: { key: TRUST_POPUP_KEY, value: JSON.stringify(config) },
    update: { value: JSON.stringify(config) },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/popup", "page");
  return { ok: true, message: "Đã lưu popup uy tín (cập nhật trang web trong ~1 phút)." };
}
