import "server-only";
import { prisma } from "./prisma";
import { HOLIDAYS_KEY, parseHolidays, type Holiday } from "./holidays";

/**
 * Lịch ngày lễ đang áp dụng (SiteSetting `holidays`, sửa ở /admin/popup).
 * Đọc thẳng DB (1 dòng theo khoá chính, không qua cache settings) để giá trang tìm, trang homestay
 * và giá chốt đơn luôn cùng một lịch.
 */
export async function getHolidays(): Promise<Holiday[]> {
  const row = await prisma.siteSetting.findUnique({ where: { key: HOLIDAYS_KEY } }).catch(() => null);
  return parseHolidays(row?.value);
}
