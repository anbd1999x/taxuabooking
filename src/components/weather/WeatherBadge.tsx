"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { loadWeather, vnHour, wxCondName } from "@/lib/weather";

const WeatherPopup = dynamic(() => import("./WeatherPopup").then((m) => m.WeatherPopup), { ssr: false });

/**
 * Nút thời tiết ở góc trên-phải banner trang chủ: ban ngày = MẶT TRỜI CƯỜI TƯƠI, ban đêm =
 * MẶT TRĂNG ĐI NGỦ (zzz) + nhiệt độ hiện tại; bấm ⇒ popup dự báo 7 ngày + khả năng biển mây
 * (`WeatherPopup`, nạp lười). Ngày/đêm theo `is_day` của Open-Meteo, chưa có dữ liệu thì theo giờ VN.
 */
export function WeatherBadge({ className = "" }: { className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [night, setNight] = useState<boolean | null>(null);
  const [temp, setTemp] = useState<number | null>(null);
  const [cond, setCond] = useState("");
  const [hint, setHint] = useState(false); // bong bóng "Bấm xem…" (chỉ tới khi khách bấm lần đầu)

  useEffect(() => {
    let alive = true;
    const timers: number[] = [];
    // Hiện sau khi màn mây mở xong; gọi dự báo lúc đó để không tranh băng thông với ảnh hero.
    const id = window.setTimeout(() => {
      const h = vnHour();
      setNight(!(h >= 6 && h < 18));
      let seen = false;
      try {
        seen = localStorage.getItem(SEEN_KEY) === "1";
      } catch {}
      if (!seen) {
        timers.push(window.setTimeout(() => alive && setHint(true), 1400));
        timers.push(window.setTimeout(() => alive && setHint(false), 11000));
      }
      loadWeather().then(({ data, live }) => {
        if (!alive || !live) return;
        setNight(!data.current.is_day);
        setTemp(Math.round(data.current.temperature_2m));
        setCond(wxCondName(data.current.weather_code, !data.current.is_day));
      });
    }, 1800);
    return () => {
      alive = false;
      clearTimeout(id);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (night === null) return null;
  const openPopup = () => {
    setOpen(true);
    setHint(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPopup}
        onPointerEnter={() => void loadWeather()}
        data-track="Xem dự báo thời tiết"
        aria-label={t("Xem dự báo thời tiết Tà Xùa")}
        title={t("Xem dự báo thời tiết Tà Xùa")}
        className={`wx-badge group flex items-center gap-2.5 rounded-[22px] border border-white/40 py-1.5 pl-1.5 pr-3 text-left text-white shadow-[0_10px_32px_oklch(0.15_0.03_200/.4),inset_0_1px_0_oklch(1_0_0/.35)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/70 ${className}`}
        style={{
          background: night
            ? "linear-gradient(135deg, oklch(0.32 0.1 285 / .05), oklch(0.24 0.07 250 / .05))" // trong 95% (kính mờ)
            : "linear-gradient(135deg, oklch(0.62 0.13 230 / .05), oklch(0.42 0.08 200 / .05))",
        }}
      >
        <span className="relative h-[54px] w-[54px] flex-none rounded-full bg-white/15 p-0.5 ring-1 ring-white/30">
          {/* vòng sáng lan toả: gợi ý bấm được */}
          <span className="wx-ring pointer-events-none absolute inset-0 rounded-full border-2 border-white/70" aria-hidden />
          {night ? <SleepyMoon /> : <HappySun />}
        </span>
        <span className="flex flex-col leading-tight [text-shadow:0_1px_6px_oklch(0.15_0.03_200/.55)]">
          <span className="text-[19px] font-black tracking-tight [text-shadow:0_1px_8px_oklch(0.2_0.05_220/.4)]">
            {temp != null ? `${temp}°C` : t("Thời tiết")}
          </span>
          <span className="max-w-[130px] truncate text-[11px] font-semibold opacity-90">
            {cond ? t(cond) : t("Xem dự báo")}
          </span>
          <span className="mt-1 flex flex-col gap-[3px]">
            <span className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[#FFE38A]">{t("Dự báo 7 ngày")}</span>
            {/* dải hoa văn thổ cẩm */}
            <span className="wx-ribbon block h-[3px] w-full rounded-full opacity-95" aria-hidden />
          </span>
        </span>
        {/* mũi tên: cho biết bấm sẽ mở chi tiết */}
        <span className="ml-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/20 text-lg font-bold leading-none transition group-hover:translate-x-0.5 group-hover:bg-white/35" aria-hidden>
          ›
        </span>
      </button>
      {hint && (
        <button
          type="button"
          onClick={openPopup}
          className="wx-hint absolute right-2 top-[calc(100%+10px)] origin-top-right max-sm:scale-[1.5] w-max max-w-[220px] rounded-2xl bg-white px-3.5 py-2.5 text-left text-[13px] font-bold leading-snug text-[oklch(0.25_0.03_160)] shadow-[0_10px_30px_oklch(0.15_0.03_200/.3)]"
        >
          <span className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 bg-white" aria-hidden />
          <span className="relative">👆 {t("Bấm xem dự báo 7 ngày & khả năng biển mây")}</span>
        </button>
      )}
      {open && <WeatherPopup onClose={() => setOpen(false)} />}
      <style>{BADGE_CSS}</style>
    </div>
  );
}

const SEEN_KEY = "tx_wx_seen";

const BADGE_CSS = `
.wx-ring{animation:wx-ring 2.2s ease-out 1s 6}
@keyframes wx-ring{0%{opacity:.9;transform:scale(.9)}100%{opacity:0;transform:scale(1.6)}}
.wx-ring{opacity:0}
.wx-hint{animation:wx-hint .45s cubic-bezier(.2,.8,.2,1) both, wx-nudge 1.6s ease-in-out .6s 4}
@keyframes wx-hint{from{opacity:0;transform:translateY(-6px) scale(.95)}to{opacity:1;transform:none}}
@keyframes wx-nudge{0%,100%{translate:0 0}50%{translate:0 -4px}}
.wx-badge{animation:wx-in .7s .1s cubic-bezier(.2,.8,.2,1) both}
@keyframes wx-in{from{opacity:0;transform:translateY(-8px) scale(.92)}to{opacity:1;transform:none}}
.wx-rays{transform-origin:24px 25px;animation:wx-spin 16s linear infinite}
.wx-sun{transform-origin:24px 25px;animation:wx-bob 2.6s ease-in-out infinite}
.wx-eye{transform-box:fill-box;transform-origin:center;animation:wx-blink 4.2s infinite}
.wx-pom{transform-box:fill-box;transform-origin:50% 0;animation:wx-swing 1.8s ease-in-out infinite}
.wx-pom2{animation-delay:-.9s}
.wx-cloud{animation:wx-drift 6s ease-in-out infinite alternate}
.wx-moon{transform-origin:24px 30px;animation:wx-rock 4.5s ease-in-out infinite}
.wx-bubble{transform-box:fill-box;transform-origin:20% 20%;animation:wx-bubble 3s ease-in-out infinite}
.wx-hatpom{transform-box:fill-box;transform-origin:50% 100%;animation:wx-squish 2.2s ease-in-out infinite}
.wx-z{opacity:0;animation:wx-z 3s ease-in infinite}
.wx-z2{animation-delay:1s}.wx-z3{animation-delay:2s}
.wx-star{animation:wx-tw 2.4s ease-in-out infinite}
.wx-ribbon{background:repeating-linear-gradient(90deg,#E63946 0 7px,#FFC93C 7px 9px,#1FA38A 9px 15px,#FFC93C 15px 17px,#7B2CBF 17px 23px,#FFC93C 23px 25px);}
@keyframes wx-spin{to{transform:rotate(360deg)}}
@keyframes wx-bob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-1.5px) rotate(3deg)}}
@keyframes wx-blink{0%,90%,100%{transform:scaleY(1)}94%{transform:scaleY(.12)}}
@keyframes wx-swing{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}
@keyframes wx-drift{from{transform:translateX(-2px)}to{transform:translateX(3px)}}
@keyframes wx-rock{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(4deg)}}
@keyframes wx-bubble{0%,100%{transform:scale(.35);opacity:.6}60%{transform:scale(1.05);opacity:.95}80%{transform:scale(1.12);opacity:0}}
@keyframes wx-squish{0%,100%{transform:scale(1,1)}50%{transform:scale(1.12,.88)}}
@keyframes wx-z{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translate(7px,-12px) scale(1.1)}}
@keyframes wx-tw{0%,100%{opacity:.25}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){.wx-badge,.wx-rays,.wx-sun,.wx-eye,.wx-pom,.wx-cloud,.wx-moon,.wx-bubble,.wx-hatpom,.wx-z,.wx-star,.wx-hint{animation:none!important;opacity:1}.wx-ring{animation:none!important;opacity:0}}
`;

/** Thổ cẩm H'Mông: đường răng cưa chạy dọc một dải cong / thẳng (tính sẵn các điểm). */
function zigzag(pt: (t: number) => [number, number], n: number, amp: number) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const [x, y] = pt(i / n);
    return `${x.toFixed(2)},${(y + (i % 2 ? -amp : amp)).toFixed(2)}`;
  }).join(" ");
}

// Băng đô thổ cẩm trên trán mặt trời: đường giữa dải = Bézier bậc 2 (11.8,22.75) → (24,15.5) → (36.2,22.75).
const SUN_BAND_ZZ = zigzag((t) => [11.8 + 24.4 * t, 22.75 - 14.5 * t + 14.5 * t * t], 12, 0.85);
// Vành mũ len thổ cẩm của mặt trăng: dải thẳng (7.2,20.2) → (23.3,12.4).
const HAT_BAND_ZZ = zigzag((t) => [7.2 + 16.1 * t, 20.2 - 7.8 * t], 10, 0.8);

/**
 * Mặt trời CHIBI TÂY BẮC: mặt tròn mắt to long lanh, má hồng, cười toe; đeo BĂNG ĐÔ THỔ CẨM H'Mông
 * (đỏ, răng cưa vàng, chấm xanh) hai bên lủng lẳng quả bông tua rua; tia nắng xoay chậm, cụm mây Tà Xùa trôi dưới cằm.
 */
export function HappySun() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full overflow-visible" aria-hidden>
      <defs>
        <radialGradient id="wxSunFace" cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor="#FFF6B0" />
          <stop offset=".55" stopColor="#FFD43B" />
          <stop offset="1" stopColor="#FF9F1C" />
        </radialGradient>
      </defs>
      {/* tia nắng: giọt nước to tròn, xen vàng / cam */}
      <g className="wx-rays">
        {Array.from({ length: 10 }, (_, i) => (
          <path
            key={i}
            d="M24 3.2c1.7 2.2 2.5 3.8 2.5 5a2.5 2.5 0 0 1-5 0c0-1.2.8-2.8 2.5-5z"
            fill={i % 2 ? "#FF8A00" : "#FFC21A"}
            transform={`rotate(${i * 36} 24 25)`}
          />
        ))}
      </g>
      <g className="wx-sun">
        <circle cx="24" cy="25" r="13.6" fill="url(#wxSunFace)" stroke="#E58A00" strokeWidth=".7" />
        {/* băng đô thổ cẩm */}
        <path d="M11.4 21.2Q24 13.4 36.6 21.2L36.1 24.6Q24 17.6 11.9 24.6Z" fill="#E63946" stroke="#9B1D2A" strokeWidth=".5" strokeLinejoin="round" />
        <polyline points={SUN_BAND_ZZ} fill="none" stroke="#FFD23F" strokeWidth=".95" strokeLinejoin="round" />
        {[0.2, 0.5, 0.8].map((t) => (
          <circle key={t} cx={11.8 + 24.4 * t} cy={22.75 - 14.5 * t + 14.5 * t * t} r=".55" fill="#1FA38A" />
        ))}
        {/* quả bông tua rua hai bên */}
        <g className="wx-pom">
          <path d="M11.8 23.6v3.4" stroke="#9B1D2A" strokeWidth=".6" />
          <circle cx="11.8" cy="28.2" r="1.9" fill="#FF4D8D" />
          <circle cx="11.3" cy="27.6" r=".5" fill="#fff" opacity=".7" />
        </g>
        <g className="wx-pom wx-pom2">
          <path d="M36.2 23.6v3.4" stroke="#9B1D2A" strokeWidth=".6" />
          <circle cx="36.2" cy="28.2" r="1.9" fill="#1FA38A" />
          <circle cx="35.7" cy="27.6" r=".5" fill="#fff" opacity=".7" />
        </g>
        {/* mắt to long lanh */}
        <g className="wx-eye">
          <ellipse cx="19.6" cy="27.6" rx="2.3" ry="2.75" fill="#2B1B17" />
          <circle cx="20.4" cy="26.6" r=".95" fill="#fff" />
          <circle cx="19" cy="28.8" r=".45" fill="#fff" />
        </g>
        <g className="wx-eye">
          <ellipse cx="28.4" cy="27.6" rx="2.3" ry="2.75" fill="#2B1B17" />
          <circle cx="29.2" cy="26.6" r=".95" fill="#fff" />
          <circle cx="27.8" cy="28.8" r=".45" fill="#fff" />
        </g>
        {/* má hồng + gạch e thẹn */}
        <ellipse cx="15.6" cy="31.3" rx="2.2" ry="1.3" fill="#FF5E7E" opacity=".55" />
        <ellipse cx="32.4" cy="31.3" rx="2.2" ry="1.3" fill="#FF5E7E" opacity=".55" />
        <path d="M14.6 31l.5-.8M16 31l.5-.8M31.4 31l.5-.8M32.8 31l.5-.8" stroke="#E0405F" strokeWidth=".45" strokeLinecap="round" />
        {/* miệng cười toe + lưỡi */}
        <path d="M21.4 31.2q2.6 3.9 5.2 0z" fill="#7A2E1E" />
        <path d="M22.7 32.9q1.3 1 2.6 0" fill="#FF7A8A" />
      </g>
      {/* mây Tà Xùa trôi dưới cằm */}
      <path
        className="wx-cloud"
        d="M3.5 42.5a3.6 3.6 0 0 1 4.3-4.6 5 5 0 0 1 9.3 1.2 3.2 3.2 0 0 1 .7 6.3H5.6a2.6 2.6 0 0 1-2.1-2.9z"
        fill="#fff"
        opacity=".95"
      />
    </svg>
  );
}

