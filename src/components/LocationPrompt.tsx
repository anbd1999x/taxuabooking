"use client";

import { useEffect, useState } from "react";

const KEY = "tx_loc"; // localStorage: { s: "sent" | "dismissed" | "denied", t: timestamp }
const RESEND_MS = 24 * 3600_000; // đã cho phép → cập nhật lại vị trí tối đa 1 lần/ngày
const REASK_MS = 7 * 24 * 3600_000; // bấm "Để sau" → 7 ngày sau mới hỏi lại
const SHOW_DELAY_MS = 10000; // sau popup uy tín + sau khi /api/track đã cấp cookie tx_vid

function readState(): { s: string; t: number } | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as { s: string; t: number }) : null;
  } catch {
    return null;
  }
}
function writeState(s: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ s, t: Date.now() }));
  } catch {
    /* private mode — bỏ qua */
  }
}

function sendPosition(pos: GeolocationPosition) {
  fetch("/api/track/location", {
    method: "POST",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
  }).catch(() => {});
  writeState("sent");
}

/**
 * Xin quyền VỊ TRÍ của khách (chỉ khi khách đồng ý). Không bật hộp xin quyền của trình
 * duyệt ngay khi vào trang (Chrome sẽ tự ẩn/chặn kiểu hỏi đó) — hiện banner nhỏ giải
 * thích mục đích, khách bấm "Cho phép" mới gọi Geolocation API.
 * Đã cho phép từ trước → tự cập nhật vị trí im lặng (≤1 lần/ngày).
 */
export function LocationPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const st = readState();
    const now = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const decide = (perm: PermissionState | "unknown") => {
      if (perm === "denied") return;
      if (perm === "granted") {
        if (st?.s === "sent" && now - st.t < RESEND_MS) return;
        navigator.geolocation.getCurrentPosition(sendPosition, () => {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 });
        return;
      }
      // Chưa quyết định: hỏi nếu chưa từ chối gần đây.
      if (st && (st.s === "dismissed" || st.s === "denied") && now - st.t < REASK_MS) return;
      if (st?.s === "sent" && now - st.t < RESEND_MS) return;
      timer = setTimeout(() => setShow(true), SHOW_DELAY_MS);
    };

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((r) => decide(r.state))
        .catch(() => decide("unknown"));
    } else {
      decide("unknown");
    }
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  function allow() {
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendPosition(pos);
        setShow(false);
      },
      (err) => {
        writeState(err.code === err.PERMISSION_DENIED ? "denied" : "dismissed");
        setShow(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
    );
  }
  function later() {
    writeState("dismissed");
    setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Chia sẻ vị trí"
      className="fixed left-3 right-3 top-14 z-40 max-w-sm rounded-2xl bg-white p-4 shadow-[0_18px_50px_-12px_rgba(20,50,35,0.45)] ring-1 ring-black/10 sm:right-auto sm:left-6 sm:top-20 sm:w-full"
    >
      <div className="flex gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-forest-50 text-xl">📍</span>
        <div className="min-w-0">
          <div className="font-bold text-ink">Chia sẻ vị trí của bạn?</div>
          <p className="mt-0.5 text-sm leading-relaxed text-gray-600">
            Giúp Tà Xùa Booking gợi ý điểm đón xe gần bạn và hỗ trợ đơn đặt nhanh hơn.
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={later} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
          Để sau
        </button>
        <button
          type="button"
          onClick={allow}
          disabled={busy}
          className="rounded-xl bg-forest-600 px-4 py-2 text-sm font-bold text-white hover:bg-forest-700 disabled:opacity-70"
        >
          {busy ? "Đang lấy vị trí…" : "Cho phép"}
        </button>
      </div>
    </div>
  );
}
