"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";

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
  amenities: string[];
  media: HomestayMedia[];
  base: number; // giá hiệu lực (sale ?? list)
  listPrice: number; // giá niêm yết (để gạch ngang khi có giảm)
  hasSale: boolean;
  /** Giá theo thứ, chỉ mục theo getUTCDay(): [CN,T2,T3,T4,T5,T6,T7]. null = dùng base. */
  days: (number | null)[];
  /** Các ngày (yyyy-mm-dd) phòng bị chiếm (không bán). */
  occupied: string[];
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
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
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
  rooms,
  startKey,
  numDays,
  phone,
  zalo,
  area,
  mapQuery,
  mapUrl,
  policy,
  header,
  description,
  suggestions,
  initialCheckIn,
  initialCheckOut,
}: {
  serviceId: string;
  rooms: HomestayRoom[];
  startKey: string;
  numDays: number;
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
  /** Gallery + tiêu đề dịch vụ, đặt trên cùng cột trái (giống thiết kế). */
  header?: ReactNode;
  /** Mô tả chi tiết — hiển thị thu gọn kèm nút "Xem đầy đủ mô tả". */
  description?: string | null;
  /** Homestay khác gần đây (gợi ý cuối trang). */
  suggestions?: HomestaySuggestion[];
}) {
  const map = resolveMap(mapUrl, mapQuery);
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
  const [selected, setSelected] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);

  const [name, setName] = useState("");
  const [cphone, setCphone] = useState("");
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
  const priceOf = (r: HomestayRoom, d: Date) => {
    const o = r.days[wdIndex(d)];
    return o != null ? o : r.base;
  };

  const nights = useMemo(() => {
    if (!ci || !co) return [] as Date[];
    const a = parseKey(ci), b = parseKey(co);
    const out: Date[] = [];
    for (let t = a.getTime(); t < b.getTime(); t += MS) out.push(new Date(t));
    return out;
  }, [ci, co]);
  const nN = nights.length;

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
            const p = priceOf(r, date);
            if (minP == null || p < minP) minP = p;
          }
        });
      }
      const status = free === 0 ? "full" : free <= 2 ? "low" : "ok";
      const isEnd = k === ci || k === co;
      const inRange = Boolean(ci && co && k > ci && k < co);
      cells.push({ key: k, day: d, inWindow, free, minP, status, isEnd, inRange });
    }
    while (cells.length % 7) cells.push({ key: null, day: 0, inWindow: false, free: 0, minP: null, status: "ok", isEnd: false, inRange: false });
    return cells;
  }, [cursor, rooms, occ, start, end, ci, co]);

  const canPrev = cursor.y > start.getUTCFullYear() || (cursor.y === start.getUTCFullYear() && cursor.m > start.getUTCMonth());
  const canNext = cursor.y < end.getUTCFullYear() || (cursor.y === end.getUTCFullYear() && cursor.m < end.getUTCMonth());
  const monthLabel = `Tháng ${cursor.m + 1}, ${cursor.y}`;

  const dname = (k: string) => {
    const d = parseKey(k);
    return WD[wdIndex(d)] + ", " + String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0");
  };
  const calHint = !ci
    ? "Bấm chọn ngày nhận phòng"
    : !co
      ? "Bấm tiếp ngày trả phòng"
      : `${dname(ci)} → ${dname(co)} · ${nN} đêm`;

  // ----- Thẻ phòng theo kỳ đã chọn -----
  const roomView = rooms.map((r, i) => {
    const free = nN > 0 && nights.every((d) => !occ[i].has(keyOf(d)));
    const stayPrice = nights.reduce((a, d) => a + priceOf(r, d), 0);
    const wdP = r.days[2] ?? r.base; // T4 đại diện ngày thường
    const weP = r.days[6] ?? r.base; // T7 đại diện cuối tuần
    let status: string, tone: "ok" | "low" | "full" | "idle";
    if (!nN) { status = "Chọn ngày"; tone = "idle"; }
    else if (!free) { status = "Hết phòng"; tone = "full"; }
    else { status = "Còn phòng"; tone = "ok"; }
    return { r, i, free, stayPrice, wdP, weP, status, tone };
  });

  const dateQS = ci && co ? `?from=${ci}&to=${co}` : "";
  const sel = roomView.find((v) => v.r.id === selected && v.free) ?? null;
  const total = sel ? sel.stayPrice : 0;
  const over = sel ? guests > sel.r.capacity : false;
  const phoneOk = /^0\d{9}$/.test(cphone.replace(/\s/g, ""));
  const ready = nN > 0 && Boolean(sel) && !over;

  async function submit() {
    setErr("");
    if (!ready) {
      setErr(!nN ? "Vui lòng chọn ngày nhận và trả phòng." : !sel ? "Vui lòng chọn một phòng còn trống." : "Số khách vượt sức chứa của phòng.");
      return;
    }
    if (!name.trim() || !phoneOk) {
      setTried(true);
      setErr(!name.trim() ? "Vui lòng nhập họ tên." : "Số điện thoại chưa đúng (10 số, bắt đầu bằng 0).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          useDate: ci,
          endDate: co,
          quantity: 1,
          roomId: sel!.r.id,
          roomTypeId: null,
          customerName: name.trim(),
          phone: cphone.trim(),
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Gửi yêu cầu thất bại, vui lòng thử lại.");
      else setResult(data);
    } catch {
      setErr("Lỗi kết nối, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setName("");
    setCphone("");
    setNote("");
    setTried(false);
    setErr("");
  }

  const scrollTo = (el: HTMLElement | null, off = 16) => {
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: "smooth" });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      {/* ===== Cột trái: gallery + tiêu đề + bản đồ + lịch + thẻ phòng ===== */}
      <div className="flex min-w-0 flex-col gap-8">
        {header}

        {/* Mô tả — thu gọn, bấm để xem đầy đủ (giống thiết kế) */}
        {descText && (
          <section className="relative max-w-[680px]">
            <div
              className="overflow-hidden transition-[max-height] duration-500 ease-out"
              style={{ maxHeight: descLong && !descOpen ? 120 : 2000 }}
            >
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-gray-700">{descText}</p>
            </div>
            {descLong && !descOpen && (
              <div className="pointer-events-none absolute inset-x-0 bottom-10 h-16 bg-gradient-to-b from-transparent to-cloud" />
            )}
            {descLong && (
              <button
                type="button"
                onClick={() => setDescOpen((o) => !o)}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-3.5 py-2 text-sm font-bold text-forest-700 transition hover:bg-forest-50"
              >
                {descOpen ? "Thu gọn ↑" : "Xem đầy đủ mô tả ↓"}
              </button>
            )}
          </section>
        )}

        {/* Lịch chọn ngày */}
        <section ref={calRef} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">Chọn ngày ở</h2>
              <p className="mt-1 text-sm text-gray-500">{calHint}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-medium text-gray-500">
              <Legend color="bg-forest-500" label="Còn phòng" />
              <Legend color="bg-amber-500" label="Còn ít" />
              <Legend color="bg-gray-400" label="Hết phòng" />
            </div>
          </div>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => canPrev && setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
                disabled={!canPrev}
                className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-gray-200 disabled:opacity-30"
                aria-label="Tháng trước"
              >
                ‹
              </button>
              <div className="text-base font-extrabold text-ink">{monthLabel}</div>
              <button
                type="button"
                onClick={() => canNext && setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
                disabled={!canNext}
                className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-gray-200 disabled:opacity-30"
                aria-label="Tháng sau"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {WD.map((w) => (
                <div key={w} className="pb-2 pt-1 text-center text-[11px] font-bold text-gray-400">{w}</div>
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
                    title={c.inWindow ? (c.status === "full" ? "Hết phòng" : c.free + " phòng trống") : ""}
                    className={[
                      "flex h-16 flex-col justify-between rounded-xl border px-1.5 py-1.5 text-left transition",
                      c.isEnd
                        ? "border-forest-700 bg-forest-700 text-white"
                        : c.inRange
                          ? "border-forest-300 bg-forest-100"
                          : c.inWindow
                            ? "border-gray-200 bg-white hover:border-forest-400 hover:bg-forest-50"
                            : "border-transparent",
                      !c.inWindow ? "cursor-default opacity-30" : c.status === "full" ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <span className="flex items-center justify-between">
                      <span className={`text-sm font-extrabold ${c.isEnd ? "text-white" : "text-ink"}`}>{c.day}</span>
                      {c.inWindow && <span className={`h-1.5 w-1.5 rounded-full ${c.isEnd ? "bg-white" : dotColor}`} />}
                    </span>
                    <span className={`truncate text-[10px] font-semibold ${c.isEnd ? "text-forest-100" : c.status === "full" ? "text-gray-400" : "text-gray-500"}`}>
                      {c.inWindow ? (c.status === "full" ? "Hết" : c.minP != null ? shortK(c.minP) : "") : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Thẻ phòng */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">Các phòng</h2>
            <p className="mt-1 text-sm text-gray-500">
              {nN ? `Giá & tình trạng cho ${nN} đêm · ${dname(ci!)} → ${dname(co!)}.` : "Chọn ngày để xem giá và phòng trống cho cả kỳ ở."}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {roomView.map((v) => {
              const isSel = sel?.r.id === v.r.id;
              return (
                <article
                  key={v.r.id}
                  className={`overflow-hidden rounded-2xl bg-white transition ${isSel ? "ring-2 ring-forest-600" : "ring-1 ring-black/5"}`}
                >
                  <div className="grid sm:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="relative flex gap-0.5 bg-gray-100 sm:min-h-[180px]">
                      {(v.r.media.length ? v.r.media.slice(0, 2) : [null, null]).map((m, k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => v.r.media.length && openLb(v.r.media, k)}
                          className={`group relative aspect-[4/3] flex-1 overflow-hidden transition-[flex-grow] duration-500 ease-out hover:grow-[2.6] sm:aspect-auto ${v.r.media.length ? "cursor-pointer" : "cursor-default"}`}
                          aria-label="Xem ảnh/video phòng"
                        >
                          {m ? (
                            m.type === "video" ? (
                              <>
                                <video src={m.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl text-white drop-shadow">▶</span>
                              </>
                            ) : (
                              <Image src={m.url} alt={v.r.name} fill sizes="(max-width:640px) 50vw, 220px" className="object-cover" />
                            )
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">Chưa có ảnh</div>
                          )}
                        </button>
                      ))}
                      {v.r.media.length > 0 && (
                        <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {v.r.media.some((m) => m.type === "video") ? "▶ " : "🖼 "}
                          {v.r.media.length}
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-forest-700">{v.r.typeName}</div>
                          <div className="truncate text-lg font-extrabold text-ink">{v.r.name}</div>
                          <div className="mt-0.5 text-xs text-gray-500">Tối đa {v.r.capacity} người</div>
                        </div>
                        <StatusChip tone={v.tone} label={v.status} />
                      </div>
                      {v.r.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {v.r.amenities.slice(0, 5).map((a, k) => (
                            <span key={k} className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-100">{a}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-gray-500">
                        <span>Ngày thường <b className="text-ink">{fmt(v.wdP)}</b></span>
                        <span>Cuối tuần <b className="text-ink">{fmt(v.weP)}</b></span>
                        {v.r.hasSale && <span className="text-gray-400 line-through">{fmt(v.r.listPrice)}</span>}
                      </div>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
                        <div>
                          <div className="text-xs text-gray-500">{nN ? `${nN} đêm` : "Mỗi đêm từ"}</div>
                          <div className="text-xl font-extrabold text-ink">{nN ? fmt(v.stayPrice) : fmt(v.r.base)}</div>
                        </div>
                        <button
                          type="button"
                          disabled={!v.free}
                          onClick={() => {
                            setSelected(v.r.id);
                            setResult(null);
                            if (guests > v.r.capacity) setGuests(v.r.capacity);
                          }}
                          className={[
                            "rounded-xl px-5 py-2.5 text-sm font-bold transition",
                            !v.free
                              ? "cursor-not-allowed bg-gray-100 text-gray-400"
                              : isSel
                                ? "bg-forest-700 text-white"
                                : "bg-forest-100 text-forest-800 hover:bg-forest-200",
                          ].join(" ")}
                        >
                          {!v.free ? "Hết phòng" : isSel ? "Đã chọn ✓" : "Chọn phòng"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Chính sách homestay */}
        {policyLines.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink">Chính sách homestay</h2>
            <ul className="flex flex-col gap-2.5 rounded-2xl bg-white p-5 ring-1 ring-black/5">
              {policyLines.map((line, i) => (
                <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-gray-700">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-forest-500" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Vị trí */}
        <section id="vi-tri" className="flex scroll-mt-20 flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">Vị trí</h2>
              {area && <p className="mt-1 text-sm text-gray-500">{area}</p>}
            </div>
            <a
              href={map.openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap rounded-full bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800"
            >
              Mở Google Maps ↗
            </a>
          </div>
          <div className="h-[280px] overflow-hidden rounded-2xl ring-1 ring-black/5">
            <iframe
              src={map.embedSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Bản đồ"
              className="h-full w-full border-0"
            />
          </div>
        </section>

        {/* Homestay khác gần đây */}
        {suggestions && suggestions.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">Homestay khác gần đây</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {nN ? `Cùng khu Tà Xùa · xem cho ${nN} đêm bạn chọn` : "Cùng khu Tà Xùa, bấm xem để chọn ngày"}
                </p>
              </div>
              <a href={`/homestay${dateQS}`} className="whitespace-nowrap text-sm font-bold text-forest-700 hover:text-sunset-600">
                Xem tất cả →
              </a>
            </div>
            <div className="-m-0.5 grid snap-x snap-mandatory auto-cols-[72%] grid-flow-col gap-3.5 overflow-x-auto p-0.5 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:auto-cols-[minmax(0,1fr)] [&::-webkit-scrollbar]:hidden">
              {suggestions.map((g) => (
                <a
                  key={g.slug}
                  href={`/homestay/${g.slug}${dateQS}`}
                  className="flex snap-start flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative aspect-[4/3] bg-forest-50">
                    {g.cover ? (
                      <Image src={g.cover} alt={g.name} fill sizes="(max-width:640px) 72vw, 240px" className="object-cover" />
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
                        {g.status === "ok" ? "Còn phòng" : g.status === "low" ? "Còn ít" : "Hết phòng"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 p-3.5">
                    <div className="text-[15px] font-extrabold leading-snug text-ink">{g.name}</div>
                    <div className="text-xs text-gray-500">{g.area}</div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="text-base font-extrabold text-sunset-600">
                        {g.price > 0 ? fmt(g.price) : "Liên hệ"}
                        {g.price > 0 && <span className="text-xs font-medium text-gray-400">/đêm</span>}
                      </span>
                      <span className="text-xs font-semibold text-gray-500">{g.cat}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ===== Cột phải: panel đặt phòng dính ===== */}
      <aside ref={panelRef} className="lg:sticky lg:top-20">
        <div className="flex flex-col gap-3.5 rounded-2xl bg-white p-5 shadow-md ring-1 ring-black/5">
          {result ? (
            <div className="flex flex-col gap-2 rounded-xl bg-forest-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-forest-700">Đã gửi yêu cầu</div>
              <div className="text-2xl font-extrabold text-ink">Mã: {result.code}</div>
              <p className="text-sm leading-relaxed text-gray-600">
                {result.needsConfirmation
                  ? `Tụi mình sẽ gọi ${cphone} để xác nhận phòng (chưa thanh toán online).`
                  : `Tụi mình sẽ gọi ${cphone} để xác nhận chi tiết.`}
              </p>
              <button type="button" onClick={reset} className="mt-1 self-start rounded-lg bg-white px-4 py-2 text-sm font-bold text-forest-800 ring-1 ring-gray-200">
                Đặt thêm
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <div className="text-lg font-extrabold text-ink">Đặt phòng</div>
                <div className="text-xs text-gray-500">Không cần tài khoản</div>
              </div>

              {/* Nhận / trả */}
              <button
                type="button"
                onClick={() => scrollTo(calRef.current, 20)}
                className="grid grid-cols-2 overflow-hidden rounded-xl text-left ring-1 ring-gray-200"
              >
                <div className="border-r border-gray-200 px-3.5 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Nhận phòng</div>
                  <div className="mt-0.5 text-sm font-bold text-ink">{ci ? dname(ci) : "Chọn ngày"}</div>
                </div>
                <div className="px-3.5 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Trả phòng</div>
                  <div className="mt-0.5 text-sm font-bold text-ink">{co ? dname(co) : "Chọn ngày"}</div>
                </div>
              </button>

              {/* Số khách */}
              <div className="flex items-center justify-between py-0.5">
                <div>
                  <div className="text-sm font-bold text-ink">Số khách</div>
                  <div className={`text-xs ${over ? "text-red-600" : "text-gray-500"}`}>
                    {sel ? (over ? `Vượt sức chứa (${sel.r.capacity} người)` : `Sức chứa ${sel.r.capacity} người`) : "Chọn phòng để biết sức chứa"}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <button type="button" onClick={() => setGuests((g) => Math.max(1, g - 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-lg ring-1 ring-gray-200">−</button>
                  <span className="min-w-[16px] text-center font-extrabold">{guests}</span>
                  <button type="button" onClick={() => setGuests((g) => Math.min(20, g + 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-lg ring-1 ring-gray-200">+</button>
                </div>
              </div>

              {/* Dòng tạm tính */}
              {sel ? (
                <div className="flex flex-col gap-2 rounded-xl bg-forest-50/60 p-3.5">
                  <div className="flex justify-between gap-2 text-[13px]">
                    <span className="min-w-0 text-gray-600">{sel.r.typeName} · {sel.r.name} · {nN} đêm</span>
                    <span className="whitespace-nowrap font-bold text-ink">{fmt(sel.stayPrice)}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 p-3.5 text-[13px] leading-relaxed text-gray-500">
                  Chọn ngày ở và một phòng còn trống bên trái.
                </div>
              )}

              <div className="flex items-baseline justify-between">
                <span className="font-bold text-ink">Tạm tính</span>
                <span className="text-2xl font-extrabold text-sunset-600">{fmt(total, "0đ")}</span>
              </div>

              {/* Form khách */}
              <div className="flex flex-col gap-2.5 border-t border-gray-100 pt-3.5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Họ và tên *"
                  className={`rounded-xl border px-3.5 py-3 text-base outline-none focus:ring-2 focus:ring-forest-200 ${tried && !name.trim() ? "border-red-400" : "border-gray-200 focus:border-forest-500"}`}
                />
                <input
                  value={cphone}
                  onChange={(e) => setCphone(e.target.value)}
                  inputMode="tel"
                  placeholder="Số điện thoại *"
                  className={`rounded-xl border px-3.5 py-3 text-base outline-none focus:ring-2 focus:ring-forest-200 ${tried && !phoneOk ? "border-red-400" : "border-gray-200 focus:border-forest-500"}`}
                />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Ghi chú (giờ tới, trẻ nhỏ…)"
                  className="resize-y rounded-xl border border-gray-200 px-3.5 py-3 text-sm outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                />
                {err && <div className="text-sm font-semibold text-red-600">{err}</div>}
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className={`rounded-xl px-4 py-3.5 text-base font-bold transition ${ready && !submitting ? "bg-sunset-500 text-white hover:bg-sunset-600" : "bg-gray-200 text-gray-500"}`}
                >
                  {submitting ? "Đang gửi..." : "Gửi yêu cầu đặt phòng"}
                </button>
                <p className="text-center text-xs leading-relaxed text-gray-500">
                  Giá tham khảo. Chủ nhà gọi xác nhận, không thanh toán online.
                </p>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="whitespace-nowrap rounded-xl px-3 py-2.5 text-center text-sm font-bold text-forest-800 ring-1 ring-gray-200">
              Gọi {phone}
            </a>
            {zalo && (
              <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-xl px-3 py-2.5 text-center text-sm font-bold text-sunset-600 ring-1 ring-gray-200">
                Chat Zalo
              </a>
            )}
          </div>
        </div>
      </aside>

      {/* Thanh đáy dính (mobile) */}
      {!result && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.2)] lg:hidden">
          <div className="min-w-0">
            <div className="truncate text-xs text-gray-500">{nN ? `${nN} đêm${sel ? " · 1 phòng" : ""}` : "Chọn ngày ở"}</div>
            <div className="text-lg font-extrabold text-ink">{fmt(total, "0đ")}</div>
          </div>
          <button
            type="button"
            onClick={() => scrollTo(panelRef.current, 12)}
            className="whitespace-nowrap rounded-xl bg-sunset-500 px-5 py-3 text-sm font-bold text-white"
          >
            Đặt phòng
          </button>
        </div>
      )}

      {/* Lightbox slider ảnh/video của phòng */}
      {lb && (
        <div onClick={() => setLb(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button type="button" onClick={() => setLb(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25" aria-label="Đóng">×</button>
          {lb.media.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLb((s) => (s ? { ...s, i: (s.i - 1 + s.media.length) % s.media.length } : s)); }}
                className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-3xl text-white hover:bg-white/25"
                aria-label="Trước"
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
                      aria-label={`Mục ${k + 1}`}
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
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function StatusChip({ tone, label }: { tone: "ok" | "low" | "full" | "idle"; label: string }) {
  const cls =
    tone === "ok"
      ? "bg-forest-100 text-forest-800"
      : tone === "low"
        ? "bg-amber-100 text-amber-800"
        : tone === "full"
          ? "bg-gray-200 text-gray-600"
          : "bg-gray-100 text-gray-500";
  return <span className={`flex-none whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{label}</span>;
}
