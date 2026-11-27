import type { Metadata } from "next";
import Link from "@/components/Link";
import { BreadcrumbLd } from "@/components/BreadcrumbLd";
import { prisma } from "@/lib/prisma";
import { getLocale, getT, lp } from "@/lib/i18n/server";
import { i18nAlternates, i18nOg } from "@/lib/i18n/meta";
import { SITE, WEBSITE_ID } from "@/lib/site";
import { MAP_CENTER } from "@/lib/checkin-map";
import { wdDmy, vnDateTime } from "@/lib/date-format";
import { wxCondName } from "@/lib/weather";
import { CLIMATE_SOURCE, TA_XUA_CLIMATE } from "@/lib/ta-xua-climate";
import { getForecast, morningOutlook, outlookNote, outlookWord, vnToday, type MorningOutlook } from "@/lib/weather-forecast";

/**
 * Trang thời tiết sống /thoi-tiet-ta-xua: dự báo 7 ngày (Open-Meteo, cache server 2 giờ; lỗi ⇒ ẩn khối dự báo),
 * ước tính khả năng biển mây từng sáng (thận trọng, không cam kết), bảng khí hậu 12 tháng (ERA5 2015–2024,
 * hằng số trong src/lib/ta-xua-climate.ts). Dựng hoàn toàn phía server, không <Suspense>.
 */
export const dynamic = "force-dynamic";

const PATH = "/thoi-tiet-ta-xua";
const G = "oklch(0.29 0.055 160)";
const ACCENT = "oklch(0.68 0.18 45)";
const BORDER = "oklch(0.92 0.01 160)";
const MUTED = "oklch(0.48 0.02 160)";
const sectionH = "text-[22px] font-extrabold tracking-[-0.02em]";

/** Số kiểu Việt (dấu phẩy thập phân) ở bản tiếng Việt. */
const num = (v: number, locale: string, d = 1) => {
  const r = Math.round(v * 10 ** d) / 10 ** d;
  return locale === "vi" ? String(r).replace(".", ",") : String(r);
};

// Các mốc khí hậu dùng cho mô tả + FAQ (tính từ hằng số, không viết tay).
const coldest = [...TA_XUA_CLIMATE].sort((a, b) => a.tmin - b.tmin)[0];
const wettest = [...TA_XUA_CLIMATE].sort((a, b) => b.rain - a.rain)[0];
const driest = [...TA_XUA_CLIMATE].sort((a, b) => a.rain - b.rain)[0];
const hottest = [...TA_XUA_CLIMATE].sort((a, b) => b.tmax - a.tmax)[0];
const recordLow = [...TA_XUA_CLIMATE].sort((a, b) => a.coldest - b.coldest)[0];
const rainy = TA_XUA_CLIMATE.filter((c) => c.wetDays >= 20); // các tháng có từ 20 ngày mưa trở lên

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const title = t("Thời tiết Tà Xùa: dự báo 7 ngày, khả năng có mây");
  const description = t("Thời tiết Tà Xùa 7 ngày tới và ước tính khả năng biển mây mỗi sáng. Khí hậu 12 tháng: đêm tháng {0} khoảng {1}°C, tháng {2} mưa nhiều nhất {3} mm.", [
    coldest.m, num(coldest.tmin, locale), wettest.m, wettest.rain,
  ]);
  return {
    title: title.length > 43 ? { absolute: title } : title,
    description,
    alternates: await i18nAlternates(PATH),
    openGraph: await i18nOg({ title, description, path: PATH, alt: t("Thời tiết Tà Xùa") }),
  };
}

