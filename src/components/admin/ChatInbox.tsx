"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { vnDateTime } from "@/lib/date-format";

/** Hộp thư chat trực tiếp với khách (/admin/chat). Hỏi tin mới 4 giây/lần (tab ẩn ⇒ 20 giây). */

type Msg = { id: string; from: "guest" | "admin"; body: string; at: string; adminName?: string | null };
type Thread = {
  id: string;
  name: string | null;
  phone: string | null;
  page: string | null;
  visitorId: string | null;
  ip: string | null;
  locale: string | null;
  status: string;
  unread: number;
  lastAt: string;
  preview: string;
  lastFrom: "guest" | "admin" | null;
  guestSeenAt: string | null;
};
type Filter = "open" | "closed" | "all";

const QUICK = [
  "Chào bạn, Tà Xùa Booking đây ạ! Bạn cần tư vấn gì ạ?",
  "Bạn cho mình xin ngày đi, số người và SĐT để mình báo giá nhé.",
  "Mình kiểm tra phòng trống rồi báo lại bạn ngay ạ.",
  "Bạn để lại SĐT / Zalo, mình gọi tư vấn kỹ hơn nhé.",
];

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ`;
  return vnDateTime(iso).split(" ")[0] ?? "";
}
function hm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const label = (t: Thread) => t.name || (t.phone ? t.phone : `Khách #${t.id.slice(-5)}`);

