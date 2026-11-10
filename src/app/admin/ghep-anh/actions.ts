"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { COLLAGE_PRESETS_KEY } from "./preset-key";

/**
 * Lưu TOÀN BỘ danh sách mẫu (client quản lý thêm/xoá/đặt mặc định rồi gửi cả danh sách).
 * Mẫu chỉ chứa thiết lập trình bày (khổ, bố cục, màu, font, chữ, vị trí…), không chứa ảnh.
 */
export async function saveCollagePresets(json: string): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();
  if (json.length > 200_000) return { error: "Dữ liệu mẫu quá lớn." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { error: "Dữ liệu mẫu không hợp lệ." };
  }
  if (!Array.isArray(parsed) || parsed.length > 50) return { error: "Danh sách mẫu không hợp lệ (tối đa 50 mẫu)." };
  await prisma.siteSetting.upsert({
    where: { key: COLLAGE_PRESETS_KEY },
    create: { key: COLLAGE_PRESETS_KEY, value: json },
    update: { value: json },
  });
  return { ok: true };
}
