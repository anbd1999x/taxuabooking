"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TARGET_LOCALES } from "@/lib/i18n/config";
import { TRANSLATIONS_TAG, hashSource } from "@/lib/i18n/server";
import { phraseId } from "@/lib/i18n/content-admin";

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function refresh() {
  updateTag(TRANSLATIONS_TAG);
  revalidatePath("/admin/translations");
}

/**
 * Lưu bản dịch của 1 trang nhập: mỗi dòng i gồm e{i}/id{i}/f{i} (định danh trường), s{i} (chuỗi gốc
 * tiếng Việt đang hiển thị) và en{i}/zh{i}/ko{i}. Ô để trống ⇒ xoá bản dịch (web hiện tiếng Việt).
 */
export async function saveTranslations(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const n = Number(str(fd.get("n"))) || 0;
  let saved = 0;
  let removed = 0;
  for (let i = 0; i < n; i++) {
    const entity = str(fd.get(`e${i}`));
    const entityId = str(fd.get(`id${i}`));
    const field = str(fd.get(`f${i}`));
    const source = str(fd.get(`s${i}`)).replace(/\r\n/g, "\n").trim();
    if (!entity || !entityId || !field || !source) continue;
    for (const locale of TARGET_LOCALES) {
      const value = str(fd.get(`${locale}${i}`)).replace(/\r\n/g, "\n").trim();
      const where = { entity_entityId_field_locale: { entity, entityId, field, locale } };
      if (!value) {
        const del = await prisma.translation.deleteMany({ where: { entity, entityId, field, locale } });
        removed += del.count;
        continue;
      }
      const data = { source, sourceHash: hashSource(source), value };
      await prisma.translation.upsert({ where, create: { entity, entityId, field, locale, ...data }, update: data });
      saved++;
    }
  }
  refresh();
  return { ok: true, message: `Đã lưu ${saved} bản dịch${removed ? `, xoá ${removed}` : ""}.` };
}

/** Thêm 1 cụm từ tự do (chữ trong lịch trình mẫu, popup, điểm đón…): chuỗi gốc phải khớp ĐÚNG chữ đang hiện trên web. */
export async function addPhrase(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const source = str(fd.get("source")).replace(/\r\n/g, "\n").trim();
  if (!source) return { error: "Vui lòng nhập cụm từ tiếng Việt gốc." };
  const values = TARGET_LOCALES.map((l) => [l, str(fd.get(l)).trim()] as const).filter(([, v]) => v);
  if (!values.length) return { error: "Nhập ít nhất một bản dịch." };
  const entityId = phraseId(source);
  for (const [locale, value] of values) {
    const data = { source, sourceHash: hashSource(source), value };
    await prisma.translation.upsert({
      where: { entity_entityId_field_locale: { entity: "Phrase", entityId, field: "text", locale } },
      create: { entity: "Phrase", entityId, field: "text", locale, ...data },
      update: data,
    });
  }
  refresh();
  return { ok: true, message: "Đã thêm cụm từ." };
}
