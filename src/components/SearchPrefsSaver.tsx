"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { saveSearchPrefs } from "@/lib/search-prefs";

/**
 * Trang khách: URL có ngày / số khách (sau khi bấm tìm ở bất kỳ form nào) ⇒ ghi nhớ vào cookie
 * để trang khác tự điền (xem `src/lib/search-prefs.ts`).
 */
export function SearchPrefsSaver() {
  const sp = useSearchParams();
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const people = Number(sp.get("people") || sp.get("pax") || sp.get("adults") || 0);
  useEffect(() => {
    if (from || to || people) saveSearchPrefs({ from, to, people });
  }, [from, to, people]);
  return null;
}
