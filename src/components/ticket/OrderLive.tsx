"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/I18nProvider";
import { mmss } from "./tk";

/**
 * Trang vé điện tử khi đơn còn chờ: tự nạp lại 15 giây/lần để vé QR hiện ngay khi địa điểm xác nhận / ghi nhận tiền,
 * và đếm ngược hạn giữ chỗ (hết hạn ⇒ nạp lại để báo đơn đã huỷ).
 */
export function OrderLive({ holdUntil, mode = "pay" }: { holdUntil: number | null; /** pay = chờ chuyển khoản · confirm = chờ địa điểm gọi xác nhận */ mode?: "pay" | "confirm" }) {
  const t = useT();
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => !document.hidden && router.refresh(), 15_000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [router]);
  const left = holdUntil ? holdUntil - now : 0;
  const over = !!holdUntil && left <= 0;
  useEffect(() => {
    if (over) router.refresh();
  }, [over, router]);
  if (!holdUntil) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: "oklch(0.52 0.15 45)", marginTop: 4 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", animation: "tkPulse 1s infinite" }} />
      {over ? t("Hết thời gian giữ chỗ, đang cập nhật…") : mode === "confirm" ? t("Chờ xác nhận · tự huỷ sau {0}", [mmss(left)]) : t("Giữ chỗ cho bạn thêm {0}", [mmss(left)])}
    </div>
  );
}
