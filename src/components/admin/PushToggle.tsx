"use client";

import { useEffect, useState } from "react";

/** Khoá VAPID public (base64url) → Uint8Array cho PushManager.subscribe. */
function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type PushState = "loading" | "unsupported" | "install" | "off" | "on" | "denied" | "busy";

/**
 * Nút bật/tắt Web Push thông báo đơn mới (header admin).
 * iPhone: bắt buộc "Thêm vào MH chính" trước (iOS ≥ 16.4) — khi chưa cài thì
 * hiện nút hướng dẫn thay vì nút bật.
 */
export function PushToggle({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<PushState>("loading");
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!vapidKey) return setState("unsupported");
    (async () => {
      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const standalone =
          (navigator as unknown as { standalone?: boolean }).standalone === true ||
          window.matchMedia("(display-mode: standalone)").matches;
        setState(isIOS && !standalone ? "install" : "unsupported");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (sub) setState("on");
      else setState(Notification.permission === "denied" ? "denied" : "off");
    })().catch(() => setState("unsupported"));
  }, [vapidKey]);

  async function enable() {
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(vapidKey) as unknown as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {});
        return setState("off");
      }
      setState("on");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  if (!vapidKey || state === "loading" || state === "unsupported") return null;

  const btn = "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition";

  if (state === "install") {
    return (
      <div className="relative">
        <button type="button" onClick={() => setShowHint(!showHint)} className={`${btn} bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100`}>
          🔔 Nhận thông báo
        </button>
        {showHint && (
          <>
            {/* Bấm ra ngoài để đóng */}
            <div className="fixed inset-0 z-40" onClick={() => setShowHint(false)} />
            {/* Mobile: hộp bám theo màn hình (nút nằm giữa header → neo theo nút sẽ tràn mép trái) */}
            <div className="fixed inset-x-4 top-[72px] z-50 rounded-xl border border-gray-100 bg-white p-3.5 text-[13px] leading-relaxed text-gray-600 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72">
              <b className="text-ink">Để nhận thông báo đơn mới trên iPhone:</b>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                <li>Mở trang này bằng <b>Safari</b></li>
                <li>Bấm nút <b>Chia sẻ</b> → <b>Thêm vào MH chính</b></li>
                <li>Mở app <b>Tà Xùa</b> từ màn hình chính → đăng nhập → bấm lại nút này</li>
              </ol>
            </div>
          </>
        )}
      </div>
    );
  }
  if (state === "denied") {
    return (
      <span className={`${btn} cursor-default bg-gray-100 text-gray-400`} title="Thông báo đang bị chặn — mở Cài đặt trình duyệt/điện thoại để cho phép lại.">
        🔕 Đã chặn thông báo
      </span>
    );
  }
  if (state === "on") {
    return (
      <button type="button" onClick={disable} title="Đang nhận thông báo đơn mới — bấm để tắt" className={`${btn} bg-forest-50 text-forest-700 ring-1 ring-forest-200 hover:bg-forest-100`}>
        🔔 Đang bật
      </button>
    );
  }
  return (
    <button type="button" onClick={state === "busy" ? undefined : enable} disabled={state === "busy"} className={`${btn} bg-sunset-500 text-white hover:bg-sunset-600 disabled:opacity-60`}>
      🔔 {state === "busy" ? "Đang bật…" : "Bật thông báo đơn mới"}
    </button>
  );
}
