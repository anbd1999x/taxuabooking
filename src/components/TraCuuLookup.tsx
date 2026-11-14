"use client";

import { VoiceText } from "@/components/SiteContact";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Trang tra cứu đơn đặt — giao diện theo thiết kế "Tra cuu don.dc.html"
 * (claude.ai/design, project Kế hoạch thiết kế giao diện): hero tìm kiếm nền
 * xanh rừng, thẻ đơn có thanh tiến trình 4 bước + hộp trạng thái, chi tiết
 * xổ ra từng phần (vé xe / phòng), tab Tất cả · Sắp đi · Đã xong.
 * Khác thiết kế: bỏ khối cọc + số tài khoản (chưa có cấu hình ngân hàng).
 */

export type LookupStatus = "new" | "contact" | "confirmed" | "done" | "cancel";

export interface LookupPart {
  k: string; // nhãn chip: XE / HS / CB...
  name: string;
  d: string | null;
  /** Dòng chi tiết thêm (vd từng loại vé cabin đôi/đơn kèm tiền). */
  lines?: string[];
  price: number | null;
}

export interface LookupOrder {
  code: string;
  st: LookupStatus;
  ic: string; // chữ trong ô vuông đầu thẻ (XE/HS/CB/XM/TX/XÔ)
  title: string;
  when: string;
  pax: string;
  created: string;
  total: number | null;
  payLabel: string;
  payTone: "paid" | "part" | "unpaid";
  name: string;
  phone: string;
  note: string | null;
  parts: LookupPart[];
  rebookHref: string;
  reviewHref: string | null;
}

const G = "oklch(0.29 0.055 160)";
const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

/** Màu + thông điệp theo trạng thái (bám thiết kế). */
const ST: Record<LookupStatus, { label: string; bg: string; fg: string; bar: string; msg: string; msgBg: string; msgFg: string }> = {
  new: { label: "Mới · chờ xác nhận", bg: "oklch(0.95 0.03 250)", fg: "oklch(0.42 0.1 250)", bar: "oklch(0.6 0.12 250)", msg: "Tụi mình đã nhận yêu cầu và sẽ gọi lại trong 30 phút (giờ hoạt động 8:00–23:00; đơn gửi ngoài giờ được xác nhận từ 8:00) để xác nhận chỗ. Chưa cần chuyển tiền.", msgBg: "oklch(0.95 0.03 250)", msgFg: "oklch(0.35 0.1 250)" },
  contact: { label: "Đang liên hệ", bg: "oklch(0.95 0.06 70)", fg: "oklch(0.48 0.15 50)", bar: "oklch(0.7 0.14 70)", msg: "Tụi mình đang gọi cho bạn. Nếu lỡ cuộc gọi, nhắn Zalo để chốt nhanh.", msgBg: "oklch(0.95 0.06 70)", msgFg: "oklch(0.45 0.14 50)" },
  confirmed: { label: "Đã xác nhận", bg: "oklch(0.93 0.05 155)", fg: "oklch(0.38 0.1 155)", bar: "oklch(0.55 0.12 155)", msg: "Chỗ đã được giữ. Lịch trình chi tiết sẽ gửi qua Zalo trước ngày đi 1 ngày; cần cọc giữ chỗ tụi mình sẽ nhắn hướng dẫn.", msgBg: "oklch(0.93 0.05 155)", msgFg: "oklch(0.33 0.1 155)" },
  done: { label: "Hoàn thành", bg: "oklch(0.93 0.01 160)", fg: "oklch(0.35 0.02 160)", bar: G, msg: "Cảm ơn bạn đã đi cùng Tà Xùa Booking. Để lại đánh giá giúp khách sau chọn đúng chỗ nhé.", msgBg: "oklch(0.96 0.005 160)", msgFg: "oklch(0.35 0.02 160)" },
  cancel: { label: "Đã huỷ", bg: "oklch(0.95 0.04 28)", fg: "oklch(0.5 0.18 28)", bar: "oklch(0.6 0.15 28)", msg: "Đơn đã huỷ. Nếu đã cọc, tiền sẽ hoàn trong 1–3 ngày làm việc.", msgBg: "oklch(0.95 0.04 28)", msgFg: "oklch(0.45 0.16 28)" },
};

const STEPS = ["Đã gửi", "Đang xác nhận", "Đã giữ chỗ", "Hoàn thành"];
const stepIdx = (st: LookupStatus) => (st === "new" ? 0 : st === "contact" ? 1 : st === "confirmed" ? 2 : st === "done" ? 3 : -1);

