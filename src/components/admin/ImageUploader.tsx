"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { showToast } from "./Toast";

/** Nén ảnh phía client: co về tối đa 2000px, JPEG ~82% — ảnh điện thoại 5–12MB
 *  còn ~0.3–1MB nên tải nhanh hơn nhiều và không vượt giới hạn 5MB của server.
 *  Ảnh nhỏ (<800KB), GIF/SVG, hoặc không giải mã được → giữ nguyên tệp gốc. */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (/gif|svg/i.test(file.type) || file.size < 800 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const MAX = 2000;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // HEIC máy không giải mã được... → tải tệp gốc
  }
}

/** Upload bằng XHR để có sự kiện tiến trình (fetch không hỗ trợ upload progress). */
function uploadWithProgress(
  fd: FormData,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; status: number; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let error: string | undefined;
      if (xhr.status < 200 || xhr.status >= 300) {
        try {
          error = JSON.parse(xhr.responseText).error;
        } catch {
          error = xhr.status === 413 ? "Tệp quá lớn, vượt giới hạn máy chủ." : undefined;
        }
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, error });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, error: "Lỗi kết nối khi tải lên." });
    xhr.send(fd);
  });
}

interface Progress {
  index: number; // tệp thứ mấy (1-based)
  total: number;
  pct: number; // % tệp hiện tại
  name: string;
  stage: "compress" | "upload";
}

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
  const [prog, setProg] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = prog !== null;

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files);
    const failed: string[] = [];
    let okCount = 0;

    for (let i = 0; i < list.length; i++) {
      let file = list[i];
      setProg({ index: i + 1, total: list.length, pct: 0, name: file.name, stage: "compress" });
      file = await compressImage(file);

      const fd = new FormData();
      if (serviceId) fd.append("serviceId", serviceId);
      if (roomTypeId) fd.append("roomTypeId", roomTypeId);
      if (roomId) fd.append("roomId", roomId);
      fd.append("file", file);

      setProg({ index: i + 1, total: list.length, pct: 0, name: file.name, stage: "upload" });
      const res = await uploadWithProgress(fd, (pct) =>
        setProg({ index: i + 1, total: list.length, pct, name: file.name, stage: "upload" }),
      );
      if (res.ok) okCount++;
      else failed.push(`${file.name}${res.error ? ` (${res.error})` : ` (mã ${res.status})`}`);
    }

    if (inputRef.current) inputRef.current.value = "";
    setProg(null);
    if (okCount > 0) {
      showToast(`Đã tải lên ${okCount}/${list.length} tệp`, "ok");
      router.refresh();
    }
    if (failed.length > 0) {
      const msg = `Lỗi ${failed.length} tệp: ${failed.join(", ")}`;
      setError(msg);
      showToast(msg, "error");
    }
  }

  // % tổng = các tệp đã xong + phần trăm tệp hiện tại.
  const overall = prog ? Math.round(((prog.index - 1 + prog.pct / 100) / prog.total) * 100) : 0;

  return (
    <div className={compact ? "max-w-[260px]" : "max-w-sm"}>
      <label
        className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-forest-300 bg-forest-50 font-medium text-forest-700 hover:bg-forest-100 ${
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
        } ${busy ? "pointer-events-none opacity-70" : ""}`}
      >
        {busy ? `Đang tải ${prog!.index}/${prog!.total}…` : label}
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

      {busy && (
        <div className="mt-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-forest-100">
            <div className="h-full rounded-full bg-forest-600 transition-[width] duration-200" style={{ width: `${overall}%` }} />
          </div>
          <p className="mt-1 truncate text-[11px] text-gray-500">
            {prog!.stage === "compress" ? "Đang nén" : `${prog!.pct}%`} · {prog!.name} ({prog!.index}/{prog!.total} · tổng {overall}%)
          </p>
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
