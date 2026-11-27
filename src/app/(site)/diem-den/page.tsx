import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/Link";
import { BreadcrumbLd } from "@/components/BreadcrumbLd";
import { ItemListLd } from "@/components/ItemListLd";
import { SeoBlock } from "@/components/SeoBlock";
import { getLocale, getT } from "@/lib/i18n/server";
import { i18nAlternates, i18nOg } from "@/lib/i18n/meta";
import { attractionPath, fmtKm, inTaXua, isFree, listAttractions, placeImages, priceLabel, tidy } from "@/lib/attractions";

/** Danh sách điểm tham quan Tà Xùa (Place CHECKIN): dựng server, xếp theo quãng đường xe chạy từ trung tâm. */
export const dynamic = "force-dynamic";

const BORDER = "oklch(0.92 0.01 160)";
const MUTED = "oklch(0.48 0.02 160)";
const ACCENT = "oklch(0.68 0.18 45)";

async function data() {
  const rows = await listAttractions();
  // Có quãng đường thật ⇒ gần trước; chưa có thì theo thứ tự admin, xếp cuối.
  return [...rows].sort((a, b) => (a.road && b.road ? a.road.km - b.road.km : a.road ? -1 : b.road ? 1 : 0));
}

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale, rows] = await Promise.all([getT(), getLocale(), data()]);
  const withRoad = rows.filter((r) => r.road);
  const near = withRoad[0];
  const far = withRoad[withRoad.length - 1];
  const title = t("Điểm tham quan Tà Xùa: {0} điểm check-in, giờ đẹp, vé", [rows.length]);
  const parts = [
    t("{0} điểm check-in Tà Xùa xếp theo quãng đường xe chạy từ trung tâm.", [rows.length]),
    near && far && near !== far ? t("Gần nhất {0} {1} km, xa nhất {2} {3} km.", [tidy(t(near.name)), fmtKm(near.road!.km, locale), tidy(t(far.name)), fmtKm(far.road!.km, locale)]) : "",
    t("Kèm giờ đẹp, vé, bản đồ."),
  ].filter(Boolean);
  let description = "";
  for (const s of parts) if ((description + " " + s).trim().length <= 155) description = (description + " " + s).trim();
  const path = "/diem-den";
  return {
    title: title.length > 43 ? { absolute: title } : title,
    description,
    alternates: await i18nAlternates(path),
    openGraph: await i18nOg({ title, description, path, image: rows.map((r) => placeImages(r)[0]).find(Boolean) ?? null, alt: t("Điểm tham quan Tà Xùa") }),
  };
}

