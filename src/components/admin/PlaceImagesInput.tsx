"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { showToast } from "./Toast";

/** Quản lý danh sách ảnh của quán: upload (standalone) hoặc xoá; submit qua input ẩn "images" (phân tách "|"). */
export function PlaceImagesInput({ initial }: { initial?: string | null }) {
  const [urls, setUrls] = useState<string[]>((initial ?? "").split("|").map((s) => s.trim()).filter(Boolean));
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("standalone", "1");
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Tải ảnh thất bại (mã ${res.status}).`);
        setUrls((u) => [...u, data.url]);
      }
      showToast(`Đã tải ${files.length} ảnh`, "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Tải ảnh thất bại.", "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input type="hidden" name="images" value={urls.join("|")} />
      <div className="flex flex-wrap items-center gap-2">
        {urls.map((u, i) => (
          <div key={i} className="group relative h-16 w-24 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/5">
            <Image src={u} alt={`Ảnh ${i + 1}`} fill sizes="96px" className="object-cover" />
            <button
              type="button"
              onClick={() => setUrls((x) => x.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white opacity-0 transition group-hover:opacity-100"
              aria-label="Xoá ảnh"
            >
              ×
            </button>
          </div>
        ))}
        <label className={`flex h-16 w-24 cursor-pointer items-center justify-center rounded-lg border border-dashed border-forest-300 bg-forest-50 text-xs font-semibold text-forest-700 hover:bg-forest-100 ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Đang tải…" : "+ Ảnh"}
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onChange} disabled={busy} />
        </label>
      </div>
    </div>
  );
}
