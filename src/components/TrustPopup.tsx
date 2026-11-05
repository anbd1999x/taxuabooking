"use client";

import { useEffect, useState } from "react";
import { telHref, zaloHref, type TrustPopupConfig, type TrustPerson } from "@/lib/trust-popup";

/** Key localStorage: khách tick "không hiện lại trong 7 ngày". */
const HIDE_KEY = "txb-trust-popup";
const HIDE_MS = 7 * 864e5;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.[0] ?? "";
  const first = parts[0]?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

export function TrustPopup({ config }: { config: TrustPopupConfig }) {
  const [open, setOpen] = useState(false);
  const [hide, setHide] = useState(false);
  const [wide, setWide] = useState(true);

  useEffect(() => {
    if (!config.enabled || config.people.length === 0) return;
    setWide(window.innerWidth >= 720);
    const onResize = () => setWide(window.innerWidth >= 720);
    window.addEventListener("resize", onResize);

    // Hiện mỗi lần TẢI TRANG (F5 / mở trực tiếp URL). Chuyển trang bằng link nội
    // bộ (SPA) không mount lại component nên không hiện lại — đúng ý "chuyển trang
    // không hiện lại". Chỉ bỏ qua khi khách đã tick "không hiện lại 7 ngày".
    let show = true;
    try {
      const t = Number(localStorage.getItem(HIDE_KEY));
      if (t && Date.now() - t < HIDE_MS) show = false;
    } catch {
      /* chế độ riêng tư: vẫn hiện bình thường */
    }
    if (show) setOpen(true);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [config.enabled, config.people.length]);

  function close() {
    try {
      if (hide) localStorage.setItem(HIDE_KEY, String(Date.now()));
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

        {/* TRÁI: người thật */}
        <div
          style={{
            position: "relative",
            background: "linear-gradient(170deg, oklch(0.36 0.07 160), oklch(0.24 0.05 165))",
            color: "white",
            padding: wide ? "36px 28px" : "30px 16px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "oklch(0.85 0.1 70)",
            }}
          >
            Người đứng sau Tà Xùa Booking
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: wide ? 12 : 10,
              width: "100%",
              maxWidth: 340,
            }}
          >
            {config.people.map((u, i) => (
              <PersonCard key={i} u={u} wide={wide} />
            ))}
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: "oklch(0.88 0.03 160)",
              maxWidth: 300,
            }}
          >
            Tụi mình trực tiếp nghe máy, tư vấn và giữ chỗ cho từng khách. Liên hệ ai cũng được.
          </div>
        </div>

        {/* PHẢI: cam kết */}
        <div style={{ padding: wide ? "36px 32px 28px" : "20px 18px calc(18px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                padding: "5px 10px",
                borderRadius: 999,
                background: "oklch(0.95 0.04 155)",
                color: "oklch(0.38 0.1 155)",
              }}
            >
              ✓ Cam kết uy tín
            </div>
            <h2
              style={{
                margin: "10px 0 0",
                fontSize: "clamp(24px,3.2vw,32px)",
                fontWeight: 800,
                letterSpacing: "-.025em",
                lineHeight: 1.12,
              }}
            >
              Website thật, người thật, không scam.
            </h2>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "oklch(0.45 0.02 160)", marginTop: 8 }}>
              Tụi mình dám cam kết bằng tiền thật, ghi rõ ra đây để bạn yên tâm đặt dịch vụ.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <PromiseRow
              amount="100 triệu"
              sub="100.000.000đ"
              amountColor="oklch(0.58 0.18 42)"
              subColor="oklch(0.5 0.1 50)"
              bg="oklch(0.97 0.03 70)"
              border="1.5px solid oklch(0.88 0.08 65)"
            >
              <b>Nếu ai chứng minh được tụi mình đào lửa</b>, tụi mình trao thưởng 100.000.000 đồng.
            </PromiseRow>
            <PromiseRow
              amount="10 triệu"
              sub="10.000.000đ"
              amountColor="oklch(0.42 0.11 155)"
              subColor="oklch(0.45 0.08 155)"
              bg="oklch(0.97 0.02 155)"
              border="1.5px solid oklch(0.86 0.06 155)"
            >
              <b>Nếu ai chứng minh được giá trên website cao hơn giá niêm yết</b> của chính nhà xe, homestay, tụi mình đền 10.000.000 đồng.
            </PromiseRow>
          </div>

          {five.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", color: "oklch(0.29 0.055 160)" }}>
                  Cam kết {five.length} Không
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.5 0.02 160)" }}>của Tà Xùa Booking</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {five.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "9px 10px",
                      borderRadius: 12,
                      background: "oklch(0.97 0.006 160)",
                      fontSize: 13,
                      fontWeight: 700,
                      lineHeight: 1.3,
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        flex: "none",
                        borderRadius: "50%",
                        background: "oklch(0.29 0.055 160)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {i + 1}
                    </span>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}

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
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 12,
                color: "oklch(0.5 0.02 160)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={hide}
                onChange={(e) => setHide(e.target.checked)}
                style={{ accentColor: "oklch(0.35 0.08 160)" }}
              />
              Không hiện lại trong 7 ngày
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonCard({ u, wide }: { u: TrustPerson; wide: boolean }) {
  const av = wide ? 96 : 72;
  const tel = telHref(u);
  const zalo = zaloHref(u);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: wide ? "16px 10px 14px" : "12px 8px 10px",
        borderRadius: 20,
        background: "oklch(1 0 0 / .08)",
        border: "1px solid oklch(1 0 0 / .14)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: av,
          height: av,
          borderRadius: "50%",
          overflow: "hidden",
          border: "4px solid white",
          boxShadow: "0 10px 24px -8px oklch(0.1 0.03 160 / .6)",
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "oklch(0.5 0.08 160)",
          fontSize: av * 0.36,
          fontWeight: 800,
          color: "white",
        }}
      >
        {u.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.avatar} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          initials(u.name)
        )}
      </div>
      <div style={{ minWidth: 0, width: "100%" }}>
        <div style={{ fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.85 0.03 160)", marginTop: 2, whiteSpace: "nowrap" }}>{u.phone}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, width: "100%" }}>
        <a
          href={u.facebook || "#"}
          target="_blank"
          rel="noopener noreferrer"
          title={`Facebook ${u.name}`}
          style={{ height: 38, borderRadius: 12, background: "oklch(0.5 0.16 255)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, textDecoration: "none" }}
        >
          f
        </a>
        <a
          href={zalo || "#"}
          target="_blank"
          rel="noopener noreferrer"
          title={`Zalo ${u.name}`}
          style={{ height: 38, borderRadius: 12, background: "oklch(0.6 0.14 245)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, textDecoration: "none" }}
        >
          Zalo
        </a>
        <a
          href={tel || "#"}
          title={`Gọi ${u.name}`}
          style={{ height: 38, borderRadius: 12, background: "oklch(0.68 0.18 45)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, textDecoration: "none" }}
        >
          ☎
        </a>
      </div>
    </div>
  );
}

function PromiseRow({
  amount,
  sub,
  amountColor,
  subColor,
  bg,
  border,
  children,
}: {
  amount: string;
  sub: string;
  amountColor: string;
  subColor: string;
  bg: string;
  border: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0,1fr)",
        gap: 14,
        alignItems: "center",
        padding: 16,
        borderRadius: 18,
        background: bg,
        border,
      }}
    >
      <div style={{ textAlign: "center", minWidth: 96 }}>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1, color: amountColor }}>{amount}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: subColor, marginTop: 3 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}
