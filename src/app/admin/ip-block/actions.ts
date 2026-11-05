"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { invalidateBlockedIps, isValidIp, normalizeIp } from "@/lib/ip-block";

export interface IpBlockState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/** Chặn 1 IP: không vào được website công khai + không gửi được đơn (hiệu lực ≤30s). */
export async function blockIp(_prev: IpBlockState, formData: FormData): Promise<IpBlockState> {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const ip = normalizeIp(String(formData.get("ip") ?? ""));
  if (!ip || !isValidIp(ip)) return { error: "IP không hợp lệ." };
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || null;

  await prisma.blockedIp.upsert({
    where: { ip },
    create: { ip, reason, createdBy: session.username || null },
    update: { reason, createdBy: session.username || null },
  });
  invalidateBlockedIps();
  revalidatePath("/admin/ip-block");
  revalidatePath("/admin/bookings", "layout");
  return { ok: true, message: `Đã chặn IP ${ip}` };
}

/** Bỏ chặn 1 IP. */
export async function unblockIp(formData: FormData): Promise<void> {
  await requireAdmin();
  const ip = normalizeIp(String(formData.get("ip") ?? ""));
  if (!ip) return;
  await prisma.blockedIp.deleteMany({ where: { ip } });
  invalidateBlockedIps();
  revalidatePath("/admin/ip-block");
  revalidatePath("/admin/bookings", "layout");
}
