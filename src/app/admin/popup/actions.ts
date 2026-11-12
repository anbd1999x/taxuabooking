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
    hidden: fd.get(`show${i}`) !== "on",
  });

  const fiveRules = String(fd.get("fiveRules") ?? "")
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);

  const config: TrustPopupConfig = {
    enabled: fd.get("enabled") === "on",
    sitePhoneOwner: fd.get("sitePhone") === "2" ? 1 : 0,
    people: [person(1), person(2)],
    fiveRules,
  };

  if (!config.people[0].name || !config.people[1].name) {
    return { error: "Cần nhập tên cho cả 2 người." };
  }
  if (config.people.every((p) => p.hidden)) return { error: "Phải hiện ít nhất 1 người." };
  const owner = config.people[config.sitePhoneOwner ?? 0];
  if (owner.phone.replace(/\D/g, "").length < 9) return { error: `Nhập số điện thoại hợp lệ cho ${owner.name} (số dùng cho toàn bộ trang web).` };
  if (owner.hidden) return { error: `Số điện thoại toàn web đang chọn của ${owner.name} nhưng người này bị ẩn — chọn số của người đang hiện.` };

  await prisma.siteSetting.upsert({
    where: { key: TRUST_POPUP_KEY },
    create: { key: TRUST_POPUP_KEY, value: JSON.stringify(config) },
    update: { value: JSON.stringify(config) },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/popup", "page");
  return { ok: true, message: "Đã lưu popup uy tín (cập nhật trang web trong ~1 phút)." };
}
