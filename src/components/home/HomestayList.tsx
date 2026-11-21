"use client";

import { SitePhone, We } from "@/components/SiteContact";
import Link from "@/components/Link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { dmy, wdShort } from "@/lib/date-format";
import { DateField } from "@/components/DateField";
import { useSearchNav } from "@/components/useSearchNav";
import { AREA_OPTIONS, areaZone, isFilterZone, zoneLabel } from "@/lib/constants";
import { useT } from "@/components/i18n/I18nProvider";
import { TripFlag } from "@/components/TripFlag";
import { PushSwitch } from "@/components/home/PushSwitch";
import type { TFunc } from "@/lib/i18n/config";
import { useImageSearch, ImageSearchBar, SimBadge, CameraIcon, hitCover, type ImgHit } from "@/components/image-search/ImageSearch";

/**
 * Mỗi thẻ = một LOẠI phòng cụ thể: các phòng giống hệt nhau (cùng hạng + giá +
 * ảnh) được gom thành 1 thẻ (count = số phòng). id = roomId phòng đại diện;
 * slug vẫn là slug homestay để link chi tiết.
 */
export interface HomestayCard {
  id: string;
  slug: string;
  name: string; // tên phòng (hạng · phòng; nhóm nhiều phòng = tên hạng)
  typeName?: string; // tên hạng phòng (để dịch riêng)
  roomName?: string | null; // tên phòng khi nhóm chỉ có 1 phòng
  homeName: string; // tên homestay
  homeCover?: string | null; // ảnh bìa homestay (chế độ xem "Homestay")
  homeDesc?: string; // tóm tắt homestay (chế độ xem "Homestay")
  area: string;
  distanceKm: number | null; // cách trung tâm Tà Xùa (km); null = chưa nhập
  amen: Record<AmenKey, boolean>; // tiện ích (hạng phòng + dịch vụ) để lọc
  desc: string; // mô tả riêng của phòng; rỗng ⇒ hiện tóm tắt nhà (homeInfo) — server không lặp tóm tắt trên từng thẻ
  capacity: number;
  childFreeUnderAge: number; // trẻ dưới tuổi này miễn phí (không tính sức chứa)
  count: number; // số phòng giống nhau trong nhóm
  price: number;
  priceOld: number | null; // giá niêm yết gạch ngang khi đang giảm giá
  stayTotal: number | null; // tổng cả kỳ (chỉ khi có ngày) — dùng thay price × số đêm
  stayOld: number | null; // tổng giá gạch cả kỳ (null = không giảm)
  cover: string | null;
  featured: boolean;
  priorityOrder: number;
  roomFeatured?: boolean; // phòng được tick "Phòng nổi bật" → lên đầu danh sách
  cat: string; // "Homestay" | "Bungalow"
  status: "ok" | "low" | "full" | "none";
  freeRooms: number;
  /** Ẩn vì kỳ đã chọn vi phạm chính sách bán cuối tuần (vd chỉ đêm T7), không phải hết phòng. */
  policyBlocked?: boolean;
}

export type AmenKey = "cloudView" | "bathtub" | "breakfast" | "airCon" | "heating" | "pool" | "easyRoad";

/** Tiện ích lọc được ở trang danh sách (đồng bộ nhãn với trang combo). */
const AMENITIES: { key: AmenKey; label: string; icon: string }[] = [
  { key: "cloudView", label: "View mây", icon: "⛅" },
  { key: "bathtub", label: "Bồn tắm", icon: "🛁" },
  { key: "breakfast", label: "Ăn sáng", icon: "🍳" },
  { key: "airCon", label: "Điều hòa", icon: "❄️" },
  { key: "heating", label: "Đêm sưởi", icon: "🔥" },
  { key: "pool", label: "Hồ bơi", icon: "🏊" },
  { key: "easyRoad", label: "Đường dễ đi", icon: "🛣️" },
];

