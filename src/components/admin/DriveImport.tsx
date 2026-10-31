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
  const [prog, setProg] = useState<{ i: number; n: number; name: string } | null>(null);

  async function post(payload: Record<string, unknown>) {
    const res = await fetch("/api/admin/drive-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function run() {
    if (!url.trim()) return;
    setBusy(true);
    setProg(null);
    try {
      // Bước 1: lấy danh sách file (thư mục → nhiều file, link lẻ → 1 file).
      const list = await post({ op: "list", url: url.trim() });
      const files: { id: string; name: string }[] = Array.isArray(list.data.files) ? list.data.files : [];
      if (!list.ok || files.length === 0) {
        showToast(list.data.error ?? "Không đọc được link Drive.", "error");
        return;
      }
      // Bước 2: nhập từng file một request riêng (tránh timeout, có tiến trình).
      let okCount = 0;
      const errors: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProg({ i: i + 1, n: files.length, name: f.name || f.id.slice(0, 8) });
        const res = await post({ op: "import", fileId: f.id, name: f.name, serviceId, roomTypeId, roomId });
        if (res.ok) {
          okCount++;
          if (okCount % 5 === 0) router.refresh(); // hiện dần ảnh đã nhập
        } else {
          errors.push(`${f.name || f.id.slice(0, 8)}: ${res.data.error ?? "lỗi"}`);
        }
      }
      if (okCount > 0) {
        showToast(`Đã nhập ${okCount}/${files.length} tệp từ Drive`, "ok");
        setUrl("");
        setOpen(false);
        router.refresh();
      }
      if (errors.length > 0) {
        showToast(`Lỗi ${errors.length} tệp: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "…" : ""}`, "error");
      }
    } catch {
      showToast("Lỗi kết nối khi nhập từ Drive.", "error");
    } finally {
      setBusy(false);
      setProg(null);
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
          {busy ? (prog ? `${prog.i}/${prog.n}…` : "Đang đọc…") : "Nhập"}
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
      {prog && (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-sky-100">
            <div
              className="h-full rounded-full bg-sky-600 transition-[width] duration-200"
              style={{ width: `${Math.round(((prog.i - 1) / prog.n) * 100)}%` }}
            />
          </div>
          <p className="mt-1 truncate text-[11px] text-gray-500">
            Đang nhập {prog.i}/{prog.n} · {prog.name}
          </p>
        </div>
      )}
      <p className="text-[11px] text-gray-400">
        File/thư mục phải ở chế độ &quot;Ai có liên kết đều xem được&quot;. Thư mục nhập tối đa 30 tệp.
      </p>
    </div>
  );
}