export function ChatInbox({ initialThreadId }: { initialThreadId: string | null }) {
  const [filter, setFilter] = useState<Filter>("open");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string | null>(initialThreadId);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);
  const lastAt = useRef<string | null>(null);
  const activeRef = useRef(active);
  const listEnd = useRef<HTMLDivElement>(null);
  const seenUnread = useRef<Map<string, number>>(new Map());

  const poll = useCallback(async (reset = false) => {
    const thread = activeRef.current;
    const q = new URLSearchParams({ filter });
    if (thread) {
      q.set("thread", thread);
      if (!reset && lastAt.current) q.set("after", lastAt.current);
    }
    try {
      const r = await fetch(`/api/admin/chat?${q}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { threads: Thread[]; messages?: Msg[] };
      if (thread !== activeRef.current) return; // đã đổi cuộc chat trong lúc chờ
      setThreads(j.threads);
      // Tin khách mới ở cuộc chat khác ⇒ tiếng "ting" nhẹ.
      let ding = false;
      for (const t of j.threads) {
        const prev = seenUnread.current.get(t.id) ?? 0;
        if (t.unread > prev && t.id !== thread) ding = true;
        seenUnread.current.set(t.id, t.unread);
      }
      if (ding && loaded) beep();
      if (j.messages) {
        const got = j.messages;
        if (reset) setMsgs(got);
        else if (got.length) setMsgs((m) => [...m, ...got.filter((x) => !m.some((y) => y.id === x.id))]);
        if (got.length) lastAt.current = got[got.length - 1].at;
        // Đang mở cuộc chat có tin khách chưa đọc ⇒ đánh dấu đã đọc.
        const cur = j.threads.find((t) => t.id === thread);
        if (cur && cur.unread > 0 && document.visibilityState === "visible") {
          void fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "read", threadId: thread }) });
        }
      }
      setLoaded(true);
    } catch {
      /* mạng chập chờn — lần sau thử lại */
    }
  }, [filter, loaded]);

  // Đổi cuộc chat / bộ lọc ⇒ nạp lại từ đầu.
  useEffect(() => {
    activeRef.current = active;
    lastAt.current = null;
    const id = setTimeout(() => void poll(true), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, filter]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(async () => {
        await poll();
        loop();
      }, document.visibilityState === "visible" ? 4000 : 20000);
    };
    loop();
    return () => clearTimeout(timer);
  }, [poll]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, active]);

  const cur = threads.find((t) => t.id === active) ?? null;
  const vp = useMobileViewport(!!active);
  useEffect(() => {
    if (vp) listEnd.current?.scrollIntoView({ block: "end" });
  }, [vp?.height]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(body?: string) {
    const b = (body ?? text).trim();
    if (!b || !active || sending) return;
    setSending(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "reply", threadId: active, body: b }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gửi thất bại.");
      setMsgs((m) => [...m, j.message]);
      lastAt.current = j.message.at;
      if (!body) setText("");
      void poll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gửi thất bại.");
    } finally {
      setSending(false);
    }
  }

  async function act(op: "close" | "reopen" | "delete") {
    if (!active) return;
    if (op === "delete" && !confirm("Xoá hẳn cuộc trò chuyện này?")) return;
    await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, threadId: active }) });
    if (op === "delete") setActive(null);
    void poll(true);
  }

  const tab = (k: Filter, name: string) => (
    <button
      key={k}
      type="button"
      onClick={() => setFilter(k)}
      className={`rounded-full px-3 py-1.5 text-[13px] font-bold ${filter === k ? "bg-forest-700 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"}`}
    >
      {name}
    </button>
  );

  return (
    <div className="grid h-[calc(100dvh-150px)] min-h-[360px] overflow-hidden rounded-2xl border border-gray-200 bg-white sm:h-[calc(100dvh-190px)] md:min-h-[480px] md:grid-cols-[320px_minmax(0,1fr)]">
      {/* Danh sách cuộc chat */}
      <aside className={`flex min-h-0 flex-col border-gray-200 md:border-r ${active ? "hidden md:flex" : "flex"}`}>
        <div className="flex gap-1.5 border-b border-gray-100 p-3">
          {tab("open", "Đang mở")}
          {tab("closed", "Đã đóng")}
          {tab("all", "Tất cả")}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loaded && threads.length === 0 && <div className="p-6 text-center text-sm text-gray-400">Chưa có cuộc trò chuyện nào.</div>}
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`flex w-full gap-3 border-b border-gray-50 px-3 py-3 text-left hover:bg-gray-50 ${t.id === active ? "bg-forest-50" : ""}`}
            >
              <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-extrabold ${t.unread ? "bg-sunset-500 text-white" : "bg-gray-100 text-gray-500"}`}>
                {label(t).slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm ${t.unread ? "font-extrabold text-ink" : "font-semibold text-gray-700"}`}>{label(t)}</span>
                  <span className="flex-none text-[11px] text-gray-400">{ago(t.lastAt)}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <span className={`line-clamp-1 flex-1 text-[13px] ${t.unread ? "font-semibold text-ink" : "text-gray-500"}`}>
                    {t.lastFrom === "admin" ? "Bạn: " : ""}
                    {t.preview}
                  </span>
                  {t.unread > 0 && <span className="flex-none rounded-full bg-sunset-500 px-1.5 text-[11px] font-extrabold text-white">{t.unread}</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Cuộc chat đang mở */}
      {/* Điện thoại: cuộc chat mở toàn màn hình (như app nhắn tin), co theo bàn phím (visualViewport). */}
      <section
        style={vp ?? undefined}
        className={`min-h-0 flex-col max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:z-40 max-md:h-dvh max-md:bg-white ${active ? "flex" : "hidden md:flex"}`}
      >
        {!active || !cur ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-gray-400">{active && !loaded ? "Đang tải…" : "Chọn một cuộc trò chuyện bên trái."}</div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-gray-100 px-2 py-2 pt-[max(8px,env(safe-area-inset-top))] md:gap-3 md:px-4 md:py-3">
              <button type="button" onClick={() => setActive(null)} className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-xl text-gray-600 hover:bg-gray-100 md:hidden" aria-label="Quay lại">←</button>
              <div className="min-w-0 flex-1">
                <div className="truncate font-extrabold text-ink">{label(cur)}</div>
                <div className="flex gap-x-3 overflow-hidden whitespace-nowrap text-xs text-gray-500 md:flex-wrap">
                  {cur.phone && <a href={`tel:${cur.phone.replace(/[^\d+]/g, "")}`} className="font-semibold text-forest-700">📞 {cur.phone}</a>}
                  {cur.phone && <a href={`https://zalo.me/${cur.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="font-semibold text-[#0068FF]">Zalo</a>}
                  {cur.page && <a href={cur.page} target="_blank" rel="noreferrer" className="min-w-0 max-w-[260px] truncate hover:text-forest-700">Đang xem: {cur.page}</a>}
                  {cur.locale && cur.locale !== "vi" && <span>Ngôn ngữ: {cur.locale}</span>}
                  {cur.ip && <span className="hidden md:inline">IP {cur.ip}</span>}
                </div>
              </div>
              <div className="flex flex-none gap-1">
                {cur.status === "open" ? (
                  <button type="button" onClick={() => act("close")} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200">Đóng</button>
                ) : (
                  <button type="button" onClick={() => act("reopen")} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200">Mở lại</button>
                )}
                <button type="button" onClick={() => act("delete")} className="rounded-full px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">Xoá</button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[oklch(0.975_0.006_160)] px-3 py-3 md:px-4 md:py-4">
              <div className="flex flex-col gap-2">
                {msgs.map((m, i) => {
                  const mine = m.from === "admin";
                  const showTime = i === 0 || new Date(m.at).getTime() - new Date(msgs[i - 1].at).getTime() > 10 * 60_000;
                  return (
                    <div key={m.id} className="flex flex-col">
                      {showTime && <div className="my-2 text-center text-[11px] text-gray-400">{vnDateTime(m.at)}</div>}
                      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          title={`${hm(m.at)}${m.adminName ? ` · ${m.adminName}` : ""}`}
                          className={`max-w-[85%] whitespace-pre-wrap md:max-w-[75%] break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${mine ? "rounded-br-sm bg-forest-700 text-white" : "rounded-bl-sm bg-white text-ink shadow-sm ring-1 ring-black/5"}`}
                        >
                          {m.body}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {msgs.length > 0 && msgs[msgs.length - 1].from === "admin" && cur.guestSeenAt && cur.guestSeenAt >= msgs[msgs.length - 1].at && (
                  <div className="text-right text-[11px] text-gray-400">Khách đã xem</div>
                )}
                <div ref={listEnd} />
              </div>
            </div>

            <div className="border-t border-gray-100 bg-white p-2 pb-[max(8px,env(safe-area-inset-bottom))] md:p-3">
              <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                {QUICK.map((q) => (
                  <button key={q} type="button" onClick={() => setText(q)} className="flex-none whitespace-nowrap rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-800 ring-1 ring-forest-100 hover:bg-forest-100">
                    {q.length > 42 ? `${q.slice(0, 40)}…` : q}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={2}
                  maxLength={1000}
                  placeholder="Nhập trả lời…"
                  enterKeyHint="send"
                  /* text-base trên điện thoại: chữ < 16px làm iOS tự phóng to khi chạm ô nhập */
                  className="max-h-32 min-h-[44px] min-w-0 flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-base outline-none focus:border-forest-500 max-md:[field-sizing:content] md:text-sm"
                />
                <button type="button" onClick={() => void send()} disabled={sending || !text.trim()} className="h-11 flex-none rounded-xl bg-forest-700 px-4 text-sm font-extrabold text-white hover:bg-forest-800 disabled:opacity-50">
                  Gửi
                </button>
              </div>
              {err && <div className="mt-1.5 text-xs font-semibold text-red-600">{err}</div>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * Điện thoại đang mở cuộc chat: khung chat bám đúng phần màn hình nhìn thấy (visualViewport) —
 * iOS mở bàn phím không co 100dvh, nên ô nhập sẽ bị bàn phím che nếu không làm vậy.
 * Đồng thời khoá cuộn trang phía sau. Máy tính (≥ md) trả null.
 */
function useMobileViewport(on: boolean): { height: number; top: number } | null {
  const [vp, setVp] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const vv = window.visualViewport;
    if (!on || !mq.matches) {
      setVp(null);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const update = () => setVp(vv ? { height: Math.round(vv.height), top: Math.round(vv.offsetTop) } : null);
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      document.body.style.overflow = prev;
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [on]);
  return vp;
}

/** Tiếng "ting" ngắn bằng WebAudio (không cần tệp âm thanh). */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    o.onended = () => void ctx.close();
  } catch {
    /* trình duyệt chặn âm thanh khi chưa tương tác */
  }
}
