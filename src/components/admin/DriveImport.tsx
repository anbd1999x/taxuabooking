"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "./Toast";

/** Nhập ảnh/video từ Google Drive: dán link 1 file hoặc cả thư mục công khai. */
export function DriveImport({
  serviceId,
  roomTypeId,
  roomId,
  compact = false,
}: {
  serviceId?: string;
  roomTypeId?: string;
  roomId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/drive-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), serviceId, roomTypeId, roomId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok > 0) {
        showToast(`Đã nhập ${data.ok}/${data.total} tệp từ Drive`, "ok");
        setUrl("");
        setOpen(false);
        router.refresh();
      }
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        showToast(`Lỗi: ${data.errors.slice(0, 3).join("; ")}${data.errors.length > 3 ? "…" : ""}`, "error");
      } else if (!res.ok && !data.ok) {
        showToast(data.error ?? `Nhập từ Drive thất bại (mã ${res.status}).`, "error");
      }
    } catch {
      showToast("Lỗi kết nối khi nhập từ Drive.", "error");
    } finally {
      setBusy(false);
    }
  }

  const btnCls = `inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-sky-300 bg-sky-50 font-medium text-sky-700 hover:bg-sky-100 ${
    compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
  }`;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnCls}>
        ☁️ Từ Google Drive
      </button>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-1.5">
      <div className="flex gap-1.5">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Dán link file hoặc thư mục Drive (công khai)"
          className="min-w-0 flex-1 rounded-xl border border-sky-200 px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
          disabled={busy}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }}
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || !url.trim()}
          className="whitespace-nowrap rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy ? "Đang nhập…" : "Nhập"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setUrl(""); }}
          disabled={busy}
          className="rounded-xl px-2 text-sm text-gray-400 hover:bg-gray-100"
          aria-label="Đóng"
        >
          ×
        </button>
      </div>
      <p className="text-[11px] text-gray-400">
        File/thư mục phải ở chế độ &quot;Ai có liên kết đều xem được&quot;. Thư mục nhập tối đa 30 tệp.
      </p>
    </div>
  );
}
