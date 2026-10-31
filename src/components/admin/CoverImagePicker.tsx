"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { showToast } from "./Toast";

/** Chọn/tải ảnh bìa bài viết: upload qua /api/admin/upload (standalone) → điền url vào input ẩn. */
export function CoverImagePicker({ name = "coverImage", initial }: { name?: string; initial?: string | null }) {
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
      showToast("Đã tải ảnh bìa", "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Tải ảnh thất bại.", "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      <input type="hidden" name={name} value={url} />
      <div className="relative aspect-[16/9] w-52 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5">
        {url ? (
          <Image src={url} alt="Ảnh bìa" fill sizes="208px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">Chưa có ảnh bìa</div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-forest-300 bg-forest-50 px-3 py-2 text-sm font-medium text-forest-700 hover:bg-forest-100 ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Đang tải…" : "📤 Tải ảnh bìa"}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} disabled={busy} />
        </label>
        {url && (
          <button type="button" onClick={() => setUrl("")} className="self-start text-xs font-semibold text-red-500 hover:underline">
            Gỡ ảnh
          </button>
        )}
        <p className="max-w-[220px] text-[11px] leading-relaxed text-gray-400">Ảnh ngang 16:9, hiện ở đầu bài + khi chia sẻ link (Facebook/Zalo/Google).</p>
      </div>
    </div>
  );
}
