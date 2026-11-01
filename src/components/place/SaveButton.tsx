"use client";

import { useEffect, useState } from "react";

const KEY = "txb:saved-places";
const BORDER = "oklch(0.88 0.02 160)";

/** Nút "Lưu quán" — lưu theo thiết bị (localStorage), không cần tài khoản. */
export function SaveButton({ placeId }: { placeId: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const ids: string[] = JSON.parse(localStorage.getItem(KEY) || "[]");
      setSaved(ids.includes(placeId));
    } catch { /* bỏ qua khi localStorage không dùng được */ }
  }, [placeId]);

  function toggle() {
    setSaved((prev) => {
      const next = !prev;
      try {
        const ids: string[] = JSON.parse(localStorage.getItem(KEY) || "[]");
        const set = new Set(ids);
        if (next) set.add(placeId);
        else set.delete(placeId);
        localStorage.setItem(KEY, JSON.stringify([...set]));
      } catch { /* bỏ qua */ }
      return next;
    });
  }

  return (
    <button type="button" onClick={toggle} className="whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-sm font-bold" style={{ border: `1.5px solid ${BORDER}`, color: "oklch(0.3 0.05 160)" }}>
      {saved ? "♥ Đã lưu" : "♡ Lưu quán"}
    </button>
  );
}
