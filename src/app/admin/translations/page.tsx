import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";
import { ActionForm } from "@/components/admin/ActionForm";
import { LOCALE_META, TARGET_LOCALES } from "@/lib/i18n/config";
import { SHORT_TEXT_MAX } from "@/lib/i18n/server";
import { collectArticle, collectPhrases, collectPlace, collectService, progress, type TrGroup } from "@/lib/i18n/content-admin";
import { addPhrase, saveTranslations } from "./actions";

export const dynamic = "force-dynamic";

type Kind = "service" | "article" | "place" | "phrase";
const KINDS: { key: Kind; label: string }[] = [
  { key: "service", label: "Dịch vụ & phòng" },
  { key: "article", label: "Bài viết" },
  { key: "place", label: "Nhà hàng / Cafe / Check-in" },
  { key: "phrase", label: "Cụm từ tự do" },
];

const inp = "w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-forest-500";

function Editor({ groups }: { groups: TrGroup[] }) {
  let i = 0;
  const total = groups.reduce((s, g) => s + g.fields.length, 0);
  const pg = progress(groups);
  return (
    <ActionForm action={saveTranslations} success="Đã lưu bản dịch" className="mt-4 space-y-4">
      <input type="hidden" name="n" value={total} />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-forest-50 px-4 py-2.5 text-sm text-forest-800">
        <span>
          Đã dịch đủ 3 ngôn ngữ: <b>{pg.done}</b>/{pg.total} trường. Ô để trống ⇒ web hiện tiếng Việt ở ngôn ngữ đó.
        </span>
        <button className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">Lưu bản dịch</button>
      </div>
      {groups.map((g) => (
        <section key={g.title} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="text-base font-bold text-ink">{g.title}</h2>
          <div className="mt-3 space-y-4">
            {g.fields.map((f) => {
              const idx = i++;
              const long = f.source.length > 90 || f.source.includes("\n");
              const rows = Math.min(14, Math.max(2, Math.ceil(f.source.length / 110) + (f.source.match(/\n/g)?.length ?? 0)));
              return (
                <div key={`${f.entity}-${f.entityId}-${f.field}`} className="border-t border-gray-100 pt-3 first:border-0 first:pt-0">
                  <input type="hidden" name={`e${idx}`} value={f.entity} />
                  <input type="hidden" name={`id${idx}`} value={f.entityId} />
                  <input type="hidden" name={`f${idx}`} value={f.field} />
                  <input type="hidden" name={`s${idx}`} value={f.source} />
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
                    {f.label}
                    {f.stale && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                        Nội dung gốc đã đổi — bản dịch cũ đang tắt, xem lại rồi bấm Lưu
                      </span>
                    )}
                    {f.source.length > SHORT_TEXT_MAX && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">nội dung dài</span>}
                  </div>
                  <div className={`mt-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-sm text-ink ${long ? "max-h-40 overflow-y-auto whitespace-pre-line" : ""}`}>{f.source}</div>
                  <div className={`mt-2 grid gap-2 ${long ? "" : "sm:grid-cols-3"}`}>
                    {TARGET_LOCALES.map((l) => (
                      <label key={l} className="block">
                        <span className="text-[11px] font-bold text-gray-400">{LOCALE_META[l].label}</span>
                        {long ? (
                          <textarea name={`${l}${idx}`} defaultValue={f.values[l]} rows={rows} className={inp} />
                        ) : (
                          <input name={`${l}${idx}`} defaultValue={f.values[l]} className={inp} />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div className="flex justify-end">
        <button className="rounded-lg bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">Lưu bản dịch</button>
      </div>
    </ActionForm>
  );
}

export default async function TranslationsPage({ searchParams }: { searchParams: Promise<{ kind?: string; id?: string }> }) {
  const sp = await searchParams;
  const kind: Kind = KINDS.some((k) => k.key === sp.kind) ? (sp.kind as Kind) : "service";
  const id = sp.id;

  const groups =
    kind === "phrase"
      ? await collectPhrases()
      : id
        ? kind === "service"
          ? await collectService(id)
          : kind === "article"
            ? await collectArticle(id)
            : await collectPlace(id)
        : null;

  // Danh sách bản ghi để chọn (khi chưa chọn id).
  const items: { id: string; name: string; sub: string }[] =
    kind === "phrase" || id
      ? []
      : kind === "service"
        ? (await prisma.service.findMany({ orderBy: [{ category: "asc" }, { title: "asc" }], select: { id: true, title: true, category: true, published: true } })).map((s) => ({
            id: s.id,
            name: s.title,
            sub: CATEGORIES[s.category].shortLabel + (s.published ? "" : " · đang ẩn"),
          }))
        : kind === "article"
          ? (await prisma.article.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, title: true, slug: true } })).map((a) => ({ id: a.id, name: a.title, sub: `/kinh-nghiem/${a.slug}` }))
          : (await prisma.place.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true, kind: true, area: true } })).map((p) => ({
              id: p.id,
              name: p.name,
              sub: `${p.kind === "CAFE" ? "Cafe" : p.kind === "RESTAURANT" ? "Nhà hàng" : "Check-in"} · ${p.area}`,
            }));

  // Bản ghi nào đã có ít nhất 1 bản dịch (đánh dấu trong danh sách).
  const translated = new Set(
    items.length
      ? (
          await prisma.translation.findMany({
            where: { entity: kind === "service" ? "Service" : kind === "article" ? "Article" : "Place", entityId: { in: items.map((x) => x.id) } },
            select: { entityId: true },
            distinct: ["entityId"],
          })
        ).map((t) => t.entityId)
      : [],
  );

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-ink">Bản dịch nội dung (đa ngôn ngữ)</h1>
      <p className="mt-1 text-sm text-gray-500">
        Website có 4 ngôn ngữ: Tiếng Việt (gốc), English (/en), 中文 (/zh), 한국어 (/ko). Chữ giao diện cố định đã dịch sẵn; ở đây nhập bản dịch cho
        nội dung do bạn tự đăng (tên, mô tả, bài viết…). Chỗ nào chưa nhập thì khách nước ngoài vẫn thấy tiếng Việt. Một cụm đã dịch (vd khu vực
        &quot;Đỉnh Gió&quot;) tự áp dụng cho mọi nơi có đúng cụm đó.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Link
            key={k.key}
            href={`/admin/translations?kind=${k.key}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${k.key === kind ? "bg-forest-600 text-white" : "bg-white text-gray-700 ring-1 ring-black/10 hover:bg-forest-50"}`}
          >
            {k.label}
          </Link>
        ))}
      </div>

      {kind === "phrase" && (
        <ActionForm action={addPhrase} success="Đã thêm cụm từ" className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="text-base font-bold text-ink">Thêm cụm từ</h2>
          <p className="mt-1 text-xs text-gray-500">
            Dùng cho chữ không thuộc dịch vụ/bài viết/địa điểm: lịch trình mẫu, popup uy tín, điểm đón, tiện ích… Chuỗi gốc phải khớp đúng từng chữ đang hiện trên web.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <label className="block">
              <span className="text-[11px] font-bold text-gray-400">Tiếng Việt (gốc)</span>
              <input name="source" className={inp} required />
            </label>
            {TARGET_LOCALES.map((l) => (
              <label key={l} className="block">
                <span className="text-[11px] font-bold text-gray-400">{LOCALE_META[l].label}</span>
                <input name={l} className={inp} />
              </label>
            ))}
          </div>
          <button className="mt-3 rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">Thêm</button>
        </ActionForm>
      )}

      {!id && kind !== "phrase" && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {items.map((x) => (
            <Link key={x.id} href={`/admin/translations?kind=${kind}&id=${x.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 hover:ring-forest-300">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{x.name}</span>
                <span className="block truncate text-xs text-gray-500">{x.sub}</span>
              </span>
              <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${translated.has(x.id) ? "bg-forest-100 text-forest-700" : "bg-gray-100 text-gray-500"}`}>
                {translated.has(x.id) ? "Đã có bản dịch" : "Chưa dịch"}
              </span>
            </Link>
          ))}
          {items.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center text-gray-500 sm:col-span-2">Chưa có nội dung.</p>}
        </div>
      )}

      {id && kind !== "phrase" && (
        <div className="mt-4">
          <Link href={`/admin/translations?kind=${kind}`} className="text-sm font-semibold text-forest-700 hover:underline">
            ← Danh sách
          </Link>
          {groups ? groups.length ? <Editor groups={groups} /> : <p className="mt-4 text-gray-500">Bản ghi này chưa có nội dung cần dịch.</p> : <p className="mt-4 text-gray-500">Không tìm thấy bản ghi.</p>}
        </div>
      )}

      {kind === "phrase" && groups && groups.length > 0 && <Editor groups={groups} />}
    </div>
  );
}
