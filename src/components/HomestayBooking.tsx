"use client";

import { saveSearchPrefs } from "@/lib/search-prefs";
import { dmy } from "@/lib/date-format";
import { trackLeadConversion } from "@/lib/ads";
import { SupportHoursNote } from "@/components/SupportHours";
import { ItineraryLink } from "@/components/itinerary/ItineraryLink";
import { VoiceText } from "@/components/SiteContact";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { CardSlides } from "@/components/combo/CardSlides";
import { billableOccupants, stayRoomsQuote, isCommunalRoom } from "@/lib/occupancy";
import { CommitmentLink } from "@/components/trust/parts";
import { vnPhoneError } from "@/lib/phone";
import { BookingEmailField, emailLooksValid } from "@/components/BookingEmailField";
import { PriceLine } from "@/components/WebPromo";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/Link";

export interface HomestayMedia {
  url: string;
  type: "image" | "video";
}

/** Một phòng con + dữ liệu giá/tồn cho cửa sổ ngày (tính sẵn phía server). */
export interface HomestayRoom {
  id: string;
  typeName: string;
  name: string;
  capacity: number;
  /** Sức chứa tối đa (nhận thêm kèm phụ thu). null = bằng capacity. */
  maxCapacity: number | null;
  /** Phụ thu mỗi người vượt chuẩn / đêm (đ). null = không phụ thu. */
  extraFee: number | null;
  earlyFee: number | null; // phụ thu check-in sớm
  lateFee: number | null; // phụ thu check-out muộn
  amenities: string[];
  media: HomestayMedia[];
  base: number; // giá hiệu lực (sale ?? list)
  listPrice: number; // giá niêm yết (để gạch ngang khi có giảm)
  hasSale: boolean;
  /** Phòng không công khai giá → hiển thị "IB để biết giá" thay vì 0đ. */
  por: boolean;
  /** Giá theo thứ, chỉ mục theo getUTCDay(): [CN,T2,T3,T4,T5,T6,T7]. null = dùng base. */
  days: (number | null)[];
  /** Giá gạch (niêm yết) theo thứ, cùng chỉ mục getUTCDay(). null = dùng listPrice chung. */
  listDays: (number | null)[];
  /** Giá NGÀY LỄ (đêm nằm trong `holidayKeys`), đè giá theo thứ. null = không có giá lễ. */
  holiday: number | null;
  /** Các ngày (yyyy-mm-dd) phòng bị chiếm (không bán). */
  occupied: string[];
  /** Nhãn tiện ích hiển thị (tiện ích của hạng phòng + của riêng phòng, đã bỏ trùng). */
  tags: string[];
  /** Hạng phòng có view săn mây / bồn tắm — dùng cho chip lọc danh sách phòng. */
  view: boolean;
  bathtub: boolean;
}

/** Thẻ gợi ý homestay khác (dựng từ getHomestayCards, bỏ homestay hiện tại). */
export interface HomestaySuggestion {
  slug: string;
  name: string;
  area: string;
  price: number;
  cover: string | null;
  cat: string;
  status: "ok" | "low" | "full" | "none";
}

const WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MS = 86_400_000;
const IB = "IB để biết giá"; // nhãn cho phòng không công khai giá

function parseKey(k: string): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function keyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function wdIndex(d: Date): number {
  return (d.getUTCDay() + 6) % 7; // T2=0 ... CN=6
}
function fmt(n: number | null | undefined, fb = "Liên hệ"): string {
  if (n == null) return fb;
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}
function shortK(n: number): string {
  return n % 1000 === 0 ? n / 1000 + "k" : fmt(n);
}

/**
 * Dựng link bản đồ nhúng + link mở từ link admin nhập.
 * Ưu tiên: link nhúng sẵn → toạ độ @lat,lng → tham số ?q= → fallback tìm theo tên.
 */
function resolveMap(mapUrl: string | null | undefined, fallbackQuery: string): { embedSrc: string; openUrl: string } {
  const q = encodeURIComponent(fallbackQuery);
  const fallbackEmbed = `https://www.google.com/maps?q=${q}&z=13&output=embed`;
  const fallbackOpen = `https://www.google.com/maps/search/?api=1&query=${q}`;
  const url = (mapUrl ?? "").trim();
  if (!url) return { embedSrc: fallbackEmbed, openUrl: fallbackOpen };
  if (url.includes("/maps/embed")) return { embedSrc: url, openUrl: url };
  // Ưu tiên toạ độ CỦA ĐỊA ĐIỂM (!3d…!4d…); phần @lat,lng chỉ là tâm khung nhìn, lệch ghim vài trăm mét.
  const at = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) {
    const coords = `${at[1]},${at[2]}`;
    return { embedSrc: `https://www.google.com/maps?q=${coords}&z=16&output=embed`, openUrl: url };
  }
  const qp = url.match(/[?&]q=([^&]+)/);
  if (qp) return { embedSrc: `https://www.google.com/maps?q=${qp[1]}&z=15&output=embed`, openUrl: url };
  // Link rút gọn (goo.gl) không trích được toạ độ: nút mở dùng link gốc, bản đồ dùng fallback.
  return { embedSrc: fallbackEmbed, openUrl: url };
}

