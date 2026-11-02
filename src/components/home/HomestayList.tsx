"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DateField } from "@/components/DateField";

/**
 * Mỗi thẻ = một LOẠI phòng cụ thể: các phòng giống hệt nhau (cùng hạng + giá +
 * ảnh) được gom thành 1 thẻ (count = số phòng). id = roomId phòng đại diện;
 * slug vẫn là slug homestay để link chi tiết.
 */
export interface HomestayCard {
  id: string;
  slug: string;
  name: string; // tên phòng (hạng · phòng; nhóm nhiều phòng = tên hạng)
  homeName: string; // tên homestay
  area: string;
  distanceKm: number | null; // cách trung tâm Tà Xùa (km); null = chưa nhập
  desc: string;
  capacity: number;
  count: number; // số phòng giống nhau trong nhóm
  price: number;
  priceOld: number | null; // giá niêm yết gạch ngang khi đang giảm giá
  cover: string | null;
  featured: boolean;
  cat: string; // "Homestay" | "Bungalow"
  status: "ok" | "low" | "full" | "none";
  freeRooms: number;
}

const STATUS: Record<HomestayCard["status"], { bg: string; fg: string; text: (n: number) => string }> = {
  ok: { bg: "oklch(0.95 0.05 155)", fg: "oklch(0.38 0.1 155)", text: (n) => `Còn ${n} phòng` },
  low: { bg: "oklch(0.95 0.06 70)", fg: "oklch(0.48 0.15 50)", text: (n) => `Còn ${n} phòng` },
  full: { bg: "oklch(0.93 0 0)", fg: "oklch(0.42 0 0)", text: () => "Hết phòng" },
  none: { bg: "oklch(1 0 0 / .92)", fg: "oklch(0.4 0.02 160)", text: () => "Chọn ngày để xem" },
};

// Theme "Rừng núi Tây Bắc"
const TH = {
  sky: "linear-gradient(180deg, oklch(0.34 0.045 240) 0%, oklch(0.55 0.04 220) 36%, oklch(0.8 0.05 120) 66%, oklch(0.9 0.06 95) 86%, oklch(0.95 0.03 95) 100%)",
  r1: "linear-gradient(180deg, oklch(0.45 0.04 200), oklch(0.52 0.04 190))",
  r2: "linear-gradient(180deg, oklch(0.3 0.045 170), oklch(0.36 0.05 160))",
  cloud: ["oklch(0.92 0.01 220 / .75)", "oklch(0.95 0.008 210 / .88)", "oklch(0.97 0.012 85)"],
  blur: ["20px", "26px", "30px"],
  page: "oklch(0.975 0.01 150)",
  mote: "oklch(0.98 0.05 95)",
  G: "oklch(0.29 0.055 160)",
};

function vnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}
function rnd(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
// Làm tròn 2 chữ số cho giá trị CSS — số thập phân dài bị CSSOM rút gọn khi đọc lại,
// gây cảnh báo hydration mismatch (React dev) và re-render xoá hiệu ứng reveal.
const r2 = (v: number) => Math.round(v * 100) / 100;

export function HomestayList({
  items: all,
  initialFrom = "",
  initialTo = "",
  initialQ = "",
}: {
  items: HomestayCard[];
  initialFrom?: string;
  initialTo?: string;
  initialQ?: string;
}) {
  const router = useRouter();
  const [w, setW] = useState(1280);
  const [q, setQ] = useState(initialQ);
  const [ci, setCi] = useState(initialFrom); // nhận phòng = from
  const [co, setCo] = useState(initialTo); // trả phòng = to
  const [price, setPrice] = useState("all");
  const [type, setType] = useState("all");
  const [zone, setZone] = useState("all"); // lọc theo khu vực (Trung tâm, Khe Cải, Đỉnh Gió...)
  const [sort, setSort] = useState("rec"); // rec | priceAsc | priceDesc | near

  const sunRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const ridgeBackRef = useRef<HTMLDivElement>(null);
  const ridgeFrontRef = useRef<HTMLDivElement>(null);
  const layerEls = useRef<(HTMLDivElement | null)[]>([]);
  const starEls = useRef<(HTMLSpanElement | null)[]>([]);
  const birdEls = useRef<(HTMLDivElement | null)[]>([]);
  const moteEls = useRef<(HTMLSpanElement | null)[]>([]);
  const houseRef = useRef<HTMLDivElement>(null);
  const doorRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const win2Ref = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const dadRef = useRef<HTMLDivElement>(null);
  const momRef = useRef<HTMLDivElement>(null);
  const kidRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    onR();
    window.addEventListener("resize", onR);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // reveal cards + hero text
    const io =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (es) =>
              es.forEach((e) => {
                if (e.isIntersecting) {
                  (e.target as HTMLElement).style.opacity = "1";
                  (e.target as HTMLElement).style.transform = "none";
                  io!.unobserve(e.target);
                }
              }),
            { threshold: 0.12 },
          )
        : null;
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => (io && !reduce ? io.observe(el) : ((el.style.opacity = "1"), (el.style.transform = "none"))));
    document.querySelectorAll<HTMLElement>("[data-in]").forEach((el) => {
      const k = Number(el.dataset.in);
      setTimeout(() => { el.style.opacity = "1"; el.style.transform = "none"; }, reduce ? 0 : 250 + k * 160);
    });

    const t0 = performance.now();
    const SP = [0.35, 0.7, 1.25];
    let raf = 0;
    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      const sy = window.scrollY || 0;
      const rise = reduce ? 1 : Math.min(1, t / 5);
      const e = 1 - Math.pow(1 - rise, 3);
      const hero = sunRef.current?.parentElement;
      const H = hero?.offsetHeight ?? 560;
      const W = hero?.offsetWidth ?? 1200;
      if (sunRef.current) sunRef.current.style.transform = `translateY(${H * (0.62 - 0.34 * e) + sy * 0.35}px) scale(${1 + Math.sin(t * 1.2) * 0.02})`;
      if (glowRef.current) glowRef.current.style.opacity = String(0.35 + 0.65 * e);
      starEls.current.forEach((el, i) => { if (el) el.style.opacity = String(Math.max(0, (1 - e) * 0.8 + 0.12 * Math.sin(t * 2 + i))); });
      if (heroTextRef.current) { heroTextRef.current.style.transform = `translateY(${sy * 0.25}px)`; heroTextRef.current.style.opacity = String(Math.max(0, 1 - sy / 420)); }
      layerEls.current.forEach((el, i) => { if (!el) return; const x = reduce ? 0 : (t * SP[i]) % 50; el.style.transform = `translate3d(${-x}%, ${-sy * (0.04 + i * 0.03) + Math.sin(t * 0.5 + i) * 4}px, 0)`; });
      if (ridgeBackRef.current) ridgeBackRef.current.style.transform = `translateY(${sy * 0.18}px)`;
      if (ridgeFrontRef.current) ridgeFrontRef.current.style.transform = `translateY(${sy * 0.1}px)`;
      if (!reduce) {
        birdEls.current.forEach((el, i) => {
          if (!el) return;
          const sp = 0.035 + i * 0.006;
          const f = ((t * sp + i * 0.23) % 1.3) - 0.15;
          const x = f * W;
          const y = H * (0.16 + (i % 3) * 0.07) + Math.sin(t * 0.8 + i * 2) * 14 - sy * 0.2;
          el.style.transform = `translate(${x}px, ${y}px)`;
          const a = Math.sin(t * (7 + i) + i) * 30;
          const l = el.querySelector<HTMLElement>("[data-wl]");
          const r = el.querySelector<HTMLElement>("[data-wr]");
          if (l) l.style.transform = `rotate(${a}deg)`;
          if (r) r.style.transform = `rotate(${-a}deg)`;
        });
        moteEls.current.forEach((el, i) => {
          if (!el) return;
          const sp = 14 + (i % 5) * 6;
          const span = H * 0.7;
          const pr = ((t * sp + i * 97) % span) / span;
          const x = ((i * 0.137) % 1) * W + Math.sin(t * 0.7 + i) * 24;
          const y = H * 0.92 - pr * span;
          el.style.transform = `translate(${x}px, ${y}px)`;
          el.style.opacity = String(Math.sin(pr * Math.PI) * 0.75);
        });
        // Nhà homestay + chủ nhà đón gia đình khách vào ở
        if (houseRef.current) {
          const P = 14, kk = t % P;
          const cl = (v: number) => Math.max(0, Math.min(1, v));
          const seg = (a: number, b: number) => cl((kk - a) / (b - a));
          const eo = (v: number) => 1 - Math.pow(1 - v, 3);
          const lr = (a: number, b: number, v: number) => a + (b - a) * v;
          const lift = -sy * 0.12;
          const Xh = Math.max(150, W * (W < 640 ? 0.52 : 0.6)), Dx = Xh + 51;
          houseRef.current.style.transform = `translate(${Xh}px, ${lift}px)`;
          const open = Math.max(seg(4.5, 5.0) - seg(8.2, 8.6), seg(10.8, 11.1) - seg(11.8, 12.2));
          if (doorRef.current) doorRef.current.style.transform = `perspective(120px) rotateY(${-75 * open}deg)`;
          const lit = seg(8.3, 9.0) - seg(12.6, 13.4);
          const wl = lit > 0 ? `oklch(${0.32 + lit * 0.56} ${0.03 + lit * 0.12} ${230 - lit * 150})` : "oklch(0.32 0.03 230)";
          const gl = `0 0 ${lit * 16}px ${lit * 4}px oklch(0.9 0.15 85 / ${lit * 0.7})`;
          [winRef.current, win2Ref.current].forEach((el) => { if (el) { el.style.background = wl; el.style.boxShadow = gl; } });
          const pose = (el: HTMLDivElement | null, x: number, y: number, f: number, mode: string, ph: number, sc: number) => {
            if (!el) return;
            const run = mode === "run";
            const sw = run ? Math.sin(t * 18 + ph) * 34 : mode === "walk" ? Math.sin(t * 12 + ph) * 24 : 0;
            const bob = run ? -Math.abs(Math.sin(t * 18 + ph)) * 2.5 : 0;
            el.style.transform = `translate(${x}px, ${y + bob + lift}px) scale(${f * sc}, ${sc})`;
            const l = el.querySelectorAll<HTMLElement>("[data-leg]");
            if (l[0]) l[0].style.transform = `rotate(${sw}deg)`;
            if (l[1]) l[1].style.transform = `rotate(${-sw}deg)`;
          };
          const arm = (el: HTMLDivElement | null, d: number) => { const a = el && el.querySelector<HTMLElement>("[data-arm]"); if (a) a.style.transform = `rotate(${d}deg)`; };
          const shake = kk > 3.3 && kk < 4.3, shk = Math.sin(t * 16) * 9;
          const H0 = hostRef.current;
          if (H0) {
            let x = Xh - 30, f = -1, mode = "stand", op = 1, sc = 1;
            if (kk >= 4.4 && kk < 5.0) f = 1;
            else if (kk >= 5.0 && kk < 6.4) { const wv = seg(5.0, 6.0); x = lr(Xh - 30, Dx, wv); f = 1; mode = wv < 1 ? "walk" : "stand"; const fd = seg(6.0, 6.4); op = 1 - fd; sc = 1 - fd * 0.15; }
            else if (kk >= 6.4 && kk < 11.0) op = 0;
            else if (kk >= 11.0) { const v = seg(11.0, 11.4), wv = seg(11.4, 12.6); op = v; x = lr(Dx, Xh - 30, wv); mode = wv > 0 && wv < 1 ? "walk" : "stand"; }
            H0.style.opacity = String(op);
            pose(H0, x, 0, f, mode, 0, sc);
            arm(H0, shake ? -78 + shk : kk > 1.4 && kk < 3.2 ? -150 + Math.sin(t * 10) * 22 : kk >= 4.4 && kk < 5.0 ? -95 : mode === "walk" ? Math.sin(t * 12) * 18 : 0);
          }
          const fam: [HTMLDivElement | null, number, number, number, number][] = [
            [dadRef.current, Xh - 58, 0.6, 5.3, 1],
            [momRef.current, Xh - 84, 0.8, 5.65, 1],
            [kidRef.current, Xh - 104, 0.7, 6.0, 0.72],
          ];
          fam.forEach(([el, stop, s0, w0, sc], i) => {
            if (!el) return;
            const r = seg(s0, s0 + 2.5), wt = (Dx - stop) / 80, wv = seg(w0, w0 + wt), fd = seg(w0 + wt, w0 + wt + 0.4);
            const x = kk < w0 ? lr(-80 - i * 30, stop, eo(r)) : lr(stop, Dx, wv);
            const mode = kk < w0 ? (r > 0 && r < 0.96 ? "run" : "stand") : (wv < 1 ? "walk" : "stand");
            const hop = i === 2 && kk > 3.2 && kk < 4.6 ? -Math.abs(Math.sin(t * 9)) * 7 : 0;
            el.style.opacity = String(kk < w0 + wt + 0.4 ? 1 - fd : 0);
            pose(el, x, hop, 1, mode, i * 1.3, sc * (1 - fd * 0.15));
            arm(el, i === 0 && shake ? -78 - shk : i === 2 && kk > 3.2 && kk < 4.6 ? -150 + Math.sin(t * 9) * 25 : mode === "run" ? Math.sin(t * 18 + i * 1.3) * 40 : mode === "walk" ? Math.sin(t * 12 + i) * 18 : 0);
          });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener("resize", onR); cancelAnimationFrame(raf); io?.disconnect(); };
  }, []);

  // Đổi bộ lọc → thẻ bị loại rồi quay lại sẽ bị React mount lại với class
  // opacity-0 mà IntersectionObserver (chỉ gắn lúc mount đầu) không còn theo dõi
  // → thẻ trong suốt vĩnh viễn, nhìn như "lọc xong không hiện gì". Sau mỗi lần
  // đổi lọc: hiện ngay mọi thẻ (hiệu ứng reveal chỉ dành cho lần tải đầu).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  }, [q, ci, co, price, type, zone, sort]);

  // Mở trang với sẵn ngày (từ trang chủ) → cuộn xuống danh sách để thấy kết quả
  // ngay trên mobile. Không chạy khi đang gõ lọc trực tiếp.
  useEffect(() => {
    if (!(initialFrom && initialTo)) return;
    const el = listRef.current;
    if (!el) return;
    const id = window.setTimeout(() => {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: "smooth" });
    }, 120);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- clouds / stars ----
  const layers = useMemo(() => {
    const LAY = [
      { bottom: "30%", h: "22%", op: 0.55, n: 8, wMin: 18, wMax: 30, hh: [40, 70], blur: TH.blur[0], bg: TH.cloud[0] },
      { bottom: "12%", h: "26%", op: 0.8, n: 9, wMin: 22, wMax: 36, hh: [60, 100], blur: TH.blur[1], bg: TH.cloud[1] },
      { bottom: "-4%", h: "30%", op: 1, n: 10, wMin: 26, wMax: 40, hh: [90, 150], blur: TH.blur[2], bg: TH.cloud[2] },
    ];
    return LAY.map((L, li) => {
      const half = Array.from({ length: L.n }, (_, i) => ({
        x: (i / L.n) * 50 + rnd(i, li) * 3,
        y: rnd(i, li + 5) * 30,
        w: L.wMin + rnd(i, li + 9) * (L.wMax - L.wMin),
        h: L.hh[0] + rnd(i, li + 13) * (L.hh[1] - L.hh[0]),
      }));
      const clouds = half.concat(half.map((c) => ({ ...c, x: c.x + 50 }))).map((c) => ({
        x: `${r2(c.x - 6)}%`, y: `${r2(c.y)}%`, w: `${r2(c.w / 2)}%`, h: `${Math.round(c.h)}px`, bg: L.bg, blur: L.blur,
      }));
      return { bottom: L.bottom, h: L.h, op: L.op, clouds };
    });
  }, []);
  const stars = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: `${r2(rnd(i, 21) * 100)}%`, y: `${r2(rnd(i, 22) * 34)}%`, s: `${r2(1.5 + rnd(i, 23) * 2)}px` })), []);

  // ---- filtering ----
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const dateErr = ci && co && co <= ci ? "Ngày trả phòng phải sau ngày nhận phòng." : "";
  const hasDates = Boolean(ci && co && !dateErr);
  const nights = hasDates ? Math.max(1, Math.round((+new Date(co) - +new Date(ci)) / 864e5)) : 0;
  const qn = norm(q.trim());
  const inPrice = (p: number) =>
    price === "all" ||
    (p > 0 &&
      ((price === "lt500" && p < 500000) ||
        (price === "mid" && p >= 500000 && p <= 900000) ||
        (price === "gt900" && p > 900000) ||
        (price === "lt1500" && p < 1500000) ||
        (price === "gt1500" && p > 1500000)));
  // Khu vực có trong dữ liệu (để dựng dãy chip lọc).
  const zones = useMemo(() => [...new Set(all.map((x) => x.area).filter(Boolean))], [all]);
  // Khoảng cách tới trung tâm để sắp "gần trung tâm": thiếu số km nhưng khu vực là
  // "Trung tâm..." thì coi như 0; thiếu hẳn thì xếp cuối.
  const distOf = (x: HomestayCard) => x.distanceKm ?? (norm(x.area).includes("trung tam") ? 0 : Number.POSITIVE_INFINITY);
  const items = all
    .filter((x) => (type === "all" || x.cat === type) && (zone === "all" || x.area === zone) && inPrice(x.price) && (!qn || norm(`${x.name} ${x.homeName} ${x.area}`).includes(qn)))
    // Sắp theo tiêu chí đã chọn (sort ổn định — "rec" giữ thứ tự nổi bật từ server).
    .sort((a, b) => {
      if (sort === "priceAsc") return (a.price > 0 ? a.price : Infinity) - (b.price > 0 ? b.price : Infinity);
      if (sort === "priceDesc") return b.price - a.price;
      if (sort === "near") return distOf(a) - distOf(b);
      return 0;
    })
    // Có ngày → đẩy phòng đã kín xuống cuối (sort ổn định, giữ thứ tự nổi bật).
    .sort((a, b) => (a.status === "full" ? 1 : 0) - (b.status === "full" ? 1 : 0));
  const hasFilter = Boolean(q || ci || co || price !== "all" || type !== "all" || zone !== "all" || sort !== "rec");
  const wide = w >= 980;
  const heroH = w < 640 ? 500 : 560;
  const dateQS = (() => { const p = new URLSearchParams(); if (hasDates) { p.set("from", ci); p.set("to", co); } const s = p.toString(); return s ? `?${s}` : ""; })();

  // Đổi ngày → cập nhật URL để server tính lại tình trạng còn phòng theo kỳ.
  function syncDates(nci: string, nco: string) {
    const p = new URLSearchParams();
    if (nci) p.set("from", nci);
    if (nco && nco > nci) p.set("to", nco);
    if (q) p.set("q", q);
    router.replace(`/homestay${p.toString() ? `?${p}` : ""}`, { scroll: false });
    router.refresh(); // ép lấy dữ liệu mới, tránh client router cache trả kết quả cũ
  }

  const cell = "flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-[oklch(0.965_0.01_230)] px-3.5 py-2.5";
  const inp = "min-w-0 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink outline-none";

  return (
    <div style={{ background: TH.page }}>
      {/* HERO */}
      <section className="relative overflow-hidden" style={{ height: heroH, background: TH.sky }}>
        <div ref={sunRef} className="absolute left-[74%] top-0 -ml-[75px] h-[150px] w-[150px] rounded-full will-change-transform" style={{ background: "radial-gradient(circle, oklch(0.98 0.07 90) 0%, oklch(0.93 0.13 75) 45%, oklch(0.85 0.15 60 / 0) 72%)" }} />
        <div ref={glowRef} className="pointer-events-none absolute left-0 right-0 top-[30%] h-[60%]" style={{ background: "radial-gradient(ellipse 60% 50% at 74% 60%, oklch(0.92 0.12 70 / .55), transparent 70%)" }} />
        <div className="pointer-events-none absolute inset-0">
          {stars.map((st, i) => (
            <span key={i} ref={(el) => { starEls.current[i] = el; }} className="absolute rounded-full bg-white opacity-70" style={{ left: st.x, top: st.y, width: st.s, height: st.s }} />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} ref={(el) => { birdEls.current[i] = el; }} className="pointer-events-none absolute left-0 top-0 z-[2] h-[10px] will-change-transform" style={{ width: `${14 + (i % 3) * 5}px` }}>
            <span data-wl="1" className="absolute right-1/2 top-1 h-[2px] w-[52%] rounded-[2px]" style={{ background: "oklch(0.26 0.04 200)", transformOrigin: "right center" }} />
            <span data-wr="1" className="absolute left-1/2 top-1 h-[2px] w-[52%] rounded-[2px]" style={{ background: "oklch(0.26 0.04 200)", transformOrigin: "left center" }} />
          </div>
        ))}
        <div ref={ridgeBackRef} className="absolute -left-[5%] -right-[5%] bottom-[22%] h-[38%] opacity-75 will-change-transform" style={{ background: TH.r1, clipPath: "polygon(0 100%,0 62%,9% 48%,17% 58%,27% 30%,36% 50%,44% 40%,55% 12%,63% 38%,72% 28%,82% 52%,91% 36%,100% 50%,100% 100%)" }} />
        <div ref={ridgeFrontRef} className="absolute -left-[5%] -right-[5%] bottom-[12%] h-[34%] will-change-transform" style={{ background: TH.r2, clipPath: "polygon(0 100%,0 55%,8% 62%,18% 40%,24% 52%,33% 22%,40% 44%,50% 34%,58% 56%,68% 26%,76% 46%,86% 30%,94% 54%,100% 44%,100% 100%)" }} />
        {/* pine silhouette */}
        <div className="pointer-events-none absolute -left-[5%] -right-[5%] bottom-[14%] h-[96px]" style={{ WebkitMaskImage: "linear-gradient(180deg, black 45%, transparent 92%)", maskImage: "linear-gradient(180deg, black 45%, transparent 92%)" }}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(-45deg, oklch(0.27 0.05 165) 50%, transparent 50%) 0px 100% / 29px 86px repeat-x, linear-gradient(45deg, oklch(0.27 0.05 165) 50%, transparent 50%) 0px 100% / 29px 86px repeat-x" }} />
        </div>
        {layers.map((L, li) => (
          <div key={li} className="pointer-events-none absolute left-0 right-0" style={{ bottom: L.bottom, height: L.h, opacity: L.op }}>
            <div ref={(el) => { layerEls.current[li] = el; }} className="absolute bottom-0 left-0 top-0 w-[200%] will-change-transform">
              {L.clouds.map((c, i) => (
                <span key={i} className="absolute rounded-full" style={{ left: c.x, bottom: c.y, width: c.w, height: c.h, background: c.bg, filter: `blur(${c.blur})` }} />
              ))}
            </div>
          </div>
        ))}
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} ref={(el) => { moteEls.current[i] = el; }} className="pointer-events-none absolute left-0 top-0 z-[2] rounded-full opacity-0 will-change-transform" style={{ width: `${2 + (i % 4)}px`, height: `${2 + (i % 4)}px`, background: TH.mote, boxShadow: `0 0 8px ${TH.mote}` }} />
        ))}
        {/* Nhà homestay */}
        <div ref={houseRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[2] h-[96px] w-[130px] will-change-transform">
          <div className="absolute left-0 top-0 h-[38px] w-[130px]" style={{ background: "oklch(0.36 0.06 45)", clipPath: "polygon(4% 100%, 50% 0, 96% 100%)" }} />
          <div className="absolute left-3 top-9 h-[60px] w-[106px]" style={{ background: "oklch(0.6 0.08 60)" }} />
          <div className="absolute left-3 top-9 h-[60px] w-[106px]" style={{ background: "repeating-linear-gradient(90deg, transparent 0 9px, oklch(0.5 0.07 55 / .5) 9px 10px)" }} />
          <div className="absolute left-[34px] top-10 h-[11px] w-[62px] rounded-[2px] text-center" style={{ background: "oklch(0.3 0.05 45)", color: "oklch(0.95 0.03 90)", fontSize: "6.5px", fontWeight: 900, lineHeight: "11px", letterSpacing: ".8px" }}>HOMESTAY</div>
          <div ref={winRef} className="absolute left-5 top-14 h-4 w-5 rounded-[2px]" style={{ border: "2px solid oklch(0.35 0.05 45)", background: "oklch(0.32 0.03 230)" }} />
          <div ref={win2Ref} className="absolute left-[88px] top-14 h-4 w-5 rounded-[2px]" style={{ border: "2px solid oklch(0.35 0.05 45)", background: "oklch(0.32 0.03 230)" }} />
          <div className="absolute left-[50px] top-[58px] h-[38px] w-6" style={{ borderRadius: "3px 3px 0 0", background: "oklch(0.85 0.12 80)", boxShadow: "inset 0 0 10px oklch(0.6 0.14 60)" }} />
          <div ref={doorRef} className="absolute left-[50px] top-[58px] h-[38px] w-6 will-change-transform" style={{ borderRadius: "3px 3px 0 0", background: "oklch(0.42 0.07 45)", border: "2px solid oklch(0.32 0.05 45)", transformOrigin: "left center" }}>
            <div className="absolute right-[3px] top-[18px] h-[3px] w-[3px] rounded-full" style={{ background: "oklch(0.85 0.12 85)" }} />
          </div>
          <div className="absolute left-[6px] top-[93px] h-[3px] w-[118px]" style={{ background: "oklch(0.3 0.04 45)" }} />
        </div>
        {/* Chủ nhà */}
        <div ref={hostRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-[46px] w-[22px] will-change-transform" style={{ transformOrigin: "50% 100%" }}>
          <div className="absolute left-[5px] top-6 h-[3px] w-3" style={{ background: "oklch(0.6 0.18 28)" }} />
          <div data-leg="1" className="absolute left-[6px] top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div data-leg="2" className="absolute left-3 top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div className="absolute left-[5px] top-[11px] h-[19px] w-3" style={{ borderRadius: "5px 5px 2px 2px", background: "oklch(0.33 0.08 270)" }} />
          <div className="absolute left-[6px] top-1 h-[10px] w-[10px] rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
          <div className="absolute left-[5px] top-[-1px] h-[5px] w-3" style={{ borderRadius: "5px 5px 1px 1px", background: "oklch(0.3 0.07 270)" }} />
          <div className="absolute left-1 top-[3px] h-[2px] w-[14px]" style={{ background: "oklch(0.6 0.18 28)" }} />
          <div data-arm="1" className="absolute left-3 top-3 h-[14px] w-1 rounded-[2px]" style={{ background: "oklch(0.33 0.08 270)", transformOrigin: "2px 2px" }}>
            <div className="absolute left-0 h-1 w-1 rounded-full" style={{ bottom: "-3px", background: "oklch(0.76 0.07 55)" }} />
          </div>
        </div>
        {/* Bố */}
        <div ref={dadRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-[46px] w-[22px] will-change-transform" style={{ transformOrigin: "50% 100%" }}>
          <div className="absolute left-0 top-3 h-[14px] w-[7px] rounded-[3px]" style={{ background: "oklch(0.5 0.1 50)" }} />
          <div data-leg="1" className="absolute left-[6px] top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div data-leg="2" className="absolute left-3 top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div className="absolute left-[5px] top-[11px] h-[19px] w-3" style={{ borderRadius: "5px 5px 2px 2px", background: "oklch(0.55 0.12 155)" }} />
          <div className="absolute left-[6px] top-1 h-[10px] w-[10px] rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
          <div className="absolute left-[5px] top-[-1px] h-[5px] w-[11px]" style={{ borderRadius: "6px 6px 1px 1px", background: "oklch(0.68 0.18 45)" }} />
          <div className="absolute left-[14px] top-[2px] h-[2px] w-[5px] rounded-[1px]" style={{ background: "oklch(0.68 0.18 45)" }} />
          <div data-arm="1" className="absolute left-3 top-3 h-[14px] w-1 rounded-[2px]" style={{ background: "oklch(0.55 0.12 155)", transformOrigin: "2px 2px" }}>
            <div className="absolute left-0 h-1 w-1 rounded-full" style={{ bottom: "-3px", background: "oklch(0.76 0.07 55)" }} />
          </div>
        </div>
        {/* Mẹ */}
        <div ref={momRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-[46px] w-[22px] will-change-transform" style={{ transformOrigin: "50% 100%" }}>
          <div data-leg="1" className="absolute left-[6px] top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.94 0.01 90)", transformOrigin: "top center" }} />
          <div data-leg="2" className="absolute left-3 top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.94 0.01 90)", transformOrigin: "top center" }} />
          <div className="absolute left-[5px] top-[11px] h-[19px] w-3" style={{ borderRadius: "5px 5px 2px 2px", background: "oklch(0.68 0.13 10)" }} />
          <div className="absolute left-[6px] top-1 h-[10px] w-[10px] rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
          <div className="absolute left-[3px] top-0 h-4 w-2" style={{ borderRadius: "5px 2px 4px 4px", background: "oklch(0.22 0.02 50)" }} />
          <div className="absolute left-[2px] top-[-2px] h-1 w-[18px] rounded-full" style={{ background: "oklch(0.88 0.07 90)" }} />
          <div data-arm="1" className="absolute left-3 top-3 h-[14px] w-1 rounded-[2px]" style={{ background: "oklch(0.68 0.13 10)", transformOrigin: "2px 2px" }}>
            <div className="absolute left-0 h-1 w-1 rounded-full" style={{ bottom: "-3px", background: "oklch(0.76 0.07 55)" }} />
          </div>
        </div>
        {/* Bé */}
        <div ref={kidRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-[46px] w-[22px] will-change-transform" style={{ transformOrigin: "50% 100%" }}>
          <div data-leg="1" className="absolute left-[6px] top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.55 0.1 250)", transformOrigin: "top center" }} />
          <div data-leg="2" className="absolute left-3 top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.55 0.1 250)", transformOrigin: "top center" }} />
          <div className="absolute left-[5px] top-[11px] h-[19px] w-3" style={{ borderRadius: "5px 5px 2px 2px", background: "oklch(0.85 0.15 95)" }} />
          <div className="absolute left-[6px] top-1 h-[10px] w-[10px] rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
          <div className="absolute left-[5px] top-[-1px] h-[6px] w-3" style={{ borderRadius: "6px 6px 1px 1px", background: "oklch(0.4 0.03 50)" }} />
          <div data-arm="1" className="absolute left-3 top-3 h-[14px] w-1 rounded-[2px]" style={{ background: "oklch(0.85 0.15 95)", transformOrigin: "2px 2px" }}>
            <div className="absolute left-0 h-1 w-1 rounded-full" style={{ bottom: "-3px", background: "oklch(0.76 0.07 55)" }} />
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[90px]" style={{ background: `linear-gradient(180deg, transparent, ${TH.page})` }} />

        <div ref={heroTextRef} className="container-page relative z-[3] text-white will-change-transform" style={{ paddingTop: w < 640 ? 48 : 72 }}>
          <div data-in="0" className="flex gap-2 text-sm opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease, transform .9s cubic-bezier(.2,.7,.2,1)", color: "oklch(0.9 0.02 220)" }}>
            <span>Trang chủ</span><span>/</span><span className="font-bold text-white">Homestay</span>
          </div>
          <div data-in="1" className="mt-4 text-[13px] font-bold uppercase tracking-[0.14em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .1s, transform .9s cubic-bezier(.2,.7,.2,1) .1s", color: "oklch(0.88 0.12 80)" }}>Tà Xùa · 2.865m · Bắc Yên, Sơn La</div>
          <h1 data-in="2" className="mt-3.5 max-w-[760px] text-[clamp(32px,6vw,60px)] font-extrabold leading-[1.02] tracking-[-0.035em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .2s, transform .9s cubic-bezier(.2,.7,.2,1) .2s", textShadow: "0 2px 24px oklch(0.2 0.05 260 / .4)" }}>Giữa rừng Tây Bắc, thức dậy trên biển mây</h1>
          <p data-in="3" className="mt-3.5 max-w-[520px] text-[clamp(15px,1.7vw,18px)] leading-[1.5] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .3s, transform .9s cubic-bezier(.2,.7,.2,1) .3s", color: "oklch(0.97 0.02 80)" }}>Homestay và bungalow giữa núi rừng Tà Xùa, sát điểm săn mây. Chọn ngày để xem phòng trống và giá đêm đó.</p>
        </div>
      </section>

      {/* SEARCH */}
      <div data-in="4" className="container-page relative z-[4] -mt-[70px] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .4s, transform .9s cubic-bezier(.2,.7,.2,1) .4s" }}>
        <div className="flex flex-col gap-2 rounded-[22px] border border-white/80 p-2.5 shadow-[0_24px_60px_-24px_oklch(0.3_0.08_270_/.45)]" style={{ background: "oklch(1 0 0 / .9)", backdropFilter: "blur(14px)" }}>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))" }}>
            <label className={cell} style={{ gridColumn: wide ? "span 1" : "1 / -1" }}>
              <span className="text-xs font-semibold text-gray-500">Tìm kiếm</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên homestay, khu vực…" className={inp} />
            </label>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Nhận phòng</span>
              <DateField value={ci} onChange={(v) => { setCi(v); syncDates(v, co); }} className={inp} displayClassName="text-[15px] font-semibold text-ink" ariaLabel="Nhận phòng" />
            </label>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Trả phòng</span>
              <DateField value={co} min={ci || undefined} onChange={(v) => { setCo(v); syncDates(ci, v); }} className={inp} displayClassName="text-[15px] font-semibold text-ink" ariaLabel="Trả phòng" />
            </label>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Khoảng giá</span>
              <select value={price} onChange={(e) => setPrice(e.target.value)} className={inp}>
                {[["all", "Mọi mức giá"], ["lt500", "Dưới 500k"], ["mid", "500k – 900k"], ["gt900", "Trên 900k"], ["lt1500", "Dưới 1.500k"], ["gt1500", "Trên 1.500k"]].map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Sắp xếp</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className={inp}>
                {[["rec", "Phù hợp nhất"], ["priceAsc", "Giá thấp → cao"], ["priceDesc", "Giá cao → thấp"], ["near", "Gần trung tâm nhất"]].map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {[["all", "Tất cả"], ["Homestay", "Homestay"], ["Bungalow", "Bungalow"]].map(([k, n]) => (
                <button key={k} type="button" onClick={() => setType(k)} className="rounded-full px-3.5 py-2 text-sm font-bold transition" style={{ background: type === k ? TH.G : "oklch(0.95 0.01 230)", color: type === k ? "white" : "oklch(0.35 0.02 160)" }}>{n}</button>
              ))}
              {zones.length > 1 && <span className="mx-1 h-5 w-px bg-[oklch(0.9_0.01_230)]" />}
              {zones.length > 1 && [["all", "Mọi khu vực"], ...zones.map((z) => [z, z.replace(/^Trung tâm Tà Xùa$/i, "Trung tâm")])].map(([k, n]) => (
                <button key={k} type="button" onClick={() => setZone(k)} className="rounded-full px-3.5 py-2 text-sm font-bold transition" style={{ background: zone === k ? "oklch(0.52 0.12 50)" : "oklch(0.95 0.01 230)", color: zone === k ? "white" : "oklch(0.35 0.02 160)" }}>{n}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {hasFilter && <button type="button" onClick={() => { setQ(""); setCi(""); setCo(""); setPrice("all"); setType("all"); setZone("all"); setSort("rec"); }} className="px-3 py-2 text-sm font-bold text-gray-500">Xoá lọc</button>}
              <span className="text-sm font-semibold text-gray-500">{items.length} loại phòng{hasDates ? ` · ${nights} đêm` : ""}</span>
            </div>
          </div>
          {dateErr && <div className="px-1.5 pb-1 text-[13px] font-semibold text-red-600">{dateErr}</div>}
        </div>
      </div>

      {/* LIST */}
      <main ref={listRef} className="container-page pb-24 pt-9">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] sm:gap-[22px]">
          {items.map((s, i) => (
            <Link
              key={s.id}
              href={`/homestay/${s.slug}${dateQS}`}
              data-reveal="1"
              className="group flex flex-col overflow-hidden rounded-[22px] border border-[oklch(0.93_0.01_230)] bg-white opacity-0 transition hover:shadow-[0_24px_50px_-24px_oklch(0.3_0.08_260_/.4)]"
              style={{ transform: "translateY(24px)", transitionProperty: "opacity, transform, box-shadow", transitionDuration: ".6s", transitionDelay: `${(i % 3) * 0.08}s` }}
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-gray-100 sm:aspect-[4/3]">
                {s.cover ? <Image src={s.cover} alt={s.name} fill sizes="(max-width:640px) 50vw, 360px" className="object-cover transition duration-700 group-hover:scale-[1.04]" /> : <div className="flex h-full items-center justify-center text-4xl">🏠</div>}
                <div className="pointer-events-none absolute left-3 right-3 top-3 flex justify-between gap-1.5">
                  <div className="flex gap-1.5">
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[oklch(0.3_0.04_160)]">{s.cat}</span>
                    {s.featured && <span className="rounded-full bg-sunset-500 px-2.5 py-1 text-xs font-bold text-white">Nổi bật</span>}
                  </div>
                  <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: STATUS[s.status].bg, color: STATUS[s.status].fg }}>{STATUS[s.status].text(s.freeRooms)}</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3 sm:gap-2 sm:p-5 sm:pt-[18px]">
                <div className="line-clamp-1 text-[11px] font-semibold text-gray-500 sm:text-[13px]">
                  {s.homeName} · {s.area}
                  {s.distanceKm != null && (s.distanceKm === 0 ? " · ngay trung tâm" : ` · cách trung tâm ${s.distanceKm.toLocaleString("vi-VN")}km`)}
                </div>
                <div className="line-clamp-1 text-[15px] font-extrabold leading-[1.25] tracking-[-0.015em] text-ink sm:line-clamp-none sm:text-[19px]">{s.name}</div>
                <div className="text-[11px] font-semibold text-gray-500 sm:text-[12px]">Tối đa {s.capacity} khách{s.count > 1 ? ` · ${s.count} phòng loại này` : ""}</div>
                <div className="line-clamp-2 text-[13px] leading-[1.5] text-gray-500 sm:line-clamp-3 sm:text-sm sm:leading-[1.55]">{s.desc}</div>
                <div className="flex-1" />
                <div className="mt-1 flex flex-wrap items-end justify-between gap-x-2 gap-y-2 border-t border-[oklch(0.94_0.01_230)] pt-2 sm:mt-1.5 sm:pt-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-gray-500 sm:text-xs">{s.price > 0 ? (hasDates ? `${nights} đêm từ` : "Giá từ") : "Giá phòng"}</div>
                    <div>
                      {s.price > 0 ? (
                        <>
                          {s.priceOld != null && s.priceOld > s.price && (
                            <span className="mr-1.5 text-[12px] text-gray-400 line-through sm:text-[14px]">{vnd(hasDates ? s.priceOld * nights : s.priceOld)}</span>
                          )}
                          <span className="text-[17px] font-extrabold tracking-[-0.02em] sm:text-[21px]" style={{ color: TH.G }}>{vnd(hasDates ? s.price * nights : s.price)}</span>{!hasDates && <span className="text-[12px] text-gray-500 sm:text-[13px]">/đêm</span>}
                        </>
                      ) : (
                        <span className="text-[17px] font-extrabold tracking-[-0.02em] sm:text-[21px]" style={{ color: TH.G }}>Liên hệ</span>
                      )}
                    </div>
                  </div>
                  <span className="whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold text-white transition group-hover:bg-sunset-500 sm:px-4 sm:py-2.5 sm:text-sm" style={{ background: TH.G }}>Xem chi tiết</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {items.length === 0 && (
          <div className="flex flex-col items-center gap-2.5 rounded-[22px] border border-dashed border-[oklch(0.85_0.02_230)] bg-white px-6 py-14 text-center">
            <div className="text-[19px] font-extrabold text-ink">Không có phòng phù hợp</div>
            <div className="max-w-[420px] text-[15px] text-gray-500">Thử đổi ngày hoặc khoảng giá. Hoặc gọi 0397 943 155, tụi mình tìm chỗ giúp.</div>
            <button type="button" onClick={() => { setQ(""); setCi(""); setCo(""); setPrice("all"); setType("all"); setZone("all"); setSort("rec"); }} className="mt-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-white" style={{ background: TH.G }}>Xoá bộ lọc</button>
          </div>
        )}
      </main>
    </div>
  );
}
