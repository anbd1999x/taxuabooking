"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Chống ghi trùng: React StrictMode (dev) chạy effect 2 lần, hoặc re-render cùng địa chỉ.
let lastKey = "";
let lastAt = 0;
let lastAction = "";
let lastActionAt = 0;

function send(body: Record<string, string>) {
  fetch("/api/track", {
    method: "POST",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

/**
 * Ghi một THAO TÁC của khách (hiện ở trang quản trị "Lượt truy cập" dạng câu).
 * Chỉ truyền mô tả hành động — KHÔNG truyền nội dung khách gõ (tên, SĐT…).
 */
export function trackAction(text: string) {
  const t = text.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!t) return;
  const now = Date.now();
  if (t === lastAction && now - lastActionAt < 1500) return; // bấm đúp
  lastAction = t;
  lastActionAt = now;
  send({ path: location.pathname + location.search, action: t });
}

/** Chữ hiển thị gọn của một phần tử (ưu tiên data-track, aria-label, title). */
function labelOf(el: HTMLElement): string {
  const own = el.getAttribute("data-track") || el.getAttribute("aria-label") || "";
  const text = (own || el.innerText || el.textContent || el.getAttribute("title") || "").replace(/\s+/g, " ").trim();
  return text.length > 60 ? text.slice(0, 57) + "…" : text;
}

/** Bắt thao tác bấm / chọn trên toàn trang công khai. */
function onClick(e: MouseEvent) {
  const el = (e.target as HTMLElement | null)?.closest?.("a,button,[role=button],summary") as HTMLElement | null;
  if (!el || el.closest("[data-track-ignore]")) return;
  if (el.tagName === "A") {
    const href = (el as HTMLAnchorElement).href || "";
    if (href.startsWith("tel:")) return trackAction(`Bấm gọi điện ${href.slice(4)}`);
    if (/zalo\.me|zalo\.vn/i.test(href)) return trackAction("Bấm nhắn Zalo");
    if (/m\.me|messenger\.com|facebook\.com/i.test(href)) return trackAction("Mở Facebook / Messenger");
    if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(href)) {
      return trackAction(/\/dir\//.test(href) ? "Mở Google Maps chỉ đường" : "Mở vị trí trên Google Maps");
    }
    try {
      const u = new URL(href, location.href);
      if (u.origin !== location.origin) return trackAction(`Mở liên kết ngoài ${u.hostname}`);
    } catch {
      /* bỏ qua */
    }
    // Link trong site: lượt xem trang mới đã được ghi — chỉ ghi khi đánh dấu data-track.
    if (el.getAttribute("data-track")) trackAction(`Bấm “${labelOf(el)}”`);
    return;
  }
  const label = labelOf(el);
  // Bỏ nút không có chữ / chỉ là số / ký hiệu (×, −, +) — trừ khi có aria-label.
  if (!label || /^[\d\s.,:%+−×x\-–—→←↗⌄·]*$/i.test(label)) return;
  trackAction(`Bấm “${label}”`);
}

function onChange(e: Event) {
  const el = e.target as HTMLElement | null;
  if (!el || el.tagName !== "SELECT" || el.closest("[data-track-ignore]")) return;
  const s = el as HTMLSelectElement;
  const opt = s.options[s.selectedIndex]?.text?.trim();
  if (!opt) return;
  const name = s.getAttribute("aria-label") || s.closest("label")?.querySelector("span")?.textContent?.trim() || "";
  trackAction(name ? `Chọn ${name}: “${opt}”` : `Chọn “${opt}”`);
}

function Tracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const qs = search?.toString() ?? "";

  // Lượt xem trang (kèm tham số tìm kiếm: ngày, số người, giá… để diễn tả khách tìm gì).
  useEffect(() => {
    const key = pathname + (qs ? `?${qs}` : "");
    const now = Date.now();
    if (key === lastKey && now - lastAt < 5000) return;
    lastKey = key;
    lastAt = now;
    send({ path: key.slice(0, 500), referrer: typeof document !== "undefined" ? document.referrer : "" });
  }, [pathname, qs]);

  // Thao tác: bắt một lần cho cả trang (capture để vẫn ghi được khi nút chặn lan truyền sự kiện).
  useEffect(() => {
    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
    };
  }, []);

  return null;
}

/** Gửi lượt xem trang + thao tác về /api/track trên website công khai. */
export function VisitTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
