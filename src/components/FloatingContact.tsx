"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SITE } from "@/lib/site";
import { useSitePhone, useVoice } from "@/components/SiteContact";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { trackAction } from "@/components/VisitTracker";
import { BoyChibi, CHIBI_CSS, GirlChibi } from "@/components/contact/ContactChibi";

/**
 * Nút liên hệ nổi góc phải màn hình (mọi trang khách): Zalo · Facebook (Messenger) · Gọi điện · Chat — theo
 * claude.ai/design `Nut Lien he.dc.html`: cột nút tròn, cô gái thổ cẩm ngồi trên mây trên nút Zalo, chàng trai
 * phất cờ / chụp ảnh cạnh nút Gọi (src/components/contact/ContactChibi.tsx).
 * Chỉ hiện ở màn hình rộng (≥1024px) — điện thoại ẩn hẳn (đã có Gọi/Zalo trong menu và thanh dính đáy từng trang).
 *
 * "Chat ngay" mở khung CHAT TRỰC TIẾP với admin (lưu ở ChatThread/ChatMessage, admin trả lời ở /admin/chat):
 * khách nhắn không cần đăng nhập (cookie httpOnly tx_chat), tin trả lời tự hiện — hỏi /api/chat 3 giây/lần khi
 * khung mở, 25 giây/lần khi đóng (chỉ khi đã từng nhắn: cờ localStorage) để báo số tin mới trên nút.
 */

