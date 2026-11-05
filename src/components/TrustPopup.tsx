"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CATEGORY_LIST } from "@/lib/constants";
import type { TrustPopupConfig } from "@/lib/trust-popup";
import { CommitmentIntro, FiveKhongBlock, PeopleColumn, PromisesBlock } from "@/components/trust/parts";

/** Key localStorage: khách đóng popup → không hiện lại trong 7 ngày. */
const HIDE_KEY = "txb-trust-popup";
/** Key sessionStorage: khách đã bấm xem 1 dịch vụ → không làm phiền nữa trong phiên. */
const VIEW_KEY = "txb-viewed-service";
const HIDE_MS = 7 * 864e5;

const CAT_SLUGS = new Set(CATEGORY_LIST.map((c) => c.slug));

/** Đường dẫn là trang CHI TIẾT dịch vụ (vd /homestay/abc, /xe-cabin/abc) → coi như "đã xem dịch vụ". */
function isServiceDetail(path: string): boolean {
  const segs = path.split("/").filter(Boolean);
  return segs.length >= 2 && CAT_SLUGS.has(segs[0]);
}

export function TrustPopup({ config }: { config: TrustPopupConfig }) {
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(true);
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Khách bấm xem 1 dịch vụ (kể cả điều hướng SPA trong lúc đang chờ): đánh dấu
  // đã xem + đóng popup nếu lỡ hiện → không làm phiền nữa.
  useEffect(() => {
    if (isServiceDetail(pathname)) {
      try {
        sessionStorage.setItem(VIEW_KEY, "1");
      } catch {
        /* chế độ riêng tư */
      }
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!config.enabled || config.people.length === 0) return;
    setWide(window.innerWidth >= 720);
    const onResize = () => setWide(window.innerWidth >= 720);
    window.addEventListener("resize", onResize);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);

    // Quy tắc hiện popup:
    //  - KHÔNG hiện ngay khi tải trang.
    //  - Sau 5–8 giây mới hiện (nếu đủ điều kiện).
    //  - Đã đóng trong 7 ngày → bỏ qua.
    //  - Đã bấm xem dịch vụ trong phiên → bỏ qua.
    //  - Vào thẳng trang chi tiết dịch vụ → bỏ qua (khách đang xem dịch vụ rồi).
    let skip = false;
    try {
      const t = Number(localStorage.getItem(HIDE_KEY));
      if (t && Date.now() - t < HIDE_MS) skip = true;
      if (sessionStorage.getItem(VIEW_KEY) === "1") skip = true;
    } catch {
      /* chế độ riêng tư: vẫn hiện bình thường */
    }
    if (typeof window !== "undefined" && isServiceDetail(window.location.pathname)) skip = true;

    if (!skip) {
      const delay = 5000 + Math.floor(Math.random() * 3000); // 5–8 giây
      timer.current = setTimeout(() => {
        let viewed = false;
        try {
          viewed = sessionStorage.getItem(VIEW_KEY) === "1";
        } catch {
          /* bỏ qua */
        }
        if (!viewed) setOpen(true);
      }, delay);
    }

    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enabled, config.people.length]);

  function close() {
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now()));
    } catch {
      /* bỏ qua */
    }
    setOpen(false);
  }

  if (!open) return null;

  const five = config.fiveRules;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cam kết uy tín"
      style={{
        fontFamily: "'Be Vietnam Pro',system-ui,sans-serif",
        color: "oklch(0.22 0.03 160)",
      }}
    >
      <style>{`
@keyframes txbPuIn{from{opacity:0;transform:translate(-50%,-46%) scale(.96)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes txbPuFade{from{opacity:0}to{opacity:1}}
@keyframes txbPuUp{from{transform:translateY(100%)}to{transform:none}}
`}</style>

      {/* Lớp phủ nền */}
      <div
        onClick={close}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 900,
          background: "oklch(0.16 0.03 160 / .6)",
          backdropFilter: "blur(4px)",
          animation: "txbPuFade .3s ease both",
        }}
      />

      {/* Hộp thoại */}
      <div
        style={{
          position: "fixed",
          zIndex: 901,
          left: wide ? "50%" : 0,
          right: wide ? "auto" : 0,
          top: wide ? "50%" : "auto",
          bottom: wide ? "auto" : 0,
          transform: wide ? "translate(-50%,-50%)" : "none",
          width: wide ? "min(880px,94vw)" : "100%",
          maxHeight: wide ? "92vh" : "90dvh",
          overflowY: "auto",
          overscrollBehavior: "contain",
          background: "white",
          borderRadius: wide ? "26px" : "24px 24px 0 0",
          display: "grid",
          gridTemplateColumns: wide ? "360px minmax(0,1fr)" : "1fr",
          boxShadow: "0 40px 80px -30px oklch(0.15 0.04 160 / .6)",
          animation: wide
            ? "txbPuIn .45s cubic-bezier(.2,.7,.2,1) both"
            : "txbPuUp .45s cubic-bezier(.2,.7,.2,1) both",
        }}
      >
        {/* Thanh kéo (mobile) */}
        {!wide && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 3,
              width: 44,
              height: 5,
              borderRadius: 999,
              background: "oklch(1 0 0 / .55)",
            }}
          />
        )}

        {/* Nút đóng */}
        <div
          onClick={close}
          title="Đóng"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 3,
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "oklch(1 0 0 / .92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 8px oklch(0.2 0.03 160 / .2)",
          }}
        >
          ×
        </div>

        {/* TRÁI: người thật + website */}
        <PeopleColumn people={config.people} wide={wide} />

        {/* PHẢI: cam kết */}
        <div style={{ padding: wide ? "36px 32px 28px" : "20px 18px calc(18px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 16 }}>
          <CommitmentIntro showSub={wide} />
          <PromisesBlock termsHref="/cam-ket/dieu-khoan" />
          <FiveKhongBlock five={five} />

          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              onClick={close}
              style={{
                cursor: "pointer",
                textAlign: "center",
                fontSize: 15,
                fontWeight: 800,
                padding: 14,
                border: "none",
                borderRadius: 999,
                background: "oklch(0.29 0.055 160)",
                color: "white",
              }}
            >
              Tôi đã hiểu, xem dịch vụ →
            </button>
            <div style={{ textAlign: "center", fontSize: 12, color: "oklch(0.5 0.02 160)" }}>
              Đóng lại sẽ không hiện lại trong 7 ngày.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
