import "server-only";
import { prisma } from "./prisma";
import { TicketError } from "./ticket";
import { TARGET_LOCALES, normSource, type TargetLocale } from "./i18n/config";
import { getContentMap, hashSource } from "./i18n/server";
import type { DineMenuTr, Tr3 } from "./dine-core";

/**
 * Bản dịch THỰC ĐƠN gọi món QR do chủ quán tự nhập (tab Thực đơn → "Dịch"): lưu bảng Translation với entity `DineMenu`
 *  - tên món / mô tả: entityId = id món, field `name` | `desc`;
 *  - nhóm món (dùng chung nhiều món): entityId = id quán, field `g:<hash tên nhóm>`.
 * TÁCH khỏi kho dịch chung của web: `getContentMap` bỏ qua entity này ⇒ chủ quán dịch một cụm trùng chữ trên web
 * (vd món tên "Homestay") không đổi chữ ở nơi khác. Trang khách tra bản của quán trước, thiếu mới lấy kho chung.
 * Chuỗi gốc đổi (quán sửa tên / mô tả) ⇒ bản dịch cũ tự hết hiệu lực vì tra theo chuỗi gốc.
 */
export const DINE_TR = "DineMenu";
const MAX = { name: 120, group: 60, desc: 800 } as const;
const empty = (): Tr3 => ({ en: "", zh: "", ko: "" });
const groupField = (group: string) => `g:${hashSource(normSource(group)).slice(0, 20)}`;

async function menuOf(venueId: string, menuId: string) {
  const m = await prisma.ticketMenuItem.findFirst({ where: { id: menuId, venueId }, select: { id: true, name: true, group: true, description: true } });
  if (!m) throw new TicketError("Món không tồn tại.");
  return { id: m.id, name: normSource(m.name), group: normSource(m.group ?? ""), desc: normSource(m.description ?? "") };
}

/** Bản dịch hiện có của một món (của quán; chưa có thì gợi ý từ kho dịch chung của web). */
export async function getDineMenuTr(venueId: string, menuId: string): Promise<DineMenuTr> {
  const m = await menuOf(venueId, menuId);
  const [own, ...maps] = await Promise.all([
    prisma.translation.findMany({ where: { entity: DINE_TR, OR: [{ entityId: m.id }, ...(m.group ? [{ entityId: venueId, field: groupField(m.group) }] : [])] } }),
    ...TARGET_LOCALES.map((l) => getContentMap(l)),
  ]);
  const pick = (src: string, entityId: string, field: string): Tr3 => {
    const out = empty();
    if (!src) return out;
    TARGET_LOCALES.forEach((l, i) => {
      const row = own.find((r) => r.entityId === entityId && r.field === field && r.locale === l && r.source === src);
      out[l] = row?.value ?? maps[i][src] ?? "";
    });
    return out;
  };
  return { name: pick(m.name, m.id, "name"), group: pick(m.group, venueId, groupField(m.group)), desc: pick(m.desc, m.id, "desc") };
}

/** Lưu bản dịch của một món. Ô để trống ⇒ xoá bản dịch (khách thấy tiếng Việt / bản của kho chung). */
export async function saveDineMenuTr(venueId: string, menuId: string, input: unknown): Promise<void> {
  const m = await menuOf(venueId, menuId);
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const val = (part: "name" | "group" | "desc", l: TargetLocale) => {
    const o = (src[part] && typeof src[part] === "object" ? src[part] : {}) as Record<string, unknown>;
    return typeof o[l] === "string" ? normSource(o[l] as string).slice(0, MAX[part]) : "";
  };
  const jobs: [source: string, entityId: string, field: string, part: "name" | "group" | "desc"][] = [[m.name, m.id, "name", "name"], [m.desc, m.id, "desc", "desc"], [m.group, venueId, groupField(m.group), "group"]];
  await prisma.$transaction(async (tx) => {
    for (const [source, entityId, field, part] of jobs) {
      if (!source) continue;
      for (const locale of TARGET_LOCALES) {
        const value = val(part, locale);
        if (!value) await tx.translation.deleteMany({ where: { entity: DINE_TR, entityId, field, locale } });
        else {
          const data = { source, sourceHash: hashSource(source), value };
          await tx.translation.upsert({ where: { entity_entityId_field_locale: { entity: DINE_TR, entityId, field, locale } }, create: { entity: DINE_TR, entityId, field, locale, ...data }, update: data });
        }
      }
    }
  });
}

/**
 * Map chuỗi gốc → bản dịch cho trang khách của một quán: bản quán tự nhập đè lên kho dịch chung của web.
 * Chỉ trả những chuỗi nằm trong `strings` (tên quán, nhóm, tên món, mô tả, món đã gọi).
 */
export async function dineTrMap(venueId: string, locale: TargetLocale, strings: (string | null | undefined)[]): Promise<Record<string, string>> {
  const [own, shared] = await Promise.all([
    prisma.translation.findMany({ where: { entity: DINE_TR, locale, OR: [{ entityId: venueId }, { entityId: { in: (await prisma.ticketMenuItem.findMany({ where: { venueId }, select: { id: true } })).map((x) => x.id) } }] }, select: { source: true, value: true } }),
    getContentMap(locale),
  ]);
  const mine = new Map(own.filter((r) => r.value.trim()).map((r) => [r.source, r.value]));
  const out: Record<string, string> = {};
  for (const s of strings) {
    if (!s) continue;
    const key = normSource(s);
    const hit = mine.get(key) ?? shared[key];
    if (hit) out[s] = hit;
  }
  return out;
}

/** Xoá bản dịch của một món khi quán xoá món (bản dịch nhóm giữ lại cho các món khác cùng nhóm). */
export async function dropDineMenuTr(menuId: string): Promise<void> {
  await prisma.translation.deleteMany({ where: { entity: DINE_TR, entityId: menuId } });
}
