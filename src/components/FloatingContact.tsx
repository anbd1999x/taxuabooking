"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SITE } from "@/lib/site";
import { useSitePhone, useVoice } from "@/components/SiteContact";
import { useT } from "@/components/i18n/I18nProvider";
import { trackAction } from "@/components/VisitTracker";

/**
 * Nút liên hệ nổi góc phải màn hình (mọi trang khách): Zalo · Facebook (Messenger) · Gọi điện.
 * Màn hình rộng (≥1024px) có thêm nút Chat mở KHUNG CHAT NHANH: lời chào, câu hỏi gợi ý, ô soạn tin
 * ⇒ gửi qua Zalo (chép sẵn nội dung — Zalo không nhận nội dung soạn sẵn qua link) hoặc Messenger (?text=).
 * Không lưu tin nhắn trên web — khách nói chuyện với người trực qua Zalo / Messenger.
 * Điện thoại: đặt cao hơn để không đè thanh đặt phòng / thanh liên hệ dính đáy của từng trang.
 */
export function FloatingContact({ facebook }: { facebook: string }) {
  const t = useT();
  const voice = useVoice();
  const phone = useSitePhone();
  const digits = phone.replace(/\D/g, "");
  const zalo = `https://zalo.me/${digits}`;
  const fbUser = facebook.match(/facebook\.com\/(?:profile\.php\?id=)?([^/?#]+)/i)?.[1] ?? "";
  const messenger = fbUser ? `https://m.me/${fbUser}` : facebook;
  const pathname = usePathname();
  // Mở khung chat = ghi lại trang đang xem; đổi trang ⇒ tự đóng (không cần effect).
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");
  const [off, setOff] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  const checkOff = () => {
    const h = (new Date().getUTCHours() + 7) % 24; // giờ VN
    setOff(h < SITE.supportOpenHour || h >= SITE.supportCloseHour);
  };
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    window.addEventListener("keydown", k);
    setTimeout(() => boxRef.current?.focus(), 60);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const quick = [
    t("Mình muốn hỏi giá phòng homestay"),
    t("Mình muốn đặt vé xe cabin"),
    t("Tư vấn giúp mình combo xe + phòng"),
    t("Mình muốn thuê xe máy"),
  ];

  /** Tin gửi đi kèm trang khách đang xem — người trực biết ngay khách hỏi về dịch vụ nào. */
  function fullText(): string {
    const body = msg.trim() || t("Chào bạn, mình cần tư vấn.");
    const page = typeof window !== "undefined" ? window.location.href : "";
    return page ? `${body}\n\n(${t("Trang đang xem")}: ${page})` : body;
  }
  async function copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  async function sendZalo() {
    const ok = await copy(fullText());
    trackAction("Chat nhanh: gửi qua Zalo");
    setNote(ok ? t("Đã chép tin nhắn — dán (Ctrl+V) vào khung chat Zalo vừa mở rồi bấm gửi.") : t("Zalo vừa mở — bạn nhắn nội dung cần hỏi nhé."));
    window.open(zalo, "_blank", "noopener");
  }
  async function sendMessenger() {
    const text = fullText();
    const ok = await copy(text);
    trackAction("Chat nhanh: gửi qua Messenger");
    setNote(ok ? t("Đã chép tin nhắn — nếu Messenger chưa điền sẵn, dán (Ctrl+V) rồi bấm gửi.") : "");
    window.open(fbUser ? `${messenger}?text=${encodeURIComponent(text)}` : messenger, "_blank", "noopener");
  }

  const round = "flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_10px_24px_-8px_rgba(0,0,0,.45)] ring-2 ring-white transition hover:scale-110";

  return (
    <div
      data-track-ignore
      className="fixed right-3 z-[44] flex flex-col items-end gap-2.5 bottom-[calc(88px+env(safe-area-inset-bottom))] lg:right-5 lg:bottom-6"
    >
      {/* Khung chat neo đúng góc phải dưới, ĐÈ lên cụm nút (đóng bằng nút × trong khung / Esc). */}
      {open && (
        <div
          role="dialog"
          aria-label={t("Chat với Tà Xùa Booking")}
          className="absolute bottom-0 right-0 z-10 hidden w-[360px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-18px_rgba(10,40,25,.55)] ring-1 ring-black/10 lg:block"
          style={{ animation: "fcRise .22s ease both" }}
        >
          <div className="flex items-center gap-3 bg-forest-700 px-4 py-3 text-white">
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

          <div className="flex flex-col gap-3 bg-forest-50/60 px-4 py-4">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink shadow-sm ring-1 ring-black/5">
              {voice(t("Chào bạn 👋 Tụi mình có thể giúp gì cho chuyến đi Tà Xùa của bạn?"))}
              <div className="mt-1 text-[11px] text-gray-400">{t("🕗 Giờ hoạt động: {0} hằng ngày.", [t(SITE.supportHours)])}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quick.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => { setMsg(q); setNote(""); boxRef.current?.focus(); }}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-forest-800 ring-1 ring-forest-200 transition hover:bg-forest-100"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 px-4 pb-4 pt-3">
            <textarea
              ref={boxRef}
              value={msg}
              onChange={(e) => { setMsg(e.target.value); setNote(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void sendZalo(); }}
              rows={3}
              maxLength={800}
              placeholder={t("Nhập câu hỏi: ngày đi, số người, dịch vụ cần đặt…")}
              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-forest-500"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void sendZalo()} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#0068FF] px-3 py-2.5 text-sm font-extrabold text-white hover:brightness-110">
                <ZaloMark small /> {t("Gửi qua Zalo")}
              </button>
              <button type="button" onClick={() => void sendMessenger()} className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-[#00B2FF] to-[#A033FF] px-3 py-2.5 text-sm font-extrabold text-white hover:brightness-110">
                <MessengerIcon className="h-4 w-4" /> Messenger
              </button>
            </div>
            {note && <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">{note}</div>}
            <a href={`tel:${digits}`} onClick={() => trackAction("Chat nhanh: gọi điện")} className="mt-2 block text-center text-xs font-semibold text-gray-500 hover:text-forest-700">
              {t("Cần gấp? Gọi {0}", [phone])}
            </a>
          </div>
        </div>
      )}

      <a href={zalo} target="_blank" rel="noopener noreferrer" aria-label="Zalo" title={t("Nhắn Zalo")} onClick={() => trackAction("Nút nổi: Zalo")} className={`${round} bg-[#0068FF]`}>
        <ZaloMark />
      </a>
      <a href={messenger} target="_blank" rel="noopener noreferrer" aria-label="Facebook Messenger" title={t("Nhắn Facebook")} onClick={() => trackAction("Nút nổi: Facebook")} className={`${round} bg-gradient-to-br from-[#00B2FF] to-[#A033FF]`}>
        <MessengerIcon className="h-6 w-6" />
      </a>
      <a href={`tel:${digits}`} aria-label={t("Gọi điện")} title={t("Gọi {0}", [phone])} onClick={() => trackAction("Nút nổi: Gọi điện")} className={`${round} relative bg-emerald-500`}>
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />
        <PhoneIcon className="relative h-5 w-5" />
      </a>
      <button
        type="button"
        onClick={() => { setOpen(!open); setNote(""); if (!open) { checkOff(); trackAction("Nút nổi: mở chat"); } }}
        aria-label={open ? t("Đóng chat") : t("Chat với chúng tôi")}
        aria-expanded={open}
        className="hidden h-14 items-center gap-2 rounded-full bg-forest-700 pl-4 pr-5 font-extrabold text-white shadow-[0_14px_30px_-10px_rgba(10,40,25,.6)] ring-2 ring-white transition hover:bg-forest-800 lg:flex"
      >
        {open ? <span className="text-2xl leading-none">×</span> : <ChatIcon className="h-6 w-6" />}
        <span className="text-sm">{open ? t("Đóng") : t("Chat ngay")}</span>
      </button>
      <style>{`@keyframes fcRise{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function ZaloMark({ small }: { small?: boolean }) {
  return <span className={`font-black tracking-tight ${small ? "text-[11px]" : "text-[13px]"}`}>Zalo</span>;
}
function MessengerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.35.27.57l.05 1.78a.8.8 0 0 0 1.12.71l1.99-.88a.8.8 0 0 1 .53-.04c.91.25 1.88.39 2.9.39 5.64 0 10-4.13 10-9.7S17.64 2 12 2Zm6 7.46-2.94 4.66a1.5 1.5 0 0 1-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66a1.5 1.5 0 0 1 2.17-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.63Z" />
    </svg>
  );
}
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02L6.6 10.8Z" />
    </svg>
  );
}
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z" />
      <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" />
    </svg>
  );
}
