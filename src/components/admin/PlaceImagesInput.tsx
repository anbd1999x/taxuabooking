"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { showToast } from "./Toast";

/** Quản lý danh sách ảnh của quán: upload (standalone) hoặc xoá; submit qua input ẩn "images" (phân tách "|"). */
export function PlaceImagesInput({ initial }: { initial?: string | null }) {
  const [urls, setUrls] = useState<string[]>((initial ?? "").split("|").map((s) => s.trim()).filter(Boolean));
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveUrl, setDriveUrl] = useState("");
  const [driveProg, setDriveProg] = useState<string | null>(null);

  async function importFromDrive() {
    if (!driveUrl.trim()) return;
    setBusy(true);
    setDriveProg("Đang đọc link…");
    try {
      const post = async (payload: Record<string, unknown>) => {
        const res = await fetch("/api/admin/drive-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return { ok: res.ok, data: await res.json().catch(() => ({})) };
      };
      const list = await post({ op: "list", url: driveUrl.trim() });
      const files: { id: string; name: string }[] = Array.isArray(list.data.files) ? list.data.files : [];
      if (!list.ok || files.length === 0) {
        showToast(list.data.error ?? "Không đọc được link Drive.", "error");
        return;
      }
      let ok = 0;
      for (let i = 0; i < files.length; i++) {
        setDriveProg(`Đang nhập ${i + 1}/${files.length}…`);
        const r = await post({ op: "import", fileId: files[i].id, name: files[i].name, standalone: true });
        if (r.ok && r.data.url) {
          ok++;
          setUrls((u) => [...u, r.data.url]);
        }
      }
      showToast(`Đã nhập ${ok}/${files.length} ảnh từ Drive`, ok > 0 ? "ok" : "error");
      if (ok > 0) {
        setDriveUrl("");
        setDriveOpen(false);
      }
    } catch {
      showToast("Lỗi kết nối khi nhập từ Drive.", "error");
    } finally {
      setBusy(false);
      setDriveProg(null);
    }
  }

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
          {busy && !driveProg ? "Đang tải…" : "+ Ảnh"}
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onChange} disabled={busy} />
        </label>
        <button
          type="button"
          onClick={() => setDriveOpen((o) => !o)}
          disabled={busy}
          className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-sky-300 bg-sky-50 text-center text-xs font-semibold leading-tight text-sky-700 hover:bg-sky-100 disabled:opacity-60"
        >
          ☁️ Từ Drive
        </button>
      </div>

      {driveOpen && (
        <div className="mt-2 flex max-w-md flex-col gap-1.5">
          <div className="flex gap-1.5">
            <input
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="Dán link file hoặc thư mục Drive (công khai)"
              disabled={busy}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); importFromDrive(); } }}
              className="min-w-0 flex-1 rounded-lg border border-sky-200 px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={importFromDrive}
              disabled={busy || !driveUrl.trim()}
              className="whitespace-nowrap rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {driveProg ?? "Nhập"}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">Drive phải ở chế độ &quot;Ai có liên kết đều xem được&quot;.</p>
        </div>
      )}
    </div>
  );
}