type Msg = { id: string; from: "guest" | "admin"; body: string; at: string; pending?: boolean };
const HAS_CHAT = "tx_chat_on"; // localStorage: đã từng nhắn (mới cần hỏi tin trả lời khi khung đóng)

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* chế độ riêng tư */
  }
}
const hm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function FloatingContact({ facebook }: { facebook: string }) {
  const t = useT();
  const locale = useLocale();
  const voice = useVoice();
  const phone = useSitePhone();
  const digits = phone.replace(/\D/g, "");
  const zalo = `https://zalo.me/${digits}`;
  const fbUser = facebook.match(/facebook\.com\/(?:profile\.php\?id=)?([^/?#]+)/i)?.[1] ?? "";
  const messenger = fbUser ? `https://m.me/${fbUser}` : facebook;
  const pathname = usePathname();

  const [open, setOpenState] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [unread, setUnread] = useState(0);
  // Đã từng nhắn (cờ localStorage) — chỉ điều khiển việc hỏi tin, không ảnh hưởng HTML nên đọc ngay lúc khởi tạo.
  const [hasChat, setHasChat] = useState(() => typeof window !== "undefined" && lsGet(HAS_CHAT) === "1");
  const [profile, setProfile] = useState<{ name: string; phone: string; saved: boolean }>({ name: "", phone: "", saved: false });
  const [off, setOff] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastAt = useRef<string | null>(null);
  const openRef = useRef(false);
  const sendingRef = useRef(false);
  const tmpSeq = useRef(0); // id tạm cho tin đang gửi

  const checkOff = () => {
    const h = (new Date().getUTCHours() + 7) % 24; // giờ VN
    setOff(h < SITE.supportOpenHour || h >= SITE.supportCloseHour);
  };

  const poll = useCallback(async () => {
    try {
      const q = lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : "";
      const r = await fetch(`/api/chat${q}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { thread: { name: string | null; phone: string | null } | null; messages: Msg[] };
      if (!j.thread) return;
      if (!lastAt.current) setProfile((p) => (p.saved || p.name || p.phone ? p : { name: j.thread!.name ?? "", phone: j.thread!.phone ?? "", saved: Boolean(j.thread!.phone) }));
      const got = j.messages;
      if (!got.length) return;
      const initial = !lastAt.current; // lần nạp lịch sử đầu tiên — không tính là tin mới
      lastAt.current = got[got.length - 1].at;
      setMsgs((m) => {
        const fresh = got.filter((x) => !m.some((y) => y.id === x.id));
        return fresh.length ? [...m.filter((y) => !y.pending), ...fresh] : m;
      });
      const adminNew = got.filter((x) => x.from === "admin").length;
      if (adminNew && !initial) {
        if (openRef.current && document.visibilityState === "visible") void fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "seen" }) });
        else setUnread((n) => n + adminNew);
      }
    } catch {
      /* mạng chập chờn */
    }
  }, []);

  // Lần đầu: khách đã từng nhắn ⇒ nạp lịch sử (đếm tin chưa xem không cần chính xác — chỉ báo tin mới từ giờ).
  useEffect(() => {
    if (hasChat) void poll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy 1 lần lúc mở trang
  }, []);

  // Hỏi tin mới: mở khung 3 giây/lần, đóng khung 25 giây/lần (chỉ khi đã từng nhắn).
  useEffect(() => {
    if (!open && !hasChat) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(async () => {
        if (document.visibilityState === "visible") await poll();
        loop();
      }, open ? 3000 : 25000);
    };
    loop();
    return () => clearTimeout(timer);
  }, [open, hasChat, poll]);

  function setOpen(v: boolean) {
    openRef.current = v;
    setOpenState(v);
    if (v) {
      checkOff();
      setUnread(0);
      trackAction("Nút nổi: mở chat");
      if (hasChat) {
        void poll();
        void fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "seen" }) });
      }
      setTimeout(() => boxRef.current?.focus(), 60);
    }
  }

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, msgs.length]);

  async function send(body?: string) {
    const b = (body ?? text).trim();
    if (!b || sendingRef.current) return;
    sendingRef.current = true;
    setErr("");
    const temp: Msg = { id: `tmp-${++tmpSeq.current}`, from: "guest", body: b, at: new Date().toISOString(), pending: true };
    setMsgs((m) => [...m, temp]);
    if (!body) setText("");
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "send", body: b, page: pathname + (typeof window !== "undefined" ? window.location.search : ""), locale }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "");
      setMsgs((m) => m.map((x) => (x.id === temp.id ? j.message : x)));
      lastAt.current = j.message.at;
      if (!hasChat) {
        setHasChat(true);
        lsSet(HAS_CHAT, "1");
      }
      trackAction("Chat trực tiếp: gửi tin");
    } catch (e) {
      setMsgs((m) => m.filter((x) => x.id !== temp.id));
      if (!body) setText(b);
      setErr(e instanceof Error && e.message ? t(e.message) : t("Chưa gửi được — kiểm tra mạng rồi thử lại."));
    } finally {
      sendingRef.current = false;
    }
  }

  async function saveProfile() {
    const ph = profile.phone.trim();
    if (ph && !/^[+0-9 .()-]{8,20}$/.test(ph)) {
      setErr(t("Số điện thoại chưa đúng."));
      return;
    }
    setErr("");
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "profile", name: profile.name, phone: ph }) });
    if (r.ok) setProfile((p) => ({ ...p, saved: true }));
  }

  const quick = [
    t("Mình muốn hỏi giá phòng homestay"),
    t("Mình muốn đặt vé xe cabin"),
    t("Tư vấn giúp mình combo xe + phòng"),
    t("Mình muốn thuê xe máy"),
  ];
  const guestCount = msgs.filter((m) => m.from === "guest").length;
  const adminReplied = msgs.some((m) => m.from === "admin");

  const round = "relative flex h-[54px] w-[54px] items-center justify-center rounded-full text-[13px] font-extrabold text-white transition-transform duration-200 hover:scale-[1.08]";
  const pop = (delay: string) => ({ animation: `chPop .35s cubic-bezier(.3,1.5,.5,1) ${delay} both` });

  return (
    <div data-track-ignore className="fc-stack fixed bottom-5 right-5 z-[44] hidden flex-col items-center gap-3 lg:flex">
      {open && (
        <div
          role="dialog"
          aria-label={t("Chat với Tà Xùa Booking")}
          className="absolute bottom-0 right-0 z-10 flex h-[560px] max-h-[calc(100vh-48px)] w-[370px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-18px_rgba(10,40,25,.55)] ring-1 ring-black/10"
          style={{ animation: "fcRise .22s ease both" }}
        >
          <div className="flex flex-none items-center gap-3 bg-forest-700 px-4 py-3 text-white">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg font-extrabold">
              TX
              <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-forest-700 ${off ? "bg-amber-400" : "bg-emerald-400"}`} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-extrabold">Tà Xùa Booking</div>
              <div className="text-xs text-white/80">
                {off ? t("Ngoài giờ hỗ trợ — sẽ trả lời từ {0}", [`${SITE.supportOpenHour}:00`]) : t("Thường trả lời trong vài phút")}
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("Đóng")} className="flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none hover:bg-white/15">
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-forest-50/60 px-4 py-4">
            <div className="flex flex-col gap-2">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink shadow-sm ring-1 ring-black/5">
                {voice(t("Chào bạn 👋 Tụi mình có thể giúp gì cho chuyến đi Tà Xùa của bạn?"))}
                <div className="mt-1 text-[11px] text-gray-400">{t("🕗 Giờ hoạt động: {0} hằng ngày.", [t(SITE.supportHours)])}</div>
              </div>
              {msgs.length === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {quick.map((q) => (
                    <button key={q} type="button" onClick={() => void send(q)} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-forest-800 ring-1 ring-forest-200 transition hover:bg-forest-100">
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {msgs.map((m) => {
                const mine = m.from === "guest";
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      title={hm(m.at)}
                      className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        mine ? `rounded-br-sm bg-forest-700 text-white ${m.pending ? "opacity-60" : ""}` : "rounded-bl-sm bg-white text-ink shadow-sm ring-1 ring-black/5"
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                );
              })}
              {guestCount > 0 && !adminReplied && (
                <div className="text-center text-[11.5px] text-gray-500">
                  {off ? t("Tin của bạn đã tới tụi mình — sẽ trả lời ngay khi vào giờ hỗ trợ.") : t("Đã gửi — tụi mình sẽ trả lời ngay tại đây.")}
                </div>
              )}
              {guestCount > 0 && !profile.saved && (
                <div className="rounded-xl bg-white p-3 text-xs shadow-sm ring-1 ring-black/5">
                  <div className="mb-2 font-semibold text-gray-600">{t("Để lại tên & SĐT để tụi mình gọi lại nếu bạn rời trang:")}</div>
                  <div className="flex gap-1.5">
                    <input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} maxLength={60} placeholder={t("Tên")} className="w-[38%] min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-[13px] outline-none focus:border-forest-500" />
                    <input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} maxLength={20} inputMode="tel" placeholder={t("Số điện thoại")} className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-[13px] outline-none focus:border-forest-500" />
                    <button type="button" onClick={() => void saveProfile()} disabled={!profile.phone.trim() && !profile.name.trim()} className="rounded-lg bg-forest-700 px-2.5 text-[12px] font-bold text-white disabled:opacity-40">
                      {t("Lưu")}
                    </button>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <div className="flex-none border-t border-gray-100 px-3 pb-3 pt-2.5">
            <div className="flex items-end gap-2">
              <textarea
                ref={boxRef}
                value={text}
                onChange={(e) => { setText(e.target.value); setErr(""); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                maxLength={1000}
                placeholder={t("Nhập câu hỏi: ngày đi, số người, dịch vụ cần đặt…")}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-forest-500"
              />
              <button type="button" onClick={() => void send()} disabled={!text.trim()} aria-label={t("Gửi")} className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-forest-700 text-white hover:bg-forest-800 disabled:opacity-40">
                <SendIcon className="h-5 w-5" />
              </button>
            </div>
            {err && <div className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 ring-1 ring-amber-200">{err}</div>}
            <div className="mt-2 flex items-center justify-center gap-3 text-[11.5px] font-semibold text-gray-500">
              <span>{t("Hoặc:")}</span>
              <a href={zalo} target="_blank" rel="noopener noreferrer" onClick={() => trackAction("Chat: mở Zalo")} className="text-[#0068FF] hover:underline">Zalo</a>
              <a href={messenger} target="_blank" rel="noopener noreferrer" onClick={() => trackAction("Chat: mở Messenger")} className="text-[#7b3cff] hover:underline">Messenger</a>
              <a href={`tel:${digits}`} onClick={() => trackAction("Chat: gọi điện")} className="hover:text-forest-700">{t("Gọi {0}", [phone])}</a>
            </div>
          </div>
        </div>
      )}

      {/* ZALO + cô gái ngồi trên mây */}
      <a
        href={zalo}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Zalo"
        title={t("Nhắn Zalo")}
        onClick={() => trackAction("Nút nổi: Zalo")}
        className={`${round} mt-[66px]`}
        style={{ background: "oklch(0.58 0.2 258)", boxShadow: "0 8px 18px -8px oklch(0.5 0.2 258 / .8)", ...pop(".12s") }}
      >
        Zalo
        <GirlChibi />
      </a>
      <a
        href={messenger}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Facebook Messenger"
        title={t("Nhắn Facebook")}
        onClick={() => trackAction("Nút nổi: Facebook")}
        className={round}
        style={{ background: "linear-gradient(140deg, oklch(0.66 0.18 245), oklch(0.6 0.24 300) 65%, oklch(0.68 0.2 15))", boxShadow: "0 8px 18px -8px oklch(0.55 0.22 300 / .8)", ...pop(".06s") }}
      >
        Mess
      </a>
      {/* GỌI + chàng trai phất cờ / chụp ảnh */}
      <a
        href={`tel:${digits}`}
        aria-label={t("Gọi điện")}
        title={t("Gọi {0}", [phone])}
        onClick={() => trackAction("Nút nổi: Gọi điện")}
        className={`${round} text-[14px]`}
        style={{ background: "oklch(0.65 0.15 160)", boxShadow: "0 8px 18px -8px oklch(0.55 0.14 160 / .8)", ...pop("0s") }}
      >
        {t("Gọi")}
        <span className="pointer-events-none absolute inset-0 rounded-full border-2" style={{ borderColor: "oklch(0.65 0.15 160)", animation: "chHalo 1.8s ease-out infinite" }} />
        <BoyChibi />
      </a>
      {/* Nút chính: mở / đóng khung chat trực tiếp */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? t("Đóng chat") : t("Chat với chúng tôi")}
        aria-expanded={open}
        className="relative flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[oklch(0.34_0.07_158)] font-extrabold text-white transition-colors hover:bg-[oklch(0.38_0.08_158)]"
        style={{ boxShadow: "0 12px 24px -10px oklch(0.2 0.06 160 / .7)", fontSize: open ? 26 : 14 }}
      >
        {open ? "×" : "Chat"}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-sunset-500 px-1.5 text-xs font-extrabold text-white ring-2 ring-white">{unread}</span>
        )}
      </button>
      <style>{CHIBI_CSS}</style>
    </div>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}
