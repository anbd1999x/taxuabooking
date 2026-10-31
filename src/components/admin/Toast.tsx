"use client";

import { useEffect, useState } from "react";

type ToastType = "ok" | "error";
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

export function showToast(message: string, type: ToastType = "ok") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("admin-toast", { detail: { message, type } }));
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let n = 0;
    function onToast(e: Event) {
      const detail = (e as CustomEvent).detail as { message: string; type: ToastType };
      const id = ++n;
      setItems((x) => [...x, { id, ...detail }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3500);
    }
    window.addEventListener("admin-toast", onToast);
    return () => window.removeEventListener("admin-toast", onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {items.map((i) => (
        <div
          key={i.id}
          className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
            i.type === "ok" ? "bg-forest-600" : "bg-red-600"
          }`}
        >
          <span>{i.type === "ok" ? "✓" : "⚠"}</span>
          {i.message}
        </div>
      ))}
    </div>
  );
}
