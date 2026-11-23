"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/Link";
import { useT } from "@/components/i18n/I18nProvider";
import { comboHrefFor, loadWeather, seaScore, seaVerdict, seaWord, wxCondName, wxKind, type WxData } from "@/lib/weather";

/**
 * Popup "Tà Xùa mấy ngày tới thế nào?" — theo claude.ai/design `Du bao Thoi tiet Ta Xua.dc.html`:
 * thẻ BÂY GIỜ (nền đổi theo ngày/đêm/mưa) · KHẢ NĂNG BIỂN MÂY (vòng %, yếu tố, gợi ý mặc gì / đường đèo /
 * đi mấy giờ) · 7 NGÀY (bấm chọn ngày, nhãn "Đẹp nhất") · THEO GIỜ · dải CTA đặt combo ngày đó.
 */

const G = "oklch(0.29 0.055 160)";
const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const scoreC = (v: number) => (v >= 70 ? "oklch(0.55 0.13 155)" : v >= 45 ? "oklch(0.7 0.15 70)" : "oklch(0.6 0.04 240)");
const pd = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const hm = (s: string) => s.slice(11, 16);

export function WeatherPopup({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [st, setSt] = useState<{ data: WxData; live: boolean; at: number } | null>(null);
  const [sel, setSel] = useState(1);

  useEffect(() => {
    let alive = true;
    loadWeather().then((r) => alive && setSt(r));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const v = useMemo(() => (st ? buildView(st.data, sel) : null), [st, sel]);
  const dLabel = (i: number, k: string) => {
    if (i === 0) return t("Hôm nay");
    if (i === 1) return t("Sáng mai");
    const d = pd(k);
    return `${t(WD[d.getUTCDay()])} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  };
  const updated = st
    ? (st.live ? t("Cập nhật {0}", [timeVN(st.at)]) : t("Dữ liệu mẫu · {0}", [timeVN(st.at)]))
    : t("Đang tải dự báo…");

  // Portal ra <body>: banner có stacking context riêng ⇒ ở trong đó popup bị menu / ô tìm kiếm / nút liên hệ đè.
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t("Dự báo thời tiết Tà Xùa")}>
      <div className="wxp-fade absolute inset-0 bg-[oklch(0.18_0.03_180/.55)] backdrop-blur-[3px]" onClick={onClose} />
      {/* iPhone: vh = màn hình khi ẨN thanh địa chỉ ⇒ 94vh cao hơn phần nhìn thấy, đầu popup (nút ×) bị khuất.
          Dùng dvh (phần đang thấy) + nút × nằm NGOÀI vùng cuộn nên luôn đứng yên ở góc. */}
      <div
        className="wxp-pop wxp-sheet relative flex w-full max-w-[1240px] flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px]"
        style={{ background: "oklch(0.975 0.008 150)", color: "oklch(0.22 0.03 160)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Đóng")}
          className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-bold leading-none shadow-md ring-1 ring-black/10 hover:bg-gray-50 active:scale-95"
        >
          ×
        </button>
        {/* thanh kéo (điện thoại) */}
        <div className="flex flex-none justify-center pt-2 sm:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-black/15" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <section className="flex flex-col gap-[18px] px-[clamp(16px,4vw,32px)] pb-[clamp(20px,4vw,40px)] pt-[clamp(20px,4vw,40px)]">
          {/* tiêu đề */}
          <div className="flex flex-wrap items-end justify-between gap-3.5 pr-10">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-extrabold tracking-[.14em]" style={{ color: "oklch(0.5 0.1 158)" }}>
                {t("DỰ BÁO MÂY & THỜI TIẾT · ĐỘ CAO ~1.600M")}
              </span>
              <h2 className="m-0 text-[clamp(24px,3.4vw,38px)] font-extrabold leading-[1.1] tracking-[-.025em]">{t("Tà Xùa mấy ngày tới thế nào?")}</h2>
            </div>
            <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "oklch(0.48 0.02 160)" }}>
              <span
                className="h-2 w-2 rounded-full [animation:wxp-pulse_1.6s_infinite]"
                style={{ background: st?.live ? "oklch(0.6 0.15 155)" : "oklch(0.7 0.12 60)" }}
              />
              {updated}
            </div>
          </div>

          {!v ? (
            <div className="grid gap-3.5 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="h-[300px] animate-pulse rounded-[28px] bg-white" />
              <div className="h-[300px] animate-pulse rounded-[28px] bg-white" />
            </div>
          ) : (
            <>
              <div className="grid items-stretch gap-3.5 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                {/* BÂY GIỜ */}
                <div
                  className="wxp-up relative flex min-h-[300px] flex-col justify-between gap-4 overflow-hidden rounded-[28px] p-6 text-white"
                  style={{ background: v.nowBg }}
                >
                  <div className="pointer-events-none absolute -left-[10%] -right-[10%] -bottom-[30px] h-[120px] [animation:wxp-drift_18s_ease-in-out_infinite_alternate]">
                    <span className="absolute bottom-5 left-[5%] h-[70px] w-[45%] rounded-full blur-[14px]" style={{ background: "oklch(1 0 0 / .22)" }} />
                    <span className="absolute bottom-0 left-[40%] h-[90px] w-[55%] rounded-full blur-[16px]" style={{ background: "oklch(1 0 0 / .28)" }} />
                  </div>
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[110px]"
                    style={{
                      background: "linear-gradient(180deg, transparent, oklch(0.2 0.04 200 / .35))",
                      clipPath: "polygon(0 70%,12% 40%,22% 58%,36% 22%,50% 50%,63% 30%,78% 55%,90% 35%,100% 52%,100% 100%,0 100%)",
                    }}
                  />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold opacity-85">{t("Bây giờ · Trung tâm Tà Xùa")}</div>
                      <div className="mt-0.5 text-base font-extrabold">
                        {t(v.now.cond)}
                      </div>
                    </div>
                    <WxIcon big sun={v.now.sun} cloud={v.now.cloud} rain={v.now.rain} sunC={v.now.sunC} sunG={v.now.sunG} />
                  </div>
                  <div className="relative flex flex-wrap items-end gap-4">
                    <div className="text-[96px] font-black leading-[.85] tracking-[-.05em]">
                      {v.now.temp}
                      <span className="align-top text-[40px]">°</span>
                    </div>
                    <div className="flex flex-col gap-0.5 pb-1.5 text-sm font-semibold">
                      <span>{t("Cảm giác {0}°", [v.now.feel])}</span>
                      <span>{t("Cao {0}° · Thấp {1}°", [v.now.max, v.now.min])}</span>
                    </div>
                  </div>
                  <div className="relative grid grid-cols-4 gap-2 max-[480px]:grid-cols-2">
                    {v.now.stats.map((s) => (
                      <div key={s.k} className="rounded-[14px] px-3 py-2.5 backdrop-blur-[6px]" style={{ background: "oklch(1 0 0 / .14)" }}>
                        <div className="whitespace-nowrap text-[11px] font-bold opacity-80">{t(s.k)}</div>
                        <div className="whitespace-nowrap text-base font-extrabold max-[420px]:text-sm">{s.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* KHẢ NĂNG BIỂN MÂY */}
                <div className="wxp-up flex flex-col gap-4 rounded-[28px] border bg-white p-6 [animation-delay:.08s]" style={{ borderColor: "oklch(0.92 0.01 160)" }}>
                  <div className="flex items-center justify-between gap-2.5">
                    <b className="text-base">{t("Khả năng biển mây · {0}", [dLabel(v.sel, v.selKey)])}</b>
                    <span className="whitespace-nowrap text-xs font-bold" style={{ color: "oklch(0.5 0.02 160)" }}>
                      {t("5h – 8h sáng")}
                    </span>
                  </div>
                  {v.sea ? (
                    <div className="flex flex-wrap items-center gap-5">
                      <div
                        className="relative h-[150px] w-[150px] flex-none rounded-full transition-[background] duration-500"
                        style={{ background: `conic-gradient(${scoreC(v.sea.s)} ${v.sea.s * 3.6}deg, oklch(0.94 0.01 160) 0)` }}
                      >
                        <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-white">
                          <span className="text-[42px] font-black tracking-[-.03em]" style={{ color: scoreC(v.sea.s) }}>
                            {v.sea.s}%
                          </span>
                          <span className="text-xs font-extrabold" style={{ color: "oklch(0.45 0.02 160)" }}>
                            {t(seaWord(v.sea.s))}
                          </span>
                        </div>
                      </div>
                      <div className="flex min-w-[180px] flex-1 flex-col gap-2">
                        <div className="text-pretty text-lg font-extrabold leading-[1.35]">{t(seaVerdict(v.sea.s))}</div>
                        {v.factors.map((f) => (
                          <div key={f.k} className="grid grid-cols-[112px_minmax(0,1fr)_52px] items-center gap-2 text-xs">
                            <span className="whitespace-nowrap font-bold" style={{ color: "oklch(0.45 0.02 160)" }}>
                              {t(f.k)}
                            </span>
                            <div className="h-1.5 overflow-hidden rounded-[3px]" style={{ background: "oklch(0.95 0.006 160)" }}>
                              <div className="h-full rounded-[3px] transition-[width] duration-500" style={{ width: f.pct, background: f.c }} />
                            </div>
                            <b className="whitespace-nowrap text-right">{f.v}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">{t("Chưa có dữ liệu buổi sáng cho ngày này.")}</p>
                  )}
                  <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
                    {v.tips.map((x) => (
                      <div key={x.k} className="rounded-[14px] px-3 py-2.5" style={{ background: "oklch(0.975 0.008 155)" }}>
                        <div className="text-[11px] font-extrabold tracking-[.06em]" style={{ color: "oklch(0.5 0.1 158)" }}>
                          {t(x.k)}
                        </div>
                        <div className="mt-0.5 text-[13px] font-bold leading-[1.4]">{t(x.v, x.args)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 7 NGÀY + THEO GIỜ */}
              <div className="wxp-up flex flex-col gap-3 rounded-[28px] border bg-white p-3.5 [animation-delay:.14s]" style={{ borderColor: "oklch(0.92 0.01 160)" }}>
                <div className="grid grid-cols-[repeat(7,minmax(86px,1fr))] gap-1.5 overflow-x-auto pb-0.5 pt-2.5 [scrollbar-width:none] min-[760px]:grid-cols-[repeat(7,minmax(0,1fr))]">
                  {v.days.map((d, i) => {
                    const on = i === v.sel;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => setSel(i)}
                        className="relative flex flex-col items-center gap-1.5 rounded-[20px] border-[1.5px] px-1.5 pb-2.5 pt-3 transition-all duration-200"
                        style={{
                          background: on ? G : "transparent",
                          color: on ? "white" : "oklch(0.25 0.03 160)",
                          borderColor: on ? G : d.best ? "oklch(0.85 0.08 70)" : "transparent",
                        }}
                      >
                        {d.best && (
                          <span className="absolute -top-[9px] whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white" style={{ background: "oklch(0.68 0.18 45)" }}>
                            {t("Đẹp nhất")}
                          </span>
                        )}
                        <span className="text-[13px] font-extrabold">{i === 0 ? t("Hôm nay") : t(WD[pd(d.key).getUTCDay()])}</span>
                        <span className="text-[11px] font-semibold opacity-75">
                          {pd(d.key).getUTCDate()}/{pd(d.key).getUTCMonth() + 1}
                        </span>
                        <WxIcon sun={d.sun} cloud={d.cloud} rain={d.rain} cloudC={on ? "oklch(0.95 0.01 240)" : "oklch(0.85 0.02 240)"} />
                        <span className="whitespace-nowrap text-[15px] font-extrabold">
                          {d.max}° <span className="font-semibold opacity-60">{d.min}°</span>
                        </span>
                        <div className="flex w-full flex-col items-center gap-[3px] px-1">
                          <div className="h-[5px] w-full overflow-hidden rounded-[3px]" style={{ background: on ? "oklch(1 0 0 / .25)" : "oklch(0.94 0.01 160)" }}>
                            <div className="h-full" style={{ width: `${d.score ?? 0}%`, background: on ? "white" : scoreC(d.score ?? 0) }} />
                          </div>
                          <span className="whitespace-nowrap text-[10px] font-extrabold opacity-85">{t("Mây {0}%", [d.score ?? "–"])}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2.5 px-1.5 pt-1">
                  <b className="text-[15px]">{t("Theo giờ · {0}", [dLabel(v.sel, v.selKey)])}</b>
                  <span className="text-xs font-semibold" style={{ color: "oklch(0.5 0.02 160)" }}>
                    {t("Mặt trời mọc {0} · lặn {1}", [v.sunrise, v.sunset])}
                  </span>
                </div>
                <div className="grid grid-cols-[repeat(9,minmax(76px,1fr))] gap-1.5 overflow-x-auto [scrollbar-width:none]">
                  {v.hours.map((h) => (
                    <div key={h.t} className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5" style={{ background: h.bg }}>
                      <span className="text-xs font-extrabold" style={{ color: h.tc }}>
                        {h.t}
                      </span>
                      <div className="mt-auto w-1.5 self-center rounded-[3px] transition-[height] duration-[400ms]" style={{ height: h.bar, background: h.barC }} />
                      <span className="text-base font-extrabold">{h.temp}°</span>
                      <span className="min-h-[15px] whitespace-nowrap text-[11px] font-bold" style={{ color: "oklch(0.5 0.12 240)" }}>
                        {h.rain != null ? t("{0}% mưa", [h.rain]) : ""}
                      </span>
                      <span className="whitespace-nowrap text-[10px] font-bold" style={{ color: "oklch(0.5 0.02 160)" }}>
                        {h.lowPct != null ? t("Mây thấp {0}%", [h.lowPct]) : t(h.label)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] px-5 py-4 text-white" style={{ background: G }}>
                <div>
                  <div className="text-base font-extrabold">
                    {v.best >= 0 && v.days[v.best].score != null
                      ? t("Ngày nhiều mây nhất tuần: {0} ({1}%)", [dLabel(v.best, v.days[v.best].key), v.days[v.best].score!])
                      : t("Chọn ngày đẹp để săn mây")}
                  </div>
                  <div className="text-[13px] opacity-85">
                    {t("Khả năng biển mây là ước tính từ độ ẩm, mây tầng thấp, gió lúc sáng sớm. Nguồn: Open-Meteo.")}
                  </div>
                </div>
                <Link
                  href={comboHrefFor(v.selKey, v.days[0].key)}
                  onClick={onClose}
                  className="whitespace-nowrap rounded-full px-5 py-3 text-[15px] font-extrabold text-white hover:brightness-110"
                  style={{ background: "oklch(0.68 0.18 45)" }}
                >
                  {t("Đặt combo ngày này →")}
                </Link>
              </div>
            </>
          )}
          {/* điện thoại: nút Đóng to ở cuối (cạnh thanh home iPhone) */}
          <button
            type="button"
            onClick={onClose}
            className="mb-[env(safe-area-inset-bottom)] w-full rounded-full border border-black/10 bg-white py-3.5 text-[15px] font-extrabold shadow-sm active:scale-[.99] sm:hidden"
          >
            {t("Đóng")}
          </button>
        </section>
        </div>
      </div>
      <style>{POP_CSS}</style>
    </div>,
    document.body,
  );
}

const POP_CSS = `
@keyframes wxp-drift{from{transform:translateX(-12%)}to{transform:translateX(12%)}}
@keyframes wxp-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes wxp-pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes wxp-pop{from{opacity:0;transform:translateY(24px) scale(.98)}to{opacity:1;transform:none}}
@keyframes wxp-fade{from{opacity:0}to{opacity:1}}
.wxp-sheet{max-height:92vh;max-height:calc(100dvh - 10px)}
@media (min-width:640px){.wxp-sheet{max-height:94vh;max-height:calc(100dvh - 32px)}}
.wxp-up{animation:wxp-up .5s ease both}
.wxp-pop{animation:wxp-pop .35s cubic-bezier(.2,.8,.2,1) both}
.wxp-fade{animation:wxp-fade .25s ease both}
@media (prefers-reduced-motion: reduce){.wxp-up,.wxp-pop,.wxp-fade{animation:none}}
`;

function timeVN(ms: number) {
  const d = new Date(ms + 7 * 3_600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Biểu tượng mặt trời / mây / mưa dựng bằng khối như bản thiết kế. */
function WxIcon({
  big = false,
  sun,
  cloud,
  rain,
  sunC = "oklch(0.85 0.16 85)",
  sunG,
  cloudC = "oklch(0.97 0.005 240)",
}: {
  big?: boolean;
  sun: boolean;
  cloud: boolean;
  rain: boolean;
  sunC?: string;
  sunG?: string;
  cloudC?: string;
}) {
  if (big)
    return (
      <div className="relative h-14 w-16 flex-none">
        {sun && <span className="absolute right-1 top-0 h-9 w-9 rounded-full" style={{ background: sunC, boxShadow: sunG ? `0 0 30px 6px ${sunG}` : undefined }} />}
        {cloud && (
          <>
            <span className="absolute bottom-1.5 left-0 h-[22px] w-[52px] rounded-xl" style={{ background: cloudC }} />
            <span className="absolute bottom-4 left-3 h-[26px] w-[26px] rounded-full" style={{ background: cloudC }} />
          </>
        )}
        {rain &&
          [12, 26, 40].map((x, i) => (
            <span key={x} className="absolute h-2.5 w-[3px] rotate-[15deg] rounded-sm" style={{ left: x, bottom: i === 1 ? -8 : -6, background: "oklch(0.75 0.1 240)" }} />
          ))}
      </div>
    );
  return (
    <div className="relative h-[30px] w-10">
      {sun && <span className="absolute right-1 top-0 h-5 w-5 rounded-full" style={{ background: "oklch(0.85 0.16 85)" }} />}
      {cloud && (
        <>
          <span className="absolute bottom-0.5 left-0.5 h-[13px] w-8 rounded-lg" style={{ background: cloudC }} />
          <span className="absolute bottom-2 left-[9px] h-[15px] w-[15px] rounded-full" style={{ background: cloudC }} />
        </>
      )}
      {rain &&
        [10, 19].map((x, i) => (
          <span key={x} className="absolute h-1.5 w-0.5 rotate-[15deg]" style={{ left: x, bottom: i ? -6 : -5, background: "oklch(0.6 0.12 240)" }} />
        ))}
    </div>
  );
}

/** Dựng số liệu hiển thị (tương đương renderVals của bản thiết kế). */
function buildView(d: WxData, selRaw: number) {
  const H = d.hourly;
  const D = d.daily;
  const C = d.current;
  const scores = D.time.map((k) => seaScore(H, k));
  const best = scores.reduce<number>((b, x, i) => (x && (b < 0 || x.s > (scores[b]?.s ?? -1)) ? i : b), -1);
  const kNow = wxKind(C.weather_code);
  const night = !C.is_day;
  const nowBg = night
    ? "linear-gradient(170deg, oklch(0.25 0.07 270), oklch(0.32 0.06 250) 60%, oklch(0.4 0.05 220))"
    : kNow === "rain"
      ? "linear-gradient(170deg, oklch(0.45 0.04 240), oklch(0.55 0.04 230))"
      : kNow === "fog" || kNow === "cloud"
        ? "linear-gradient(170deg, oklch(0.55 0.05 225), oklch(0.68 0.05 210) 60%, oklch(0.75 0.04 180))"
        : "linear-gradient(170deg, oklch(0.55 0.12 240), oklch(0.68 0.1 225) 55%, oklch(0.8 0.08 85))";
  const sel = Math.min(selRaw, D.time.length - 1);
  const selKey = D.time[sel];
  const sea = scores[sel] ?? scores[0];
  const di = sel;
  const mn = D.temperature_2m_min[di];
  const rainMax = D.precipitation_probability_max[di] ?? 0;

  const hours = [5, 6, 7, 9, 11, 13, 15, 17, 19].map((h) => {
    const i = H.time.indexOf(`${selKey}T${String(h).padStart(2, "0")}:00`);
    const tLabel = `${String(h).padStart(2, "0")}h`;
    if (i < 0)
      return { t: tLabel, temp: "–" as string | number, rain: null as number | null, lowPct: null as number | null, label: "", bar: "4px", barC: "oklch(0.9 0.01 160)", bg: "oklch(0.975 0.006 160)", tc: "oklch(0.4 0.02 160)" };
    const morning = h <= 7;
    const low = H.cloud_cover_low[i];
    const rp = H.precipitation_probability[i] ?? 0;
    return {
      t: tLabel,
      temp: Math.round(H.temperature_2m[i]),
      rain: rp >= 20 ? rp : null,
      lowPct: morning ? Math.round(low) : null,
      label: morning ? "" : wxCondName(H.weather_code[i], h >= 18).split(" ·")[0],
      bar: `${Math.max(4, Math.round(((morning ? low : H.cloud_cover[i]) / 100) * 44))}px`,
      barC: morning ? scoreC(sea ? sea.s : 0) : "oklch(0.82 0.03 230)",
      bg: morning ? "oklch(0.97 0.025 155)" : "oklch(0.975 0.006 160)",
      tc: morning ? "oklch(0.38 0.1 155)" : "oklch(0.4 0.02 160)",
    };
  });

  const sunrise = hm(D.sunrise[di] ?? "");
  return {
    night,
    nowBg,
    sel,
    selKey,
    best,
    sea,
    now: {
      temp: Math.round(C.temperature_2m),
      feel: Math.round(C.apparent_temperature),
      max: Math.round(D.temperature_2m_max[0]),
      min: Math.round(D.temperature_2m_min[0]),
      cond: wxCondName(C.weather_code, night),
      sun: kNow === "sun" || kNow === "part",
      cloud: kNow !== "sun",
      rain: kNow === "rain",
      sunC: night ? "oklch(0.93 0.03 90)" : "oklch(0.88 0.16 85)",
      sunG: night ? "oklch(0.9 0.03 90 / .4)" : "oklch(0.9 0.16 85 / .6)",
      stats: [
        { k: "Độ ẩm", v: `${Math.round(C.relative_humidity_2m)}%` },
        { k: "Gió", v: `${Math.round(C.wind_speed_10m)} km/h` },
        { k: "Mọc", v: hm(D.sunrise[0] ?? "") },
        { k: "Lặn", v: hm(D.sunset[0] ?? "") },
      ],
    },
    factors: sea
      ? (
          [
            ["Độ ẩm sáng", sea.fRh, `${Math.round(sea.rh)}%`],
            ["Mây tầng thấp", sea.fLow, `${Math.round(sea.low)}%`],
            ["Hơi nước bão hoà", sea.fSp, `${sea.spread.toFixed(1)}°`],
            ["Gió lặng", sea.fW, `${Math.round(sea.wind)}km/h`],
          ] as const
        ).map(([k, f, val]) => ({
          k,
          v: val,
          pct: `${Math.round(f * 100)}%`,
          c: f >= 0.7 ? "oklch(0.55 0.13 155)" : f >= 0.4 ? "oklch(0.7 0.15 70)" : "oklch(0.7 0.03 240)",
        }))
      : [],
    tips: [
      { k: "MẶC GÌ", v: mn <= 8 ? "Áo phao dày, mũ len, găng tay" : mn <= 13 ? "Áo khoác gió + áo nỉ bên trong" : "Áo khoác mỏng buổi sáng", args: undefined as (string | number)[] | undefined },
      { k: "ĐƯỜNG ĐÈO", v: rainMax >= 60 ? "Đường trơn, hạn chế tự chạy xe" : rainMax >= 30 ? "Có thể mưa rào, mang áo mưa" : "Khô ráo, đi xe máy ổn", args: undefined },
      sea && sea.s >= 45
        ? { k: "ĐI MẤY GIỜ", v: "Có mặt trước {0}", args: [sunrise && sunrise < "06:10" ? "5h30" : "5h45"] }
        : { k: "ĐI MẤY GIỜ", v: "Không cần dậy quá sớm", args: undefined },
    ],
    days: D.time.map((k, i) => {
      const x = scores[i];
      const kd = wxKind(D.weather_code[i]);
      return {
        key: k,
        max: Math.round(D.temperature_2m_max[i]),
        min: Math.round(D.temperature_2m_min[i]),
        score: x ? x.s : null,
        best: i === best && !!x && x.s >= 45,
        sun: kd === "sun" || kd === "part",
        cloud: kd !== "sun",
        rain: kd === "rain",
      };
    }),
    sunrise,
    sunset: hm(D.sunset[di] ?? ""),
    hours,
  };
}