/**
 * Mặt trăng CHIBI TÂY BẮC đi ngủ: trăng khuyết đội MŨ LEN THỔ CẨM (chóp chàm, vành đỏ răng cưa vàng, quả bông hồng
 * nhún nhảy), mắt nhắm cong, má hồng, bong bóng mũi phồng xẹp kiểu anime, ôm gối mây; zzz bay lên, sao lấp lánh.
 */
export function SleepyMoon() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full overflow-visible" aria-hidden>
      <defs>
        <radialGradient id="wxMoonFace" cx="30%" cy="60%" r="80%">
          <stop offset="0" stopColor="#FFF8D6" />
          <stop offset=".6" stopColor="#FFE38A" />
          <stop offset="1" stopColor="#F6C445" />
        </radialGradient>
        <mask id="wxMoonCut">
          <rect width="48" height="48" fill="#fff" />
          <circle cx="31" cy="20" r="12" fill="#000" />
        </mask>
      </defs>
      <circle className="wx-star" cx="40" cy="30" r="1.1" fill="#FFF6C8" />
      <circle className="wx-star" cx="4" cy="12" r="1" fill="#FFF6C8" style={{ animationDelay: ".8s" }} />
      <path className="wx-star" d="M44 22l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="#FFE38A" style={{ animationDelay: "1.4s" }} />
      <g className="wx-moon">
        {/* trăng khuyết = hình tròn bị khoét */}
        <circle cx="22" cy="27" r="15" fill="url(#wxMoonFace)" mask="url(#wxMoonCut)" />
        {/* mắt nhắm cong + lông mi */}
        <g stroke="#7A4B00" strokeWidth="1.3" strokeLinecap="round" fill="none">
          <path d="M10.4 26.4q1.6 1.8 3.2 0" />
          <path d="M16.9 30.4q1.6 1.8 3.2 0" />
          <path d="M10.2 26.2l-.8-.5M19.9 30.2l.8-.5" strokeWidth=".7" />
        </g>
        {/* má hồng */}
        <ellipse cx="9.8" cy="30.2" rx="1.8" ry="1.1" fill="#FF7E9A" opacity=".55" />
        <ellipse cx="21.2" cy="34.4" rx="1.8" ry="1.1" fill="#FF7E9A" opacity=".55" />
        {/* miệng chu ngủ say */}
        <ellipse cx="14.6" cy="33.4" rx=".9" ry="1.1" fill="#8A4B12" />
        {/* bong bóng mũi */}
        <circle className="wx-bubble" cx="10.6" cy="35.6" r="2.6" fill="#E6F4FF" fillOpacity=".55" stroke="#BFE3FF" strokeWidth=".6" />
        {/* mũ len thổ cẩm: chóp chàm có sọc, vành đỏ răng cưa vàng */}
        <path d="M6.6 19.4Q4.6 9.6 12.6 6.6Q20 4.2 23 11.6Z" fill="#3D348B" stroke="#241E5C" strokeWidth=".5" strokeLinejoin="round" />
        <path d="M9 13.6l9.6-4.4M8.4 16.6l12.4-5.6" stroke="#6C63D9" strokeWidth=".7" strokeLinecap="round" />
        <path d="M6.2 18.4L22.6 10.6L24.1 14.2L7.8 22Z" fill="#E63946" stroke="#9B1D2A" strokeWidth=".5" strokeLinejoin="round" />
        <polyline points={HAT_BAND_ZZ} fill="none" stroke="#FFD23F" strokeWidth=".9" strokeLinejoin="round" />
        {/* tua rua bên vành */}
        <g className="wx-pom">
          <path d="M23.6 13.4l2 3.2" stroke="#9B1D2A" strokeWidth=".6" />
          <circle cx="26.2" cy="17.6" r="1.5" fill="#FFC21A" />
        </g>
        {/* quả bông trên chóp */}
        <g className="wx-hatpom">
          <circle cx="12.4" cy="5.4" r="3" fill="#FF4D8D" />
          <circle cx="11.4" cy="4.4" r=".8" fill="#fff" opacity=".7" />
          <circle cx="13.6" cy="6.2" r=".5" fill="#FFC21A" />
        </g>
      </g>
      {/* gối mây */}
      <path d="M12 44.6a3.4 3.4 0 0 1 3.2-4.4 5.2 5.2 0 0 1 9.8-.6 4.4 4.4 0 0 1 7.6 2.2 2.6 2.6 0 0 1-.4 5.2H14.4a2.6 2.6 0 0 1-2.4-2.4z" fill="#fff" opacity=".92" />
      <text className="wx-z" x="33" y="13" fontSize="7" fontWeight="900" fill="#fff">z</text>
      <text className="wx-z wx-z2" x="37" y="8.5" fontSize="8.5" fontWeight="900" fill="#fff">z</text>
      <text className="wx-z wx-z3" x="41" y="4" fontSize="10" fontWeight="900" fill="#FFE38A">Z</text>
    </svg>
  );
}
