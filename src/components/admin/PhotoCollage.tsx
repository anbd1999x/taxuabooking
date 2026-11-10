"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveCollagePresets } from "@/app/admin/ghep-anh/actions";

export interface CollagePhoto {
  id: string;
  url: string;
  tag: string; // "home" | roomTypeId | "up"
  label: string;
}

export interface CollageHome {
  id: string;
  name: string;
  published: boolean;
  loc: string;
  pros: string;
  cons: string;
  sMin: string;
  sMax: string;
  cMin: string;
  cMax: string;
  tags: { key: string; name: string }[];
  photos: CollagePhoto[];
}

type Fields = {
  name: string; loc: string; pros: string; cons: string;
  sMin: string; sMax: string; unit: string; cMin: string; cMax: string; cUnit: string;
};
/** Các chữ "cố định" trên ảnh — giờ đều sửa được. */
type Labels = {
  kicker: string; pros: string; cons: string; markPro: string; markCon: string;
  single: string; combo: string; note: string; brand: string; contact: string;
};
type ShowKey = "kicker" | "name" | "loc" | "pros" | "cons" | "single" | "combo" | "note" | "footer";
type Theme = { name: string; bg: string; cardBg: string; ink: string; sub: string; acc: string; box: string; pro: string; con: string };
type Box = { x: number; y: number; w: number; h: number };

const FMT = { sq: [1080, 1080, "Vuông 1:1"], pt: [1080, 1350, "Dọc 4:5"], st: [1080, 1920, "Story 9:16"] } as const;
type FmtKey = keyof typeof FMT;
const THEMES: Record<string, Theme> = {
  forest: { name: "Núi rừng", bg: "#1f3a2e", cardBg: "rgba(31,58,46,0.93)", ink: "#ffffff", sub: "#c9d8cc", acc: "#f2b866", box: "#3a5a48", pro: "#a6dfae", con: "#f6b08f" },
  cream: { name: "Kem sáng", bg: "#f6f1e7", cardBg: "rgba(246,241,231,0.95)", ink: "#1e2b24", sub: "#5d6b62", acc: "#d4652a", box: "#e9e0cd", pro: "#2f7a4a", con: "#c2502a" },
  sunset: { name: "Hoàng hôn", bg: "#b9532a", cardBg: "rgba(185,83,42,0.93)", ink: "#ffffff", sub: "#ffe0cc", acc: "#fff0bd", box: "#cf6c42", pro: "#fff0bd", con: "#ffd3bf" },
};
const SHOWS: [ShowKey, string][] = [
  ["kicker", "Dòng tiêu đề nhỏ"], ["name", "Tên home"], ["loc", "Vị trí"], ["pros", "Ưu điểm"], ["cons", "Nhược điểm"],
  ["single", "Giá lẻ"], ["combo", "Giá combo"], ["note", "Ghi chú giá"], ["footer", "Chân ảnh"],
];

/** Font Google có hỗ trợ tiếng Việt. "" = font mặc định của web (Be Vietnam Pro qua next/font). */
const FONTS: { key: string; label: string; weights: string }[] = [
  { key: "", label: "Be Vietnam Pro (mặc định)", weights: "" },
  { key: "Montserrat", label: "Montserrat", weights: "500;600;700;800" },
  { key: "Nunito", label: "Nunito", weights: "500;600;700;800" },
  { key: "Lexend", label: "Lexend", weights: "500;600;700;800" },
  { key: "Quicksand", label: "Quicksand", weights: "500;600;700" },
  { key: "Oswald", label: "Oswald", weights: "500;600;700" },
  { key: "Playfair Display", label: "Playfair Display (có chân)", weights: "500;600;700;800" },
  { key: "Lora", label: "Lora (có chân)", weights: "500;600;700" },
  { key: "Dancing Script", label: "Dancing Script (viết tay)", weights: "500;600;700" },
  { key: "Pacifico", label: "Pacifico (viết tay)", weights: "" },
];
const FONT_HREF =
  "https://fonts.googleapis.com/css2?" +
  FONTS.filter((x) => x.key)
    .map((x) => "family=" + x.key.replace(/ /g, "+") + (x.weights ? ":wght@" + x.weights : ""))
    .join("&") +
  "&display=swap";

const G = "oklch(0.29 0.055 160)";
const O = "oklch(0.68 0.18 45)";
const BORDER = "oklch(0.88 0.015 160)";
const DIACRITICS = /[̀-ͯ]/g;

const digits = (v: string) => +String(v || "").replace(/\D/g, "");
const money = (v: string) => {
  const n = digits(v);
  return n ? n.toLocaleString("vi-VN") + "đ" : "";
};
const range = (x: string, y: string, u: string) => {
  const a = money(x), b = money(y);
  if (!a && !b) return "";
  return (a && b && a !== b ? `${a} – ${b}` : a || b) + (u || "");
};
/** Ghi gọn cho ảnh khi chật: 550.000 → 550k, 1.290.000 → 1,29tr. */
const short = (v: string) => {
  const n = digits(v);
  if (!n) return "";
  if (n >= 1_000_000) return (Math.round(n / 10_000) / 100).toLocaleString("vi-VN") + "tr";
  return Math.round(n / 1000) + "k";
};
const shortRange = (x: string, y: string, u: string) => {
  const a = short(x), b = short(y);
  if (!a && !b) return "";
  return (a && b && a !== b ? `${a} – ${b}` : a || b) + (u || "");
};
const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);
const fillOf = (h: CollageHome): Fields => ({
  name: h.name, loc: h.loc, pros: h.pros, cons: h.cons,
  sMin: h.sMin, sMax: h.sMax, unit: "/đêm", cMin: h.cMin, cMax: h.cMax, cUnit: "/người",
});
const slug = (t: string) =>
  t.normalize("NFD").replace(DIACRITICS, "").replace(/đ/gi, "d").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
const defaultLabels = (domain: string, phone: string): Labels => ({
  kicker: "REVIEW HOMESTAY TÀ XÙA",
  pros: "ƯU ĐIỂM",
  cons: "NHƯỢC ĐIỂM",
  markPro: "✓",
  markCon: "–",
  single: "Giá lẻ",
  combo: "Giá combo",
  note: "Giá tham khảo · giá chính thức chốt bill qua Zalo",
  brand: "Tà Xùa Booking",
  contact: `${domain} · ${phone}`,
});

type ItemKey = "kicker" | "name" | "loc" | "pros" | "cons" | "single" | "combo" | "note" | "footer";
type ItemBox = Box & { key: ItemKey };
type Offsets = Partial<Record<ItemKey, { x: number; y: number }>>;
type ColorKey = "bg" | "ink" | "sub" | "acc" | "pro" | "con" | "box";
const ITEM_NAMES: Record<ItemKey, string> = {
  kicker: "Dòng tiêu đề nhỏ", name: "Tên home", loc: "Vị trí", pros: "Ưu điểm", cons: "Nhược điểm",
  single: "Ô giá lẻ", combo: "Ô giá combo", note: "Ghi chú giá", footer: "Chân ảnh",
};
const COLOR_FIELDS: [ColorKey, string][] = [
  ["ink", "Chữ chính"], ["sub", "Chữ phụ"], ["acc", "Màu nhấn · nền ô combo"], ["pro", "Ưu điểm"], ["con", "Nhược điểm"], ["box", "Nền ô giá lẻ"],
];
/** Độ sáng tương đối của màu hex (0 tối – 1 sáng). */
const lum = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

interface RenderOpts {
  c: HTMLCanvasElement | null;
  fmt: FmtKey; theme: string; layout: string; style: string; cardFill: string; cardClear: number; priceFill: boolean;
  colors: Partial<Record<ColorKey, string>>;
  show: Record<ShowKey, boolean>; f: Fields; labels: Labels; single: string; combo: string;
  selPhotos: CollagePhoto[]; titleFont: string; bodyFont: string;
  scale: number; nameScale: number; widthPct: number; pos: { x: number; y: number } | null; offsets: Offsets;
  imgs: Record<string, HTMLImageElement>; baseFam: string; onImg: () => void;
}
interface RenderResult { box: Box; items: ItemBox[]; origin: { x: number; y: number } }