const CHIP: Record<string, [string, string]> = {
  HS: ["oklch(0.93 0.05 155)", "oklch(0.38 0.1 155)"],
  XE: ["oklch(0.93 0.04 250)", "oklch(0.4 0.1 250)"],
  CB: ["oklch(0.93 0.04 250)", "oklch(0.4 0.1 250)"],
};
const chipColor = (k: string): [string, string] => CHIP[k] ?? ["oklch(0.95 0.06 70)", "oklch(0.48 0.15 50)"];

const PAY_TONE: Record<LookupOrder["payTone"], [string, string]> = {
  paid: ["oklch(0.93 0.05 155)", "oklch(0.38 0.1 155)"],
  part: ["oklch(0.95 0.06 70)", "oklch(0.48 0.15 50)"],
  unpaid: ["oklch(0.95 0.005 160)", "oklch(0.45 0.02 160)"],
};

const RECENT_KEY = "tx-tra-cuu-recent";

export function TraCuuLookup({
  initialQ,
  orders,
  phone,
  zalo,
  autoCancelHours = 0,
}: {
  initialQ: string;
  orders: LookupOrder[];
  phone: string;
  zalo: string;
  /** Số giờ tự huỷ đơn chưa thanh toán (admin thiết lập); 0 = tắt ⇒ không hiện câu nhắc. */
  autoCancelHours?: number;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [tab, setTab] = useState<"all" | "active" | "past">("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [recent, setRecent] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const telHref = `tel:${phone.replace(/\s/g, "")}`;
  const zaloHref = `https://zalo.me/${zalo.replace(/\s/g, "")}`;

  // Tra gần đây (chỉ lưu trên máy khách).
  useEffect(() => {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      if (Array.isArray(saved)) setRecent(saved.filter((x) => typeof x === "string").slice(0, 3));
    } catch {}
  }, []);

  function doSearch(v?: string) {
    const next = (v ?? q).trim();
    if (!next) return;
    if (v != null) setQ(v);
    try {
      const list = [next, ...recent.filter((x) => x !== next)].slice(0, 3);
      setRecent(list);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {}
    startTransition(() => {
      router.push(`/tra-cuu?q=${encodeURIComponent(next)}`, { scroll: false });
    });
  }

  const qn = q.replace(/[\s.\-]/g, "").toUpperCase();
  const qKind = !q ? "SĐT / Mã" : /[A-Z]/.test(qn) ? "Mã đơn" : "Số điện thoại";

  const searched = initialQ.trim();
  const showResults = Boolean(searched) && orders.length > 0;
  const notFound = Boolean(searched) && orders.length === 0;
  const idle = !searched;

  const isActive = (o: LookupOrder) => ["new", "contact", "confirmed"].includes(o.st);
  const list = orders.filter((o) => (tab === "all" ? true : tab === "active" ? isActive(o) : !isActive(o)));
  const tabs: { key: typeof tab; name: string }[] = [
    { key: "all", name: `Tất cả (${orders.length})` },
    { key: "active", name: `Sắp đi (${orders.filter(isActive).length})` },
    { key: "past", name: `Đã xong (${orders.filter((o) => !isActive(o)).length})` },
  ];

  const HOWTO = [
    { k: "BƯỚC 1", t: "Nhập số điện thoại", d: "Đúng số bạn đã điền lúc gửi yêu cầu. Mã đơn TX-… cũng dùng được." },
    { k: "BƯỚC 2", t: "Xem trạng thái", d: "Mỗi đơn có thanh tiến trình: Đã gửi → Đang xác nhận → Đã giữ chỗ → Hoàn thành." },
    { k: "BƯỚC 3", t: "Giữ liên lạc", d: "Tụi mình sẽ gọi/Zalo để chốt chỗ. Lịch trình chi tiết gửi trước ngày đi 1 ngày." },
  ];
  const LEGEND: { k: string; c: string; d: string }[] = [
    { k: ST.new.label, c: ST.new.bar, d: "đã nhận, chưa ai kiểm tra chỗ" },
    { k: ST.contact.label, c: ST.contact.bar, d: "tụi mình đang gọi bạn" },
    { k: ST.confirmed.label, c: ST.confirmed.bar, d: "chỗ đã giữ chắc chắn" },
    { k: ST.done.label, c: ST.done.bar, d: "đã dùng dịch vụ xong" },
    { k: ST.cancel.label, c: ST.cancel.bar, d: "đơn không còn hiệu lực" },
  ];

  const pill = "whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-bold";

  return (
    <div style={{ background: "oklch(0.975 0.01 150)" }}>
      <style>{`@keyframes tx-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`}</style>

      {/* Hero tìm kiếm */}
      <section style={{ background: `linear-gradient(180deg, ${G}, oklch(0.36 0.07 165) 70%, oklch(0.975 0.01 150) 70%)` }}>
        <div className="mx-auto flex max-w-[840px] flex-col gap-[18px] px-4 pt-9 sm:px-6">
          <div className="flex flex-col gap-2 text-center text-white">
            <h1 className="m-0 text-[clamp(26px,4vw,38px)] font-extrabold leading-[1.1] tracking-[-0.03em]">Tra cứu đơn đặt</h1>
            <p className="m-0 text-[15px]" style={{ color: "oklch(0.9 0.03 160)", textWrap: "balance" }}>
              Nhập số điện thoại đã dùng khi đặt, hoặc mã đơn dạng TX-XXXXXX.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 rounded-[20px] bg-white p-2" style={{ boxShadow: "0 24px 60px -24px oklch(0.25 0.06 220 / .45)" }}>
            <div className="flex min-w-[220px] flex-1 items-center gap-2.5 py-1.5 pl-4 pr-2.5">
              <span className="whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold" style={{ background: "oklch(0.95 0.025 155)", color: "oklch(0.36 0.08 155)" }}>{qKind}</span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
                placeholder="0357452952 hoặc TX-BCLL5B"
                inputMode="search"
                className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[17px] font-bold tracking-[0.01em] text-ink outline-none sm:text-lg"
              />
              {q && (
                <button
                  type="button"
                  aria-label="Xoá"
                  onClick={() => { setQ(""); inputRef.current?.focus(); }}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
                  style={{ background: "oklch(0.95 0.005 160)", color: "oklch(0.45 0.02 160)" }}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => doSearch()}
              className="flex flex-[1_1_100%] items-center justify-center whitespace-nowrap rounded-[14px] px-6 py-3.5 text-base font-extrabold text-white transition hover:brightness-105 active:brightness-95 sm:flex-none"
              style={{ background: "oklch(0.68 0.18 45)" }}
            >
              {pending ? "Đang tìm…" : "Tra cứu"}
            </button>
          </div>
          {recent.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[13px]" style={{ color: "oklch(0.45 0.02 160)" }}>
              <span>Tra gần đây:</span>
              {recent.map((r) => (
                <button key={r} type="button" onClick={() => doSearch(r)} className="rounded-full border bg-white px-2.5 py-1 font-bold" style={{ borderColor: "oklch(0.9 0.01 160)", color: "oklch(0.3 0.04 160)" }}>
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto flex w-full max-w-[840px] flex-1 flex-col gap-3.5 px-4 pb-16 pt-5 sm:px-6">
        {showResults && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2.5" style={{ animation: "tx-in .4s ease both" }}>
              <div className="text-[15px]" style={{ color: "oklch(0.45 0.02 160)" }}>
                Tìm thấy <b className="text-ink">{orders.length}</b> đơn cho <b className="text-ink">{searched}</b>
              </div>
              <div className="inline-flex gap-1 rounded-xl p-1" style={{ background: "oklch(0.93 0.01 160)" }}>
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className="whitespace-nowrap rounded-[9px] px-3 py-[7px] text-[13px] font-bold"
                    style={{
                      background: tab === t.key ? "white" : "transparent",
                      color: tab === t.key ? G : "oklch(0.42 0.02 160)",
                      boxShadow: tab === t.key ? "0 1px 3px oklch(0.2 0.03 160 / .15)" : "none",
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {list.map((o, j) => {
              const st = ST[o.st];
              const i = stepIdx(o.st);
              const isOpen = Boolean(open[o.code]);
              const [icBg, icFg] = chipColor(o.ic);
              const [pbg, pfg] = PAY_TONE[o.payTone];
              const toggle = () => setOpen((prev) => ({ ...prev, [o.code]: !isOpen }));
              return (
                <article key={o.code} className="overflow-hidden rounded-[20px] border bg-white" style={{ borderColor: "oklch(0.92 0.01 160)", animation: "tx-in .5s ease both", animationDelay: `${j * 0.07}s` }}>
                  {/* đầu thẻ */}
                  <div onClick={toggle} className="flex cursor-pointer flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] text-xs font-extrabold" style={{ background: icBg, color: icFg }}>{o.ic}</div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[17px] font-extrabold tracking-[-0.01em]">{o.code}</span>
                          <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                        </div>
                        <div className="mt-1 text-[15px] font-bold leading-[1.35]">{o.title}</div>
                        <div className="mt-[3px] text-[13px]" style={{ color: "oklch(0.5 0.02 160)" }}>{o.when} · {o.pax} · đặt lúc {o.created}</div>
                      </div>
                    </div>
                    <div className="flex flex-none flex-col items-end gap-1">
                      <div className="text-lg font-extrabold tracking-[-0.02em]" style={{ color: "oklch(0.6 0.18 45)" }}>{o.total != null ? vnd(o.total) : "Liên hệ"}</div>
                      <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: pbg, color: pfg }}>{o.payLabel}</span>
                    </div>
                  </div>
                  {/* tiến trình */}
                  <div className="grid grid-cols-4 gap-1 px-5 pb-3.5">
                    {STEPS.map((nm, k) => (
                      <div key={nm} className="flex flex-col gap-[5px]">
                        <div className="h-[5px] rounded-full" style={{ background: o.st === "cancel" ? "oklch(0.93 0.01 160)" : k <= i ? st.bar : "oklch(0.93 0.01 160)" }} />
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-bold" style={{ color: k <= i && o.st !== "cancel" ? "oklch(0.25 0.03 160)" : "oklch(0.62 0.02 160)" }}>{nm}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mx-5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold leading-[1.5]" style={{ background: st.msgBg, color: st.msgFg }}><VoiceText text={st.msg + (autoCancelHours > 0 && (o.st === "new" || o.st === "contact") ? ` Đơn tự huỷ nếu sau ${String(autoCancelHours).replace(".", ",")} giờ kể từ lúc đặt chưa xác nhận thanh toán.` : "")} /></div>
                  {/* chi tiết */}
                  {isOpen && (
                    <div className="flex flex-col gap-2 px-5 pt-3.5">
                      {o.parts.map((p, pi) => {
                        const [bg, fg] = chipColor(p.k);
                        return (
                          <div key={pi} className="grid items-start gap-2.5 rounded-[14px] px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto]" style={{ background: "oklch(0.975 0.008 150)" }}>
                            <div className="flex min-w-0 gap-2.5">
                              <span className="self-start whitespace-nowrap rounded-[7px] px-[7px] py-1 text-[11px] font-extrabold" style={{ background: bg, color: fg }}>{p.k}</span>
                              <div className="min-w-0">
                                <div className="text-sm font-bold">{p.name}</div>
                                {p.d && <div className="mt-0.5 text-[13px] leading-[1.5]" style={{ color: "oklch(0.45 0.02 160)" }}><VoiceText text={p.d} /></div>}
                                {p.lines && p.lines.length > 0 && (
                                  <div className="mt-1.5 flex flex-col gap-1">
                                    {p.lines.map((l) => (
                                      <div key={l} className="flex items-start gap-1.5 text-[13px] font-semibold leading-[1.45]" style={{ color: "oklch(0.32 0.06 230)" }}>
                                        <span className="flex-none">🎫</span>
                                        <span>{l}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="whitespace-nowrap text-right text-sm font-extrabold">{p.price != null ? vnd(p.price) : ""}</div>
                          </div>
                        );
                      })}
                      <div className="grid gap-2.5 px-0.5 py-1" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))" }}>
                        <div><div className="text-xs" style={{ color: "oklch(0.5 0.02 160)" }}>Tên khách</div><div className="text-sm font-bold">{o.name}</div></div>
                        <div><div className="text-xs" style={{ color: "oklch(0.5 0.02 160)" }}>Số điện thoại</div><div className="text-sm font-bold">{o.phone}</div></div>
                        <div><div className="text-xs" style={{ color: "oklch(0.5 0.02 160)" }}>Số lượng</div><div className="text-sm font-bold">{o.pax}</div></div>
                        <div><div className="text-xs" style={{ color: "oklch(0.5 0.02 160)" }}>Ghi chú</div><div className="text-sm font-semibold" style={{ color: "oklch(0.45 0.02 160)" }}>{o.note || "Không có"}</div></div>
                      </div>
                    </div>
                  )}
                  {/* hành động */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-4 pt-3.5">
                    <button type="button" onClick={toggle} className="text-[13px] font-bold" style={{ color: "oklch(0.4 0.08 160)" }}>
                      {isOpen ? "Thu gọn chi tiết ↑" : "Xem chi tiết đơn ↓"}
                    </button>
                    <div className="flex flex-wrap gap-1.5">
                      <a href={zaloHref} target="_blank" rel="noreferrer" className={`${pill} border bg-white`} style={{ borderColor: "oklch(0.88 0.015 160)" }}>Nhắn Zalo</a>
                      {isActive(o) && <a href={telHref} className={`${pill} border bg-white`} style={{ borderColor: "oklch(0.88 0.015 160)" }}>Đổi lịch / huỷ</a>}
                      {o.st === "done" && o.reviewHref && <Link href={o.reviewHref} className={`${pill} text-white`} style={{ background: "oklch(0.68 0.18 45)" }}>Viết đánh giá</Link>}
                      {(o.st === "done" || o.st === "cancel") && <Link href={o.rebookHref} className={`${pill} text-white`} style={{ background: G }}>Đặt lại</Link>}
                    </div>
                  </div>
                </article>
              );
            })}

            {list.length === 0 && (
              <div className="rounded-[20px] border-[1.5px] border-dashed bg-white px-5 py-9 text-center text-sm" style={{ borderColor: "oklch(0.85 0.02 200)", color: "oklch(0.45 0.02 160)" }}>
                Không có đơn nào ở mục này.
              </div>
            )}
          </>
        )}

        {notFound && (
          <div className="flex flex-col items-center gap-2.5 rounded-[20px] border-[1.5px] border-dashed bg-white px-6 py-9 text-center" style={{ borderColor: "oklch(0.85 0.02 200)", animation: "tx-in .4s ease both" }}>
            <div className="text-[17px] font-extrabold">Không tìm thấy đơn cho {searched}</div>
            <div className="max-w-[440px] text-sm leading-[1.55]" style={{ color: "oklch(0.45 0.02 160)", textWrap: "pretty" }}>
              Kiểm tra lại số điện thoại đúng số đã nhập lúc đặt (không có khoảng trắng), hoặc nhập mã đơn trong tin nhắn xác nhận. Đơn vừa gửi có thể mất 1–2 phút để hiện.
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <a href={telHref} className="rounded-full px-4 py-2.5 text-sm font-bold text-white" style={{ background: G }}>Gọi {phone}</a>
              <a href={zaloHref} target="_blank" rel="noreferrer" className="rounded-full border-[1.5px] bg-white px-4 py-2.5 text-sm font-bold" style={{ borderColor: "oklch(0.88 0.015 160)" }}>Nhắn Zalo</a>
            </div>
          </div>
        )}

        {idle && (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", animation: "tx-in .4s ease both" }}>
            {HOWTO.map((h) => (
              <div key={h.k} className="rounded-2xl border bg-white p-4" style={{ borderColor: "oklch(0.92 0.01 160)" }}>
                <div className="text-xs font-extrabold" style={{ color: "oklch(0.68 0.18 45)" }}>{h.k}</div>
                <div className="mt-1 text-[15px] font-bold">{h.t}</div>
                <div className="mt-1 text-[13px] leading-[1.5]" style={{ color: "oklch(0.45 0.02 160)" }}><VoiceText text={h.d} /></div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2.5 flex flex-col gap-2 rounded-2xl border bg-white px-[18px] py-4" style={{ borderColor: "oklch(0.92 0.01 160)" }}>
          <div className="text-sm font-extrabold">Ý nghĩa trạng thái</div>
          <div className="grid gap-x-4 gap-y-2 text-[13px] leading-[1.5]" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", color: "oklch(0.4 0.02 160)" }}>
            {LEGEND.map((l) => (
              <div key={l.k} className="flex items-start gap-2">
                <span className="mt-[5px] h-[9px] w-[9px] flex-none rounded-full" style={{ background: l.c }} />
                <span><b className="text-ink">{l.k}</b> — <VoiceText text={l.d} /></span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center text-sm" style={{ color: "oklch(0.45 0.02 160)" }}>
          Cần hỗ trợ? Gọi <a href={telHref} className="font-bold text-forest-700">{phone}</a> · <Link href="/huong-dan" className="font-bold text-forest-700">Xem hướng dẫn đặt dịch vụ</Link>
        </div>
      </main>
    </div>
  );
}
