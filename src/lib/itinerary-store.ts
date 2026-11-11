import "server-only";
import { prisma } from "./prisma";
import { ITINERARY_KEY, buildDefaultConfig, sanitizeConfig, type ItineraryConfig } from "./itinerary";

/** Cấu hình lịch trình đã lưu; chưa lưu lần nào (hoặc dữ liệu hỏng) ⇒ bản mặc định. */
export async function loadItinerary(places: { id: string; slug: string | null }[]): Promise<{ config: ItineraryConfig; saved: boolean }> {
  const row = await prisma.siteSetting.findUnique({ where: { key: ITINERARY_KEY } });
  if (row) {
    try {
      const cfg = sanitizeConfig(JSON.parse(row.value));
      if (cfg && cfg.plans.length) return { config: cfg, saved: true };
    } catch {
      /* JSON hỏng → dùng mặc định */
    }
  }
  return { config: buildDefaultConfig(places), saved: false };
}