/** Vẽ ảnh ghép lên canvas; trả về khung chữ + từng mục (toạ độ canvas) để kéo thả. */
function renderCollage(o: RenderOpts): RenderResult | null {
  const { c, fmt, theme, layout, style, cardFill, cardClear, priceFill, colors, show, f, labels, single, combo, selPhotos, titleFont, bodyFont, scale, nameScale, widthPct, pos, offsets, imgs, baseFam, onImg } = o;
  if (!c) return null;
  const [W, H] = FMT[fmt];
  const T: Theme = { ...THEMES[theme], ...colors };
  // Màu nền tự chọn → nền thẻ nổi (có nền) dùng cùng màu, hơi trong như theme có sẵn.
  if (colors.bg) {
    const n = parseInt(colors.bg.replace("#", ""), 16);
    T.cardBg = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.93)`;
  }
  if (c.width !== W) c.width = W;
  if (c.height !== H) c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, W, H);
  const ps = selPhotos;
  ps.forEach((p) => {
    if (!imgs[p.url]) {
      const im = new Image();
      if (/^https?:\/\//i.test(p.url) && !p.url.startsWith(location.origin)) im.crossOrigin = "anonymous";
      im.onload = onImg;
      im.src = p.url;
      imgs[p.url] = im;
    }
  });
  const famOf = (kind: "t" | "b") => {
    const k = kind === "t" ? titleFont : bodyFont;
    return k ? `"${k}", ${baseFam}` : baseFam;
  };
  const font = (sz: number, wt: number, kind: "t" | "b" = "b") => { ctx.font = `${wt} ${sz}px ${famOf(kind)}`; };
  const ls = (v: string) => { if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = v; };
  const wrap = (text: string, maxW: number) => {
    const words = String(text).split(/\s+/).filter(Boolean), out: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  };
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  };

  /**
   * Vẽ (hoặc chỉ đo khi draw=false) khối nội dung tại (x, y). Mỗi mục được dịch theo
   * offsets[mục] (kéo thả riêng). Trả về chiều cao bố cục mặc định + khung từng mục.
   */
  const info = (x: number, y: number, w: number, draw: boolean, k0: number) => {
    const k = k0 * (scale / 100);
    let cy = y;
    const items: ItemBox[] = [];
    const Z = (v: number) => Math.round(v * k), sq = k0 < 0.75;
    const txt = (t: string, xx: number, yy: number, col: string) => { if (draw) { ctx.fillStyle = col; ctx.fillText(t, xx, yy); } };
    /** Một mục: vẽ trong vùng (bx, y0, bw), dịch theo offset; body trả về y kết thúc. */
    const item = (key: ItemKey, bx: number, bw: number, y0: number, body: () => number) => {
      const off = offsets[key] ?? { x: 0, y: 0 };
      if (draw) { ctx.save(); ctx.translate(off.x, off.y); }
      const y1 = body();
      if (draw) ctx.restore();
      items.push({ key, x: bx + off.x, y: y0 + off.y, w: bw, h: Math.max(1, y1 - y0) });
      return y1;
    };
    ctx.textBaseline = "top"; ctx.textAlign = "left";
    if (show.kicker && labels.kicker.trim()) {
      cy = item("kicker", x, w, cy, () => {
        let yy = cy;
        ls("3px"); font(Z(20), 800, "t");
        wrap(labels.kicker, w).slice(0, 2).forEach((l) => { txt(l, x, yy, T.acc); yy += Z(32); });
        ls("0px");
        return yy;
      }) + Z(4);
    }
    if (show.name && f.name) {
      cy = item("name", x, w, cy, () => {
        let yy = cy;
        const ns = Z(60 * (nameScale / 100));
        font(ns, 800, "t");
        wrap(f.name, w).slice(0, sq ? 2 : 3).forEach((l) => { txt(l, x, yy, T.ink); yy += Math.round(ns * 1.17); });
        return yy;
      });
    }
    if (show.loc && f.loc) {
      cy = item("loc", x, w, cy, () => {
        let yy = cy;
        font(Z(26), 600);
        if (draw) { ctx.fillStyle = T.acc; ctx.beginPath(); ctx.arc(x + 8, yy + Z(15), Math.max(4, Z(8)), 0, Math.PI * 2); ctx.fill(); }
        wrap(f.loc, w - 28).slice(0, 2).forEach((l) => { txt(l, x + 26, yy, T.sub); yy += Z(36); });
        return yy;
      });
    }
    const lim = sq ? 2 : 3;
    const pros = show.pros ? lines(f.pros).slice(0, lim) : [];
    const cons = show.cons ? lines(f.cons).slice(0, lim) : [];
    if (pros.length || cons.length) {
      cy += Z(22);
      const top = cy;
      const two = pros.length > 0 && cons.length > 0, cw = two ? (w - 36) / 2 : w;
      const col = (rows: string[], cx: number, head: string, c: string, mark: string) => {
        let yy = top;
        if (head.trim()) { ls("2px"); font(Z(19), 800); txt(head, cx, yy, c); ls("0px"); yy += Z(34); }
        font(Z(25), 500);
        const indent = mark ? Z(30) : 0;
        rows.forEach((it) => {
          const ws = wrap(it, cw - indent - 2);
          if (draw && mark) { ctx.fillStyle = c; font(Z(25), 800); ctx.fillText(mark, cx, yy); font(Z(25), 500); }
          ws.forEach((l) => { txt(l, cx + indent, yy, T.ink); yy += Z(34); });
          yy += Z(6);
        });
        return yy;
      };
      let h1 = top, h2 = top;
      if (pros.length) h1 = item("pros", x, cw, top, () => col(pros, x, labels.pros, T.pro, labels.markPro));
      if (cons.length) {
        const cx = two ? x + cw + 36 : x;
        h2 = item("cons", cx, cw, top, () => col(cons, cx, labels.cons, T.con, labels.markCon));
      }
      cy = Math.max(h1, h2);
    }
    const prices = [
      show.single && single ? ["single", labels.single, single, shortRange(f.sMin, f.sMax, f.unit)] : null,
      show.combo && combo ? ["combo", labels.combo, combo, shortRange(f.cMin, f.cMax, f.cUnit)] : null,
    ].filter(Boolean) as [ItemKey, string, string, string][];
    if (prices.length) {
      // Giá lẻ & giá combo luôn nằm CÙNG 1 HÀNG (2 ô cạnh nhau); chữ tự thu nhỏ cho vừa ô.
      cy += Z(18);
      const gap = 16, bw = (w - gap * (prices.length - 1)) / prices.length, bh = Z(priceFill ? 104 : 88);
      const pad = priceFill ? 22 : 0; // không nền ô → chữ thẳng hàng với lề khung
      const top = cy;
      prices.forEach(([key, l, full, compact], i) => {
        const bx = x + i * (bw + gap);
        const hi = i === prices.length - 1 && prices.length > 1;
        item(key, bx, bw, top, () => {
          if (draw && priceFill) { ctx.fillStyle = hi ? T.acc : T.box; rr(bx, top, bw, bh, 18); ctx.fill(); }
          // Có nền: ô nhấn dùng chữ màu nền; không nền: giá combo tô màu nhấn.
          const ic = priceFill ? (hi ? T.bg : T.ink) : hi ? T.acc : T.ink;
          const lc = priceFill ? (hi ? T.bg : T.sub) : T.sub;
          font(Z(19), 700);
          txt(l, bx + pad, top + Z(16), lc);
          // Ghi đầy đủ không vừa ô ở cỡ chữ đủ to → chuyển sang ghi gọn (k / tr).
          font(Z(28), 800, "t");
          const v = ctx.measureText(full).width > bw - pad * 2 - 4 ? compact : full;
          let fs = Z(36);
          font(fs, 800, "t");
          while (ctx.measureText(v).width > bw - pad * 2 - 4 && fs > 16) { fs -= 1; font(fs, 800, "t"); }
          txt(v, bx + pad, top + Z(46), ic);
          return top + bh;
        });
      });
      cy = top + bh;
      if (show.note && labels.note.trim()) {
        cy += Z(12);
        cy = item("note", x, w, cy, () => {
          let yy = cy;
          font(Z(18), 500);
          wrap(labels.note, w).slice(0, 2).forEach((l) => { txt(l, x, yy, T.sub); yy += Z(26); });
          return yy;
        });
      }
    }
    if (show.footer && (labels.brand.trim() || labels.contact.trim())) {
      cy += Z(22);
      cy = item("footer", x, w, cy, () => {
        let yy = cy;
        if (draw) { ctx.fillStyle = T.sub; ctx.globalAlpha = 0.35; ctx.fillRect(x, yy, w, 1.5); ctx.globalAlpha = 1; }
        yy += Z(18);
        font(Z(21), 800, "t");
        const bW = labels.brand.trim() ? ctx.measureText(labels.brand).width : 0;
        font(Z(21), 600);
        const cW = ctx.measureText(labels.contact).width;
        const oneRow = bW + cW + 24 <= w;
        font(Z(21), 800, "t"); txt(labels.brand, x, yy, T.ink);
        font(Z(21), 600);
        if (oneRow) {
          if (draw) { ctx.textAlign = "right"; ctx.fillStyle = T.sub; ctx.fillText(labels.contact, x + w, yy); ctx.textAlign = "left"; }
          yy += Z(28);
        } else {
          if (bW) yy += Z(30);
          txt(labels.contact, x, yy, T.sub);
          yy += Z(28);
        }
        return yy;
      });
    }
    return { h: cy - y, items };
  };

  const cells = (n: number, x: number, y: number, w: number, h: number, g: number): number[][] => {
    const grid = (n: number, x: number, y: number, w: number, h: number, cols?: number) => {
      const cc = cols || (n <= 2 ? n : n <= 4 ? 2 : n <= 9 ? 3 : 4);
      const rows = Math.ceil(n / cc), rh = (h - g * (rows - 1)) / rows, out: number[][] = [];
      let i = 0;
      for (let r = 0; r < rows; r++) {
        const k = Math.min(cc, n - i), cw = (w - g * (k - 1)) / k;
        for (let j = 0; j < k; j++) { out.push([x + j * (cw + g), y + r * (rh + g), cw, rh]); i++; }
      }
      return out;
    };
    if (n <= 0) return [];
    if (n === 1 || layout === "grid") return grid(n, x, y, w, h);
    if (layout === "hero") {
      const hh = (h - g) * (n <= 3 ? 0.6 : 0.58), m = n - 1;
      return [[x, y, w, hh], ...grid(m, x, y + hh + g, w, h - hh - g, m <= 4 ? m : Math.ceil(m / 2))];
    }
    const lw = (w - g) * 0.58, m = n - 1, cols = m <= 3 ? 1 : 2, rows = Math.ceil(m / cols), out = [[x, y, lw, h]], rw = w - lw - g, rh = (h - g * (rows - 1)) / rows;
    for (let i = 0; i < m; i++) {
      const r = Math.floor(i / cols), c2 = i % cols, k = Math.min(cols, m - r * cols), cw2 = (rw - g * (k - 1)) / k;
      out.push([x + lw + g + c2 * cw2 + c2 * g, y + r * (rh + g), cw2, rh]);
    }
    return out;
  };

  const drawPhoto = (p: CollagePhoto, x: number, y: number, w: number, h: number, r: number) => {
    ctx.save(); rr(x, y, w, h, r); ctx.clip();
    const im = imgs[p.url];
    if (im && im.complete && im.naturalWidth) {
      const s = Math.max(w / im.naturalWidth, h / im.naturalHeight), iw = im.naturalWidth * s, ih = im.naturalHeight * s;
      ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    } else {
      ctx.fillStyle = "#dfe7e2"; ctx.fillRect(x, y, w, h);
      ctx.font = `600 ${Math.max(14, Math.min(26, w / 14))}px ${baseFam}`;
      ctx.fillStyle = "rgba(30,43,36,0.6)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("Đang tải ảnh…", x + w / 2, y + h / 2, w - 20);
      ctx.textAlign = "left"; ctx.textBaseline = "top";
    }
    ctx.restore();
  };

  const clampBox = (bx: number, by: number, bw: number, bh: number) => ({
    x: Math.round(Math.min(Math.max(0, bx), Math.max(0, W - bw))),
    y: Math.round(Math.min(Math.max(0, by), Math.max(0, H - bh))),
  });
  /** Hợp khung mặc định với khung các mục đã kéo lệch (mục đo ở gốc 0,0 → dịch dx, dy). */
  const unionOf = (b: Box, its: ItemBox[], dx: number, dy: number, padding: number): Box => {
    let x1 = b.x, y1 = b.y, x2 = b.x + b.w, y2 = b.y + b.h;
    for (const it of its) {
      x1 = Math.min(x1, it.x + dx - padding); y1 = Math.min(y1, it.y + dy - padding);
      x2 = Math.max(x2, it.x + dx + it.w + padding); y2 = Math.max(y2, it.y + dy + it.h + padding);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };

  const K = { sq: 0.7, pt: 0.78, st: 0.95 }[fmt];
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
  if (style === "panel") {
    const m = 18, pad = 44, iw = Math.round((W - pad * 2) * (widthPct / 100));
    const ih = info(0, 0, iw, false, K).h;
    const photoH = Math.max(H * 0.5, H - ih - pad - 28 - m);
    cells(ps.length, m, m, W - m * 2, photoH, 8).forEach((r, i) => drawPhoto(ps[i], r[0], r[1], r[2], r[3], 14));
    const p = clampBox(pos?.x ?? pad, pos?.y ?? m + photoH + 28, iw, ih);
    const { items } = info(p.x, p.y, iw, true, K);
    return { box: unionOf({ x: p.x, y: p.y, w: iw, h: ih }, items, 0, 0, 0), items, origin: p };
  }
  cells(ps.length, 0, 0, W, H, 6).forEach((r, i) => drawPhoto(ps[i], r[0], r[1], r[2], r[3], 0));
  const cm = 32, cp = 32, k = K * 0.92;
  const cw = Math.round((W - cm * 2) * (widthPct / 100));
  const measured = info(0, 0, cw - cp * 2, false, k), ch = measured.h + cp * 2;
  const p = clampBox(pos?.x ?? cm, pos?.y ?? H - cm - ch, cw, ch);
  // Nền thẻ phủ cả các mục đã kéo lệch ra ngoài bố cục mặc định.
  const card = unionOf({ x: p.x, y: p.y, w: cw, h: ch }, measured.items, p.x + cp, p.y + cp, cp);
  let items: ItemBox[];
  if (cardFill === "solid") {
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
    ctx.fillStyle = T.cardBg; rr(card.x, card.y, card.w, card.h, 32); ctx.fill(); ctx.restore();
    items = info(p.x + cp, p.y + cp, cw - cp * 2, true, k).items;
  } else {
    // Thẻ trong suốt: nền màu theme với độ trong suốt tuỳ chỉnh (100% = không nền).
    // Chữ đọc được nhờ bóng đổ quanh chữ — nền càng trong, bóng càng đậm.
    const a = Math.max(0, Math.min(1, 1 - cardClear / 100));
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = T.bg;
      rr(card.x, card.y, card.w, card.h, 32); ctx.fill(); ctx.restore();
    }
    const sh = 0.25 + 0.65 * (1 - a);
    ctx.save();
    ctx.shadowColor = lum(T.ink) > 0.55 ? `rgba(0,0,0,${sh.toFixed(2)})` : `rgba(255,255,255,${Math.min(1, sh + 0.05).toFixed(2)})`;
    ctx.shadowBlur = 14; ctx.shadowOffsetY = 2;
    items = info(p.x + cp, p.y + cp, cw - cp * 2, true, k).items;
    ctx.restore();
  }
  return { box: card, items, origin: p };
}

// ---------- Lưu thẳng vào thư mục trên máy (File System Access API – Chrome/Edge máy tính) ----------
type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (o: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: "readwrite" }) => Promise<PermissionState>;
};
type DirPickerWindow = Window & { showDirectoryPicker?: (o?: { mode?: "readwrite"; id?: string }) => Promise<DirHandle> };
const IDB_NAME = "taxua-collage", IDB_STORE = "kv", IDB_DIR_KEY = "saveDir";
/** Nhớ thư mục đã chọn giữa các lần mở trang (IndexedDB giữ được handle; localStorage thì không). */
function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(IDB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(IDB_STORE);
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        try {
          const req = run(open.result.transaction(IDB_STORE, mode).objectStore(IDB_STORE));
          req.onsuccess = () => resolve(req.result as T);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      };
    } catch {
      resolve(undefined);
    }
  });
}
/** Tên file chưa có trong thư mục: abc.png → abc-2.png → abc-3.png… (không ghi đè ảnh cũ). */
async function freeName(dir: DirHandle, base: string, ext: string): Promise<string> {
  for (let i = 1; i < 200; i++) {
    const name = i === 1 ? `${base}.${ext}` : `${base}-${i}.${ext}`;
    try {
      await dir.getFileHandle(name);
    } catch {
      return name; // chưa tồn tại
    }
  }
  return `${base}-${Date.now()}.${ext}`;
}

/** Mẫu bố cục đã lưu: chỉ thiết lập trình bày, không gồm ảnh / nội dung riêng của home. */
interface Preset {
  id: string;
  name: string;
  isDefault?: boolean;
  fmt: FmtKey; layout: string; style: string; theme: string;
  cardFill: string; cardClear: number; priceFill: boolean;
  colors: Partial<Record<ColorKey, string>>;
  show: Record<ShowKey, boolean>;
  labels: Labels;
  titleFont: string; bodyFont: string;
  scale: number; nameScale: number; widthPct: number;
  pos: { x: number; y: number } | null;
  offsets: Offsets;
  dragMode: string;
  unit: string; cUnit: string;
}

/** Đọc mẫu từ DB an toàn: thiếu/sai trường nào thì lấy mặc định trường đó. */
function cleanPreset(raw: unknown, domain: string, phone: string): Preset | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const obj = <T,>(v: unknown, d: T): T => (v && typeof v === "object" ? { ...d, ...(v as object) } : d);
  const fmt = str(r.fmt, "pt");
  const pos = r.pos && typeof r.pos === "object" ? (r.pos as { x: number; y: number }) : null;
  return {
    id: str(r.id, String(Date.now())),
    name: str(r.name, "Mẫu"),
    isDefault: r.isDefault === true,
    fmt: (fmt in FMT ? fmt : "pt") as FmtKey,
    layout: str(r.layout, "hero"),
    style: str(r.style, "panel"),
    theme: str(r.theme, "forest") in THEMES ? str(r.theme, "forest") : "forest",
    cardFill: str(r.cardFill, "solid"),
    cardClear: num(r.cardClear, 100),
    priceFill: typeof r.priceFill === "boolean" ? r.priceFill : true,
    colors: obj(r.colors, {}),
    show: obj(r.show, { kicker: true, name: true, loc: true, pros: true, cons: true, single: true, combo: true, note: true, footer: true }),
    labels: obj(r.labels, defaultLabels(domain, phone)),
    titleFont: str(r.titleFont, ""),
    bodyFont: str(r.bodyFont, ""),
    scale: num(r.scale, 100),
    nameScale: num(r.nameScale, 100),
    widthPct: num(r.widthPct, 100),
    pos: pos && typeof pos.x === "number" && typeof pos.y === "number" ? { x: pos.x, y: pos.y } : null,
    offsets: obj(r.offsets, {}),
    dragMode: str(r.dragMode, "item"),
    unit: str(r.unit, "/đêm"),
    cUnit: str(r.cUnit, "/người"),
  };
}

export function PhotoCollage({ homes, phone, domain, initialPresets = [] }: { homes: CollageHome[]; phone: string; domain: string; initialPresets?: unknown[] }) {
  const [presets, setPresets] = useState<Preset[]>(() =>
    initialPresets.map((x) => cleanPreset(x, domain, phone)).filter((x): x is Preset => !!x),
  );
  // Mẫu mặc định → làm giá trị KHỞI TẠO cho mọi thiết lập (mở trang là đúng format đã lưu).
  const [def] = useState<Preset | undefined>(() => presets.find((x) => x.isDefault));
  const [presetName, setPresetName] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(def?.id ?? null);
  const [savingPreset, startSave] = useTransition();
  const first = homes.find((h) => h.photos.length >= 2) ?? homes[0];
  const [homeId, setHomeId] = useState(first?.id ?? "");
  const [sel, setSel] = useState<string[]>(() => (first ? first.photos.slice(0, 4).map((p) => p.id) : []));
  const [tag, setTag] = useState("all");
  const [fmt, setFmt] = useState<FmtKey>(def?.fmt ?? "pt");
  const [layout, setLayout] = useState(def?.layout ?? "hero");
  const [style, setStyle] = useState(def?.style ?? "panel");
  const [theme, setTheme] = useState(def?.theme ?? "forest");
  const [cardFill, setCardFill] = useState(def?.cardFill ?? "solid"); // thẻ nổi: "solid" = có nền | "none" = trong suốt
  const [cardClear, setCardClear] = useState(def?.cardClear ?? 100); // độ trong suốt nền thẻ khi "Trong suốt" (100 = không nền)
  const [priceFill, setPriceFill] = useState(def?.priceFill ?? true); // nền ô giá lẻ / combo
  const [colors, setColors] = useState<Partial<Record<ColorKey, string>>>(def?.colors ?? {}); // màu chữ tự chọn (ghi đè màu theo nền)
  const [offsets, setOffsets] = useState<Offsets>(def?.offsets ?? {}); // vị trí riêng từng mục (kéo thả)
  const [dragMode, setDragMode] = useState(def?.dragMode ?? "item"); // "item" = kéo từng mục | "block" = kéo cả khung
  const [show, setShow] = useState<Record<ShowKey, boolean>>(def?.show ?? { kicker: true, name: true, loc: true, pros: true, cons: true, single: true, combo: true, note: true, footer: true });
  const [f, setF] = useState<Fields>(() => {
    const base = first ? fillOf(first) : { name: "", loc: "", pros: "", cons: "", sMin: "", sMax: "", unit: "/đêm", cMin: "", cMax: "", cUnit: "/người" };
    return def ? { ...base, unit: def.unit, cUnit: def.cUnit } : base;
  });
  const [labels, setLabels] = useState<Labels>(() => def?.labels ?? defaultLabels(domain, phone));
  // Font & cỡ chữ
  const [titleFont, setTitleFont] = useState(def?.titleFont ?? "");
  const [bodyFont, setBodyFont] = useState(def?.bodyFont ?? "");
  const [scale, setScale] = useState(def?.scale ?? 100); // % cỡ chữ toàn khung
  const [nameScale, setNameScale] = useState(def?.nameScale ?? 100); // % cỡ tên home (so với cỡ chung)
  const [widthPct, setWidthPct] = useState(def?.widthPct ?? 100); // % độ rộng khung chữ
  // Vị trí khung chữ (góc trên-trái, toạ độ canvas). null = vị trí mặc định.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(def?.pos ?? null);
  const [capEdit, setCapEdit] = useState<string | null>(null); // caption sửa tay (null = tự sinh)
  const [uploads, setUploads] = useState<Record<string, CollagePhoto[]>>({});
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const [tick, setTick] = useState(0); // ảnh/font tải xong → vẽ lại
  const [saveDir, setSaveDir] = useState<DirHandle | null>(null); // thư mục lưu đã chọn
  const [dirSupported, setDirSupported] = useState(false);
  const [saveCaption, setSaveCaption] = useState(false); // lưu kèm caption .txt vào thư mục
  const [fontCss, setFontCss] = useState(0); // stylesheet font Google tải xong → nạp lại font đang chọn
  const [hover, setHover] = useState<ItemKey | "block" | null>(null);
  const [dragging, setDragging] = useState(false);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const imgs = useRef<Record<string, HTMLImageElement>>({});
  const baseFam = useRef('"Be Vietnam Pro", system-ui, sans-serif');
  const layoutRef = useRef<RenderResult | null>(null); // khung chữ + từng mục vừa vẽ (để kéo thả)
  const overlayRef = useRef<HTMLCanvasElement>(null); // lớp viền gợi ý khi rê/kéo (không xuất ra PNG)
  const drag = useRef<
    { kind: "block"; dx: number; dy: number } | { kind: "item"; key: ItemKey; sx: number; sy: number; ox: number; oy: number } | null
  >(null);
  const tt = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const home = homes.find((h) => h.id === homeId);
  const allPhotos = useMemo(() => [...(uploads[homeId] ?? []), ...(home?.photos ?? [])], [uploads, homeId, home]);
  const byId = useMemo(() => new Map(allPhotos.map((p) => [p.id, p])), [allPhotos]);
  const selPhotos = useMemo(() => sel.map((id) => byId.get(id)).filter((p): p is CollagePhoto => !!p), [sel, byId]);
  const selN = selPhotos.length;
  const single = range(f.sMin, f.sMax, f.unit);
  const combo = range(f.cMin, f.cMax, f.cUnit);

  const toastMsg = useCallback((t: string) => {
    clearTimeout(tt.current);
    setToast(t);
    tt.current = setTimeout(() => setToast(""), 2200);
  }, []);

  useEffect(() => {
    // next/font đặt tên font riêng (biến CSS) → lấy đúng family đang dùng để vẽ canvas.
    const fam = getComputedStyle(document.body).fontFamily;
    if (fam) baseFam.current = fam;
    // Nạp các font Google để chọn (1 lần).
    if (!document.querySelector(`link[data-collage-fonts]`)) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = FONT_HREF;
      l.dataset.collageFonts = "1";
      l.onload = () => setFontCss((n) => n + 1);
      document.head.appendChild(l);
    }
    document.fonts?.ready.then(() => setTick((n) => n + 1));
    // Thư mục lưu đã chọn lần trước (chỉ trình duyệt hỗ trợ chọn thư mục).
    if (typeof (window as DirPickerWindow).showDirectoryPicker === "function") {
      idb<DirHandle>("readonly", (s) => s.get(IDB_DIR_KEY)).then((h) => {
        setDirSupported(true);
        if (h) setSaveDir(h);
      });
    }
    return () => clearTimeout(tt.current);
  }, []);

  // Đổi font → chờ font tải xong (đủ các độ đậm dùng trên ảnh) rồi vẽ lại.
  useEffect(() => {
    const fams = [titleFont, bodyFont].filter(Boolean);
    if (!fams.length || !document.fonts) return;
    Promise.all(
      fams.flatMap((fam) => [500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px "${fam}"`, "Tà Xùa ữ đ"))),
    ).finally(() => setTick((n) => n + 1));
  }, [titleFont, bodyFont, fontCss]);


  // ---------- vẽ canvas ----------
  useEffect(() => {
    layoutRef.current = renderCollage({
      c: cvRef.current, fmt, theme, layout, style, cardFill, cardClear, priceFill, colors, show, f, labels, single, combo, selPhotos,
      titleFont, bodyFont, scale, nameScale, widthPct, pos, offsets, imgs: imgs.current, baseFam: baseFam.current,
      onImg: () => setTick((n) => n + 1),
    });
    // Viền gợi ý mục đang rê/kéo trên lớp phủ riêng.
    const ov = overlayRef.current, main = cvRef.current, L = layoutRef.current;
    if (!ov || !main) return;
    if (ov.width !== main.width) ov.width = main.width;
    if (ov.height !== main.height) ov.height = main.height;
    const g = ov.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, ov.width, ov.height);
    const target = !L || !hover ? null : hover === "block" ? L.box : L.items.find((it) => it.key === hover) ?? null;
    if (target) {
      g.setLineDash([12, 8]);
      g.lineWidth = 4;
      g.strokeStyle = "#f08a3c";
      g.strokeRect(target.x - 8, target.y - 8, target.w + 16, target.h + 16);
    }
  }, [fmt, theme, layout, style, cardFill, cardClear, priceFill, colors, show, f, labels, single, combo, selPhotos, titleFont, bodyFont, scale, nameScale, widthPct, pos, offsets, tick, hover]);

  // ---------- kéo thả khung chữ trên canvas ----------
  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget, r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  /** Mục / khung dưới con trỏ: chế độ "từng mục" ưu tiên mục nhỏ nhất chứa điểm. */
  const hitAt = (p: { x: number; y: number }): ItemKey | "block" | null => {
    const L = layoutRef.current;
    if (!L) return null;
    const inside = (b: Box) => p.x >= b.x - 8 && p.x <= b.x + b.w + 8 && p.y >= b.y - 8 && p.y <= b.y + b.h + 8;
    if (dragMode === "item") {
      const hits = L.items.filter(inside).sort((a, b) => a.w * a.h - b.w * b.h);
      if (hits.length) return hits[0].key;
    }
    return inside(L.box) ? "block" : null;
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toCanvas(e), hit = hitAt(p), L = layoutRef.current;
    if (!hit || !L) return;
    if (hit === "block") drag.current = { kind: "block", dx: p.x - L.box.x, dy: p.y - L.box.y };
    else {
      const off = offsets[hit] ?? { x: 0, y: 0 };
      drag.current = { kind: "item", key: hit, sx: p.x, sy: p.y, ox: off.x, oy: off.y };
    }
    setHover(hit);
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toCanvas(e), d = drag.current;
    if (!d) return setHover(hitAt(p));
    if (d.kind === "block") {
      // Khung đã gồm cả mục kéo lệch → quy về gốc bố cục (pos) theo độ lệch hiện tại.
      const L = layoutRef.current;
      if (!L) return;
      const nx = p.x - d.dx, ny = p.y - d.dy;
      setPos({ x: L.origin.x + (nx - L.box.x), y: L.origin.y + (ny - L.box.y) });
    } else {
      const key = d.key;
      setOffsets((cur) => ({ ...cur, [key]: { x: Math.round(d.ox + p.x - d.sx), y: Math.round(d.oy + p.y - d.sy) } }));
    }
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // ---------- caption ----------
  const autoCaption = useMemo(() => {
    const out = [`${f.name.toUpperCase()}${f.loc ? " – " + f.loc : ""}`, ""];
    if (show.pros && lines(f.pros).length) out.push("Ưu điểm:", ...lines(f.pros).map((x) => "+ " + x), "");
    if (show.cons && lines(f.cons).length) out.push("Nhược điểm (nói thật):", ...lines(f.cons).map((x) => "– " + x), "");
    if (show.single && single) out.push(`${labels.single}: ${single}`);
    if (show.combo && combo) out.push(`${labels.combo} (xe cabin khứ hồi + phòng): ${combo}`);
    if (show.note && labels.note.trim()) out.push(labels.note.replace(/\s·\s/g, ", ") + ".");
    out.push("", `Đặt phòng & xem phòng trống theo ngày: ${domain}`, `Zalo/ĐT: ${phone}`, "#tàxùa #homestaytàxùa #sănmâytàxùa");
    return out.join("\n");
  }, [f, show, labels, single, combo, domain, phone]);
  const caption = capEdit ?? autoCaption;

  // ---------- actions ----------
  const toggle = (id: string) => {
    if (sel.includes(id)) return setSel(sel.filter((x) => x !== id));
    if (sel.length >= 10) return toastMsg("Tối đa 10 ảnh");
    setSel([...sel, id]);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= sel.length) return;
    const a = [...sel];
    [a[i], a[j]] = [a[j], a[i]];
    setSel(a);
  };
  const pickHome = (id: string) => {
    const h = homes.find((x) => x.id === id);
    if (!h) return;
    setHomeId(id);
    setSel(h.photos.slice(0, 4).map((p) => p.id));
    setF((cur) => ({ ...fillOf(h), unit: cur.unit, cUnit: cur.cUnit })); // giữ đơn vị giá đang dùng
    setCapEdit(null);
    setTag("all");
  };
  const setField = (k: keyof Fields) => (e: { target: { value: string } }) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const setLabel = (k: keyof Labels) => (e: { target: { value: string } }) => setLabels((cur) => ({ ...cur, [k]: e.target.value }));

  // ---------- mẫu bố cục (lưu DB, dùng lại lần sau) ----------
  const snapshot = (): Omit<Preset, "id" | "name" | "isDefault"> => ({
    fmt, layout, style, theme, cardFill, cardClear, priceFill, colors, show, labels,
    titleFont, bodyFont, scale, nameScale, widthPct, pos, offsets, dragMode, unit: f.unit, cUnit: f.cUnit,
  });
  const persist = (next: Preset[], okMsg: string) => {
    const prev = presets;
    setPresets(next);
    startSave(async () => {
      const r = await saveCollagePresets(JSON.stringify(next));
      if (r.error) { setPresets(prev); toastMsg(r.error); }
      else toastMsg(okMsg);
    });
  };
  const applyPreset = (pr: Preset) => {
    setFmt(pr.fmt); setLayout(pr.layout); setStyle(pr.style); setTheme(pr.theme);
    setCardFill(pr.cardFill); setCardClear(pr.cardClear); setPriceFill(pr.priceFill); setColors(pr.colors);
    setShow(pr.show); setLabels(pr.labels); setTitleFont(pr.titleFont); setBodyFont(pr.bodyFont);
    setScale(pr.scale); setNameScale(pr.nameScale); setWidthPct(pr.widthPct);
    setPos(pr.pos); setOffsets(pr.offsets); setDragMode(pr.dragMode);
    setF((cur) => ({ ...cur, unit: pr.unit, cUnit: pr.cUnit }));
    setActivePreset(pr.id);
    toastMsg(`Đã áp dụng mẫu “${pr.name}”`);
  };
  const saveNewPreset = () => {
    const name = presetName.trim() || `Mẫu ${presets.length + 1}`;
    const pr: Preset = { id: String(Date.now()), name, isDefault: presets.length === 0, ...snapshot() };
    setPresetName("");
    setActivePreset(pr.id);
    persist([...presets, pr], `Đã lưu mẫu “${name}”${pr.isDefault ? " (mặc định khi mở trang)" : ""}`);
  };
  const overwritePreset = (id: string) => {
    const old = presets.find((x) => x.id === id);
    if (!old) return;
    persist(presets.map((x) => (x.id === id ? { ...x, ...snapshot() } : x)), `Đã cập nhật mẫu “${old.name}”`);
  };
  const deletePreset = (id: string) => {
    const old = presets.find((x) => x.id === id);
    if (!old || !confirm(`Xoá mẫu “${old.name}”?`)) return;
    if (activePreset === id) setActivePreset(null);
    persist(presets.filter((x) => x.id !== id), `Đã xoá mẫu “${old.name}”`);
  };
  const toggleDefault = (id: string) => {
    const on = !presets.find((x) => x.id === id)?.isDefault;
    persist(
      presets.map((x) => ({ ...x, isDefault: on && x.id === id })),
      on ? "Mẫu này sẽ tự áp dụng mỗi khi mở trang" : "Đã bỏ mẫu mặc định",
    );
  };

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!files.length || !homeId) return;
    setUploading(true);
    const added: CollagePhoto[] = [];
    let failed = 0;
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("serviceId", homeId); // lưu vào kho ảnh chung của home
      try {
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j.url) added.push({ id: `up:${Date.now()}:${added.length}`, url: j.url, tag: "up", label: file.name });
        else failed++;
      } catch {
        failed++;
      }
    }
    setUploading(false);
    if (added.length) setUploads((u) => ({ ...u, [homeId]: [...added, ...(u[homeId] ?? [])] }));
    toastMsg(failed ? `Đã thêm ${added.length} ảnh, lỗi ${failed} ảnh` : `Đã thêm ${added.length} ảnh vào kho của home`);
  }

  async function pickDir() {
    const w = window as DirPickerWindow;
    if (!w.showDirectoryPicker) return toastMsg("Trình duyệt này không hỗ trợ chọn thư mục — dùng Chrome/Edge trên máy tính");
    try {
      const h = await w.showDirectoryPicker({ mode: "readwrite", id: "taxua-collage" });
      setSaveDir(h);
      await idb("readwrite", (s) => s.put(h, IDB_DIR_KEY));
      toastMsg(`Ảnh sẽ lưu vào thư mục “${h.name}”`);
    } catch {
      /* người dùng bấm Huỷ */
    }
  }
  async function forgetDir() {
    setSaveDir(null);
    await idb("readwrite", (s) => s.delete(IDB_DIR_KEY));
    toastMsg("Đã bỏ thư mục lưu — ảnh sẽ tải về thư mục Tải xuống");
  }
  const toBlob = (c: HTMLCanvasElement) =>
    new Promise<Blob | null>((resolve) => {
      try {
        c.toBlob((b) => resolve(b), "image/png");
      } catch {
        resolve(null); // canvas bị "bẩn" do ảnh ngoài hệ thống
      }
    });
  async function download() {
    if (selN < 2) return toastMsg("Chọn ít nhất 2 ảnh");
    const c = cvRef.current;
    if (!c) return;
    const b = await toBlob(c);
    if (!b) return toastMsg("Không xuất được ảnh — có ảnh ngoài hệ thống, hãy bỏ ảnh đó");
    const base = `${slug(f.name) || "review"}-${fmt}`;
    // Có thư mục đã chọn → ghi thẳng vào đó (xin lại quyền nếu trình duyệt đã quên).
    if (saveDir) {
      try {
        let perm = (await saveDir.queryPermission?.({ mode: "readwrite" })) ?? "granted";
        if (perm !== "granted") perm = (await saveDir.requestPermission?.({ mode: "readwrite" })) ?? "denied";
        if (perm === "granted") {
          const name = await freeName(saveDir, base, "png");
          const fh = await saveDir.getFileHandle(name, { create: true });
          const wr = await fh.createWritable();
          await wr.write(b);
          await wr.close();
          if (saveCaption) {
            const tn = name.replace(/\.png$/, ".txt");
            const th = await saveDir.getFileHandle(tn, { create: true });
            const tw = await th.createWritable();
            await tw.write(caption);
            await tw.close();
          }
          return toastMsg(`Đã lưu “${name}”${saveCaption ? " + caption" : ""} vào thư mục “${saveDir.name}”`);
        }
        toastMsg("Chưa cấp quyền ghi thư mục — tải về thư mục Tải xuống");
      } catch {
        toastMsg("Không ghi được vào thư mục đã chọn — tải về thư mục Tải xuống");
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `${base}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    if (!saveDir) toastMsg("Đang tải ảnh về máy");
  }
  function copyCaption() {
    (navigator.clipboard ? navigator.clipboard.writeText(caption) : Promise.reject()).then(
      () => toastMsg("Đã sao chép caption"),
      () => toastMsg("Không sao chép được, hãy bôi đen để copy"),
    );
  }

  // ---------- UI ----------
  const tagList = [
    { key: "all", name: "Tất cả", n: allPhotos.length },
    ...(uploads[homeId]?.length ? [{ key: "up", name: "Vừa tải lên", n: uploads[homeId].length }] : []),
    ...(home?.tags ?? []).map((t) => ({ ...t, n: allPhotos.filter((p) => p.tag === t.key).length })),
  ].filter((t) => t.n > 0 || t.key === "all");
  const lib = allPhotos.filter((p) => tag === "all" || p.tag === tag);
  const nL = (t: string) => lines(t).length;
  const lim = fmt === "sq" ? 2 : 3;
  const tooMany = (show.pros && nL(f.pros) > lim) || (show.cons && nL(f.cons) > lim);
  const [FW, FH, FN] = FMT[fmt];
  const dlBg = selN < 2 ? "oklch(0.7 0.02 160)" : O;

  const card = "flex flex-col gap-3.5 rounded-[20px] border border-[oklch(0.92_0.01_160)] bg-white p-[18px]";
  const inputCls = "rounded-xl border-[1.5px] border-[oklch(0.88_0.015_160)] px-3 py-2.5 text-[15px] font-semibold";
  const smallInput = "rounded-xl border-[1.5px] border-[oklch(0.88_0.015_160)] px-3 py-2 text-sm font-semibold";
  const labelCls = "flex flex-col gap-1.5 text-xs font-bold text-[oklch(0.48_0.02_160)]";
  const seg = (label: string, cur: string, set: (k: string) => void, items: [string, string, string?][]) => (
    <div className="grid items-center gap-2 sm:grid-cols-[90px_minmax(0,1fr)]">
      <span className="text-[13px] font-bold text-[oklch(0.45_0.02_160)]">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map(([k, name, dot]) => {
          const on = cur === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => set(k)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-2 text-[13px] font-bold"
              style={{ background: on ? "oklch(0.96 0.02 155)" : "white", color: on ? G : "oklch(0.35 0.02 160)", border: `1.5px solid ${on ? G : "oklch(0.9 0.01 160)"}` }}
            >
              {dot && <span className="h-3.5 w-3.5 rounded-full border border-[oklch(0.85_0.01_160)]" style={{ background: dot }} />}
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
  const slider = (label: string, val: number, set: (n: number) => void, min: number, max: number) => (
    <label className="grid items-center gap-2 sm:grid-cols-[120px_minmax(0,1fr)_48px]">
      <span className="text-[13px] font-bold text-[oklch(0.45_0.02_160)]">{label}</span>
      <input type="range" min={min} max={max} step={5} value={val} onChange={(e) => set(+e.target.value)} className="w-full accent-[oklch(0.68_0.18_45)]" />
      <span className="text-right text-[13px] font-bold">{val}%</span>
    </label>
  );
  const fontSelect = (label: string, val: string, set: (v: string) => void) => (
    <label className={labelCls}>
      {label}
      <select value={val} onChange={(e) => set(e.target.value)} className={`${smallInput} bg-white`} style={{ fontFamily: val ? `"${val}"` : undefined }}>
        {FONTS.map((x) => (
          <option key={x.key} value={x.key} style={{ fontFamily: x.key ? `"${x.key}"` : undefined }}>{x.label}</option>
        ))}
      </select>
    </label>
  );
  const priceBox = (title: string, minK: keyof Fields, maxK: keyof Fields, unitK: keyof Fields, units: string[], preview: string) => (
    <div className={labelCls}>
      {title}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5">
        <input value={f[minK]} onChange={setField(minK)} inputMode="numeric" placeholder="Từ" className={`min-w-0 ${inputCls}`} />
        <span className="text-[15px] text-[oklch(0.5_0.02_160)]">–</span>
        <input value={f[maxK]} onChange={setField(maxK)} inputMode="numeric" placeholder="Đến" className={`min-w-0 ${inputCls}`} />
        <select value={f[unitK]} onChange={setField(unitK)} className="rounded-xl border-[1.5px] border-[oklch(0.88_0.015_160)] bg-white px-2 py-2.5 text-sm font-semibold">
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <span className="font-medium text-[oklch(0.55_0.02_160)]">Hiện trên ảnh: {preview || "—"}</span>
    </div>
  );
  // Xếp thành từng CẶP (2 cột trên desktop): tiêu đề cột, ký hiệu, nhãn giá, tiêu đề nhỏ/ghi chú, chân ảnh.
  const LABEL_FIELDS: [keyof Labels, string][] = [
    ["pros", "Tiêu đề cột ưu điểm"],
    ["cons", "Tiêu đề cột nhược điểm"],
    ["markPro", "Ký hiệu đầu dòng ưu điểm"],
    ["markCon", "Ký hiệu đầu dòng nhược điểm"],
    ["single", "Nhãn ô giá lẻ"],
    ["combo", "Nhãn ô giá combo"],
    ["kicker", "Dòng tiêu đề nhỏ (trên tên home)"],
    ["note", "Ghi chú dưới giá"],
    ["brand", "Chân ảnh · tên thương hiệu"],
    ["contact", "Chân ảnh · web & số điện thoại"],
  ];

  if (!home) return <div className="rounded-2xl bg-white p-6 text-sm text-gray-500">Chưa có homestay nào.</div>;

  return (
    <div className="flex flex-col gap-4 text-[oklch(0.22_0.03_160)]">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[clamp(22px,3vw,28px)] font-extrabold tracking-tight">Ghép ảnh review</h1>
          <div className="mt-1 text-sm text-[oklch(0.48_0.02_160)]">Chọn 2–10 ảnh từ kho ảnh của homestay, thêm thông tin, tải về để đăng lên các hội nhóm review.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyCaption} className="whitespace-nowrap rounded-full border-[1.5px] bg-white px-3.5 py-2.5 text-sm font-bold" style={{ borderColor: BORDER }}>Sao chép caption</button>
          <button type="button" onClick={download} className="whitespace-nowrap rounded-full px-[18px] py-2.5 text-sm font-extrabold text-white" style={{ background: dlBg }}>{saveDir ? "Lưu vào thư mục" : "Tải ảnh PNG"}</button>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <div className="flex min-w-0 flex-col gap-3.5">
          {/* Mẫu bố cục đã lưu */}
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-base font-extrabold">⭐ Mẫu bố cục đã lưu</div>
              <span className="text-[12px] font-medium text-[oklch(0.5_0.02_160)]">Lưu khổ ảnh, bố cục, màu, font, cỡ chữ, chữ cố định & vị trí từng mục để dùng lại</span>
            </div>
            {presets.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {presets.map((pr) => {
                  const on = activePreset === pr.id;
                  return (
                    <div key={pr.id} className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: on ? G : "oklch(0.92 0.01 160)", background: on ? "oklch(0.97 0.02 155)" : "white" }}>
                      <button type="button" onClick={() => applyPreset(pr)} className="min-w-0 flex-1 truncate text-left text-sm font-bold" title="Áp dụng mẫu này">
                        {pr.name}
                        {pr.isDefault && <span className="ml-2 rounded-full bg-[oklch(0.68_0.18_45)] px-2 py-0.5 text-[11px] font-bold text-white">Mặc định</span>}
                        <span className="ml-2 text-[12px] font-medium text-[oklch(0.5_0.02_160)]">{FMT[pr.fmt][2]} · {pr.style === "card" ? "Thẻ nổi" : "Khung dưới ảnh"}</span>
                      </button>
                      <div className="flex flex-wrap gap-1.5 text-[12px] font-bold">
                        <button type="button" onClick={() => applyPreset(pr)} className="rounded-lg bg-[oklch(0.29_0.055_160)] px-2.5 py-1 text-white">Áp dụng</button>
                        <button type="button" disabled={savingPreset} onClick={() => overwritePreset(pr.id)} className="rounded-lg border px-2.5 py-1" style={{ borderColor: BORDER }} title="Ghi đè mẫu này bằng thiết lập hiện tại">Lưu đè</button>
                        <button type="button" disabled={savingPreset} onClick={() => toggleDefault(pr.id)} className="rounded-lg border px-2.5 py-1" style={{ borderColor: BORDER }} title="Tự áp dụng mẫu này mỗi khi mở trang">
                          {pr.isDefault ? "Bỏ mặc định" : "Đặt mặc định"}
                        </button>
                        <button type="button" disabled={savingPreset} onClick={() => deletePreset(pr.id)} className="rounded-lg px-2 py-1 text-[oklch(0.5_0.18_28)]">Xoá</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[13px] text-[oklch(0.5_0.02_160)]">Chưa có mẫu nào. Chỉnh bố cục ưng ý rồi bấm “Lưu mẫu” — mẫu đầu tiên sẽ tự là mặc định khi mở trang.</div>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveNewPreset(); } }}
                placeholder="Tên mẫu, VD: Dọc 4:5 – thẻ trong suốt"
                maxLength={60}
                className="min-w-0 flex-1 rounded-xl border-[1.5px] border-[oklch(0.88_0.015_160)] px-3 py-2 text-sm font-semibold"
              />
              <button type="button" disabled={savingPreset} onClick={saveNewPreset} className="whitespace-nowrap rounded-xl px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60" style={{ background: O }}>
                {savingPreset ? "Đang lưu…" : "Lưu mẫu hiện tại"}
              </button>
            </div>
          </section>

          {/* 1. Home & ảnh */}
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="text-base font-extrabold">1. Chọn homestay & ảnh</div>
              <select value={homeId} onChange={(e) => pickHome(e.target.value)} className="max-w-full rounded-xl border-[1.5px] bg-white px-3 py-2 text-sm font-bold" style={{ borderColor: BORDER }}>
                {homes.map((h) => (
                  <option key={h.id} value={h.id}>{h.name} ({h.photos.length} ảnh){h.published ? "" : " · đang ẩn"}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap gap-1.5">
                {tagList.map((t) => {
                  const on = tag === t.key;
                  return (
                    <button key={t.key} type="button" onClick={() => setTag(t.key)} className="whitespace-nowrap rounded-full border border-[oklch(0.9_0.01_160)] px-3 py-1.5 text-[13px] font-bold" style={{ background: on ? G : "white", color: on ? "white" : "oklch(0.35 0.02 160)" }}>
                      {t.name} <span className="opacity-60">{t.n}</span>
                    </button>
                  );
                })}
              </div>
              <label className="cursor-pointer whitespace-nowrap rounded-full border-[1.5px] border-dashed border-[oklch(0.75_0.04_160)] px-3 py-[7px] text-[13px] font-bold text-[oklch(0.35_0.06_160)]">
                {uploading ? "Đang tải lên…" : "+ Tải ảnh lên kho"}
                <input type="file" accept="image/*" multiple onChange={upload} disabled={uploading} className="hidden" />
              </label>
            </div>
            {lib.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-500">Home này chưa có ảnh — bấm “+ Tải ảnh lên kho”.</div>
            ) : (
              // Mobile: 3 cột, cuộn theo trang (không cuộn lồng); desktop: lưới tự chia, khung cuộn riêng.
              <div className="grid grid-cols-3 gap-2 sm:max-h-[460px] sm:grid-cols-[repeat(auto-fill,minmax(104px,1fr))] sm:overflow-y-auto sm:pr-1">
                {lib.map((p) => {
                  const i = sel.indexOf(p.id);
                  return (
                    // Ô vuông bằng padding-top 100% (aspect-ratio trên <button> không chạy ở Safari iOS →
                    // ô dẹt về 0, ảnh chồng lên nhau).
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      title={p.label}
                      className="relative block h-0 w-full overflow-hidden rounded-xl pt-[100%] transition hover:scale-[.97]"
                      style={{ outline: i >= 0 ? `3px solid ${O}` : "none", outlineOffset: -3 }}
                    >
                      <span className="absolute inset-0 bg-gray-100 bg-cover bg-center" style={{ backgroundImage: `url("${p.url}")` }} />
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-xs font-extrabold text-white shadow" style={{ background: i >= 0 ? O : "oklch(0.2 0.02 160 / .35)" }}>
                        {i >= 0 ? i + 1 : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-col gap-2 border-t border-[oklch(0.94_0.01_160)] pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold">
                  Đã chọn <span style={{ color: selN < 2 ? "oklch(0.55 0.17 45)" : G }}>{selN}/10</span>{" "}
                  <span className="font-medium text-[oklch(0.5_0.02_160)]">· ảnh số 1 là ảnh chính</span>
                </span>
                {selN > 0 && <button type="button" onClick={() => setSel([])} className="text-[13px] font-bold text-[oklch(0.5_0.18_28)]">Bỏ chọn tất cả</button>}
              </div>
              {selN === 0 && <div className="text-[13px] text-[oklch(0.5_0.02_160)]">Bấm vào ảnh trong kho để chọn, tối thiểu 2 ảnh.</div>}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {selPhotos.map((p, i) => (
                  <div key={p.id} className="flex w-[92px] flex-none flex-col gap-1">
                    <div className="relative h-16 overflow-hidden rounded-[10px] bg-gray-100">
                      <span className="block h-full w-full bg-cover bg-center" style={{ backgroundImage: `url("${p.url}")` }} />
                      <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: O }}>{i + 1}</span>
                    </div>
                    <div className="flex justify-between gap-0.5">
                      <button type="button" title="Lên trước" onClick={() => move(i, -1)} className="flex-1 rounded-md bg-[oklch(0.96_0.005_160)] py-0.5 text-[13px] font-extrabold" style={{ opacity: i === 0 ? 0.35 : 1 }}>←</button>
                      <button type="button" title="Ra sau" onClick={() => move(i, 1)} className="flex-1 rounded-md bg-[oklch(0.96_0.005_160)] py-0.5 text-[13px] font-extrabold" style={{ opacity: i === selN - 1 ? 0.35 : 1 }}>→</button>
                      <button type="button" title="Bỏ chọn" onClick={() => toggle(p.id)} className="flex-1 rounded-md bg-[oklch(0.96_0.03_28)] py-0.5 text-[13px] font-extrabold text-[oklch(0.5_0.18_28)]">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 2. Bố cục & màu */}
          <section className={card}>
            <div className="text-base font-extrabold">2. Bố cục & màu</div>
            {seg("Khổ ảnh", fmt, (k) => { setFmt(k as FmtKey); setPos(null); setOffsets({}); }, [["sq", "Vuông 1:1"], ["pt", "Dọc 4:5"], ["st", "Story 9:16"]])}
            {seg("Bố cục ảnh", layout, setLayout, [["hero", "Ảnh lớn trên"], ["mosaic", "Ảnh lớn trái"], ["grid", "Lưới đều"]])}
            {seg("Chữ", style, (k) => { setStyle(k); setPos(null); setOffsets({}); }, [["panel", "Khung dưới ảnh"], ["card", "Thẻ nổi trên ảnh"]])}
            {style === "card" && seg("Nền thẻ", cardFill, (k) => { setCardFill(k); setPriceFill(k === "solid"); }, [["solid", "Có nền"], ["none", "Trong suốt"]])}
            {style === "card" && cardFill === "none" && (
              <label className="grid items-center gap-2 sm:grid-cols-[90px_minmax(0,1fr)_48px]">
                <span className="text-[13px] font-bold text-[oklch(0.45_0.02_160)]">Độ trong suốt</span>
                <input type="range" min={0} max={100} step={5} value={cardClear} onChange={(e) => setCardClear(+e.target.value)} className="w-full accent-[oklch(0.68_0.18_45)]" />
                <span className="text-right text-[13px] font-bold">{cardClear}%</span>
              </label>
            )}
            {seg("Nền ô giá", priceFill ? "on" : "off", (k) => setPriceFill(k === "on"), [["on", "Có nền ô"], ["off", "Không nền"]])}
            <div className="grid items-center gap-2 sm:grid-cols-[90px_minmax(0,1fr)]">
              <span className="text-[13px] font-bold text-[oklch(0.45_0.02_160)]">Màu nền</span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(THEMES).map(([k, th]) => {
                  const on = theme === k && !colors.bg;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => { setTheme(k); setColors({}); }}
                      className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-2 text-[13px] font-bold"
                      style={{ background: on ? "oklch(0.96 0.02 155)" : "white", color: on ? G : "oklch(0.35 0.02 160)", border: `1.5px solid ${on ? G : "oklch(0.9 0.01 160)"}` }}
                    >
                      <span className="h-3.5 w-3.5 rounded-full border border-[oklch(0.85_0.01_160)]" style={{ background: th.bg }} />
                      {th.name}
                    </button>
                  );
                })}
                {/* Màu nền tự chọn: giữ các màu chữ của bộ màu đang chọn, chỉ đổi nền. */}
                <label
                  className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[10px] py-1 pl-1 pr-3 text-[13px] font-bold"
                  style={{ background: colors.bg ? "oklch(0.96 0.02 155)" : "white", color: colors.bg ? G : "oklch(0.35 0.02 160)", border: `1.5px solid ${colors.bg ? G : "oklch(0.9 0.01 160)"}` }}
                >
                  <input type="color" value={colors.bg ?? THEMES[theme].bg} onChange={(e) => setColors((c) => ({ ...c, bg: e.target.value }))} className="h-7 w-7 cursor-pointer rounded-md border-0 bg-transparent p-0" />
                  Tự chọn màu
                </label>
              </div>
            </div>
            <div className="grid items-start gap-2 sm:grid-cols-[90px_minmax(0,1fr)]">
              <span className="pt-2 text-[13px] font-bold text-[oklch(0.45_0.02_160)]">Màu chữ</span>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {COLOR_FIELDS.map(([k, name]) => {
                    const val = colors[k] ?? THEMES[theme][k];
                    return (
                      <label key={k} className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-[oklch(0.9_0.01_160)] bg-white py-1 pl-1 pr-2.5 text-[13px] font-bold" style={colors[k] ? { borderColor: G } : undefined}>
                        <input type="color" value={val} onChange={(e) => setColors((c) => ({ ...c, [k]: e.target.value }))} className="h-7 w-7 cursor-pointer rounded-md border-0 bg-transparent p-0" />
                        {name}
                      </label>
                    );
                  })}
                </div>
                {Object.keys(colors).length > 0 && (
                  <button type="button" onClick={() => setColors({})} className="self-start text-[12px] font-bold text-[oklch(0.4_0.08_160)]">Về màu theo nền “{THEMES[theme].name}”</button>
                )}
              </div>
            </div>
          </section>

          {/* 3. Nội dung */}
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-base font-extrabold">3. Nội dung trên ảnh</div>
              <button type="button" onClick={() => setF(fillOf(home))} className="text-[13px] font-bold text-[oklch(0.4_0.08_160)]">Lấy lại từ dữ liệu home</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SHOWS.map(([k, name]) => {
                const on = show[k];
                return (
                  <button key={k} type="button" onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))} className="whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-bold" style={{ background: on ? "oklch(0.96 0.02 155)" : "white", color: on ? G : "oklch(0.5 0.02 160)", border: `1px solid ${on ? "oklch(0.8 0.05 155)" : "oklch(0.9 0.01 160)"}` }}>
                    {on ? "✓" : "+"} {name}
                  </button>
                );
              })}
            </div>
            <div className="grid items-start gap-2.5 md:grid-cols-2">
              <label className={labelCls}>Tên home<input value={f.name} onChange={setField("name")} className={inputCls} /></label>
              <label className={labelCls}>Vị trí<input value={f.loc} onChange={setField("loc")} className={inputCls} /></label>
              <label className={labelCls}>Ưu điểm · mỗi dòng một ý<textarea value={f.pros} onChange={setField("pros")} rows={4} className="resize-y rounded-xl border-[1.5px] border-[oklch(0.88_0.015_160)] px-3 py-2.5 text-sm leading-normal" /></label>
              <label className={labelCls}>Nhược điểm · mỗi dòng một ý<textarea value={f.cons} onChange={setField("cons")} rows={4} placeholder={"VD: Đường vào dốc, cần đi chậm\nĐêm khá lạnh, nên mang áo ấm"} className="resize-y rounded-xl border-[1.5px] border-[oklch(0.88_0.015_160)] px-3 py-2.5 text-sm leading-normal" /></label>
              {priceBox("Giá lẻ · từ – đến", "sMin", "sMax", "unit", ["/đêm", "/phòng", "/người"], single)}
              {priceBox("Giá combo · từ – đến", "cMin", "cMax", "cUnit", ["/người", "/nhóm", "/combo"], combo)}
            </div>
            <p className="text-[12px] leading-relaxed text-[oklch(0.55_0.02_160)]">
              Giá lẻ lấy thấp nhất – cao nhất của các phòng (cả giá theo thứ). Giá combo/người = tiền phòng ÷ sức chứa của phòng (phòng đôi ÷ 2, phòng 4 người ÷ 4) + vé cabin khứ hồi từ Hà Nội (giá thấp nhất) — phòng cộng đồng: giá giường + vé. Sửa tay nếu cần.
            </p>
            {tooMany && (
              <div className="text-[13px] leading-normal text-[oklch(0.48_0.15_50)]">
                {fmt === "sq" ? "Khổ vuông chỉ hiện 2 ưu điểm, 2 nhược điểm để ảnh chiếm nhiều chỗ hơn." : "Ảnh chỉ hiện tối đa 3 ưu điểm và 3 nhược điểm để chữ đủ to, dễ đọc."}
              </div>
            )}
          </section>

          {/* 4. Font, cỡ chữ, vị trí */}
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-base font-extrabold">4. Font, cỡ chữ & vị trí</div>
              <button
                type="button"
                onClick={() => { setTitleFont(""); setBodyFont(""); setScale(100); setNameScale(100); setWidthPct(100); setPos(null); setOffsets({}); }}
                className="text-[13px] font-bold text-[oklch(0.4_0.08_160)]"
              >
                Đặt lại mặc định
              </button>
            </div>
            <div className="grid items-start gap-2.5 md:grid-cols-2">
              {fontSelect("Font tiêu đề (tên home, giá, thương hiệu)", titleFont, setTitleFont)}
              {fontSelect("Font nội dung (vị trí, ưu/nhược, ghi chú)", bodyFont, setBodyFont)}
            </div>
            {slider("Cỡ chữ", scale, setScale, 60, 160)}
            {slider("Cỡ tên home", nameScale, setNameScale, 50, 200)}
            {slider("Độ rộng khung chữ", widthPct, setWidthPct, 40, 100)}
            {seg("Kéo thả", dragMode, setDragMode, [["item", "Từng mục"], ["block", "Cả khung"]])}
            <div className="flex flex-col gap-2 rounded-xl bg-[oklch(0.97_0.01_155)] px-3 py-2.5 text-[13px]">
              <span className="font-semibold text-[oklch(0.4_0.05_160)]">
                {dragMode === "item"
                  ? "✋ Kéo từng mục (tên, vị trí, ưu/nhược, ô giá, ghi chú, chân ảnh) ngay trên ảnh xem trước. Kéo vào khoảng trống trong khung để di chuyển cả khung."
                  : "✋ Kéo khung chữ ngay trên ảnh xem trước để đổi vị trí cả khối."}
              </span>
              {(pos || Object.keys(offsets).length > 0) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {Object.keys(offsets).length > 0 && (
                    <span className="text-[oklch(0.45_0.02_160)]">
                      Đã dời: {(Object.keys(offsets) as ItemKey[]).map((k) => ITEM_NAMES[k]).join(", ")}
                    </span>
                  )}
                  {Object.keys(offsets).length > 0 && <button type="button" onClick={() => setOffsets({})} className="font-bold text-[oklch(0.5_0.18_28)]">Xếp lại các mục</button>}
                  {pos && <button type="button" onClick={() => setPos(null)} className="font-bold text-[oklch(0.5_0.18_28)]">Khung về vị trí mặc định</button>}
                </div>
              )}
            </div>
          </section>

          {/* 5. Chữ cố định */}
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-base font-extrabold">5. Các dòng chữ khác trên ảnh</div>
              <button type="button" onClick={() => setLabels(defaultLabels(domain, phone))} className="text-[13px] font-bold text-[oklch(0.4_0.08_160)]">Khôi phục chữ mặc định</button>
            </div>
            <div className="grid items-start gap-2.5 md:grid-cols-2">
              {LABEL_FIELDS.map(([k, label]) => (
                <label key={k} className={labelCls}>
                  {label}
                  <input value={labels[k]} onChange={setLabel(k)} placeholder="(để trống = ẩn)" className={smallInput} />
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Xem trước */}
        <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-4">
          <section className="flex flex-col gap-3 rounded-[20px] border border-[oklch(0.92_0.01_160)] bg-white p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-extrabold">Xem trước</span>
              <span className="text-xs font-semibold text-[oklch(0.5_0.02_160)]">{FN} · {FW}×{FH}px · kéo khung chữ để di chuyển</span>
            </div>
            <div className="flex justify-center rounded-[14px] p-3" style={{ background: "repeating-conic-gradient(oklch(0.95 0.005 160) 0 25%, white 0 50%) 0 0 / 20px 20px" }}>
              <div className="relative inline-block max-w-full">
                <canvas
                  ref={cvRef}
                  width={1080}
                  height={1350}
                  className="block h-auto w-auto max-w-full rounded-md max-h-[70vh] xl:max-h-[calc(100vh-240px)]"
                  style={{ boxShadow: "0 10px 30px -12px oklch(0.2 0.03 160 / .4)" }}
                />
                {/* Lớp phủ: nhận kéo thả + vẽ viền gợi ý (không nằm trong ảnh xuất ra). */}
                <canvas
                  ref={overlayRef}
                  width={1080}
                  height={1350}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  onPointerLeave={() => { if (!drag.current) setHover(null); }}
                  className="absolute inset-0 h-full w-full touch-none rounded-md"
                  style={{ cursor: dragging ? "grabbing" : hover ? "grab" : "default" }}
                />
              </div>
            </div>
            {hover && hover !== "block" && !dragging && (
              <div className="-mt-1 text-center text-[12px] font-semibold text-[oklch(0.5_0.02_160)]">Kéo để dời: {ITEM_NAMES[hover]}</div>
            )}
            {selN < 2 && <div className="text-center text-[13px] font-semibold text-[oklch(0.48_0.15_50)]">Chọn ít nhất 2 ảnh để tải về.</div>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={copyCaption} className="rounded-full border-[1.5px] p-3 text-center text-sm font-bold" style={{ borderColor: BORDER }}>Sao chép caption</button>
              <button type="button" onClick={download} className="rounded-full p-3 text-center text-sm font-extrabold text-white" style={{ background: dlBg }}>
                {saveDir ? "Lưu vào thư mục" : "Tải ảnh PNG"}
              </button>
            </div>
            {dirSupported ? (
              <div className="flex flex-col gap-1.5 rounded-xl bg-[oklch(0.97_0.01_155)] px-3 py-2.5 text-[13px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 font-semibold text-[oklch(0.4_0.05_160)]">
                    📁 {saveDir ? <>Lưu vào: <b className="text-[oklch(0.29_0.055_160)]">{saveDir.name}</b></> : "Chưa chọn thư mục — ảnh tải về thư mục Tải xuống"}
                  </span>
                  <span className="flex gap-3 font-bold">
                    <button type="button" onClick={pickDir} className="text-[oklch(0.4_0.08_160)]">{saveDir ? "Đổi thư mục" : "Chọn thư mục lưu"}</button>
                    {saveDir && <button type="button" onClick={forgetDir} className="text-[oklch(0.5_0.18_28)]">Bỏ</button>}
                  </span>
                </div>
                {saveDir && (
                  <label className="flex cursor-pointer items-center gap-2 text-[oklch(0.45_0.02_160)]">
                    <input type="checkbox" checked={saveCaption} onChange={(e) => setSaveCaption(e.target.checked)} className="h-4 w-4 accent-[oklch(0.68_0.18_45)]" />
                    Lưu kèm caption (.txt cùng tên ảnh)
                  </label>
                )}
              </div>
            ) : (
              <div className="text-center text-[12px] text-[oklch(0.55_0.02_160)]">Chọn thư mục lưu riêng chỉ có trên Chrome/Edge máy tính — trình duyệt này tải về thư mục Tải xuống.</div>
            )}
          </section>
          <section className="flex flex-col gap-2 rounded-[20px] border border-[oklch(0.92_0.01_160)] bg-white p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-extrabold">Caption gợi ý để đăng bài <span className="font-medium text-[oklch(0.5_0.02_160)]">· sửa trực tiếp được</span></div>
              {capEdit != null && <button type="button" onClick={() => setCapEdit(null)} className="text-[12px] font-bold text-[oklch(0.4_0.08_160)]">Tạo lại tự động</button>}
            </div>
            <textarea value={caption} onChange={(e) => setCapEdit(e.target.value)} rows={10} className="resize-y rounded-xl border-[1.5px] border-[oklch(0.92_0.01_160)] bg-[oklch(0.985_0.003_160)] px-3 py-2.5 text-[13px] leading-relaxed" />
          </section>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-[18px] py-3 text-sm font-bold text-white" style={{ background: "oklch(0.25 0.045 160)" }}>{toast}</div>
      )}
    </div>
  );
}