export default async function WeatherPage() {
  const [t, locale, f, arts] = await Promise.all([
    getT(),
    getLocale(),
    getForecast(),
    prisma.article.findMany({ where: { published: true, OR: [{ slug: { startsWith: "ta-xua-thang-" } }, { slug: { in: LINK_SLUGS } }] }, select: { slug: true, title: true } }).catch(() => []),
  ]);
  const artBy = new Map(arts.map((a) => [a.slug, a]));
  const monthArt = (m: number) => artBy.get(`ta-xua-thang-${m}`);
  const today = vnToday();

  // Dự báo: bỏ ngày hôm qua (past_days=1 chỉ để biết mưa hôm trước), lấy từ hôm nay.
  const days = f ? f.daily.time.map((d, i) => ({ d, i })).filter((x) => x.d >= today).slice(0, 7) : [];
  const outlooks = new Map<string, MorningOutlook>();
  if (f) for (const { d } of days) { const o = morningOutlook(f, d); if (o) outlooks.set(d, o); }
  // Trước 7h sáng (giờ VN) thì "sáng nay" vẫn còn; sau đó nói về sáng mai. Sáng hôm nay đã qua thì bảng không chấm nữa.
  const hourVN = new Date(Date.now() + 7 * 3_600_000).getUTCHours();
  const thisMorning = hourVN < 7;
  const focus = thisMorning ? days[0]?.d : days[1]?.d;
  const tm = focus ? outlooks.get(focus) : undefined;
  const focusLabel = thisMorning ? t("Sáng nay") : t("Sáng mai");
  const cur = f?.current;
  const curCond = cur ? t(wxCondName(cur.weather_code, !cur.is_day)) : "";

  const lead = [
    cur ? t("Lúc {0}, trung tâm Tà Xùa {1}°C (cảm giác {2}°C), {3}, độ ẩm {4}%.", [vnDateTime(new Date(f!.at)), Math.round(cur.temperature_2m), Math.round(cur.apparent_temperature), curCond.toLowerCase(), Math.round(cur.relative_humidity_2m)]) : "",
    tm ? t("{0} ({1}) khả năng có biển mây ước tính {2}: {3}%.", [focusLabel, wdDmy(tm.day, t), t(outlookWord(tm.score)).toLowerCase(), tm.score]) : "",
    t("Bên dưới là dự báo 7 ngày và bảng khí hậu 12 tháng tính từ dữ liệu 10 năm."),
  ].filter(Boolean);

  const faq: [string, string][] = [];
  if (cur) faq.push([t("Thời tiết Tà Xùa hôm nay thế nào?"), lead[0] + (days[0] ? " " + t("Hôm nay nhiệt độ từ {0}°C đến {1}°C, khả năng mưa cao nhất {2}%.", [Math.round(f!.daily.temperature_2m_min[days[0].i]), Math.round(f!.daily.temperature_2m_max[days[0].i]), Math.round(f!.daily.precipitation_probability_max[days[0].i] ?? 0)]) : "")]);
  faq.push([t("Tà Xùa tháng nào lạnh nhất?"), t("Tháng {0} có nhiệt độ thấp trung bình {1}°C, ban ngày khoảng {2}°C. Trong 10 năm 2015–2024, mức thấp nhất là {3}°C vào tháng {4} (số liệu mô hình ERA5).", [coldest.m, num(coldest.tmin, locale), num(coldest.tmax, locale), num(recordLow.coldest, locale), recordLow.m])]);
  faq.push([t("Tà Xùa tháng nào mưa nhiều nhất?"), t("Tháng {0}: trung bình {1} mm với khoảng {2} ngày mưa. Ít mưa nhất là tháng {3}: {4} mm, khoảng {5} ngày mưa.", [wettest.m, wettest.rain, wettest.wetDays, driest.m, driest.rain, driest.wetDays])]);
  faq.push([t("Mùa hè ở Tà Xùa có nóng không?"), t("Tháng nóng nhất là tháng {0} với nhiệt độ cao trung bình {1}°C, đêm khoảng {2}°C. Mùa hè cũng là mùa mưa nhiều.", [hottest.m, num(hottest.tmax, locale), num(hottest.tmin, locale)])]);
  faq.push([t("Có biết trước sáng mai có biển mây không?"), t("Chỉ ước tính được. Trang này chấm điểm từ dự báo lúc 5h đến 7h sáng: độ ẩm, mây tầng thấp, chênh lệch nhiệt độ và điểm sương, gió, khả năng mưa, cộng thêm khi hôm trước có mưa. Mây có thể đổi trong vài giờ nên đây không phải cam kết.")]);

  const pageUrl = `${SITE.url}${await lp(PATH)}`;
  const webLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE.url}${PATH}#page`,
    url: pageUrl,
    name: t("Thời tiết Tà Xùa: dự báo 7 ngày và khả năng biển mây"),
    isPartOf: { "@id": WEBSITE_ID },
    ...(f ? { dateModified: new Date(f.at).toISOString() } : {}),
    about: { "@type": "Place", name: "Tà Xùa", geo: { "@type": "GeoCoordinates", latitude: MAP_CENTER.lat, longitude: MAP_CENTER.lng }, containedInPlace: { "@type": "AdministrativeArea", name: t("Sơn La"), addressCountry: "VN" } },
    citation: [{ "@type": "CreativeWork", name: CLIMATE_SOURCE.name, url: CLIMATE_SOURCE.url }],
  };
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  const ld = (o: object) => JSON.stringify(o).replace(/</g, "\\u003c");
  const scoreC = (v: number) => (v >= 65 ? "oklch(0.55 0.13 155)" : v >= 45 ? "oklch(0.7 0.15 70)" : "oklch(0.6 0.04 240)");

  return (
    <div style={{ background: "oklch(0.975 0.01 150)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(webLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(faqLd) }} />
      <BreadcrumbLd items={[{ name: t("Trang chủ"), path: "/" }, { name: t("Thời tiết Tà Xùa"), path: PATH }]} />

      <div className="container-page flex min-w-0 flex-col gap-7 pb-16 pt-5">
        <nav className="flex flex-wrap gap-2 text-sm" style={{ color: MUTED }} aria-label={t("Đường dẫn")}>
          <Link href="/">{t("Trang chủ")}</Link><span>/</span>
          <span className="font-bold text-ink">{t("Thời tiết Tà Xùa")}</span>
        </nav>
        <header className="flex flex-col gap-3">
          <h1 className="text-[clamp(26px,3.6vw,40px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink">{t("Thời tiết Tà Xùa: dự báo 7 ngày và khả năng biển mây")}</h1>
          <p className="max-w-[860px] text-[16px] leading-[1.7]" style={{ color: "oklch(0.32 0.02 160)" }}>{lead.join(" ")}</p>
        </header>

        {f && tm && (
          <section className="grid gap-4 rounded-[22px] p-5 text-white sm:grid-cols-[auto_minmax(0,1fr)] sm:p-7" style={{ background: G }}>
            <div className="flex flex-col items-center justify-center gap-1 rounded-[18px] bg-white/10 px-6 py-4 text-center">
              <div className="text-xs font-semibold opacity-80">{focusLabel} · {wdDmy(tm.day, t)}</div>
              <div className="text-[44px] font-extrabold leading-none">{tm.score}%</div>
              <div className="text-sm font-bold">{t("Khả năng biển mây: {0}", [t(outlookWord(tm.score))])}</div>
            </div>
            <div className="flex min-w-0 flex-col gap-2.5">
              <h2 className="text-xl font-extrabold">{thisMorning ? t("Sáng nay có biển mây không?") : t("Sáng mai có biển mây không?")}</h2>
              <p className="text-[15px] leading-[1.6] opacity-95">{t(outlookNote(tm.score))}</p>
              <ul className="grid gap-x-5 gap-y-1 text-sm opacity-90 sm:grid-cols-2">
                <li>{t("Độ ẩm lúc 5h–7h: {0}%", [Math.round(tm.rh)])}</li>
                <li>{t("Mây tầng thấp: {0}%", [Math.round(tm.low)])}</li>
                <li>{t("Chênh nhiệt độ và điểm sương: {0}°C", [num(tm.spread, locale)])}</li>
                <li>{t("Gió: {0} km/h", [Math.round(tm.wind)])}</li>
                <li>{t("Khả năng mưa lúc 5h–7h: {0}%", [Math.round(tm.rain)])}</li>
                {tm.rainBefore != null && <li>{t("Mưa hôm trước: {0} mm", [num(tm.rainBefore, locale)])}</li>}
              </ul>
              <p className="text-xs leading-[1.55] opacity-75">{t("Ước tính tự động từ dự báo Open-Meteo, không phải cam kết. Mây ở Tà Xùa có thể đổi trong vài giờ.")}</p>
              <div className="flex flex-wrap gap-2 pt-1 text-sm">
                <Link href="/diem-den" className="rounded-full px-4 py-2 font-bold text-white" style={{ background: ACCENT }}>{t("Điểm ngắm mây gần trung tâm")}</Link>
                {artBy.get("kinh-nghiem-san-may-ta-xua") && <Link href="/kinh-nghiem/kinh-nghiem-san-may-ta-xua" className="rounded-full bg-white/15 px-4 py-2 font-bold">{t("Kinh nghiệm săn mây")}</Link>}
              </div>
            </div>
          </section>
        )}

        {f && days.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className={sectionH}>{t("Dự báo thời tiết Tà Xùa 7 ngày tới")}</h2>
            <div className="overflow-x-auto rounded-[18px] border bg-white" style={{ borderColor: BORDER }}>
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead style={{ background: "oklch(0.965 0.01 160)" }}>
                  <tr>
                    <th className="px-4 py-3 font-bold">{t("Ngày")}</th>
                    <th className="px-4 py-3 font-bold">{t("Thời tiết")}</th>
                    <th className="px-4 py-3 font-bold">{t("Nhiệt độ")}</th>
                    <th className="px-4 py-3 font-bold">{t("Khả năng mưa")}</th>
                    <th className="px-4 py-3 font-bold">{t("Lượng mưa")}</th>
                    <th className="px-4 py-3 font-bold">{t("Biển mây sáng sớm (ước tính)")}</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map(({ d, i }, k) => {
                    const o = outlooks.get(d);
                    return (
                      <tr key={d} className="border-t" style={{ borderColor: BORDER }}>
                        <td className="whitespace-nowrap px-4 py-2.5 font-semibold">{k === 0 ? t("Hôm nay") : wdDmy(d, t)}</td>
                        <td className="px-4 py-2.5">{t(wxCondName(f.daily.weather_code[i]))}</td>
                        <td className="whitespace-nowrap px-4 py-2.5">{Math.round(f.daily.temperature_2m_min[i])}–{Math.round(f.daily.temperature_2m_max[i])}°C</td>
                        <td className="px-4 py-2.5">{Math.round(f.daily.precipitation_probability_max[i] ?? 0)}%</td>
                        <td className="px-4 py-2.5">{num(f.daily.precipitation_sum[i] ?? 0, locale)} mm</td>
                        <td className="px-4 py-2.5">{o && !(k === 0 && !thisMorning) ? <b style={{ color: scoreC(o.score) }}>{o.score}% · {t(outlookWord(o.score))}</b> : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs" style={{ color: MUTED }}>
              {t("Nguồn: Open-Meteo, toạ độ trung tâm xã Tà Xùa, độ cao mô hình {0} m. Cập nhật {1}.", [Math.round(f.elevation), vnDateTime(new Date(f.at))])}
            </p>
          </section>
        )}
        {!f && (
          <p className="rounded-2xl border bg-white px-4 py-3.5 text-[15px]" style={{ borderColor: BORDER }}>{t("Dự báo tạm thời chưa tải được. Bảng khí hậu theo tháng bên dưới vẫn dùng để tham khảo.")}</p>
        )}

        <section className="flex flex-col gap-3">
          <h2 className={sectionH}>{t("Khí hậu Tà Xùa theo tháng")}</h2>
          <p className="max-w-[860px] text-[15px] leading-[1.7]" style={{ color: "oklch(0.35 0.02 160)" }}>
            {t("Lạnh nhất là tháng {0} (thấp trung bình {1}°C), mưa nhiều nhất là tháng {2} ({3} mm), khô nhất là tháng {4} ({5} mm).", [
              coldest.m, num(coldest.tmin, locale), wettest.m, wettest.rain, driest.m, driest.rain,
            ])}
            {rainy.length > 1 && " " + t("Từ tháng {0} tới tháng {1}, mỗi tháng có từ 20 ngày mưa trở lên.", [rainy[0].m, rainy[rainy.length - 1].m])}
          </p>
          <div className="overflow-x-auto rounded-[18px] border bg-white" style={{ borderColor: BORDER }}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead style={{ background: "oklch(0.965 0.01 160)" }}>
                <tr>
                  <th className="px-4 py-3 font-bold">{t("Tháng")}</th>
                  <th className="px-4 py-3 font-bold">{t("Cao TB")}</th>
                  <th className="px-4 py-3 font-bold">{t("Thấp TB")}</th>
                  <th className="px-4 py-3 font-bold">{t("Lượng mưa")}</th>
                  <th className="px-4 py-3 font-bold">{t("Ngày mưa")}</th>
                  <th className="px-4 py-3 font-bold">{t("Độ ẩm")}</th>
                  <th className="px-4 py-3 font-bold">{t("Thấp nhất 10 năm")}</th>
                </tr>
              </thead>
              <tbody>
                {TA_XUA_CLIMATE.map((c) => {
                  const a = monthArt(c.m);
                  return (
                    <tr key={c.m} className="border-t" style={{ borderColor: BORDER }}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-semibold">
                        {a ? <Link href={`/kinh-nghiem/${a.slug}`} className="text-forest-700 hover:underline">{t("Tháng {0}", [c.m])}</Link> : t("Tháng {0}", [c.m])}
                      </td>
                      <td className="px-4 py-2.5">{num(c.tmax, locale)}°C</td>
                      <td className="px-4 py-2.5">{num(c.tmin, locale)}°C</td>
                      <td className="px-4 py-2.5">{c.rain} mm</td>
                      <td className="px-4 py-2.5">{c.wetDays}</td>
                      <td className="px-4 py-2.5">{c.rh}%</td>
                      <td className="px-4 py-2.5">{num(c.coldest, locale)}°C</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-[1.55]" style={{ color: MUTED }}>
            {t("Nguồn: {0}, trung bình {1}, ô lưới quanh trung tâm xã Tà Xùa, độ cao {2} m. Số liệu mô hình tái phân tích, không phải trạm đo tại xã; dùng để so sánh giữa các tháng.", [CLIMATE_SOURCE.name, CLIMATE_SOURCE.years, CLIMATE_SOURCE.elevation])}{" "}
            <a href={CLIMATE_SOURCE.url} target="_blank" rel="noopener noreferrer" className="underline">open-meteo.com</a>
          </p>
        </section>

        {arts.some((a) => a.slug.startsWith("ta-xua-thang-")) && (
          <section className="flex flex-col gap-3">
            <h2 className={sectionH}>{t("Đi Tà Xùa tháng nào: bài chi tiết từng tháng")}</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TA_XUA_CLIMATE.map((c) => monthArt(c.m)).filter((a): a is { slug: string; title: string } => !!a).map((a) => (
                <Link key={a.slug} href={`/kinh-nghiem/${a.slug}`} className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold hover:text-forest-700" style={{ borderColor: BORDER }}>{t(a.title)}</Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {LINK_SLUGS.map((s) => artBy.get(s)).filter((a): a is { slug: string; title: string } => !!a).map((a) => (
                <Link key={a.slug} href={`/kinh-nghiem/${a.slug}`} className="rounded-full bg-forest-50 px-3.5 py-2 text-sm font-semibold text-forest-700 ring-1 ring-forest-200 hover:bg-forest-100">{t(a.title)}</Link>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className={sectionH}>{t("Câu hỏi thường gặp")}</h2>
          <div className="divide-y rounded-[18px] border bg-white px-5" style={{ borderColor: BORDER }}>
            {faq.map(([q, a]) => (
              <div key={q} className="py-4">
                <h3 className="text-[16px] font-bold text-ink">{q}</h3>
                <p className="mt-1.5 text-[15px] leading-[1.65]" style={{ color: "oklch(0.35 0.02 160)" }}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] p-5 text-white" style={{ background: G }}>
          <div className="text-lg font-extrabold">{t("Chọn được ngày đẹp? Đặt xe và chỗ ở")}</div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/combo" className="rounded-full px-4 py-2.5 font-extrabold text-white" style={{ background: ACCENT }}>{t("Combo xe cabin + homestay")}</Link>
            <Link href="/homestay" className="rounded-full bg-white/15 px-4 py-2.5 font-bold">{t("Homestay")}</Link>
            <Link href="/xe-cabin" className="rounded-full bg-white/15 px-4 py-2.5 font-bold">{t("Xe cabin")}</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Bài liên quan (chỉ hiện khi đang đăng): săn mây, mùa nào đẹp, mùa đông, mùa hè, chuẩn bị đồ. */
const LINK_SLUGS = ["ta-xua-mua-nao-dep-nhat", "kinh-nghiem-san-may-ta-xua", "san-may-hut-o-ta-xua-lam-gi", "ta-xua-mua-dong-lanh-mac-gi", "ta-xua-mua-he-thang-5-8", "chuan-bi-gi-khi-di-ta-xua"];