export default async function AttractionsPage() {
  const [t, locale, rows] = await Promise.all([getT(), getLocale(), data()]);
  const withRoad = rows.filter((r) => r.road);
  const near = withRoad[0];
  const far = withRoad[withRoad.length - 1];
  const free = rows.filter((r) => isFree(r.price)).map((r) => tidy(t(r.name)));
  const within5 = withRoad.filter((r) => r.road!.km <= 5).length;
  const name = (r: (typeof rows)[number]) => tidy(t(r.name));

  return (
    <div style={{ background: "oklch(0.975 0.01 150)" }}>
      <BreadcrumbLd items={[{ name: t("Trang chủ"), path: "/" }, { name: t("Điểm tham quan Tà Xùa"), path: "/diem-den" }]} />
      <ItemListLd name={t("Điểm tham quan Tà Xùa")} items={rows.map((r) => ({ name: name(r), path: attractionPath(r.slug), image: placeImages(r)[0] ?? null }))} />

      <div className="container-page flex flex-col gap-6 pb-6 pt-5">
        <nav className="flex flex-wrap gap-2 text-sm" style={{ color: MUTED }} aria-label={t("Đường dẫn")}>
          <Link href="/">{t("Trang chủ")}</Link><span>/</span>
          <span className="font-bold text-ink">{t("Điểm tham quan Tà Xùa")}</span>
        </nav>
        <header className="flex flex-col gap-3">
          <h1 className="text-[clamp(26px,3.6vw,40px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink">{t("Điểm tham quan Tà Xùa: {0} điểm check-in và đường đi", [rows.length])}</h1>
          <p className="max-w-[860px] text-[16px] leading-[1.7]" style={{ color: "oklch(0.32 0.02 160)" }}>
            {[
              t("Tà Xùa Booking đang có {0} điểm check-in ở Tà Xùa, mỗi điểm có ảnh thật, toạ độ và trang riêng.", [rows.length]),
              near && far && near !== far ? t("Gần trung tâm xã nhất là {0} ({1} km), xa nhất là {2} ({3} km) theo đường xe chạy.", [name(near), fmtKm(near.road!.km, locale), name(far), fmtKm(far.road!.km, locale)]) : "",
              within5 ? t("{0} điểm nằm trong bán kính 5 km đường xe chạy từ trung tâm.", [within5]) : "",
            ].filter(Boolean).join(" ")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/ban-do" className="rounded-full px-4 py-2.5 text-sm font-bold text-white" style={{ background: "oklch(0.29 0.055 160)" }}>{t("Xem trên bản đồ vệ tinh")}</Link>
            <Link href="/thoi-tiet-ta-xua" className="rounded-full border-[1.5px] bg-white px-4 py-2.5 text-sm font-bold" style={{ borderColor: "oklch(0.88 0.02 160)", color: "oklch(0.3 0.05 160)" }}>{t("Thời tiết & khả năng có mây")}</Link>
          </div>
        </header>

        <h2 className="-mb-2 text-[22px] font-extrabold tracking-[-0.02em]">{t("Các điểm tham quan, gần trung tâm trước")}</h2>
        <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r, i) => {
            const img = placeImages(r)[0];
            const price = priceLabel(r.price);
            return (
              <Link key={r.id} href={attractionPath(r.slug)} className="group flex flex-col overflow-hidden rounded-[18px] border bg-white transition hover:shadow-[0_20px_40px_-24px_oklch(0.25_0.06_220_/.4)]" style={{ borderColor: BORDER }}>
                <div className="relative aspect-[16/10] bg-forest-50">
                  {img && <Image src={img} alt={inTaXua(r) ? t("{0}, xã Tà Xùa, Sơn La", [name(r)]) : t("{0}, {1}, Sơn La", [name(r), t(r.area)])} fill priority={i < 3} sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 400px" className="object-cover transition duration-700 group-hover:scale-[1.04]" />}
                  {r.road && <span className="absolute left-2.5 top-2.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold" style={{ color: "oklch(0.3 0.04 160)" }}>{t("{0} km từ trung tâm", [fmtKm(r.road.km, locale)])}</span>}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-3.5">
                  <h3 className="text-[17px] font-extrabold leading-[1.3] group-hover:text-forest-700">{name(r)}</h3>
                  {r.desc && <p className="line-clamp-2 text-[13px] leading-[1.5]" style={{ color: MUTED }}>{tidy(t(r.desc))}</p>}
                  <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[13px] font-semibold" style={{ color: "oklch(0.35 0.03 160)" }}>
                    {r.hours && <span>🕐 {r.hours}</span>}
                    {price && <span style={{ color: ACCENT }}>{t(price)}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>

        {/* Bảng dữ liệu dựng server: Google / công cụ AI đọc thẳng được khoảng cách, giờ, chi phí từng điểm. */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">{t("Bảng khoảng cách các điểm tham quan Tà Xùa")}</h2>
          <div className="overflow-x-auto rounded-[18px] border bg-white" style={{ borderColor: BORDER }}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead style={{ background: "oklch(0.965 0.01 160)" }}>
                <tr>
                  <th className="px-4 py-3 font-bold">{t("Điểm tham quan")}</th>
                  <th className="px-4 py-3 font-bold">{t("Cách trung tâm (xe máy)")}</th>
                  <th className="px-4 py-3 font-bold">{t("Giờ đẹp")}</th>
                  <th className="px-4 py-3 font-bold">{t("Chi phí tham khảo")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: BORDER }}>
                    <td className="px-4 py-2.5 font-semibold"><Link href={attractionPath(r.slug)} className="text-forest-700 hover:underline">{name(r)}</Link></td>
                    <td className="px-4 py-2.5">{r.road ? t("{0} km · {1} phút", [fmtKm(r.road.km, locale), r.road.min]) : "–"}</td>
                    <td className="px-4 py-2.5">{r.hours || "–"}</td>
                    <td className="px-4 py-2.5">{priceLabel(r.price) ? t(priceLabel(r.price)) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs" style={{ color: MUTED }}>{t("Quãng đường xe chạy tính từ UBND xã Tà Xùa theo bản đồ OpenStreetMap; giờ và chi phí do Tà Xùa Booking cập nhật, nên hỏi lại tại chỗ.")}</p>
        </section>
      </div>

      <SeoBlock
        kind="DIEM_DEN"
        stats={{
          n: rows.length,
          near: near ? name(near) : null,
          nearKm: near ? fmtKm(near.road!.km, locale) : null,
          far: far && far !== near ? name(far) : null,
          farKm: far && far !== near ? fmtKm(far.road!.km, locale) : null,
          free: free.length ? free.join(", ") : null,
          within5: within5 || null,
        }}
      />
    </div>
  );
}