export function HomestayBooking({
  serviceId,
  contactOnly,
  inquiryOnly,
  rooms,
  startKey,
  numDays,
  phone,
  zalo,
  area,
  mapQuery,
  mapUrl,
  policy,
  summary,
  highlights = [],
  reviewLink,
  near = [],
  nearbySlot,
  policyCards = [],
  distanceKm,
  reviews,
  description,
  suggestions,
  initialCheckIn,
  initialCheckOut,
  weekendPolicy,
  childFreeUnderAge = 6,
  initialAdults,
  initialChildAges,
  holidayKeys = [],
}: {
  serviceId: string;
  /** Các đêm (yyyy-mm-dd) là NGÀY LỄ trong khung lịch — phòng có giá lễ tính giá lễ đêm đó (cùng công thức server). */
  holidayKeys?: string[];
  /** Trẻ dưới số tuổi này miễn phí (không tính người/phụ thu). */
  childFreeUnderAge?: number;
  /** Số người lớn / tuổi trẻ em mang từ trang tìm kiếm sang (điền sẵn). */
  initialAdults?: number;
  initialChildAges?: number[];
  /** Không quản lý lịch trên web: ẩn lịch & form đặt, khách nhắn tin để nhận thông tin. */
  contactOnly?: boolean;
  /** Nhắn tin để biết chi tiết (không đặt trực tiếp) nhưng VẪN hiện lịch & tình trạng phòng thật. */
  inquiryOnly?: boolean;
  rooms: HomestayRoom[];
  startKey: string;
  numDays: number;
  /** Chính sách bán cuối tuần theo cụm (NONE | FRI_SAT | SAT_SUN | FRI_SUN | SAT_PAIRED). */
  weekendPolicy?: string | null;
  /** Ngày nhận/trả từ URL (?from=&to=) để chọn sẵn khi mở trang. */
  initialCheckIn?: string | null;
  initialCheckOut?: string | null;
  phone: string;
  zalo?: string | null;
  area?: string | null;
  mapQuery: string;
  /** Link Google Maps do admin nhập (null = tự tìm theo mapQuery). */
  mapUrl?: string | null;
  /** Chính sách homestay (mỗi dòng một mục) hiển thị cho khách. */
  policy?: string | null;
  /** Tóm tắt ngắn (dòng đậm đầu mục Tổng quan). */
  summary?: string | null;
  /** Điểm nổi bật (thẻ nhỏ đầu mục Tổng quan) — dựng từ dữ liệu thật ở server. */
  highlights?: { t: string; d?: string }[];
  /** Link bài review riêng của homestay (nếu có). */
  reviewLink?: ReactNode;
  /** Điểm xung quanh gần nhất kèm quãng đường xe chạy (đọc từ cache RoadDistance). */
  near?: { name: string; kind: string; km: number; min: number; c: string; href: string | null }[];
  /** Nút mở popup "Xung quanh có gì?" đặt đè lên bản đồ. */
  nearbySlot?: ReactNode;
  /** Thẻ chính sách có cấu trúc (phụ thu, trẻ em, cuối tuần…). */
  policyCards?: { k: string; v: string; d?: string }[];
  /** Cách trung tâm Tà Xùa (km). */
  distanceKm?: number | null;
  /** Mục Đánh giá (ServiceReviews dựng ở server). */
  reviews?: ReactNode;
  /** Mô tả chi tiết — hiển thị thu gọn kèm nút "Xem đầy đủ mô tả". */
  description?: string | null;
  /** Homestay khác gần đây (gợi ý cuối trang). */
  suggestions?: HomestaySuggestion[];
}) {
  const tr = useT();
  const map = resolveMap(mapUrl, mapQuery);
  // Link nhắn tin cho homestay "chỉ liên hệ": ưu tiên Zalo, không có thì gọi điện.
  const chatOnly = Boolean(contactOnly || inquiryOnly); // không có form đặt: mọi nút đặt → nhắn tin
  const chatUrl = zalo ? `https://zalo.me/${zalo}` : `tel:${phone.replace(/\s/g, "")}`;
  const policyLines = (policy ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-•·\s]+/, "").trim())
    .filter(Boolean);
  const start = useMemo(() => parseKey(startKey), [startKey]);
  const end = useMemo(() => addDays(start, numDays - 1), [start, numDays]);

  // Chọn sẵn ngày từ URL nếu hợp lệ & nằm trong cửa sổ hiển thị.
  const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const inWin = (k?: string | null): k is string => {
    if (!k || !KEY_RE.test(k)) return false;
    const t = parseKey(k).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };
  const ci0 = inWin(initialCheckIn) ? initialCheckIn : null;
  const co0 = ci0 && inWin(initialCheckOut) && initialCheckOut! > ci0 ? initialCheckOut! : null;
  const cursorStart = ci0 ? parseKey(ci0) : start;

  const descText = (description ?? "").trim();
  const descLong = descText.length > 280;
  const [descOpen, setDescOpen] = useState(false);

  const [cursor, setCursor] = useState(() => ({ y: cursorStart.getUTCFullYear(), m: cursorStart.getUTCMonth() }));
  const [ci, setCi] = useState<string | null>(ci0);
  const [co, setCo] = useState<string | null>(co0);
  // Đặt được NHIỀU phòng cùng homestay trong 1 đơn → giữ danh sách id phòng đã chọn.
  const [selected, setSelected] = useState<string[]>([]);
  const toggleRoom = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const [adults, setAdults] = useState(initialAdults && initialAdults > 0 ? initialAdults : 2);
  const [childAges, setChildAges] = useState<number[]>(initialChildAges ?? []);
  // Nhớ ngày ở + số khách để trang khác (cabin, combo, xe máy…) tự điền — search-prefs.ts.
  useEffect(() => {
    if (ci && co) saveSearchPrefs({ from: ci, to: co, people: adults });
  }, [ci, co, adults]);

  const [name, setName] = useState("");
  const [cphone, setCphone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ code: string; needsConfirmation: boolean } | null>(null);

  const calRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Lightbox slider ảnh/video của phòng.
  const [lb, setLb] = useState<{ media: HomestayMedia[]; i: number } | null>(null);
  const openLb = (media: HomestayMedia[], i: number) => media.length > 0 && setLb({ media, i });
  useEffect(() => {
    if (!lb) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLb(null);
      else if (e.key === "ArrowRight") setLb((s) => (s ? { ...s, i: (s.i + 1) % s.media.length } : s));
      else if (e.key === "ArrowLeft") setLb((s) => (s ? { ...s, i: (s.i - 1 + s.media.length) % s.media.length } : s));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lb]);

  const occ = useMemo(() => rooms.map((r) => new Set(r.occupied)), [rooms]);
  // r.days lập chỉ mục theo getUTCDay(): [CN, T2, T3, T4, T5, T6, T7].
  // Giá 1 đêm; trả null = ngày đó KHÔNG công khai giá (IB) — khi giá hiệu lực ≤ 0.
  const holSet = useMemo(() => new Set(holidayKeys), [holidayKeys]);
  const nightPrice = (r: HomestayRoom, d: Date): number | null => {
    // Đêm ngày lễ + phòng có giá lễ ⇒ giá lễ (khớp priceForDay phía server).
    if (r.holiday != null && r.holiday > 0 && holSet.has(keyOf(d))) return r.holiday;
    const o = r.days[d.getUTCDay()];
    const p = o != null ? o : r.base;
    return p > 0 ? p : null;
  };
  // Giá "từ" để hiển thị khi chưa chọn ngày: nhỏ nhất trong các mức giá dương
  // (phòng có thể chỉ nhập giá theo thứ, để giá thường = 0).
  const fromPrice = (r: HomestayRoom) => {
    const cands = [r.base, ...r.days].filter((p): p is number => p != null && p > 0);
    return cands.length ? Math.min(...cands) : null;
  };
  // Giá gạch 1 đêm: giá-gạch-theo-thứ (nếu có) ?? giá niêm yết chung (khi đang giảm);
  // chỉ trả khi CAO HƠN giá bán đêm đó.
  const nightStrike = (r: HomestayRoom, d: Date, eff: number): number | null => {
    const perDay = r.listDays[d.getUTCDay()];
    const candidate = perDay != null && perDay > 0 ? perDay : r.hasSale ? r.listPrice : null;
    return candidate != null && candidate > eff ? candidate : null;
  };
  // Giá gạch tương ứng đêm rẻ nhất (cho hiển thị "mỗi đêm từ" khi chưa chọn ngày).
  const fromStrike = (r: HomestayRoom): number | null => {
    const fp = fromPrice(r);
    if (fp == null) return null;
    let best: number | null = null;
    for (let dow = 0; dow < 7; dow++) {
      const eff = r.days[dow] != null ? (r.days[dow] as number) : r.base;
      if (eff !== fp) continue;
      const perDay = r.listDays[dow];
      const cand = perDay != null && perDay > 0 ? perDay : r.hasSale ? r.listPrice : null;
      if (cand != null && cand > eff && (best == null || cand > best)) best = cand;
    }
    return best;
  };

  // Chỉ chọn 1 ngày = mặc định ở đúng 1 đêm (trả phòng trưa hôm sau).
  // Bấm thêm ngày sau đó mới chuyển sang logic khoảng nhận → trả như thường.
  const coEff = co ?? (ci ? keyOf(addDays(parseKey(ci), 1)) : null);

  const nights = useMemo(() => {
    if (!ci || !coEff) return [] as Date[];
    const a = parseKey(ci), b = parseKey(coEff);
    const out: Date[] = [];
    for (let t = a.getTime(); t < b.getTime(); t += MS) out.push(new Date(t));
    return out;
  }, [ci, coEff]);
  const nN = nights.length;

  // Chính sách bán cuối tuần theo cụm: nếu kỳ chạm 1 đêm trong cụm thì phải có đủ cả cụm.
  const policyWarn = useMemo(() => {
    const BLOCKS: Record<string, { wd: number[]; label: string }> = {
      FRI_SAT: { wd: [5, 6], label: "T6 + T7" },
      SAT_SUN: { wd: [6, 0], label: "T7 + CN" },
      FRI_SUN: { wd: [5, 6, 0], label: "T6 + T7 + CN" },
    };
    if (nights.length === 0) return null;
    const have = new Set(nights.map(keyOf));
    // T7 không bán lẻ: mỗi đêm thứ 7 phải kèm đêm T6 liền trước hoặc đêm CN liền sau.
    if (weekendPolicy === "SAT_PAIRED") {
      for (const d of nights) {
        if (d.getUTCDay() !== 6) continue;
        if (!have.has(keyOf(addDays(d, -1))) && !have.has(keyOf(addDays(d, 1)))) {
          return tr("Homestay này không bán lẻ đêm thứ 7 — vui lòng đặt kèm đêm thứ 6 hoặc chủ nhật (T6+T7, T7+CN hoặc cả ba đêm).");
        }
      }
      return null;
    }
    const b = weekendPolicy ? BLOCKS[weekendPolicy] : undefined;
    if (!b) return null;
    for (const d of nights) {
      const pos = b.wd.indexOf(d.getUTCDay());
      if (pos === -1) continue;
      const anchor = addDays(d, -pos);
      for (let i = 0; i < b.wd.length; i++) {
        if (!have.has(keyOf(addDays(anchor, i)))) {
          return tr("Homestay này cuối tuần chỉ nhận đặt nguyên cụm {0} — vui lòng chọn đủ các đêm {1} (không bán lẻ).", [b.label, b.label]);
        }
      }
    }
    return null;
  }, [weekendPolicy, nights]);

  function pickDay(k: string) {
    setResult(null);
    if (!ci || (ci && co)) {
      setCi(k);
      setCo(null);
    } else if (k > ci) {
      setCo(k);
    } else {
      setCi(k);
      setCo(null);
    }
  }

  // ----- Lịch tháng -----
  const monthCells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
    const lead = wdIndex(first); // số ô trống đầu tháng
    const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    type Cell = {
      key: string | null;
      day: number;
      inWindow: boolean;
      free: number;
      minP: number | null;
      status: "ok" | "low" | "full";
      isEnd: boolean;
      inRange: boolean;
      hol?: boolean;
    };
    const cells: Cell[] = [];
    for (let i = 0; i < lead; i++)
      cells.push({ key: null, day: 0, inWindow: false, free: 0, minP: null, status: "ok", isEnd: false, inRange: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(cursor.y, cursor.m, d));
      const k = keyOf(date);
      const inWindow = date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
      let free = 0;
      let minP: number | null = null;
      if (inWindow) {
        rooms.forEach((r, i) => {
          if (!occ[i].has(k)) {
            free++;
            // Đêm không công khai giá (IB) không gộp vào giá "từ" của ngày.
            const p = nightPrice(r, date);
            if (p != null && (minP == null || p < minP)) minP = p;
          }
        });
      }
      const status = free === 0 ? "full" : free <= 2 ? "low" : "ok";
      const isEnd = k === ci || k === coEff;
      const inRange = Boolean(ci && coEff && k > ci && k < coEff);
      cells.push({ key: k, day: d, inWindow, free, minP, status, isEnd, inRange, hol: holSet.has(k) });
    }
    while (cells.length % 7) cells.push({ key: null, day: 0, inWindow: false, free: 0, minP: null, status: "ok", isEnd: false, inRange: false });
    return cells;
  }, [cursor, rooms, occ, start, end, ci, co, holSet]);

  const canPrev = cursor.y > start.getUTCFullYear() || (cursor.y === start.getUTCFullYear() && cursor.m > start.getUTCMonth());
  const canNext = cursor.y < end.getUTCFullYear() || (cursor.y === end.getUTCFullYear() && cursor.m < end.getUTCMonth());
  const monthLabel = tr("Tháng {0}, {1}", [cursor.m + 1, cursor.y]);

  const dname = (k: string) => {
    const d = parseKey(k);
    return tr(WD[wdIndex(d)]) + ", " + dmy(k);
  };
  const calHint = !ci
    ? tr("Bấm chọn ngày nhận phòng")
    : !co
      ? tr("{0} → {1} · 1 đêm (bấm thêm ngày nếu ở nhiều đêm)", [dname(ci), dname(coEff!)])
      : tr("{0} → {1} · {2} đêm", [dname(ci), dname(co), nN]);

  // ----- Thẻ phòng theo kỳ đã chọn -----
  const roomView = rooms.map((r, i) => {
    const roomFree = nN > 0 && nights.every((d) => !occ[i].has(keyOf(d)));
    // Kỳ vi phạm chính sách bán cuối tuần (vd chỉ đêm T7) → không phòng nào đặt được.
    const free = roomFree && !policyWarn;
    // Kỳ có ít nhất 1 đêm không công khai giá (IB) → không tính tổng được.
    const ib = nN > 0 && nights.some((d) => nightPrice(r, d) == null);
    const stayPrice = nN > 0 && !ib ? nights.reduce((a, d) => a + (nightPrice(r, d) ?? 0), 0) : null;
    // Tổng giá gạch cho kỳ: đêm không giảm dùng chính giá bán → chỉ gạch khi tổng > giá bán.
    let stayStrike: number | null = null;
    if (nN > 0 && !ib) {
      let sum = 0;
      let any = false;
      for (const d of nights) {
        const eff = nightPrice(r, d) ?? 0;
        const st = nightStrike(r, d, eff);
        sum += st ?? eff;
        if (st != null) any = true;
      }
      stayStrike = any && stayPrice != null && sum > stayPrice ? sum : null;
    }
    const wdP = r.days[3] ?? r.base; // T4 đại diện ngày thường (chỉ mục getUTCDay)
    const weP = r.days[6] ?? r.base; // T7 đại diện cuối tuần
    let status: string, tone: "ok" | "low" | "full" | "idle";
    if (contactOnly) { status = tr("Nhắn để hỏi"); tone = "idle"; }
    else if (!nN) { status = tr("Chọn ngày"); tone = "idle"; }
    else if (roomFree && policyWarn) { status = tr("Không bán lẻ cuối tuần"); tone = "full"; }
    else if (!free) { status = tr("Hết phòng"); tone = "full"; }
    else { status = tr("Còn phòng"); tone = "ok"; }
    // Phòng cộng đồng (dorm): giá là giá MỖI NGƯỜI ⇒ tiền = giá × số khách (xem stayRoomsQuote).
    const communal = isCommunalRoom(r.typeName, r.name);
    return { r, i, free, ib, stayPrice, stayStrike, wdP, weP, status, tone, communal };
  });

  const dateQS = ci && coEff ? `?from=${ci}&to=${coEff}` : "";
  // Các phòng đã chọn mà CÒN TRỐNG cho kỳ hiện tại (đổi ngày → phòng hết tự rơi khỏi đơn).
  const sels = roomView.filter((v) => v.free && selected.includes(v.r.id));
  const hasSel = sels.length > 0;
  const anyIb = sels.some((v) => v.ib);
  // Số người TÍNH PHÍ = người lớn + trẻ TỪ ngưỡng miễn phí trở lên (trẻ nhỏ hơn: miễn phí).
  const occupants = billableOccupants(adults, childAges, childFreeUnderAge);
  // Đoàn chia vào các phòng đã chọn: sức chứa = tổng các phòng; vượt chuẩn ⇒ phụ thu (mức chung homestay).
  // Cùng hàm với server (createBooking): phòng thường = giá cả phòng + phụ thu; phòng cộng đồng = giá × số khách.
  const ec = stayRoomsQuote(
    occupants,
    sels.map((v) => ({ price: v.ib ? null : v.stayPrice, capacity: v.r.capacity, maxCapacity: v.r.maxCapacity, communal: v.communal })),
    sels[0]?.r.extraFee,
    nN,
  );
  const selCap = ec.capacity;
  const selMax = ec.max;
  const extraGuests = hasSel ? ec.extraGuests : 0;
  const extraCost = hasSel ? ec.cost : 0;
  /** Số khách tính tiền ở phòng thứ i của đơn (phòng thường = 1 đơn vị "cả phòng"). */
  const unitsOf = (i: number) => (sels[i]?.communal ? ec.beds[i] ?? 1 : 1);
  const roomsSum = ec.roomsTotal ?? 0;
  // Khuyến mãi khi đặt trên website = tổng (giá bán niêm yết − giá đặt web) các phòng đã chọn.
  const webPromo = anyIb ? 0 : sels.reduce((n, v, i) => n + (v.stayStrike != null && v.stayPrice != null ? (v.stayStrike - v.stayPrice) * unitsOf(i) : 0), 0);
  // Kỳ có đêm không công khai giá → không có tạm tính (hiển thị "IB để biết giá").
  const total: number | null = hasSel ? (anyIb ? null : roomsSum + extraCost) : 0;
  const over = hasSel ? ec.overCapacity : false;
  // Số di động VN thật (đầu số nhà mạng, chặn số dãy/lặp) — server kiểm tra lại.
  const phoneErr = vnPhoneError(cphone);
  const phoneOk = phoneErr === null;
  const ready = nN > 0 && hasSel && !over && !policyWarn;

  const sendLock = useRef(false); // khoá tức thời chống bấm đúp ⇒ tạo 2 đơn
  async function submit() {
    if (sendLock.current) return;
    setErr("");
    if (policyWarn) { setErr(policyWarn); return; }
    if (!ready) {
      setErr(
        !nN
          ? tr("Vui lòng chọn ngày nhận và trả phòng.")
          : !hasSel
            ? tr("Vui lòng chọn ít nhất một phòng còn trống.")
            : tr("Số khách ({0}) vượt sức chứa tối đa của {1} ({2}) — chọn thêm phòng.", [occupants, sels.length > 1 ? tr("{0} phòng đã chọn", [sels.length]) : tr("phòng"), selMax]),
      );
      return;
    }
    if (!name.trim() || !phoneOk) {
      setTried(true);
      setErr(!name.trim() ? tr("Vui lòng nhập họ tên.") : phoneErr ?? "");
      return;
    }
    if (!emailLooksValid(email)) { setErr(tr("Email không hợp lệ (có thể để trống).")); return; }
    sendLock.current = true;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          useDate: ci,
          endDate: coEff,
          quantity: sels.length,
          adults,
          childrenAges: childAges,
          roomId: sels[0].r.id,
          roomIds: sels.map((v) => v.r.id),
          roomTypeId: null,
          customerName: name.trim(),
          phone: cphone.trim(),
          email: email.trim() || null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) setErr(tr(data.error) ?? tr("Gửi yêu cầu thất bại, vui lòng thử lại."));
      else { trackLeadConversion(); setResult(data); }
    } catch {
      setErr(tr("Lỗi kết nối, vui lòng thử lại."));
    } finally {
      sendLock.current = false;
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setSelected([]);
    setName("");
    setCphone("");
    setEmail("");
    setNote("");
    setTried(false);
    setErr("");
  }

  const scrollTo = (el: HTMLElement | null, off = 16) => {
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: "smooth" });
  };
  /**
   * Nút ở thanh đáy (điện thoại): chưa chọn ngày ⇒ tới lịch; chưa chọn phòng ⇒ tới danh sách phòng;
   * đã chọn phòng ⇒ tới form. Khách ĐÃ điền tên / SĐT (hoặc form đang nằm trong màn hình) mà bấm nút này
   * thì coi như bấm "Gửi yêu cầu" — trước đây nút chỉ cuộn nên bấm xong không thấy gì xảy ra.
   */
  const barAction = () => {
    if (!nN) return scrollTo(calRef.current, stickyOff());
    if (!hasSel) return goSec("ph");
    const el = panelRef.current;
    const r = el?.getBoundingClientRect();
    const inView = !!r && r.top < window.innerHeight - 220 && r.bottom > 160;
    if (name.trim() || cphone.trim() || inView) {
      void submit().then(() => scrollTo(panelRef.current, stickyOff() - 50)); // lỗi / mã đơn hiện trong form ⇒ đưa form vào màn hình
    } else scrollTo(el ?? null, stickyOff() - 50);
  };
  /** Khoảng trừ khi cuộn tới một mục: header dính của site + thanh tab dính của trang. */
  const stickyOff = () => (typeof window !== "undefined" && window.innerWidth >= 1024 ? 138 : 122);

  // ----- Bố cục trang (thiết kế "Chi tiết Homestay v3"): thanh tab dính + các mục -----
  // Tiện ích của cả homestay = gộp tiện ích các phòng (cái nào nhiều phòng có thì đứng trước).
  const amenAll = useMemo(() => {
    const cnt = new Map<string, { label: string; n: number }>();
    for (const r of rooms) for (const a of r.tags) {
      const k = a.toLowerCase();
      const cur = cnt.get(k);
      if (cur) cur.n++;
      else cnt.set(k, { label: a, n: 1 });
    }
    return [...cnt.values()].sort((a, b) => b.n - a.n).map((x) => x.label);
  }, [rooms]);
  const AMEN_FOLD = 9;
  const [amenOpen, setAmenOpen] = useState(false);
  const hasPolicy = policyCards.length > 0 || policyLines.length > 0;
  const secs = [
    { id: "tq", name: tr("Tổng quan"), on: true },
    { id: "ti", name: tr("Tiện ích"), on: amenAll.length > 0 },
    { id: "vt", name: tr("Vị trí"), on: true },
    { id: "cs", name: tr("Chính sách"), on: hasPolicy },
    { id: "ph", name: tr("Phòng · {0}", [rooms.length]), on: true },
    { id: "dg", name: tr("Đánh giá"), on: !!reviews },
  ].filter((s) => s.on);
  const rootRef = useRef<HTMLDivElement>(null);
  const secEl = (id: string) => rootRef.current?.querySelector<HTMLElement>(`[data-sec="${id}"]`) ?? null;
  const [tab, setTab] = useState("tq");
  const secIds = secs.map((s) => s.id).join(",");
  useEffect(() => {
    const ids = secIds.split(",");
    const onScroll = () => {
      const off = stickyOff() + 12;
      let cur = ids[0];
      for (const id of ids) {
        const el = rootRef.current?.querySelector<HTMLElement>(`[data-sec="${id}"]`);
        if (el && el.getBoundingClientRect().top <= off) cur = id;
      }
      setTab(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [secIds]);
  const goSec = (id: string) => { setTab(id); scrollTo(secEl(id), stickyOff()); };

  // ----- Lọc danh sách phòng (chỉ lọc HIỂN THỊ — không đổi giá / tình trạng / phòng đã chọn) -----
  type RoomFilter = "all" | "free" | "two" | "fam" | "view" | "tub";
  const [filter, setFilter] = useState<RoomFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const ROOM_FOLD = 6;
  const filterFn: Record<RoomFilter, (v: (typeof roomView)[number]) => boolean> = {
    all: () => true,
    free: (v) => v.free,
    two: (v) => v.r.capacity <= 2,
    fam: (v) => (v.r.maxCapacity ?? v.r.capacity) >= 4,
    view: (v) => v.r.view,
    tub: (v) => v.r.bathtub,
  };
  const filterDefs = ([["all", "Tất cả"], ["free", "Còn trống"], ["two", "1–2 khách"], ["fam", "Gia đình · nhóm"], ["view", "View mây"], ["tub", "Bồn tắm"]] as [RoomFilter, string][])
    .map(([k, name]) => ({ k, name, n: roomView.filter(filterFn[k]).length }))
    // "Còn trống" chỉ có nghĩa khi đã chọn ngày; bỏ nhóm rỗng và nhóm trùng "Tất cả".
    .filter((f) => f.k === "all" || (f.k === "free" ? nN > 0 && !contactOnly : f.n > 0 && f.n < roomView.length));
  const filterOn: RoomFilter = filterDefs.some((f) => f.k === filter) ? filter : "all";
  const roomList = roomView.filter(filterFn[filterOn]);
  // Phòng đã chọn luôn hiện dù đang thu gọn danh sách.
  const roomShown = showAll ? roomList : roomList.filter((v, i) => i < ROOM_FOLD || selected.includes(v.r.id));
  const freeCount = roomView.filter((v) => v.free).length;
  const minFrom = rooms.reduce<number | null>((m, r) => { const p = r.por ? null : fromPrice(r); return p != null && (m == null || p < m) ? p : m; }, null);
  const dm = (k: string) => dmy(k).slice(0, 5);
  const guestsN = adults + childAges.length;

  const CARD = "flex flex-col gap-3.5 rounded-[20px] border border-[oklch(0.92_0.01_160)] bg-white p-[18px]";
  const H2 = "text-xl font-extrabold tracking-[-.01em] text-ink";
  const SUB = "text-[13px] text-[oklch(0.5_0.02_160)]";
  const G = "oklch(0.29 0.055 160)";
  const O = "oklch(0.68 0.18 45)";

  return (
    <div ref={rootRef} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      {/* ===== Cột trái ===== */}
      <div className="flex min-w-0 flex-col gap-3.5">
        {/* Thanh tab dính */}
        <div className="sticky top-14 z-20 -mx-1 bg-[oklch(0.975_0.006_150/.92)] px-1 py-1.5 backdrop-blur-[10px] lg:top-[70px]">
          <div className="flex gap-1 overflow-x-auto rounded-[14px] border border-[oklch(0.92_0.01_160)] bg-white p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {secs.map((s) => (
              <button key={s.id} type="button" onClick={() => goSec(s.id)} className="flex-none cursor-pointer whitespace-nowrap rounded-[10px] px-3.5 py-[9px] text-sm font-extrabold transition-colors" style={{ background: tab === s.id ? G : "transparent", color: tab === s.id ? "white" : "oklch(0.38 0.02 160)" }}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* TỔNG QUAN */}
        <section data-sec="tq" className={CARD}>
          {highlights.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-2">
              {highlights.map((h, i) => (
                <div key={i} className="flex flex-col gap-0.5 rounded-[14px] bg-[oklch(0.975_0.01_155)] px-3.5 py-3">
                  <b className="text-sm">{tr(h.t)}</b>
                  {h.d && <span className="text-xs leading-[1.45] text-[oklch(0.48_0.02_160)]">{tr(h.d)}</span>}
                </div>
              ))}
            </div>
          )}
          {summary && <p className="text-[15px] font-semibold leading-[1.6] text-[oklch(0.28_0.02_160)]">{tr(summary)}</p>}
          {descText && (
            <div className="relative">
              <div className="overflow-hidden transition-[max-height] duration-500 ease-out" style={{ maxHeight: descLong && !descOpen ? 104 : 4000 }}>
                <p className="whitespace-pre-line text-[15px] leading-[1.7] text-[oklch(0.32_0.02_160)] [text-wrap:pretty]">{tr(descText)}</p>
              </div>
              {descLong && !descOpen && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-white" />}
            </div>
          )}
          {descLong && (
            <button type="button" onClick={() => setDescOpen((o) => !o)} className="cursor-pointer self-start text-sm font-extrabold text-[oklch(0.4_0.08_158)] hover:text-sunset-600">
              {descOpen ? tr("Thu gọn ↑") : tr("Đọc thêm ↓")}
            </button>
          )}
          {reviewLink}
        </section>

        {/* TIỆN ÍCH */}
        {amenAll.length > 0 && (
          <section data-sec="ti" className={CARD}>
            <div className="flex items-baseline justify-between gap-2.5">
              <h2 className={H2}>{tr("Tiện ích")}</h2>
              <span className={SUB}>{tr("{0} tiện ích", [amenAll.length])}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-x-5 gap-y-2.5">
              {(amenOpen ? amenAll : amenAll.slice(0, AMEN_FOLD)).map((a) => (
                <div key={a} className="flex items-start gap-2 text-sm leading-[1.4]">
                  <span className="mt-px flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-[oklch(0.94_0.05_155)] text-[11px] font-extrabold text-[oklch(0.4_0.1_155)]">✓</span>
                  {tr(a)}
                </div>
              ))}
            </div>
            {amenAll.length > AMEN_FOLD && (
              <button type="button" onClick={() => setAmenOpen((o) => !o)} className="cursor-pointer self-start rounded-full border-[1.5px] border-[oklch(0.88_0.015_160)] px-4 py-[9px] text-sm font-extrabold hover:border-[oklch(0.5_0.1_158)]">
                {amenOpen ? tr("Thu gọn") : tr("Xem tất cả {0} tiện ích", [amenAll.length])}
              </button>
            )}
            <p className="text-xs text-[oklch(0.52_0.02_160)]">{tr("Tiện ích khác nhau theo từng phòng — xem chi tiết ở mục Chọn phòng.")}</p>
          </section>
        )}

        {/* VỊ TRÍ */}
        <section data-sec="vt" id="vi-tri" className={`${CARD} scroll-mt-36`}>
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <h2 className={H2}>{tr("Vị trí & xung quanh")}</h2>
              {(area || distanceKm != null) && (
                <div className={`${SUB} mt-0.5`}>
                  {[area ? tr(area) : null, distanceKm != null ? (distanceKm > 0 ? tr("cách trung tâm Tà Xùa {0} km", [String(distanceKm).replace(".", ",")]) : tr("ngay trung tâm Tà Xùa")) : null].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            <a href={map.openUrl} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full px-3.5 py-[9px] text-[13px] font-extrabold text-white" style={{ background: G }}>
              {tr("Chỉ đường ↗")}
            </a>
          </div>
          <div className={`grid items-stretch gap-3.5 ${near.length ? "md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" : ""}`}>
            <div className="relative min-h-[240px] overflow-hidden rounded-2xl bg-[oklch(0.93_0.02_150)]">
              <iframe src={map.embedSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={tr("Bản đồ")} className="absolute inset-0 h-full w-full border-0" />
              {nearbySlot && <div className="absolute bottom-2.5 left-2.5">{nearbySlot}</div>}
            </div>
            {near.length > 0 && (
              <div className="flex flex-col gap-1">
                {near.map((n, i) => (
                  <div key={i} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[oklch(0.94_0.006_160)] px-1 py-[9px] last:border-b-0">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: n.c }} />
                    <div className="min-w-0">
                      {n.href ? <Link href={n.href} className="block truncate text-sm font-bold text-ink hover:text-sunset-600">{tr(n.name)}</Link> : <div className="truncate text-sm font-bold">{tr(n.name)}</div>}
                      <div className="text-xs text-[oklch(0.52_0.02_160)]">{tr(n.kind)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold">{String(n.km).replace(".", ",")} km</div>
                      <div className="whitespace-nowrap text-[11px] text-[oklch(0.52_0.02_160)]">{tr("~{0} phút xe máy", [n.min])}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CHÍNH SÁCH */}
        {hasPolicy && (
          <section data-sec="cs" className={CARD}>
            <h2 className={H2}>{tr("Chính sách")}</h2>
            {policyCards.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-2">
                {policyCards.map((p, i) => (
                  <div key={i} className="flex flex-col gap-1 rounded-[14px] border border-[oklch(0.92_0.01_160)] px-3.5 py-3">
                    <span className="text-xs font-bold text-[oklch(0.5_0.02_160)]">{tr(p.k)}</span>
                    <b className="text-[15px] leading-[1.35]">{tr(p.v)}</b>
                    {p.d && <span className="text-xs leading-[1.45] text-[oklch(0.48_0.02_160)]">{tr(p.d)}</span>}
                  </div>
                ))}
              </div>
            )}
            {policyLines.length > 0 && (
              <ul className="flex flex-col gap-2">
                {policyLines.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-[oklch(0.32_0.02_160)]">
                    <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-forest-500" />
                    <span>{tr(line)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-xl bg-[oklch(0.97_0.03_80)] px-3.5 py-2.5 text-[13px] leading-[1.55] text-[oklch(0.42_0.08_55)]">
              {tr("Giá chính thức là giá chốt bill qua Zalo. Giá trên web để tham khảo, có thể chưa kịp cập nhật khi chủ nhà vừa đổi giá.")}
            </div>
          </section>
        )}

        {/* CHỌN PHÒNG */}
        <section data-sec="ph" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2.5">
            <div>
              <h2 className="text-[22px] font-extrabold text-ink">{tr("Chọn phòng")}</h2>
              <div className={`${SUB} mt-0.5`}>
                {contactOnly
                  ? tr("Giá tham khảo từng phòng bên dưới — nhắn tin để nhận thông tin phòng trống & giữ phòng.")
                  : nN
                    ? tr("{0} phòng · {1} còn trống {2} → {3}", [roomList.length, freeCount, dm(ci!), dm(coEff!)]) + (inquiryOnly ? " · " + tr("nhắn tin để biết chi tiết & giữ phòng") : "")
                    : inquiryOnly
                      ? tr("Chọn ngày để xem phòng trống, rồi nhắn tin để biết chi tiết & giữ phòng.")
                      : tr("Chọn ngày để xem giá và phòng trống cho cả kỳ ở.")}
              </div>
            </div>
            {!contactOnly && (
              <div className="flex items-center gap-1.5 rounded-full border border-[oklch(0.9_0.01_160)] bg-white py-1.5 pl-3 pr-1.5">
                <span className="whitespace-nowrap text-[13px] font-bold">
                  {nN ? tr("{0} → {1} · {2} đêm · {3} khách", [dm(ci!), dm(coEff!), nN, guestsN]) : tr("Chưa chọn ngày · {0} khách", [guestsN])}
                </span>
                <button type="button" onClick={() => scrollTo(calRef.current, stickyOff())} className="cursor-pointer whitespace-nowrap rounded-full bg-[oklch(0.95_0.025_155)] px-2.5 py-1.5 text-xs font-extrabold text-[oklch(0.35_0.08_158)]">
                  {nN ? tr("Đổi ngày") : tr("Chọn ngày")}
                </button>
              </div>
            )}
          </div>

          {/* Lịch chọn ngày (ẩn với homestay "chỉ liên hệ" — không quản lý lịch trên web) */}
          {!contactOnly && (
            <div ref={calRef} className="flex flex-col gap-2 rounded-[18px] border border-[oklch(0.92_0.01_160)] bg-white p-3 sm:p-4">
              <div className="flex flex-wrap items-end justify-between gap-2.5">
                <div>
                  <b className="text-[17px]">{tr("Chọn ngày ở")}</b>
                  <div className="mt-0.5 text-xs text-[oklch(0.5_0.02_160)]">{tr(calHint)}</div>
                </div>
                <div className="flex flex-wrap gap-2.5 text-[11px] font-bold text-[oklch(0.45_0.02_160)]">
                  <Legend color="bg-forest-500" label={tr("Còn phòng")} />
                  <Legend color="bg-amber-500" label={tr("Còn ít")} />
                  <Legend color="bg-gray-400" label={tr("Hết phòng")} />
                  {holidayKeys.length > 0 && (
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-2.5 w-2.5 rounded-[3px] border border-red-400 bg-red-100" />
                      {tr("Ngày lễ")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => canPrev && setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
                  disabled={!canPrev}
                  className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-gray-200 disabled:opacity-30"
                  aria-label={tr("Tháng trước")}
                >
                  ‹
                </button>
                <div className="text-[15px] font-extrabold text-ink">{tr(monthLabel)}</div>
                <button
                  type="button"
                  onClick={() => canNext && setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
                  disabled={!canNext}
                  className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-gray-200 disabled:opacity-30"
                  aria-label={tr("Tháng sau")}
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {WD.map((w) => (
                  <div key={w} className="pb-1 text-center text-[11px] font-extrabold text-[oklch(0.55_0.02_160)]">{tr(w)}</div>
                ))}
                {monthCells.map((c, idx) => {
                  if (!c.key) return <div key={idx} />;
                  const disabled = !c.inWindow || c.status === "full";
                  const dotColor = c.status === "full" ? "bg-gray-400" : c.status === "low" ? "bg-amber-500" : "bg-forest-500";
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => !disabled && pickDay(c.key!)}
                      disabled={disabled}
                      title={c.inWindow ? (c.hol ? tr("Ngày lễ") + " · " : "") + (c.status === "full" ? tr("Hết phòng") : c.free + tr(" phòng trống")) : ""}
                      className={[
                        "flex h-[58px] flex-col justify-between rounded-[10px] border px-1.5 py-1.5 text-left transition",
                        c.isEnd
                          ? "border-forest-700 bg-forest-700 text-white"
                          : c.inRange
                            ? c.hol
                              ? "border-red-400 bg-red-100"
                              : "border-forest-300 bg-forest-100"
                            : c.hol && c.inWindow
                              ? "border-red-300 bg-red-50 hover:border-red-500 hover:bg-red-100"
                              : c.inWindow
                                ? c.status === "full"
                                  ? "border-transparent bg-[oklch(0.95_0.005_160)]"
                                  : c.status === "low"
                                    ? "border-transparent bg-[oklch(0.97_0.04_75)] hover:border-amber-400"
                                    : "border-transparent bg-[oklch(0.96_0.03_155)] hover:border-forest-400"
                                : "border-transparent",
                        !c.inWindow ? "cursor-default opacity-30" : c.status === "full" ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                      ].join(" ")}
                    >
                      <span className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className={`text-[13px] font-extrabold ${c.isEnd ? "text-white" : c.hol ? "text-red-600" : "text-ink"}`}>{c.day}</span>
                          {c.hol && (
                            <span className={`rounded px-1 text-[9px] font-extrabold leading-[14px] ${c.isEnd ? "bg-white text-red-600" : "bg-red-500 text-white"}`}>
                              {tr("Lễ")}
                            </span>
                          )}
                        </span>
                        {c.inWindow && <span className={`h-1.5 w-1.5 rounded-full ${c.isEnd ? "bg-white" : dotColor}`} />}
                      </span>
                      <span className={`truncate text-[10px] font-bold ${c.isEnd ? "text-forest-100" : c.status === "full" ? "text-gray-400" : "text-[oklch(0.42_0.06_155)]"}`}>
                        {c.inWindow ? (c.status === "full" ? tr("Hết") : c.minP != null ? shortK(c.minP) : c.free > 0 ? "IB" : "") : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!contactOnly && policyWarn && (
            <div className="rounded-xl bg-amber-50 px-3.5 py-3 text-[13px] font-medium leading-relaxed text-amber-800">⚠️ {tr(policyWarn)}</div>
          )}

          {filterDefs.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {filterDefs.map((f) => {
                const on = filterOn === f.k;
                return (
                  <button key={f.k} type="button" onClick={() => { setFilter(f.k); setShowAll(false); }} className="cursor-pointer whitespace-nowrap rounded-full border-[1.5px] px-[13px] py-[7px] text-[13px] font-bold" style={{ background: on ? G : "white", color: on ? "white" : "oklch(0.3 0.03 160)", borderColor: on ? G : "oklch(0.9 0.01 160)" }}>
                    {tr(f.name)} <span className="opacity-60">{f.n}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {roomShown.length === 0 && <div className="rounded-[18px] border border-dashed border-[oklch(0.86_0.02_160)] bg-white p-5 text-center text-sm text-[oklch(0.5_0.02_160)]">{tr("Không có phòng nào khớp bộ lọc này.")}</div>}
            {roomShown.map((v) => {
              const isSel = sels.some((s) => s.r.id === v.r.id);
              const noPrice = v.r.por || v.ib;
              const strike = noPrice ? null : nN ? v.stayStrike : fromStrike(v.r);
              const sale = noPrice ? null : nN ? v.stayPrice : fromPrice(v.r);
              const pct = strike != null && sale != null && strike > sale ? Math.max(1, Math.round(((strike - sale) / strike) * 100)) : 0;
              const m0 = v.r.media[0];
              const chip = v.tone === "ok" ? "bg-[oklch(0.94_0.05_155)] text-[oklch(0.36_0.1_155)]" : v.tone === "full" ? "bg-[oklch(0.95_0.005_160)] text-[oklch(0.45_0.02_160)]" : "bg-[oklch(0.96_0.006_160)] text-[oklch(0.5_0.02_160)]";
              const unavailable = nN > 0 && !contactOnly && !v.free;
              const capLine = (
                <>
                  {v.r.typeName.trim().toLowerCase() !== v.r.name.trim().toLowerCase() && <>{tr(v.r.typeName)} ·{" "}</>}
                </>
              );
              const perLabel = noPrice ? tr("Giá phòng") : v.communal ? (nN > 1 ? tr("/ người / {0} đêm", [nN]) : tr("/ người / đêm")) : nN ? tr("tổng {0} đêm", [nN]) : tr("mỗi đêm từ");
              const rates: [string, string][] = v.r.por
                ? []
                : [
                    [tr("Ngày thường"), v.wdP > 0 ? tr(fmt(v.wdP)) : tr(IB)],
                    [tr("Cuối tuần"), v.weP > 0 ? tr(fmt(v.weP)) : tr(IB)],
                    ...(v.r.holiday != null && v.r.holiday > 0 && holidayKeys.length > 0 ? ([[tr("Ngày lễ"), tr(fmt(v.r.holiday))]] as [string, string][]) : []),
                  ];
              // Ảnh phòng dạng SLIDE (≥2 ảnh): lướt xem ngay trên thẻ, chạm ảnh mở lightbox đúng ảnh đó (video vẫn xem trong lightbox).
              const pics = v.r.media.map((m, i) => ({ m, i })).filter((x) => x.m.type !== "video");
              const slideOn = pics.length > 1;
              const media = (cls: string, sizes: string, small = false) => slideOn ? (
                <div className={`relative overflow-hidden bg-[oklch(0.95_0.01_155)] ${cls}`}>
                  <CardSlides
                    slides={pics.map((x) => ({ url: x.m.url }))}
                    alt={tr(v.r.name)}
                    sizes={sizes}
                    small={small}
                    dotsClass={small ? "bottom-1" : "bottom-2.5"}
                    onOpen={(i) => openLb(v.r.media, pics[i]?.i ?? 0)}
                  />
                  {v.r.media.length > pics.length && (
                    <span className={`pointer-events-none absolute rounded-full bg-black/55 font-extrabold text-white ${small ? "bottom-1.5 left-1.5 px-1.5 py-0.5 text-[10px]" : "bottom-2.5 left-2.5 px-2 py-1 text-[11px]"}`}>▶ video</span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => v.r.media.length && openLb(v.r.media, 0)}
                  className={`relative overflow-hidden bg-[oklch(0.95_0.01_155)] ${cls} ${v.r.media.length ? "cursor-pointer" : "cursor-default"}`}
                  aria-label={tr("Xem ảnh/video phòng")}
                >
                  {m0 ? (
                    m0.type === "video" ? (
                      <>
                        <video src={m0.url} className="absolute inset-0 h-full w-full object-cover" muted playsInline preload="metadata" />
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl text-white drop-shadow">▶</span>
                      </>
                    ) : (
                      <Image src={m0.url} alt={tr(v.r.name)} fill sizes={sizes} className="object-cover" />
                    )
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-400">{tr("Chưa có ảnh")}</span>
                  )}
                </button>
              );
              const pickBtn = (big: boolean) =>
                chatOnly ? (
                  <a href={chatUrl} target={zalo ? "_blank" : undefined} rel={zalo ? "noopener noreferrer" : undefined} className={`whitespace-nowrap rounded-full font-extrabold text-white ${big ? "px-[18px] py-3 text-sm" : "px-4 py-2.5 text-[13px]"}`} style={{ background: O }}>
                    {tr("💬 Nhắn tin")}
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled={!v.free}
                    onClick={() => {
                      toggleRoom(v.r.id);
                      setResult(null);
                    }}
                    title={isSel ? tr("Bấm để bỏ chọn phòng này") : tr("Thêm phòng này vào đơn (chọn được nhiều phòng)")}
                    className={`whitespace-nowrap rounded-full border-[1.5px] font-extrabold transition ${big ? "px-[18px] py-3 text-sm" : "px-4 py-2.5 text-[13px]"} ${v.free ? "cursor-pointer" : "cursor-not-allowed"}`}
                    style={
                      !v.free
                        ? { background: "oklch(0.95 0.005 160)", color: "oklch(0.55 0.02 160)", borderColor: "oklch(0.9 0.01 160)" }
                        : isSel
                          ? { background: G, color: "white", borderColor: G }
                          : { background: "white", color: G, borderColor: G }
                    }
                  >
                    {!v.free ? (v.tone === "full" ? tr(v.status) : nN ? tr("Hết phòng") : tr("Chọn ngày")) : isSel ? tr("✓ Đã chọn") : hasSel ? tr("+ Thêm phòng") : tr("Chọn phòng")}
                  </button>
                );
              return (
                <article key={v.r.id} className="overflow-hidden rounded-[20px] border-2 bg-white transition sm:rounded-[18px]" style={{ borderColor: isSel ? G : "oklch(0.92 0.01 160)" }}>
                  {/* ĐIỆN THOẠI: thẻ dọc — ảnh 16:9, thông tin, bảng giá theo ngày, giá + nút */}
                  <div data-card="m" className="flex flex-col sm:hidden">
                    <div className="relative" style={{ opacity: unavailable ? 0.6 : 1 }}>
                      {media("block aspect-video w-full", "100vw")}
                      <span className={`pointer-events-none absolute left-2.5 top-2.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold ${chip}`}>{tr(v.status)}</span>
                      {v.r.media.length > 0 && !slideOn && (
                        <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-full bg-[oklch(0.2_0.02_160/.7)] px-[9px] py-1 text-[11px] font-extrabold text-white">
                          {v.r.media.some((m) => m.type === "video") ? "▶ " : ""}
                          {tr("{0} ảnh", [v.r.media.length])}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2.5 px-3.5 pb-3.5 pt-3">
                      <div className="flex flex-col gap-[3px]">
                        <b className="text-[17px] leading-[1.25]">{tr(v.r.name)}</b>
                        <div className="text-[13px] leading-[1.45] text-[oklch(0.45_0.02_160)]">{capLine}{tr("{0} khách", [v.r.capacity])}</div>
                        {v.r.maxCapacity != null && v.r.maxCapacity > v.r.capacity && <div className="text-xs text-[oklch(0.55_0.02_160)]">{tr("Tối đa {0} khách, có phụ thu", [v.r.maxCapacity])}</div>}
                      </div>
                      {v.r.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {v.r.tags.slice(0, 5).map((a) => (
                            <span key={a} className="whitespace-nowrap rounded-full bg-[oklch(0.965_0.006_160)] px-2.5 py-1 text-xs font-semibold text-[oklch(0.4_0.02_160)]">{tr(a)}</span>
                          ))}
                        </div>
                      )}
                      {rates.length > 0 && (
                        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${rates.length},minmax(0,1fr))` }}>
                          {rates.map(([k, val]) => (
                            <div key={k} className="flex flex-col gap-px rounded-xl bg-[oklch(0.975_0.006_160)] px-2.5 py-2">
                              <span className="whitespace-nowrap text-[11px] text-[oklch(0.5_0.02_160)]">{k}</span>
                              <b className="whitespace-nowrap text-[13px]">{val}</b>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-t border-dashed border-[oklch(0.9_0.01_160)] pt-3">
                        <div className="min-w-0">
                          {strike != null && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-[oklch(0.55_0.02_160)] line-through">{tr(fmt(strike))}</span>
                              {pct > 0 && <span className="rounded-md px-1.5 py-px text-[11px] font-extrabold text-white" style={{ background: O }}>−{pct}%</span>}
                            </div>
                          )}
                          <div className="flex flex-wrap items-baseline gap-x-1.5">
                            <span data-price className={`whitespace-nowrap font-extrabold leading-[1.15] ${noPrice ? "text-base text-forest-700" : "text-[22px] text-[oklch(0.58_0.17_45)]"}`}>{noPrice ? tr(IB) : tr(fmt(sale))}</span>
                            <span className="whitespace-nowrap text-xs text-[oklch(0.5_0.02_160)]">{perLabel}</span>
                          </div>
                        </div>
                        {pickBtn(true)}
                      </div>
                      {pct > 0 && strike != null && sale != null && (
                        <div className="rounded-[10px] bg-[oklch(0.96_0.03_155)] px-2.5 py-[7px] text-xs font-bold text-[oklch(0.4_0.1_155)]">{tr("🎁 Đặt trên website giảm {0}", [tr(fmt(strike - sale))])}</div>
                      )}
                    </div>
                  </div>

                  {/* MÁY TÍNH / MÀN RỘNG: thẻ hàng ngang — ảnh · thông tin · giá + nút */}
                  <div data-card="d" className="hidden grid-cols-[150px_minmax(0,1fr)_auto] items-center gap-x-3.5 p-2.5 sm:grid" style={{ opacity: unavailable ? 0.62 : 1 }}>
                    <div className="relative h-full min-h-[112px] self-stretch">
                      {media("absolute inset-0 h-full w-full rounded-xl", "150px", true)}
                      {v.r.media.length > 1 && !slideOn && (
                        <span className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {v.r.media.some((m) => m.type === "video") ? "▶ " : "🖼 "}
                          {v.r.media.length}
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col gap-[5px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-base leading-tight">{tr(v.r.name)}</b>
                        <span className={`whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-extrabold ${chip}`}>{tr(v.status)}</span>
                      </div>
                      <div className="text-[13px] text-[oklch(0.45_0.02_160)]">
                        {capLine}
                        {v.r.maxCapacity && v.r.maxCapacity > v.r.capacity
                          ? tr("{0} khách · tối đa {1} (phụ thu)", [v.r.capacity, v.r.maxCapacity])
                          : tr("{0} khách", [v.r.capacity])}
                      </div>
                      {v.r.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {v.r.tags.slice(0, 4).map((a) => (
                            <span key={a} className="whitespace-nowrap rounded-full bg-[oklch(0.965_0.006_160)] px-2 py-[3px] text-[11px] font-semibold text-[oklch(0.4_0.02_160)]">{tr(a)}</span>
                          ))}
                        </div>
                      )}
                      {rates.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 text-xs text-[oklch(0.5_0.02_160)]">
                          {rates.map(([k, val]) => (
                            <span key={k}>{k} <b className="text-ink">{val}</b></span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end justify-between gap-1.5 text-right">
                      <div>
                        {strike != null && (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-[oklch(0.5_0.02_160)] line-through">{tr(fmt(strike))}</span>
                            {pct > 0 && <span className="rounded-md bg-sunset-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">−{pct}%</span>}
                          </div>
                        )}
                        <div data-price className={`whitespace-nowrap font-extrabold ${noPrice ? "text-[15px] text-forest-700" : "text-[19px] text-[oklch(0.58_0.17_45)]"}`}>
                          {noPrice ? tr(IB) : tr(fmt(sale))}
                        </div>
                        <div className="text-[11px] text-[oklch(0.5_0.02_160)]">{perLabel}</div>
                        {pct > 0 && strike != null && sale != null && (
                          <div className="mt-1 inline-flex w-fit items-center rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-semibold text-forest-700 ring-1 ring-forest-200">{tr("🎁 Đặt trên website giảm {0}", [tr(fmt(strike - sale))])}</div>
                        )}
                      </div>
                      {pickBtn(false)}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {!showAll && roomList.length > roomShown.length && (
            <button type="button" onClick={() => setShowAll(true)} className="cursor-pointer self-center rounded-full border-[1.5px] border-[oklch(0.88_0.015_160)] bg-white px-5 py-[11px] text-sm font-extrabold hover:border-[oklch(0.5_0.1_158)]">
              {tr("Xem thêm {0} phòng", [roomList.length - roomShown.length])}
            </button>
          )}
        </section>

        {/* ĐÁNH GIÁ */}
        {reviews && (
          <section data-sec="dg" className={CARD}>
            {reviews}
          </section>
        )}

        {/* Homestay khác gần đây */}
        {suggestions && suggestions.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">{tr("Homestay khác gần đây")}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {nN ? tr("Cùng khu Tà Xùa · xem cho {0} đêm bạn chọn", [nN]) : tr("Cùng khu Tà Xùa, bấm xem để chọn ngày")}
                </p>
              </div>
              <Link href={`/homestay${dateQS}`} className="whitespace-nowrap text-sm font-bold text-forest-700 hover:text-sunset-600">
                {tr("Xem tất cả →")}
              </Link>
            </div>
            <div className="-m-0.5 grid snap-x snap-mandatory auto-cols-[48%] grid-flow-col gap-3 overflow-x-auto p-0.5 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:auto-cols-[minmax(0,1fr)] sm:gap-3.5 [&::-webkit-scrollbar]:hidden">
              {suggestions.map((g) => (
                <Link
                  key={g.slug}
                  href={`/homestay/${g.slug}${dateQS}`}
                  className="flex snap-start flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative aspect-[4/3] bg-forest-50">
                    {g.cover ? (
                      <Image src={g.cover} alt={tr(g.name)} fill sizes="(max-width:640px) 72vw, 240px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">🏠</div>
                    )}
                    {g.status !== "none" && (
                      <span
                        className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                          g.status === "ok"
                            ? "bg-forest-100 text-forest-800"
                            : g.status === "low"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {g.status === "ok" ? tr("Còn phòng") : g.status === "low" ? tr("Còn ít") : tr("Hết phòng")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 p-3.5">
                    <div className="text-[15px] font-extrabold leading-snug text-ink">{tr(g.name)}</div>
                    <div className="text-xs text-gray-500">{tr(g.area)}</div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="font-extrabold text-sunset-600">
                        {g.price > 0 ? <span className="text-base">{tr(fmt(g.price))}</span> : <span className="text-sm">{tr(IB)}</span>}
                        {g.price > 0 && <span className="text-xs font-medium text-gray-400">{tr("/đêm")}</span>}
                      </span>
                      <span className="text-xs font-semibold text-gray-500">{tr(g.cat)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ===== Cột phải: panel đặt phòng dính ===== */}
      <aside ref={panelRef} className="scroll-mt-32 lg:sticky lg:top-[86px]">
        <div className="flex flex-col gap-3.5 rounded-[22px] border border-[oklch(0.92_0.01_160)] bg-white p-[18px] shadow-[0_24px_50px_-30px_oklch(0.2_0.04_160/.35)]">
          {chatOnly ? (
            <div className="flex flex-col gap-3">
              <div className="text-lg font-extrabold text-ink">{contactOnly ? tr("Nhắn tin để nhận thông tin") : tr("Nhắn tin để biết chi tiết")}</div>
              <p className="text-sm leading-relaxed text-gray-600">
                {contactOnly
                  ? tr("Homestay này không hiển thị lịch trống trên web. Nhắn tin hoặc gọi cho Tà Xùa Booking để kiểm tra phòng trống, nhận báo giá chính xác và giữ phòng — phản hồi nhanh trong giờ hành chính.")
                  : tr("Homestay này không nhận đặt trực tiếp trên web. Chọn ngày để xem phòng còn trống, rồi nhắn tin hoặc gọi cho Tà Xùa Booking để biết chi tiết và giữ phòng.")}
              </p>
              <a
                href={chatUrl}
                target={zalo ? "_blank" : undefined}
                rel={zalo ? "noopener noreferrer" : undefined}
                className="rounded-xl bg-sunset-500 px-4 py-3.5 text-center text-base font-bold text-white transition hover:bg-sunset-600"
              >
                {contactOnly ? tr("💬 Nhắn tin nhận thông tin") : tr("💬 Nhắn tin để biết chi tiết")}
              </a>
              <p className="text-center text-xs leading-relaxed text-gray-500">
                {tr("Giá hiển thị là giá tham khảo theo bảng giá niêm yết của homestay.")}
              </p>
            </div>
          ) : result ? (
            <div className="flex flex-col gap-2 rounded-xl bg-forest-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-forest-700">{tr("Đã gửi yêu cầu")}</div>
              <div className="text-2xl font-extrabold text-ink">{tr("Mã: {0}", [tr(result.code)])}</div>
              <p className="text-sm leading-relaxed text-gray-600">
                <VoiceText text={result.needsConfirmation
                  ? tr("Tụi mình sẽ gọi {0} để xác nhận phòng (chưa thanh toán online).", [cphone])
                  : tr("Tụi mình sẽ gọi {0} để xác nhận chi tiết.", [cphone])} />
              </p>
              <SupportHoursNote />
              <button type="button" onClick={reset} className="mt-1 self-start rounded-lg bg-white px-4 py-2 text-sm font-bold text-forest-800 ring-1 ring-gray-200">
                {tr("Đặt thêm")}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <div className="text-lg font-extrabold text-ink">{tr("Đặt phòng")}</div>
                <div className="text-[13px] text-[oklch(0.5_0.02_160)]">{minFrom != null ? <>{tr("từ")} <b className="text-[oklch(0.58_0.17_45)]">{tr(fmt(minFrom))}</b>{tr("/đêm")}</> : tr("Không cần tài khoản")}</div>
              </div>

              {/* Nhận / trả */}
              <button
                type="button"
                onClick={() => scrollTo(calRef.current, stickyOff())}
                className="grid cursor-pointer grid-cols-2 overflow-hidden rounded-[14px] border-[1.5px] border-[oklch(0.88_0.015_160)] text-left"
              >
                <div className="border-r border-gray-200 px-3.5 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{tr("Nhận phòng")}</div>
                  <div className="mt-0.5 text-sm font-bold text-ink">{ci ? tr(dname(ci)) : tr("Chọn ngày")}</div>
                </div>
                <div className="px-3.5 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{tr("Trả phòng")}</div>
                  <div className="mt-0.5 text-sm font-bold text-ink">{coEff ? tr(dname(coEff)) : tr("Chọn ngày")}</div>
                </div>
              </button>

              {/* Số khách: người lớn + trẻ em (kèm tuổi) */}
              <div className="flex flex-col gap-2.5 py-0.5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-ink">{tr("Người lớn")}</div>
                  <div className="flex items-center gap-2.5">
                    <button type="button" onClick={() => setAdults((g) => Math.max(1, g - 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-lg ring-1 ring-gray-200">−</button>
                    <span className="min-w-[16px] text-center font-extrabold">{adults}</span>
                    <button type="button" onClick={() => setAdults((g) => Math.min(20, g + 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-lg ring-1 ring-gray-200">+</button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-ink">{tr("Trẻ em")}</div>
                    <div className="text-xs text-gray-500">{tr("Dưới {0} tuổi: miễn phí", [childFreeUnderAge])}</div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button type="button" onClick={() => setChildAges((a) => a.slice(0, -1))} className="flex h-8 w-8 items-center justify-center rounded-full text-lg ring-1 ring-gray-200">−</button>
                    <span className="min-w-[16px] text-center font-extrabold">{childAges.length}</span>
                    <button type="button" onClick={() => setChildAges((a) => (a.length >= 10 ? a : [...a, 6]))} className="flex h-8 w-8 items-center justify-center rounded-full text-lg ring-1 ring-gray-200">+</button>
                  </div>
                </div>
                {childAges.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {childAges.map((age, i) => (
                      <label key={i} className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2 py-1 text-xs ring-1 ring-gray-200">
                        <span className="text-gray-500">{tr("Bé {0}", [i + 1])}</span>
                        <input
                          type="number"
                          min={0}
                          max={17}
                          value={age}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(17, parseInt(e.target.value || "0", 10) || 0));
                            setChildAges((arr) => arr.map((x, j) => (j === i ? v : x)));
                          }}
                          className="w-12 rounded border border-gray-200 px-1.5 py-1 text-center font-bold text-ink outline-none"
                        />
                        <span className="text-gray-500">{tr("tuổi")}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className={`text-xs ${over ? "text-red-600" : "text-gray-500"}`}>
                  {hasSel
                    ? over
                      ? tr("Vượt tối đa {0} người{1} (đang {2}) — chọn thêm phòng", [selMax, sels.length > 1 ? tr(" của {0} phòng", [sels.length]) : "", occupants])
                      : extraGuests > 0
                        ? tr("{0} người tính phí · {1} vượt chuẩn{2}", [occupants, extraGuests, sels[0].r.extraFee ? tr(" · phụ thu {0}/người/đêm", [tr(fmt(sels[0].r.extraFee))]) : ""])
                        : tr("{0}Sức chứa {1}{2} người · đang {3} tính phí", [sels.length > 1 ? tr("{0} phòng · ", [sels.length]) : "", selCap, selMax > selCap ? tr(" · tối đa {0}", [selMax]) : "", occupants])
                    : tr("Chọn phòng để biết sức chứa · đặt được nhiều phòng trong 1 đơn")}
                </div>
              </div>

              {/* Dòng tạm tính */}
              {hasSel ? (
                <div className="flex flex-col gap-2 rounded-xl bg-forest-50/60 p-3.5">
                  {sels.length > 1 && (
                    <div className="text-[11px] font-bold uppercase tracking-wide text-forest-700">{tr("{0} phòng · {1} đêm", [sels.length, nN])}</div>
                  )}
                  {sels.map((v, si) => (
                    <div key={v.r.id} className="flex items-start justify-between gap-2 text-[13px]">
                      <span className="min-w-0 text-gray-600">{tr(v.r.typeName)} · {tr(v.r.name)}{sels.length > 1 ? "" : tr(" · {0} đêm", [nN])}{v.communal && !v.ib && v.stayPrice != null ? <>{" · "}<b className="text-ink">{tr("{0} khách × {1}", [unitsOf(si), tr(fmt(v.stayPrice))])}</b></> : null}</span>
                      <span className="flex flex-none items-center gap-1.5">
                        <span className="whitespace-nowrap font-bold text-ink">{v.ib ? tr(IB) : tr(fmt((v.stayStrike ?? v.stayPrice ?? 0) * unitsOf(si)))}</span>
                        {sels.length > 1 && (
                          <button
                            type="button"
                            onClick={() => toggleRoom(v.r.id)}
                            className="flex h-5 w-5 items-center justify-center rounded-full text-xs text-gray-400 ring-1 ring-gray-200 hover:text-red-600"
                            aria-label={tr("Bỏ {0}", [tr(v.r.name)])}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                  {!anyIb && extraCost > 0 && (
                    <div className="flex justify-between gap-2 text-[13px]">
                      <span className="min-w-0 text-gray-600">{tr("Phụ thu {0} người thêm × {1} đêm", [extraGuests, nN])}</span>
                      <span className="whitespace-nowrap font-bold text-ink">{tr(fmt(extraCost))}</span>
                    </div>
                  )}
                  {webPromo > 0 && <PriceLine promo label={tr("🎁 Khuyến mãi khi đặt trên website")} amount={webPromo} />}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 p-3.5 text-[13px] leading-relaxed text-gray-500">
                  {tr("Chọn ngày ở và một hoặc nhiều phòng còn trống bên trái.")}
                </div>
              )}

              {policyWarn && (
                <div className="rounded-xl bg-amber-50 px-3.5 py-3 text-[13px] font-medium leading-relaxed text-amber-800">
                  ⚠️ {tr(policyWarn)}
                </div>
              )}

              <div className="flex items-baseline justify-between">
                <span className="font-bold text-ink">{tr("Tạm tính")}</span>
                <span className={`font-extrabold text-sunset-600 ${anyIb ? "text-lg" : "text-2xl"}`}>
                  {anyIb ? tr(IB) : tr(fmt(total, tr("0đ")))}
                </span>
              </div>

              {/* Form khách */}
              <div className="flex flex-col gap-2.5 border-t border-gray-100 pt-3.5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tr("Họ và tên *")}
                  className={`rounded-xl border px-3.5 py-3 text-base outline-none focus:ring-2 focus:ring-forest-200 ${tried && !name.trim() ? "border-red-400" : "border-gray-200 focus:border-forest-500"}`}
                />
                <input
                  value={cphone}
                  onChange={(e) => setCphone(e.target.value)}
                  inputMode="tel"
                  placeholder={tr("Số điện thoại *")}
                  className={`rounded-xl border px-3.5 py-3 text-base outline-none focus:ring-2 focus:ring-forest-200 ${tried && !phoneOk ? "border-red-400" : "border-gray-200 focus:border-forest-500"}`}
                />
                <BookingEmailField value={email} onChange={setEmail} inputClassName="rounded-xl border border-gray-200 px-3.5 py-3 text-base outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200" />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={tr("Ghi chú (giờ tới, trẻ nhỏ…)")}
                  className="resize-y rounded-xl border border-gray-200 px-3.5 py-3 text-sm outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                />
                {err && <div className="text-sm font-semibold text-red-600">{tr(err)}</div>}
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className={`cursor-pointer rounded-full px-4 py-3.5 text-[15px] font-extrabold transition ${ready && !submitting ? "bg-[oklch(0.68_0.18_45)] text-white hover:bg-[oklch(0.62_0.18_45)]" : "bg-[oklch(0.75_0.06_50)] text-white"}`}
                >
                  {submitting ? tr("Đang gửi...") : sels.length > 1 ? tr("Gửi yêu cầu đặt {0} phòng", [sels.length]) : tr("Gửi yêu cầu đặt phòng")}
                </button>
                <ItineraryLink nights={nN} cost={hasSel && total ? { roomTotal: total, rooms: sels.length, pax: adults + childAges.length } : undefined} />
                <CommitmentLink className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-forest-700 transition hover:text-forest-900" />
                <p className="text-center text-xs leading-relaxed text-gray-500">
                  {tr("Giá tham khảo. Tụi mình gọi xác nhận, không thanh toán online.")}
                </p>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="whitespace-nowrap rounded-full border-[1.5px] border-[oklch(0.88_0.015_160)] px-3 py-2.5 text-center text-[13px] font-extrabold text-[oklch(0.25_0.03_160)]">
              {tr("Gọi {0}", [tr(phone)])}
            </a>
            {zalo && (
              <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full bg-[oklch(0.95_0.03_250)] px-3 py-2.5 text-center text-[13px] font-extrabold text-[oklch(0.42_0.12_250)]">
                Chat Zalo
              </a>
            )}
          </div>
        </div>
      </aside>

      {/* Thanh đáy dính (mobile) */}
      {chatOnly ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2.5 border-t border-[oklch(0.92_0.01_160)] bg-white px-3.5 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-10px_30px_-20px_oklch(0.2_0.03_160/.4)] lg:hidden">
          <div className="min-w-0">
            <div className="truncate text-xs text-gray-500">{tr("Kiểm tra phòng trống & giữ phòng")}</div>
            <div className="text-base font-extrabold text-ink">{contactOnly ? tr("Nhắn tin nhận thông tin") : tr("Nhắn tin để biết chi tiết")}</div>
          </div>
          <a
            href={chatUrl}
            target={zalo ? "_blank" : undefined}
            rel={zalo ? "noopener noreferrer" : undefined}
            className="whitespace-nowrap rounded-xl bg-sunset-500 px-5 py-3 text-sm font-bold text-white"
          >
            {tr("💬 Nhắn tin")}
          </a>
        </div>
      ) : !result && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2.5 border-t border-[oklch(0.92_0.01_160)] bg-white px-3.5 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-10px_30px_-20px_oklch(0.2_0.03_160/.4)] lg:hidden">
          <div className="min-w-0">
            <div className="truncate text-xs text-[oklch(0.5_0.02_160)]">{nN ? (hasSel ? tr("{0} phòng · {1} → {2}", [sels.length, dm(ci!), dm(coEff!)]) : tr("Mỗi đêm · {0} → {1}", [dm(ci!), dm(coEff!)])) : tr("Chọn ngày ở")}</div>
            {/* flex-wrap: tổng 8 chữ số + giá gạch không đủ chỗ cạnh nút "Đặt phòng" → giá gạch tự xuống dòng. */}
            <div className="flex flex-wrap items-baseline gap-x-1.5 text-lg font-extrabold text-ink">
              {webPromo > 0 && total != null && <span className="whitespace-nowrap text-xs font-semibold text-gray-400 line-through">{tr(fmt(total + webPromo))}</span>}
              <span className="whitespace-nowrap text-[oklch(0.58_0.17_45)]">{anyIb ? tr(IB) : hasSel ? tr(fmt(total, tr("0đ"))) : minFrom != null ? tr("Từ {0}", [tr(fmt(minFrom))]) : tr(IB)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={barAction}
            className="cursor-pointer whitespace-nowrap rounded-full bg-[oklch(0.68_0.18_45)] px-5 py-[13px] text-[15px] font-extrabold text-white"
          >
            {hasSel ? tr("Đặt phòng") : !nN ? tr("Chọn ngày") : tr("Chọn phòng")}
          </button>
        </div>
      )}

      {/* Lightbox slider ảnh/video của phòng */}
      {lb && (
        <div onClick={() => setLb(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button type="button" onClick={() => setLb(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25" aria-label={tr("Đóng")}>×</button>
          {lb.media.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLb((s) => (s ? { ...s, i: (s.i - 1 + s.media.length) % s.media.length } : s)); }}
                className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-3xl text-white hover:bg-white/25"
                aria-label={tr("Trước")}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLb((s) => (s ? { ...s, i: (s.i + 1) % s.media.length } : s)); }}
                className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-3xl text-white hover:bg-white/25"
                aria-label="Sau"
              >
                ›
              </button>
            </>
          )}
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-full max-w-4xl flex-col items-center gap-3">
            {lb.media[lb.i].type === "video" ? (
              <video key={lb.i} src={lb.media[lb.i].url} className="max-h-[78vh] max-w-full rounded-xl" controls autoPlay playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={lb.i} src={lb.media[lb.i].url} alt="" className="max-h-[78vh] max-w-full rounded-xl object-contain" />
            )}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-white/90">{lb.i + 1} / {lb.media.length}</span>
              {lb.media.length > 1 && (
                <div className="flex gap-1.5">
                  {lb.media.map((_, k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLb((s) => (s ? { ...s, i: k } : s)); }}
                      className={`h-2 rounded-full transition-all ${k === lb.i ? "w-5 bg-white" : "w-2 bg-white/40"}`}
                      aria-label={tr("Mục {0}", [k + 1])}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const tr = useT();
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {tr(label)}
    </span>
  );
}