const STATUS: Record<HomestayCard["status"], { bg: string; fg: string; text: (n: number, t: TFunc) => string }> = {
  ok: { bg: "oklch(0.95 0.05 155)", fg: "oklch(0.38 0.1 155)", text: (n, t) => t("Còn {0} phòng", [n]) },
  low: { bg: "oklch(0.95 0.06 70)", fg: "oklch(0.48 0.15 50)", text: (n, t) => t("Còn {0} phòng", [n]) },
  full: { bg: "oklch(0.93 0 0)", fg: "oklch(0.42 0 0)", text: (_n, t) => t("Hết phòng") },
  none: { bg: "oklch(1 0 0 / .92)", fg: "oklch(0.4 0.02 160)", text: (_n, t) => t("Chọn ngày để xem") },
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
  initialPeople = 0,
  initialView = "room",
  homeInfo,
}: {
  /** Ảnh bìa + tóm tắt từng homestay (theo slug) cho chế độ "Theo nhà" — gửi 1 lần/nhà, không lặp trên từng thẻ phòng. */
  homeInfo?: Record<string, { cover: string | null; desc: string }>;
  /** Chế độ kết quả: "room" = từng loại phòng (mặc định), "home" = gom theo homestay (?view=home). */
  initialView?: "room" | "home";
  items: HomestayCard[];
  initialFrom?: string;
  initialTo?: string;
  initialQ?: string;
  /** Số người trong đoàn (?people= từ trang chủ); 0 = không lọc. */
  initialPeople?: number;
}) {
  const tr = useT();
  const { pending: searching, go } = useSearchNav();
  const [w, setW] = useState(1280);
  const [q, setQ] = useState(initialQ);
  const [view, setView] = useState<"room" | "home">(initialView);
  // ci/co = ngày đang CHỌN (nháp). Tình trạng còn phòng trong `items` do server
  // tính theo ngày TRÊN URL (initialFrom/initialTo) — chỉ đổi khi bấm "Tìm kiếm".
  const [ci, setCi] = useState(initialFrom); // nhận phòng = from
  const [co, setCo] = useState(initialTo); // trả phòng = to
  const [adults, setAdults] = useState(initialPeople > 0 ? initialPeople : 0); // 0 = không lọc số khách
  const [childAges, setChildAges] = useState<number[]>([]); // tuổi từng trẻ (lọc theo ngưỡng miễn phí từng home)
  const [price, setPrice] = useState("all");
  const [type, setType] = useState("all");
  const [fZone, setFZone] = useState<string[]>([]); // lọc theo khu vực (chọn nhiều: Trung tâm, Khe Cải, Đỉnh Gió...)
  const [fHome, setFHome] = useState<string[]>([]); // lọc theo TÊN homestay (chọn nhiều)
  const [sheet, setSheet] = useState(false); // mobile: cột lọc dạng bottom sheet
  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [sheet]);
  const [sort, setSort] = useState("rec"); // rec | priceAsc | priceDesc | near
  const [amen, setAmen] = useState<Set<AmenKey>>(new Set()); // tiện ích phải có (chọn nhiều)
  // Tìm theo ảnh (module dùng chung với /combo): chọn / dán / thả ảnh → chỉ hiện nhà / phòng có ảnh giống, xếp "Giống ảnh".
  const { img, imgOn, dragging: dragImg, searchImage, clearImage, pickFile, dropProps, fileInput } = useImageSearch({
    onStart: () => {
      setSort("img");
      const el = listRef.current;
      if (el) window.setTimeout(() => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: "smooth" }), 80);
    },
    onResult: (ok) => { if (!ok) setSort((s) => (s === "img" ? "rec" : s)); },
    onClear: () => setSort((s) => (s === "img" ? "rec" : s)),
  });
  /** Điểm giống của 1 thẻ phòng (server đã tính: ảnh phòng / hạng phòng, thiếu thì ảnh của nhà). */
  const roomHit = (x: { id: string }): ImgHit | null => (imgOn && img ? (img.rooms[x.id] ?? null) : null);

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

  // Đổi bộ lọc / dữ liệu server mới → thẻ mount lại với class opacity-0 mà
  // IntersectionObserver (chỉ gắn lúc mount đầu) không còn theo dõi → thẻ trong
  // suốt vĩnh viễn, nhìn như "không có dữ liệu". Sau mỗi lần đổi lọc HOẶC nhận
  // items mới (bấm Tìm kiếm → router.refresh): hiện ngay mọi thẻ (hiệu ứng
  // reveal chỉ dành cho lần tải đầu).
  // Số thẻ đang dựng: bắt đầu 24, cuộn tới cuối danh sách thì thêm 24. Đổi bộ lọc / dữ liệu ⇒ về 24
  // (so khoá lọc thay vì setState trong effect).
  const PAGE = 24;
  const fkey = JSON.stringify([view, q, ci, co, adults, childAges, price, type, fZone, fHome, sort, [...amen], all.length, img?.preview ?? "", img?.status ?? ""]);
  const [lim, setLim] = useState({ k: fkey, n: PAGE });
  const limit = lim.k === fkey ? lim.n : PAGE;
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = moreRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (es) => { if (es.some((e) => e.isIntersecting)) setLim({ k: fkey, n: limit + PAGE }); },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [fkey, limit]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  }, [view, q, ci, co, adults, childAges, price, type, fZone, fHome, sort, amen, all, limit, img]);

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
  const dateErr = ci && co && co <= ci ? tr("Ngày trả phòng phải sau ngày nhận phòng.") : "";
  // hasDates/nights theo ngày ĐÃ ÁP DỤNG (trên URL) — khớp với tình trạng server
  // đã tính trong items; ngày nháp chưa bấm Tìm kiếm không đổi hiển thị.
  const hasDates = Boolean(initialFrom && initialTo && initialTo > initialFrom);
  const nights = hasDates ? Math.max(1, Math.round((+new Date(initialTo) - +new Date(initialFrom)) / 864e5)) : 0;
  const qn = norm(q.trim());
  const inPrice = (p: number) =>
    price === "all" ||
    (p > 0 &&
      ((price === "lt500" && p < 500000) ||
        (price === "mid" && p >= 500000 && p <= 900000) ||
        (price === "gt900" && p > 900000) ||
        (price === "lt1500" && p < 1500000) ||
        (price === "gt1500" && p > 1500000)));
  // Khu vực có trong dữ liệu — quy về KHU CHUẨN (areaZone) để "Đỉnh Gió" và
  // "Đỉnh Gió, Tà Xùa" là MỘT lựa chọn. Khu chuẩn trước, khu khác sau, "Khác" cuối.
  const zones = useMemo(() => {
    const set = new Set(all.map((x) => areaZone(x.area)).filter(isFilterZone));
    const rank = (z: string) => (z === "Khác" ? 2 : (AREA_OPTIONS as readonly string[]).includes(z) ? 0 : 1);
    return [...set].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "vi"));
  }, [all]);
  // Các homestay có trong dữ liệu (cột lọc: tick nhiều nhà) kèm số loại phòng của từng nhà.
  const homeList = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of all) if (x.homeName) m.set(x.homeName, (m.get(x.homeName) ?? 0) + 1);
    return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [all]);
  // Khoảng cách tới trung tâm để sắp "gần trung tâm": thiếu số km nhưng khu vực là
  // "Trung tâm..." thì coi như 0; thiếu hẳn thì xếp cuối.
  const distOf = (x: HomestayCard) => x.distanceKm ?? (norm(x.area).includes("trung tam") ? 0 : Number.POSITIVE_INFINITY);
  // Hạng ưu tiên: chỉ dịch vụ Nổi bật mới được ưu tiên; trong đó số thứ tự lớn hơn lên trước.
  const prRank = (x: HomestayCard) => (x.featured ? (x.priorityOrder || 0) + 1 : 0);
  // Đủ chỗ cho cả đoàn (như combo): tính cả việc lấy NHIỀU phòng giống nhau cùng
  // loại — freeRooms = số phòng còn trống trong kỳ (chưa chọn ngày = tổng số phòng).
  // Số người TÍNH PHÍ cần chứa = người lớn + trẻ TỪ ngưỡng miễn phí của home đó.
  const partyEmpty = adults === 0 && childAges.length === 0;
  const occFor = (x: HomestayCard) => adults + childAges.filter((a) => a >= x.childFreeUnderAge).length;
  // Sức chứa còn trống tính theo CẢ HOMESTAY (cộng mọi thẻ của home): đoàn đông có thể
  // ghép nhiều phòng khác hạng/khác thẻ (vd T9 + T10 mỗi phòng 4 khách = 8 khách) —
  // trước đây xét từng thẻ riêng nên đoàn 5+ người bị ẩn hết dù home vẫn đủ chỗ.
  const homeFreeCap = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of all) {
      if (hasDates && x.status === "full") continue;
      m.set(x.slug, (m.get(x.slug) ?? 0) + x.capacity * x.freeRooms);
    }
    return m;
  }, [all, hasDates]);
  const fitsGuests = (x: HomestayCard) => partyEmpty || (homeFreeCap.get(x.slug) ?? 0) >= occFor(x);
  const preFiltered = all.filter(
    (x) =>
      (type === "all" || x.cat === type) &&
      (!fZone.length || fZone.includes(areaZone(x.area))) &&
      (!fHome.length || fHome.includes(x.homeName)) &&
      inPrice(x.price) &&
      fitsGuests(x) &&
      [...amen].every((k) => x.amen?.[k]) &&
      (!qn || norm(`${x.name} ${x.homeName} ${x.area}`).includes(qn)),
  );
  // Đã tìm theo ngày → ẨN HẲN phòng hết chỗ trong kỳ (chỉ hiện phòng còn trống).
  const hiddenFull = hasDates ? preFiltered.filter((x) => x.status === "full" && !x.policyBlocked).length : 0;
  // Số home bị ẩn do không bán lẻ cuối tuần (vd chỉ ở đêm T7) → báo lý do + gợi ý thêm đêm.
  const hiddenPolicyHomes = hasDates
    ? new Set(preFiltered.filter((x) => x.status === "full" && x.policyBlocked).map((x) => x.slug)).size
    : 0;
  const matched = preFiltered.filter(
    (x) => (!hasDates || x.status !== "full") && (!imgOn || !img || (view === "home" ? Boolean(img.homes[x.slug]) : Boolean(img.rooms[x.id]))),
  );
  const bySort = (a: HomestayCard, b: HomestayCard) => {
    if (sort === "priceAsc") return (a.price > 0 ? a.price : Infinity) - (b.price > 0 ? b.price : Infinity);
    if (sort === "priceDesc") return b.price - a.price;
    if (sort === "near") return distOf(a) - distOf(b);
    if (sort === "img") return (roomHit(b)?.s ?? -1) - (roomHit(a)?.s ?? -1);
    return 0; // "rec": giữ thứ tự nổi bật/ưu tiên/tên từ server
  };
  // Ưu tiên (Nổi bật lên đầu) CHỈ áp dụng ở trạng thái MẶC ĐỊNH: mọi mức giá +
  // sắp xếp "Phù hợp nhất". Khi khách đã lọc giá hoặc đổi sắp xếp → bỏ ưu tiên,
  // hiển thị đúng theo bộ lọc/sắp xếp đã chọn.
  const keepPriority = price === "all" && sort === "rec";
  let items: HomestayCard[];
  if (keepPriority) {
    const ranked = [...matched].sort((a, b) => prRank(b) - prRank(a) || bySort(a, b));
    // PHÒNG nổi bật (tick ở từng phòng) lên TRÊN CÙNG, hiện hết — giữ thứ tự ưu tiên của home.
    const roomTop = ranked.filter((x) => x.roomFeatured);
    // Nhóm ưu tiên hiện trước nhóm bình thường. Trong nhóm ưu tiên: mỗi home chỉ hiện TỐI ĐA
    // PRIORITY_PER_HOME căn ở lượt đầu (tránh 1 home lố khi có nhiều home ưu tiên), các căn thừa
    // dồn xuống CUỐI nhóm ưu tiên (vẫn trước danh sách bình thường). Chỉ 1 home ưu tiên → hiện hết căn của nó.
    const PRIORITY_PER_HOME = 1;
    const perHome = new Map<string, number>();
    const prioHead: HomestayCard[] = []; // tối đa PRIORITY_PER_HOME căn / home ưu tiên
    const prioTail: HomestayCard[] = []; // căn thừa của home ưu tiên (cuối nhóm ưu tiên)
    const normal: HomestayCard[] = []; // home không ưu tiên
    for (const x of ranked) {
      if (x.roomFeatured) continue; // đã nằm ở roomTop
      if (prRank(x) > 0) {
        const n = perHome.get(x.slug) ?? 0;
        perHome.set(x.slug, n + 1);
        (n < PRIORITY_PER_HOME ? prioHead : prioTail).push(x);
      } else {
        normal.push(x);
      }
    }
    items = [...roomTop, ...prioHead, ...prioTail, ...normal];
  } else {
    // Đã lọc giá hoặc đổi sắp xếp → KHÔNG ưu tiên Nổi bật nữa: chỉ theo sắp xếp đã chọn
    // (riêng "Phù hợp nhất" thì xếp theo tên cho trung lập, không đẩy Nổi bật lên).
    items = [...matched].sort((a, b) =>
      sort === "rec"
        ? (a.homeName || a.name).localeCompare(b.homeName || b.name, "vi")
        : bySort(a, b),
    );
  }
  // ---- Chế độ "Homestay": gom các loại phòng ĐÃ LỌC theo từng nhà (mỗi nhà 1 thẻ) ----
  // Nhà chỉ hiện khi còn ít nhất 1 loại phòng khớp bộ lọc; giá "từ" = phòng khớp rẻ nhất.
  const homes = (() => {
    const m = new Map<string, {
      slug: string; name: string; area: string; distanceKm: number | null; cover: string | null; desc: string;
      hot: boolean; types: number; freeRooms: number; maxCap: number; amen: Set<AmenKey>; price: number; old: number | null;
    }>();
    for (const x of items) {
      let g = m.get(x.slug);
      if (!g) {
        g = {
          slug: x.slug, name: x.homeName, area: x.area, distanceKm: x.distanceKm, cover: homeInfo?.[x.slug]?.cover ?? x.homeCover ?? x.cover,
          desc: homeInfo?.[x.slug]?.desc ?? x.homeDesc ?? x.desc, hot: x.featured, types: 0, freeRooms: 0, maxCap: 0, amen: new Set(), price: 0, old: null,
        };
        m.set(x.slug, g);
      }
      g.types += 1;
      g.freeRooms += x.freeRooms;
      g.maxCap = Math.max(g.maxCap, x.capacity);
      if (!g.cover) g.cover = x.cover;
      for (const a of AMENITIES) if (x.amen?.[a.key]) g.amen.add(a.key);
      if (x.price > 0) {
        const shown = hasDates ? (x.stayTotal ?? x.price * nights) : x.price;
        const old = hasDates ? (x.stayTotal != null ? x.stayOld : x.priceOld != null ? x.priceOld * nights : null) : x.priceOld;
        if (g.price === 0 || shown < g.price) { g.price = shown; g.old = old; }
      }
    }
    const list = [...m.values()]; // giữ thứ tự xuất hiện (ưu tiên / tên / gần trung tâm) của danh sách phòng
    if (sort === "priceAsc") list.sort((a, b) => (a.price > 0 ? a.price : Infinity) - (b.price > 0 ? b.price : Infinity));
    else if (sort === "priceDesc") list.sort((a, b) => b.price - a.price);
    else if (sort === "img" && imgOn && img) list.sort((a, b) => (img.homes[b.slug]?.s ?? -1) - (img.homes[a.slug]?.s ?? -1));
    return list;
  })();
  const shownCount = view === "home" ? homes.length : items.length;
  const toggleAmen = (k: AmenKey) =>
    setAmen((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const heroH = w < 640 ? 500 : 560;
  const dateQS = (() => { const p = new URLSearchParams(); if (hasDates) { p.set("from", initialFrom); p.set("to", initialTo); } const s = p.toString(); return s ? `?${s}` : ""; })();
  // Mang theo số khách sang trang chi tiết để panel đặt tự điền (giá hiện đúng ngay).
  const partyQS = (() => {
    const parts: string[] = [];
    if (adults > 0) parts.push(`adults=${adults}`);
    if (childAges.length) parts.push(`kids=${childAges.join("-")}`);
    if (!parts.length) return "";
    return (dateQS ? "&" : "?") + parts.join("&");
  })();

  // Bấm "Tìm kiếm" → đẩy ngày lên URL để server tính lại tình trạng còn phòng.
  function submitSearch() {
    if (dateErr) return;
    const p = new URLSearchParams();
    if (ci && co && co > ci) { p.set("from", ci); p.set("to", co); }
    if (q) p.set("q", q);
    if (adults > 0) p.set("people", String(adults));
    if (childAges.length) p.set("kids", childAges.join("-"));
    if (view === "home") p.set("view", "home");
    go(`/homestay${p.toString() ? `?${p}` : ""}`, { replace: true }); // kèm refresh — tránh cache cũ
    const el = listRef.current;
    if (el) window.setTimeout(() => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: "smooth" }), 120);
  }

  // Xoá lọc: về trạng thái không ngày (server trả "Chọn ngày để xem").
  function clearAll() {
    setQ(""); setCi(""); setCo(""); setAdults(0); setChildAges([]); setPrice("all"); setType("all"); setFZone([]); setFHome([]); setSort("rec"); setAmen(new Set());
    clearImage();
    go(view === "home" ? "/homestay?view=home" : "/homestay", { replace: true });
  }

  // Ô nhập theo ô tìm combo (Combo v3).
  const cell = "flex min-w-0 flex-col gap-[3px] rounded-[14px] border-[1.5px] border-transparent bg-[oklch(0.965_0.008_180)] px-3.5 py-2.5";
  const lab = "whitespace-nowrap text-xs font-semibold text-[oklch(0.48_0.02_160)]";
  const inp = "w-full min-w-0 border-0 bg-transparent p-0 text-base font-bold text-ink outline-none";
  const stepBtn = "flex h-7 w-7 flex-none items-center justify-center rounded-[9px] font-extrabold transition";
  // Dải ngày ở theo ngày ĐANG CHỌN (nháp) — chỉ để khách soát lại trước khi bấm tìm.
  const draftOk = /^d{4}-d{2}-d{2}$/.test(ci) && /^d{4}-d{2}-d{2}$/.test(co) && co > ci;
  const draftNights = draftOk ? Math.round((Date.parse(co) - Date.parse(ci)) / 864e5) : 0;
  const stayPlan = draftOk
    ? [
        { k: tr("Nhận phòng"), v: `${tr(wdShort(ci))} ${dmy(ci)}` },
        { k: tr("Trả phòng"), v: `${tr(wdShort(co))} ${dmy(co)}` },
      ]
    : null;
  // Cột lọc trái: loại hình · homestay · khu vực · tiện ích (lọc phía client, không tìm lại).
  const toggleIn = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const sideCount = (type !== "all" ? 1 : 0) + fHome.length + fZone.length + amen.size;
  const clearSide = () => { setType("all"); setFHome([]); setFZone([]); setAmen(new Set()); };
  const groupCls = "flex flex-col gap-2 border-t border-[oklch(0.94_0.006_160)] pt-3.5";
  const groupTitle = "text-xs font-extrabold tracking-[0.08em] text-[oklch(0.45_0.06_158)]";
  const chipCls = (on: boolean) =>
    `cursor-pointer rounded-full border px-[11px] py-1.5 text-[13px] font-bold transition ${on ? "border-forest-700 bg-forest-700 text-white" : "border-[oklch(0.9_0.01_160)] bg-white text-[oklch(0.3_0.03_160)] hover:border-forest-300"}`;

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
          <TripFlag x={15} y={-22} h={48} />
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
            <span>{tr("Trang chủ")}</span><span>/</span><span className="font-bold text-white">Homestay</span>
          </div>
          <h1 data-in="1" className="mt-4 text-[13px] font-bold uppercase tracking-[0.14em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .1s, transform .9s cubic-bezier(.2,.7,.2,1) .1s", color: "oklch(0.88 0.12 80)" }}>{tr("Homestay Tà Xùa · giá & phòng trống theo ngày")}</h1>
          <p data-in="2" className="mt-3.5 max-w-[760px] text-[clamp(32px,6vw,60px)] font-extrabold leading-[1.02] tracking-[-0.035em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .2s, transform .9s cubic-bezier(.2,.7,.2,1) .2s", textShadow: "0 2px 24px oklch(0.2 0.05 260 / .4)" }}>{tr("Giữa rừng Tây Bắc, thức dậy trên biển mây")}</p>
          <p data-in="3" className="mt-3.5 max-w-[520px] text-[clamp(15px,1.7vw,18px)] leading-[1.5] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .3s, transform .9s cubic-bezier(.2,.7,.2,1) .3s", color: "oklch(0.97 0.02 80)" }}>{tr("Homestay và bungalow giữa núi rừng Tà Xùa, sát điểm săn mây. Chọn ngày để xem phòng trống và giá đêm đó.")}</p>
        </div>
      </section>

      {/* SEARCH — theo bố cục ô tìm combo (Combo v3): 3 nhóm đánh số + dải ngày ở + nút tìm */}
      <div data-in="4" className="container-page relative z-[4] -mt-[70px] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .4s, transform .9s cubic-bezier(.2,.7,.2,1) .4s" }}>
        <div className="flex flex-col gap-3.5 rounded-[24px] bg-white p-3.5 text-ink shadow-[0_24px_60px_-28px_oklch(0.2_0.05_200_/.55)] sm:p-[18px]">
          <div className="grid gap-3.5 sm:gap-[18px] min-[1100px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,.62fr)]">
            {/* 1 · LƯU TRÚ */}
            <SearchGroup n={1} title={tr("LƯU TRÚ")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div
                  className={`${cell} relative col-span-2 pr-14 sm:col-span-1 ${dragImg ? "!border-forest-500 !bg-forest-50" : ""}`}
                  // Kéo-thả ảnh vào ô ⇒ tìm theo ảnh (khớp lời gợi ý trong placeholder).
                  {...dropProps}
                >
                  <label htmlFor="hs-q" className={lab}>{tr("Tìm kiếm")}</label>
                  <input
                    id="hs-q"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }}
                    onPaste={(e) => {
                      // Dán ảnh (Ctrl+V ảnh chụp màn hình / ảnh copy từ Facebook) ⇒ tìm theo ảnh.
                      const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/"));
                      if (f) { e.preventDefault(); void searchImage(f); }
                    }}
                    placeholder={dragImg ? tr("Thả ảnh vào đây để tìm…") : tr("Tên homestay, khu vực… hoặc dán / thả ảnh 📷")}
                    title={tr("Gõ tên homestay, khu vực — hoặc dán, kéo-thả, bấm 📷 để tìm theo ảnh mẫu")}
                    className={`${inp} text-ellipsis placeholder:text-[14px] placeholder:font-semibold`}
                  />
                  <button
                    type="button"
                    onClick={pickFile}
                    title={tr("Tìm theo ảnh")}
                    aria-label={tr("Tìm homestay theo ảnh")}
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-white text-forest-700 shadow-sm ring-1 ring-[oklch(0.88_0.02_160)] transition hover:bg-forest-50 hover:ring-forest-300"
                  >
                    <CameraIcon className="h-5 w-5" />
                  </button>
                  {fileInput}
                </div>
                <label className={cell}>
                  <span className={lab}>{tr("Nhận phòng")}</span>
                  <DateField value={ci} onChange={setCi} className={inp} displayClassName="text-base font-bold text-ink" ariaLabel={tr("Nhận phòng")} />
                </label>
                <label className={cell}>
                  <span className={lab}>{tr("Trả phòng")}</span>
                  <DateField value={co} min={ci || undefined} onChange={setCo} className={inp} displayClassName="text-base font-bold text-ink" ariaLabel={tr("Trả phòng")} />
                </label>
              </div>
            </SearchGroup>

            {/* 2 · ĐOÀN KHÁCH */}
            <SearchGroup n={2} title={tr("ĐOÀN KHÁCH")}>
              <div className="grid grid-cols-2 gap-2">
                <div className={cell}>
                  <span className={lab}>{tr("Người lớn")}</span>
                  <span className="flex items-center justify-between gap-1.5">
                    <button type="button" aria-label={tr("Giảm người lớn")} onClick={() => setAdults(Math.max(0, adults - 1))} className={`${stepBtn} border border-[oklch(0.9_0.01_160)] bg-white text-ink hover:bg-forest-50`}>−</button>
                    <b className="text-[17px]">{adults > 0 ? adults : <span className="text-sm font-bold text-gray-400">{tr("Mọi")}</span>}</b>
                    <button type="button" aria-label={tr("Tăng người lớn")} onClick={() => setAdults(Math.min(20, adults + 1))} className={`${stepBtn} bg-forest-700 text-white hover:bg-forest-800`}>+</button>
                  </span>
                </div>
                <label className={cell}>
                  <span className={lab}>{tr("Trẻ em")}</span>
                  <select
                    value={childAges.length}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setChildAges((arr) => Array.from({ length: n }, (_, i) => arr[i] ?? 6));
                    }}
                    className={inp}
                  >
                    {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                      <option key={n} value={n}>{n === 0 ? tr("Không có") : tr("{0} bé", [n])}</option>
                    ))}
                  </select>
                </label>
              </div>
              {childAges.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-1 text-xs font-semibold text-[oklch(0.48_0.02_160)]">
                  {tr("Tuổi từng bé:")}
                  {childAges.map((age, i) => (
                    <input
                      key={i}
                      type="number"
                      min={0}
                      max={17}
                      value={age}
                      aria-label={tr("Tuổi bé {0}", [i + 1])}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(17, parseInt(e.target.value || "0", 10) || 0));
                        setChildAges((arr) => arr.map((x, j) => (j === i ? v : x)));
                      }}
                      className="w-12 rounded-lg border border-[oklch(0.9_0.01_160)] bg-white px-1 py-1 text-center text-xs font-bold text-ink outline-none focus:border-forest-500"
                    />
                  ))}
                </div>
              )}
            </SearchGroup>

            {/* 3 · NGÂN SÁCH / ĐÊM */}
            <SearchGroup n={3} title={tr("NGÂN SÁCH / ĐÊM")}>
              <label className={cell}>
                <span className={lab}>{tr("Khoảng giá")}</span>
                <select value={price} onChange={(e) => setPrice(e.target.value)} className={inp}>
                  {[["all", tr("Mọi mức giá")], ["lt500", tr("Dưới 500k")], ["mid", "500k – 900k"], ["gt900", tr("Trên 900k")], ["lt1500", tr("Dưới 1.500k")], ["gt1500", tr("Trên 1.500k")]].map(([v, n]) => <option key={v} value={v}>{tr(n)}</option>)}
                </select>
              </label>
            </SearchGroup>
          </div>

          {/* Dải ngày ở + nút tìm */}
          <div className="grid items-center gap-3 border-t border-[oklch(0.94_0.006_160)] pt-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            {stayPlan ? (
              <div className="flex min-w-0 items-center overflow-x-auto [scrollbar-width:none]">
                {stayPlan.map((p, i) => (
                  <div key={p.k} className="flex flex-none items-center">
                    <div className="flex flex-col gap-px rounded-xl bg-[oklch(0.965_0.008_180)] px-3 py-1.5">
                      <span className="whitespace-nowrap text-[11px] font-bold text-[oklch(0.5_0.02_160)]">{p.k}</span>
                      <b className="whitespace-nowrap text-sm">{p.v}</b>
                    </div>
                    {i < stayPlan.length - 1 && <span className="mx-0.5 h-0.5 w-7 flex-none" style={{ background: "repeating-linear-gradient(90deg, oklch(0.75 0.02 160) 0 4px, transparent 4px 7px)" }} />}
                  </div>
                ))}
                <span className="ml-2.5 flex-none whitespace-nowrap rounded-full bg-[oklch(0.95_0.04_155)] px-2.5 py-1 text-xs font-extrabold text-[oklch(0.36_0.1_155)]">{tr("{0} đêm", [draftNights])}</span>
              </div>
            ) : (
              <div className="text-[13px] leading-relaxed text-[oklch(0.42_0.03_220)]">{tr("Chọn ngày nhận / trả phòng để xem phòng còn trống và giá đúng đêm đó.")}</div>
            )}
            <button
              type="button"
              onClick={submitSearch}
              disabled={Boolean(dateErr) || searching}
              className="whitespace-nowrap rounded-2xl bg-sunset-500 px-7 py-[15px] text-center text-base font-extrabold text-white transition hover:bg-sunset-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {tr("Tìm homestay →")}
            </button>
          </div>
          {dateErr && <div className="text-[13px] font-bold text-[oklch(0.55_0.19_28)]">{tr(dateErr)}</div>}
        </div>
      </div>

      {/* LIST — cột lọc trái (mobile: bottom sheet) + sắp xếp & công tắc chế độ + lưới thẻ */}
      <main ref={listRef} className="container-page pb-24 pt-9">
        <div className="mb-4">
          <h2 className="m-0 text-[clamp(22px,2.6vw,30px)] font-extrabold tracking-[-0.02em] text-ink">
            {view === "home" ? tr("{0} homestay phù hợp", [homes.length]) : tr("{0} loại phòng phù hợp", [items.length])}
          </h2>
          <div className="mt-1 text-sm text-[oklch(0.48_0.02_160)]">
            {hasDates ? tr("{0} đêm · {1} → {2}", [nights, dmy(initialFrom), dmy(initialTo)]) : tr("Chưa chọn ngày · giá hiển thị là giá 1 đêm")}
            {hiddenFull > 0 && <span className="text-gray-400">{" "}{tr("· đã ẩn {0} loại hết phòng", [hiddenFull])}</span>}
          </div>
          {hiddenPolicyHomes > 0 && (
            <div className="mt-1 text-[13px] font-medium text-amber-700">
              {tr("⚠️ {0} homestay không bán lẻ đêm cuối tuần nên đã ẩn — chọn thêm đêm thứ 6 hoặc chủ nhật để xem.", [hiddenPolicyHomes])}
            </div>
          )}
        </div>

        <div className="grid items-start gap-5 min-[900px]:grid-cols-[260px_minmax(0,1fr)]">
          <aside
            className={`flex-col gap-4 overflow-y-auto border border-[oklch(0.92_0.01_160)] bg-white p-[18px] text-ink min-[900px]:sticky min-[900px]:top-[84px] min-[900px]:flex min-[900px]:max-h-[calc(100vh-100px)] min-[900px]:rounded-[20px] ${
              sheet ? "fixed inset-x-0 bottom-0 z-[60] flex max-h-[85vh] rounded-t-[22px] pb-[calc(18px+env(safe-area-inset-bottom))]" : "hidden"
            }`}
          >
            <div className="flex items-center justify-between">
              <b className="text-base">{tr("Bộ lọc")}</b>
              <span className="flex items-center gap-3">
                {sideCount > 0 && (
                  <button type="button" onClick={clearSide} className="text-[13px] font-bold text-[oklch(0.5_0.15_45)]">{tr("Xoá lọc ({0})", [sideCount])}</button>
                )}
                <button type="button" onClick={() => setSheet(false)} aria-label={tr("Đóng")} className="flex h-8 w-8 items-center justify-center rounded-full bg-[oklch(0.95_0.005_160)] text-xl leading-none text-gray-600 min-[900px]:hidden">×</button>
              </span>
            </div>
            <div className={groupCls}>
              <span className={groupTitle}>{tr("LOẠI HÌNH")}</span>
              <div className="flex flex-wrap gap-1.5">
                {[["all", tr("Tất cả")], ["Homestay", "Homestay"], ["Bungalow", "Bungalow"]].map(([k, n]) => (
                  <button key={k} type="button" onClick={() => setType(k)} className={chipCls(type === k)}>{tr(n)}</button>
                ))}
              </div>
            </div>
            {homeList.length > 1 && (
              <div className={groupCls}>
                <span className={groupTitle}>{tr("HOMESTAY")}</span>
                <div className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto">
                  {homeList.map((h) => {
                    const on = fHome.includes(h.name);
                    return (
                      <button key={h.name} type="button" onClick={() => toggleIn(fHome, setFHome, h.name)} className="flex items-center gap-2.5 rounded-lg px-1 py-[7px] text-left hover:bg-[oklch(0.975_0.006_160)]">
                        <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border-2 text-[11px] font-extrabold text-white" style={{ borderColor: on ? TH.G : "oklch(0.8 0.01 160)", background: on ? TH.G : "white" }}>{on ? "✓" : ""}</span>
                        <span className="min-w-0 flex-1 text-sm font-semibold">{tr(h.name)}</span>
                        <span className="text-xs text-[oklch(0.55_0.02_160)]">{h.n}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {zones.length > 1 && (
              <div className={groupCls}>
                <span className={groupTitle}>{tr("KHU VỰC")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {zones.map((z) => (
                    <button key={z} type="button" onClick={() => toggleIn(fZone, setFZone, z)} className={chipCls(fZone.includes(z))}>
                      {tr(zoneLabel(z))}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className={groupCls}>
              <span className={groupTitle}>{tr("TIỆN ÍCH")}</span>
              <div className="flex flex-wrap gap-1.5">
                {AMENITIES.map((a) => (
                  <button key={a.key} type="button" onClick={() => toggleAmen(a.key)} className={chipCls(amen.has(a.key))}>{tr(a.icon)} {tr(a.label)}</button>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setSheet(false)} className="rounded-[14px] p-[13px] text-center text-[15px] font-extrabold text-white min-[900px]:hidden" style={{ background: TH.G }}>
              {view === "home" ? tr("Xem {0} homestay", [homes.length]) : tr("Xem {0} loại phòng", [items.length])}
            </button>
          </aside>
          {sheet && <div onClick={() => setSheet(false)} className="fixed inset-0 z-[59] bg-[oklch(0.15_0.03_165_/.45)] min-[900px]:hidden" />}

          <div className="flex min-w-0 flex-col gap-4">
            {img && <ImageSearchBar img={img} foundLabel={view === "home" ? tr("{0} homestay có ảnh giống", [homes.length]) : tr("{0} loại phòng có ảnh giống", [items.length])} onChange={pickFile} onClear={clearImage} />}
            {/* Sắp xếp + công tắc chế độ: desktop cùng hàng (công tắc bên phải); mobile công tắc hàng riêng phía trên. */}
            <div className="flex flex-wrap items-center gap-2.5 min-[1100px]:flex-nowrap">
              <div className="order-first w-full min-[1100px]:order-last min-[1100px]:w-[400px] min-[1100px]:flex-none">
                <div className="ml-auto w-full sm:w-[400px]">
                  <PushSwitch
                    value={view}
                    onChange={setView}
                    left={{ k: "home", name: tr("Theo homestay"), n: homes.length }}
                    right={{ k: "room", name: tr("Theo phòng"), n: items.length }}
                    ariaLabel={tr("Xem kết quả")}
                    flag={tr("Đi Tà Xùa thôi!")}
                    pushLabel={tr("ĐẨY")}
                    tip={(name) => tr("Đẩy sang {0}", [name])}
                  />
                </div>
              </div>
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
                {[...(imgOn ? [["img", "📷 Giống ảnh"]] : []), ["rec", "Phù hợp nhất"], ["priceAsc", "Giá thấp nhất"], ["priceDesc", "Giá cao nhất"], ["near", "Gần trung tâm"]].map(([k, n]) => {
                  const on = sort === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSort(k)}
                      className="flex-none whitespace-nowrap rounded-full border px-[13px] py-2 text-[13px] font-bold transition"
                      style={on ? { background: TH.G, color: "white", borderColor: TH.G } : { background: "white", color: "oklch(0.3 0.03 160)", borderColor: "oklch(0.9 0.01 160)" }}
                    >
                      {tr(n)}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => setSheet(true)} className="whitespace-nowrap rounded-full border-[1.5px] border-[oklch(0.85_0.03_158)] bg-white px-3.5 py-2 text-[13px] font-extrabold text-ink min-[900px]:hidden">
                {tr("Bộ lọc")}{sideCount ? ` · ${sideCount}` : ""}
              </button>
            </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] sm:gap-[18px]">
          {view === "home" && homes.slice(0, limit).map((h, i) => {
            // Tìm theo ảnh: hiện ẢNH KHỚP NHẤT của nhà thay ảnh bìa — khách thấy ngay vì sao nhà này lên đầu.
            const hit = imgOn && img ? img.homes[h.slug] : undefined;
            const cover = hitCover(hit, h.cover);
            return (
            <Link
              key={h.slug}
              href={`/homestay/${h.slug}${dateQS}${partyQS}`}
              data-reveal="1"
              className="group flex flex-col overflow-hidden rounded-[22px] border border-[oklch(0.93_0.01_230)] bg-white opacity-0 transition hover:shadow-[0_24px_50px_-24px_oklch(0.3_0.08_260_/.4)]"
              style={{ transform: "translateY(24px)", transitionProperty: "opacity, transform, box-shadow", transitionDuration: ".6s", transitionDelay: `${(i % 3) * 0.08}s` }}
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-gray-100 sm:aspect-[4/3]">
                {cover ? <Image src={cover} alt={tr(h.name)} fill sizes="(max-width:640px) 50vw, 360px" className="object-cover transition duration-700 group-hover:scale-[1.04]" /> : <div className="flex h-full items-center justify-center text-4xl">🏠</div>}
                {h.hot && (
                  <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-sunset-500 px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-white shadow-sm sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-xs">🔥 HOT</span>
                )}
                {hit && <SimBadge s={hit.s} />}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3 sm:gap-2 sm:p-5 sm:pt-[18px]">
                <div className="line-clamp-1 text-[11px] font-semibold text-gray-500 sm:text-[13px]">
                  {tr(h.area)}
                  {h.distanceKm != null && (h.distanceKm === 0 ? tr(" · ngay trung tâm") : tr(" · cách trung tâm {0}km", [h.distanceKm.toLocaleString("vi-VN")]))}
                </div>
                <div className="line-clamp-2 text-[15px] font-extrabold leading-[1.25] tracking-[-0.015em] text-ink sm:text-[19px]">{tr(h.name)}</div>
                <div className="text-[11px] font-semibold text-gray-500 sm:text-[12px]">
                  {h.types}{" "}{tr("loại phòng")} · {tr("Tối đa")}{" "}{h.maxCap}{" "}{tr("khách")}{tr("/phòng")}
                  {hasDates && <span className="ml-1.5 inline-block whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-bold sm:text-[11px]" style={{ background: STATUS[h.freeRooms <= 2 ? "low" : "ok"].bg, color: STATUS[h.freeRooms <= 2 ? "low" : "ok"].fg }}>{tr("Còn {0} phòng", [h.freeRooms])}</span>}
                </div>
                {h.amen.size > 0 && (() => {
                  const tags = AMENITIES.filter((a) => h.amen.has(a.key));
                  return (
                    <div className="flex flex-wrap gap-1">
                      {tags.slice(0, 4).map((a) => (
                        <span key={a.key} className="rounded-full bg-[oklch(0.96_0.02_155)] px-2 py-0.5 text-[10px] font-semibold text-[oklch(0.36_0.08_155)] sm:text-[11px]">{tr(a.icon)} {tr(a.label)}</span>
                      ))}
                      {tags.length > 4 && <span className="rounded-full bg-[oklch(0.96_0.005_230)] px-2 py-0.5 text-[10px] font-semibold text-gray-500 sm:text-[11px]">+{tags.length - 4}</span>}
                    </div>
                  );
                })()}
                <div className="line-clamp-2 text-[13px] leading-[1.5] text-gray-500 sm:line-clamp-3 sm:text-sm sm:leading-[1.55]">{tr(h.desc)}</div>
                <div className="flex-1" />
                <div className="mt-1 flex flex-wrap items-end justify-between gap-x-2 gap-y-2 border-t border-[oklch(0.94_0.01_230)] pt-2 sm:mt-1.5 sm:pt-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-gray-500 sm:text-xs">{h.price > 0 ? (hasDates ? tr("{0} đêm từ", [nights]) : tr("Giá từ")) : tr("Giá phòng")}</div>
                    <div className="flex flex-wrap items-baseline gap-x-1.5">
                      {h.price > 0 ? (
                        <>
                          {h.old != null && h.old > h.price && (
                            <span className="whitespace-nowrap text-[12px] text-gray-400 line-through sm:text-[14px]">{tr(vnd(h.old))}</span>
                          )}
                          <span className="whitespace-nowrap">
                            <span className="text-[15px] font-extrabold tracking-[-0.02em] min-[400px]:text-[17px] sm:text-[21px]" style={{ color: TH.G }}>{tr(vnd(h.price))}</span>{!hasDates && <span className="text-[11px] text-gray-500 min-[400px]:text-[12px] sm:text-[13px]">{tr("/đêm")}</span>}
                          </span>
                        </>
                      ) : (
                        <span className="text-[15px] font-extrabold tracking-[-0.02em] sm:text-[18px]" style={{ color: TH.G }}>{tr("IB để biết giá")}</span>
                      )}
                    </div>
                  </div>
                  <span className="whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold text-white transition group-hover:bg-sunset-500 sm:px-4 sm:py-2.5 sm:text-sm" style={{ background: TH.G }}>{tr("Xem chi tiết")}</span>
                </div>
              </div>
            </Link>
            );
          })}
          {view === "room" && items.slice(0, limit).map((s, i) => {
            const hit = roomHit(s);
            const cover = hitCover(hit, s.cover);
            return (
            <Link
              key={s.id}
              href={`/homestay/${s.slug}${dateQS}${partyQS}`}
              data-reveal="1"
              className="group flex flex-col overflow-hidden rounded-[22px] border border-[oklch(0.93_0.01_230)] bg-white opacity-0 transition hover:shadow-[0_24px_50px_-24px_oklch(0.3_0.08_260_/.4)]"
              style={{ transform: "translateY(24px)", transitionProperty: "opacity, transform, box-shadow", transitionDuration: ".6s", transitionDelay: `${(i % 3) * 0.08}s` }}
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-gray-100 sm:aspect-[4/3]">
                {cover ? <Image src={cover}alt={s.typeName ? `${tr(s.typeName)}${s.roomName ? ` · ${tr(s.roomName)}` : ""}` : tr(s.name)} fill sizes="(max-width:640px) 50vw, 360px" className="object-cover transition duration-700 group-hover:scale-[1.04]" /> : <div className="flex h-full items-center justify-center text-4xl">🏠</div>}
                {/* Trên ảnh chỉ hiện badge HOT khi được tick Nổi bật (nhiều chip dễ chồng nhau trên mobile). */}
                {(s.roomFeatured || s.featured) && (
                  <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-sunset-500 px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-white shadow-sm sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-xs">🔥 HOT</span>
                )}
                {hit && <SimBadge s={hit.s} />}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3 sm:gap-2 sm:p-5 sm:pt-[18px]">
                <div className="line-clamp-1 text-[11px] font-semibold text-gray-500 sm:text-[13px]">
                  {tr(s.homeName)} · {tr(s.area)}
                  {s.distanceKm != null && (s.distanceKm === 0 ? tr(" · ngay trung tâm") : tr(" · cách trung tâm {0}km", [s.distanceKm.toLocaleString("vi-VN")]))}
                </div>
                <div className="line-clamp-1 text-[15px] font-extrabold leading-[1.25] tracking-[-0.015em] text-ink sm:line-clamp-none sm:text-[19px]">{s.typeName ? `${tr(s.typeName)}${s.roomName ? ` · ${tr(s.roomName)}` : ""}` : tr(s.name)}</div>
                <div className="text-[11px] font-semibold text-gray-500 sm:text-[12px]">
                  {tr("Tối đa")}{" "}{s.capacity}{" "}{tr("khách")}{s.count > 1 ? tr(" · {0} phòng loại này", [s.count]) : ""}
                  {s.status !== "none" && <span className="ml-1.5 inline-block whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-bold sm:text-[11px]" style={{ background: STATUS[s.status].bg, color: STATUS[s.status].fg }}>{tr(STATUS[s.status].text(s.freeRooms, tr))}</span>}
                </div>
                {(() => {
                  const tags = AMENITIES.filter((a) => s.amen?.[a.key]);
                  if (tags.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1">
                      {tags.slice(0, 4).map((a) => (
                        <span key={a.key} className="rounded-full bg-[oklch(0.96_0.02_155)] px-2 py-0.5 text-[10px] font-semibold text-[oklch(0.36_0.08_155)] sm:text-[11px]">{tr(a.icon)} {tr(a.label)}</span>
                      ))}
                      {tags.length > 4 && <span className="rounded-full bg-[oklch(0.96_0.005_230)] px-2 py-0.5 text-[10px] font-semibold text-gray-500 sm:text-[11px]">+{tags.length - 4}</span>}
                    </div>
                  );
                })()}
                <div className="line-clamp-2 text-[13px] leading-[1.5] text-gray-500 sm:line-clamp-3 sm:text-sm sm:leading-[1.55]">{tr(s.desc || homeInfo?.[s.slug]?.desc || s.homeDesc || "")}</div>
                <div className="flex-1" />
                <div className="mt-1 flex flex-wrap items-end justify-between gap-x-2 gap-y-2 border-t border-[oklch(0.94_0.01_230)] pt-2 sm:mt-1.5 sm:pt-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-gray-500 sm:text-xs">{s.price > 0 ? (hasDates ? tr("{0} đêm từ", [nights]) : tr("Giá từ")) : tr("Giá phòng")}</div>
                    {/* flex-wrap: thẻ 2 cột trên mobile rất hẹp → giá gạch tự xuống dòng thay vì đẩy giá bán tràn khỏi thẻ. */}
                    <div className="flex flex-wrap items-baseline gap-x-1.5">
                      {s.price > 0 ? (() => {
                        // Có ngày: dùng TỔNG cả kỳ (giá bán & giá gạch theo thứ) nếu tính được;
                        // chưa có thì nhân cứng per-night × số đêm như cũ.
                        const shown = hasDates ? (s.stayTotal ?? s.price * nights) : s.price;
                        const old = hasDates ? (s.stayTotal != null ? s.stayOld : (s.priceOld != null ? s.priceOld * nights : null)) : s.priceOld;
                        return (
                        <>
                          {old != null && old > shown && (
                            <span className="whitespace-nowrap text-[12px] text-gray-400 line-through sm:text-[14px]">{tr(vnd(old))}</span>
                          )}
                          <span className="whitespace-nowrap">
                            <span className="text-[15px] font-extrabold tracking-[-0.02em] min-[400px]:text-[17px] sm:text-[21px]" style={{ color: TH.G }}>{tr(vnd(shown))}</span>{!hasDates && <span className="text-[11px] text-gray-500 min-[400px]:text-[12px] sm:text-[13px]">{tr("/đêm")}</span>}
                          </span>
                        </>
                        );
                      })() : (
                        <span className="text-[15px] font-extrabold tracking-[-0.02em] sm:text-[18px]" style={{ color: TH.G }}>{tr("IB để biết giá")}</span>
                      )}
                    </div>
                  </div>
                  <span className="whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold text-white transition group-hover:bg-sunset-500 sm:px-4 sm:py-2.5 sm:text-sm" style={{ background: TH.G }}>{tr("Xem chi tiết")}</span>
                </div>
              </div>
            </Link>
            );
          })}
        </div>
        {shownCount > limit && (
          <div ref={moreRef} className="mt-6 flex justify-center">
            <button type="button" onClick={() => setLim({ k: fkey, n: limit + PAGE })} className="rounded-full border border-[oklch(0.88_0.02_230)] bg-white px-6 py-3 text-sm font-bold text-ink hover:bg-gray-50">
              {tr(view === "home" ? "Xem thêm {0} homestay (còn {1})" : "Xem thêm {0} phòng (còn {1})", [Math.min(PAGE, shownCount - limit), shownCount - limit])}
            </button>
          </div>
        )}
        {items.length === 0 && (
          <div className="flex flex-col items-center gap-2.5 rounded-[22px] border border-dashed border-[oklch(0.85_0.02_230)] bg-white px-6 py-14 text-center">
            <div className="text-[19px] font-extrabold text-ink">{view === "home" ? tr("Không có homestay phù hợp") : tr("Không có phòng phù hợp")}</div>
            <div className="max-w-[420px] text-[15px] text-gray-500">{tr("Thử đổi ngày hoặc khoảng giá. Hoặc gọi")}{" "}<SitePhone />, <We />{" "}{tr("tìm chỗ giúp.")}</div>
            <button type="button" onClick={clearAll} className="mt-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-white" style={{ background: TH.G }}>{tr("Xoá bộ lọc")}</button>
          </div>
        )}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Nhóm trường có số thứ tự tròn — như ô tìm combo (Combo v3). */
function SearchGroup({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-extrabold tracking-[0.08em] text-[oklch(0.45_0.06_158)]">
        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-forest-700 text-[11px] text-white">{n}</span>
        {title}
      </div>
      {children}
    </div>
  );
}
