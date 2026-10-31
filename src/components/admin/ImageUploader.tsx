"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { showToast } from "./Toast";

export function ImageUploader({
  serviceId,
  roomTypeId,
  roomId,
  label = "📤 Tải ảnh lên",
  compact = false,
  accept = "image/*",
}: {
  serviceId?: string;
  roomTypeId?: string;
  roomId?: string;
  label?: string;
  compact?: boolean;
  accept?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        if (serviceId) fd.append("serviceId", serviceId);
        if (roomTypeId) fd.append("roomTypeId", roomTypeId);
        if (roomId) fd.append("roomId", roomId);
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "Tải ảnh thất bại.");
        }
      }
      if (inputRef.current) inputRef.current.value = "";
      showToast(`Đã tải lên ${files.length} tệp`, "ok");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Có lỗi xảy ra.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label
        className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-forest-300 bg-forest-50 font-medium text-forest-700 hover:bg-forest-100 ${
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
        }`}
      >
        {busy ? "Đang tải..." : label}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={onChange}
          disabled={busy}
        />
      </label>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
