import * as React from "react";
import { OFFICIAL_SITES, telHref, zaloHref, type TrustPerson } from "@/lib/trust-popup";

export { CommitmentLink } from "./CommitmentLink";

/** Các mảnh dùng chung giữa Popup uy tín và trang /cam-ket (nội dung + thiết kế giống nhau). */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.[0] ?? "";
  const first = parts[0]?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

function PhoneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function PersonCard({ u, wide }: { u: TrustPerson; wide: boolean }) {
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
          style={{ height: 38, borderRadius: 12, background: "oklch(0.68 0.18 45)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
        >
          <PhoneIcon />
        </a>
      </div>
    </div>
  );
}

/** Cột TRÁI: giới thiệu 2 người thật + website chính thức. */
export function PeopleColumn({
  people,
  wide,
  rounded,
}: {
  people: TrustPerson[];
  wide: boolean;
  /** Bo góc bên trái (popup) hay bo cả (trang) — mặc định để component cha quyết định qua style wrapper. */
  rounded?: string;
}) {
  return (
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
        borderRadius: rounded,
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
        Xin chào, tụi mình là
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
        {people.map((u, i) => (
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
        Hai đứa mình trực tiếp nghe máy, tư vấn và giữ chỗ cho từng khách. Liên hệ ai cũng được.
      </div>

      {/* Website chính thức duy nhất */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          width: "100%",
          maxWidth: 340,
          paddingTop: 14,
          borderTop: "1px solid oklch(1 0 0 / .14)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "oklch(0.85 0.1 70)",
          }}
        >
          Website chính thức duy nhất
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, width: "100%" }}>
          {OFFICIAL_SITES.map((name) => (
            <a
              key={name}
              href={`https://${name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white transition-colors hover:bg-[oklch(0.95_0.03_155)]"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 8px",
                borderRadius: 999,
                color: "oklch(0.29 0.055 160)",
                fontSize: 14,
                fontWeight: 800,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </a>
          ))}
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.5, color: "oklch(0.82 0.03 160)" }}>
          Ngoài {OFFICIAL_SITES.length} địa chỉ này đều là giả mạo.
        </div>
      </div>
    </div>
  );
}

/** Nhãn + tiêu đề + mô tả phần cam kết. */
export function CommitmentIntro({ showSub = true }: { showSub?: boolean }) {
  return (
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
      {showSub && (
        <div style={{ fontSize: 14, lineHeight: 1.6, color: "oklch(0.45 0.02 160)", marginTop: 8 }}>
          Kết nối trực tiếp với nhà xe, homestay tại Tà Xùa. Mọi cam kết đều có điều kiện công khai để bạn tự kiểm chứng.
        </div>
      )}
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

/** 2 cam kết bằng tiền (100 triệu + 10 triệu). `termsHref` có thì hiện link "Xem điều kiện áp dụng". */
export function PromisesBlock({ termsHref }: { termsHref?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <PromiseRow
        amount="100 triệu"
        sub="100.000.000đ"
        amountColor="oklch(0.58 0.18 42)"
        subColor="oklch(0.5 0.1 50)"
        bg="oklch(0.97 0.03 70)"
        border="1.5px solid oklch(0.88 0.08 65)"
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span>
            <b>Cam kết minh bạch.</b> Nếu Tà Xùa Booking đã nhận tiền mà không cung cấp dịch vụ và không hoàn tiền trong 3 ngày làm việc kể từ khi bạn yêu cầu, bạn được hoàn 100% và bồi thường thêm, tổng chi trả đến 100.000.000 đồng.
          </span>
          {termsHref && (
            <a href={termsHref} style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.5 0.15 45)", textDecoration: "none" }}>
              Xem điều kiện áp dụng →
            </a>
          )}
        </span>
      </PromiseRow>
      <PromiseRow
        amount="10 triệu"
        sub="10.000.000đ"
        amountColor="oklch(0.42 0.11 155)"
        subColor="oklch(0.45 0.08 155)"
        bg="oklch(0.97 0.02 155)"
        border="1.5px solid oklch(0.86 0.06 155)"
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span>
            <b>Đúng giá niêm yết.</b> Nếu tụi mình đã biết giá niêm yết của chính nhà xe, homestay thấp hơn mà vẫn chốt giá cao hơn, bạn được hoàn phần chênh lệch và bồi thường 10.000.000 đồng. Nhà cung cấp đổi giá mà không báo thì bạn được hoàn đủ phần chênh lệch.
          </span>
          <span style={{ fontSize: 12, lineHeight: 1.5, color: "oklch(0.45 0.03 155)" }}>
            Giá chốt qua Zalo là giá cuối cùng, không tăng sau khi bạn đồng ý. Giá trên web chỉ để tham khảo.
          </span>
        </span>
      </PromiseRow>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: "oklch(0.4 0.02 160)", padding: "0 4px" }}>
        <b>Sự cố ngoài ý muốn</b> (xe hỏng, homestay khoá nhầm phòng, sạt lở, cấm đường…): tụi mình báo ngay và đưa phương án thay thế tương đương, hoặc hoàn tiền phần dịch vụ chưa sử dụng nếu bạn không đồng ý.
      </div>
    </div>
  );
}

/** Cam kết N Không (lưới đánh số). */
export function FiveKhongBlock({ five }: { five: string[] }) {
  if (five.length === 0) return null;
  return (
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
  );
}
