"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/i18n/I18nProvider";
import { WeatherBoard } from "./WeatherBoard";

/**
 * Popup "Tà Xùa mấy ngày tới thế nào?" ở banner trang chủ — vỏ kính mờ + nút đóng, phần thân là
 * `WeatherBoard` (dùng chung với trang /thoi-tiet-ta-xua), theo claude.ai/design `Du bao Thoi tiet Ta Xua.dc.html`.
 */
export function WeatherPopup({ onClose }: { onClose: () => void }) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Portal ra <body>: banner có stacking context riêng ⇒ ở trong đó popup bị menu / ô tìm kiếm / nút liên hệ đè.
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t("Dự báo thời tiết Tà Xùa")}>
      <div className="wxp-fade absolute inset-0 bg-[oklch(0.18_0.03_180/.55)] backdrop-blur-[3px]" onClick={onClose} />
      {/* iPhone: vh = màn hình khi ẨN thanh địa chỉ ⇒ 94vh cao hơn phần nhìn thấy, đầu popup (nút ×) bị khuất.
          Dùng dvh (phần đang thấy) + nút × nằm NGOÀI vùng cuộn nên luôn đứng yên ở góc. */}
      <div
        className="wxp-pop wxp-sheet relative flex w-full max-w-[1240px] flex-col overflow-hidden rounded-t-[28px] ring-1 ring-white/25 backdrop-blur-xl sm:rounded-[28px]"
        style={{ background: "oklch(0.975 0.008 150 / .05)", color: "oklch(0.22 0.03 160)" }} // trong 95%: kính mờ, thấy trang phía sau
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Đóng")}
          className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-bold leading-none shadow-md ring-1 ring-black/10 hover:bg-gray-50 active:scale-95"
        >
          ×
        </button>
        {/* thanh kéo (điện thoại) */}
        <div className="flex flex-none justify-center pt-2 sm:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-white/45" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-[18px] px-[clamp(16px,4vw,32px)] pb-[clamp(20px,4vw,40px)] pt-[clamp(20px,4vw,40px)]">
            <WeatherBoard variant="popup" onNavigate={onClose} />
            {/* điện thoại: nút Đóng to ở cuối (cạnh thanh home iPhone) */}
            <button
              type="button"
              onClick={onClose}
              className="mb-[env(safe-area-inset-bottom)] w-full rounded-full border border-black/10 bg-white py-3.5 text-[15px] font-extrabold shadow-sm active:scale-[.99] sm:hidden"
            >
              {t("Đóng")}
            </button>
          </div>
        </div>
      </div>
      <style>{POP_CSS}</style>
    </div>,
    document.body,
  );
}

const POP_CSS = `
@keyframes wxp-pop{from{opacity:0;transform:translateY(24px) scale(.98)}to{opacity:1;transform:none}}
@keyframes wxp-fade{from{opacity:0}to{opacity:1}}
.wxp-sheet{max-height:92vh;max-height:calc(100dvh - 10px)}
@media (min-width:640px){.wxp-sheet{max-height:94vh;max-height:calc(100dvh - 32px)}}
.wxp-pop{animation:wxp-pop .35s cubic-bezier(.2,.8,.2,1) both}
.wxp-fade{animation:wxp-fade .25s ease both}
@media (prefers-reduced-motion: reduce){.wxp-pop,.wxp-fade{animation:none}}
`;
