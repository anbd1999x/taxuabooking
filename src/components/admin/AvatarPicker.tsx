"use client";

import { useRef, useState } from "react";
import { showToast } from "./Toast";

/** Chọn/tải ảnh đại diện (tròn): upload qua /api/admin/upload (standalone) → điền url vào input ẩn. */
export function AvatarPicker({ name, initial }: { name: string; initial?: string | null }) {
  const [url, setUrl] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("standalone", "1");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Tải ảnh thất bại (mã ${res.status}).`);
      setUrl(data.url);
      showToast("Đã tải ảnh đại diện", "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Tải ảnh thất bại.", "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input type="hidden" name={name} value={url} />
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-forest-100 ring-1 ring-black/5">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Ảnh đại diện" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-gray-400">Chưa có ảnh</div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={`inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-forest-300 bg-forest-50 px-3 py-2 text-sm font-medium text-forest-700 hover:bg-forest-100 ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Đang tải…" : "📤 Tải ảnh"}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} disabled={busy} />
        </label>
        {url && (
          <button type="button" onClick={() => setUrl("")} className="w-fit text-xs font-semibold text-red-500 hover:underline">
            Gỡ ảnh
          </button>
        )}
      </div>
    </div>
  );
}
