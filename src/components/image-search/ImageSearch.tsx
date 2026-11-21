"use client";

/**
 * TÌM THEO ẢNH — phần giao diện dùng chung cho trang /homestay và /combo (gợi ý + tự chọn).
 * Gửi ảnh (đã thu nhỏ trong trình duyệt) tới POST /api/homestay/image-search; server trả điểm giống theo
 * slug homestay + roomId, hoặc `reason` khi ảnh không liên quan / không nhà nào đủ giống (xem src/lib/image-search.ts).
 */

import { useRef, useState, type DragEvent } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { trackAction } from "@/components/VisitTracker";

/** Điểm giống (cosine CLIP, 0–1) + ảnh khớp nhất. */
export type ImgHit = { s: number; url: string };
export type ImgSearch = {
  preview: string;
  status: "loading" | "done" | "error";
  err?: string;
  /** theo slug homestay */
  homes: Record<string, ImgHit>;
  /** theo roomId */
  rooms: Record<string, ImgHit>;
  /** Không có kết quả vì ảnh không phải phòng / nhà / phong cảnh (unrelated) hoặc không nhà nào đủ giống (nomatch). */
  reason?: "unrelated" | "nomatch";
  /** Ảnh được nhận ra là gì (food | vehicle | person | screen | other | room | scenery). */
  kind?: string;
};

export const IMG_VIDEO_RE = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i;
/** Cosine CLIP ảnh–ảnh: ~0,5 = không liên quan, ~0,92+ = gần như cùng cảnh ⇒ quy ra % dễ hiểu. */
export const simPct = (s: number) => Math.max(0, Math.min(99, Math.round(((s - 0.5) / 0.42) * 100)));
/** Ảnh khớp dùng làm ảnh bìa thẻ (bỏ qua video). */
export const hitCover = (hit: ImgHit | null | undefined, fallback: string | null) => (hit && !IMG_VIDEO_RE.test(hit.url) ? hit.url : fallback);

/** Thu nhỏ ảnh trong trình duyệt (cạnh dài 512px, JPEG) trước khi gửi — nhanh trên 4G. Không giải mã được (vd HEIC trên Chrome) ⇒ gửi nguyên tệp. */
async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = c.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.86));
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * Trạng thái tìm theo ảnh. `onStart` chạy khi bắt đầu tìm (vd đổi sắp xếp, cuộn tới kết quả),
 * `onResult(hasResults, result)` khi có kết quả / không có kết quả.
 */
export function useImageSearch(opts: { onStart?: () => void; onResult?: (hasResults: boolean, result?: ImgSearch) => void; onClear?: () => void; track?: string } = {}) {
  const tr = useT();
  const [img, setImg] = useState<ImgSearch | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const seqRef = useRef(0);

  async function searchImage(file: File) {
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) return;
    if (file.size > 25 * 1024 * 1024) {
      setImg((p) => {
        if (p?.preview) URL.revokeObjectURL(p.preview);
        return { preview: "", status: "error", err: tr("Ảnh quá lớn (tối đa 25MB)."), homes: {}, rooms: {} };
      });
      return;
    }
    const seq = ++seqRef.current;
    const preview = URL.createObjectURL(file);
    setImg((p) => {
      if (p?.preview) URL.revokeObjectURL(p.preview);
      return { preview, status: "loading", homes: {}, rooms: {} };
    });
    opts.onStart?.();
    trackAction(opts.track ?? "Tìm homestay theo ảnh");
    try {
      const body = await shrinkImage(file);
      const r = await fetch("/api/homestay/image-search", { method: "POST", body, headers: { "content-type": body.type || "application/octet-stream" } });
      const j = await r.json().catch(() => ({}));
      if (seq !== seqRef.current) return; // khách đã chọn ảnh khác
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "");
      const res: ImgSearch = { preview, status: "done", homes: j.homes ?? {}, rooms: j.rooms ?? {}, reason: j.reason, kind: j.kind };
      setImg(res);
      opts.onResult?.(!j.reason, res);
    } catch (e) {
      if (seq !== seqRef.current) return;
      const msg = e instanceof Error && e.message ? e.message : "Chưa tìm được — thử lại sau ít phút.";
      setImg({ preview, status: "error", err: tr(msg), homes: {}, rooms: {} });
      opts.onResult?.(false);
    }
  }

  function clearImage() {
    seqRef.current++;
    setImg((p) => {
      if (p?.preview) URL.revokeObjectURL(p.preview);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
    opts.onClear?.();
  }

  /** Kéo-thả ảnh vào một vùng (ô tìm kiếm / thanh công cụ). */
  const dropProps = {
    onDragOver: (e: DragEvent) => {
      if ([...e.dataTransfer.items].some((x) => x.kind === "file")) {
        e.preventDefault();
        setDragging(true);
      }
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => {
      const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
      setDragging(false);
      if (f) {
        e.preventDefault();
        void searchImage(f);
      }
    },
  };

  /** Ô chọn tệp ẩn — đặt một lần trong component dùng hook. */
  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void searchImage(f);
        e.target.value = "";
      }}
    />
  );

  return {
    img,
    /** Có kết quả để lọc / xếp (không lỗi, không reason). */
    imgOn: img?.status === "done" && !img.reason,
    dragging,
    searchImage,
    clearImage,
    pickFile: () => fileRef.current?.click(),
    dropProps,
    fileInput,
  };
}

export function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 4h-5L7.5 6.5H5A2 2 0 0 0 3 8.5v9A2 2 0 0 0 5 19.5h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2.5L14.5 4Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

/** Lý do ảnh không liên quan — theo loại ảnh embedder nhận ra. */
const IMG_KIND_NOTE: Record<string, string> = {
  food: "Ảnh có vẻ là món ăn / đồ uống.",
  vehicle: "Ảnh có vẻ là xe cộ.",
  person: "Ảnh có vẻ là ảnh chân dung.",
  screen: "Ảnh có vẻ là ảnh chụp màn hình / văn bản.",
};

/** Dải trạng thái tìm theo ảnh (ảnh của khách + đang tìm / có N kết quả / lý do không có + Đổi ảnh / Bỏ). */
export function ImageSearchBar({ img, foundLabel, onChange, onClear }: { img: ImgSearch; /** VD "12 homestay có ảnh giống" (đã dịch) */ foundLabel: string; onChange: () => void; onClear: () => void }) {
  const tr = useT();
  const bad = img.status === "error" || Boolean(img.reason);
  const title =
    img.status === "loading" ? tr("Đang tìm homestay có ảnh giống…")
    : img.status === "error" ? tr("Chưa tìm được theo ảnh")
    : img.reason === "unrelated" ? tr("Ảnh này không giống phòng hay cảnh homestay")
    : img.reason === "nomatch" ? tr("Chưa có homestay nào giống ảnh này")
    : foundLabel;
  const sub =
    img.status === "error" ? img.err
    : img.reason === "unrelated" ? `${img.kind && IMG_KIND_NOTE[img.kind] ? tr(IMG_KIND_NOTE[img.kind]) + " " : ""}${tr("Hãy thử ảnh phòng ngủ, bồn tắm, căn nhà hoặc cảnh núi, biển mây.")}`
    : img.reason === "nomatch" ? tr("Thử một ảnh khác — bên dưới là tất cả homestay.")
    : tr("So khung cảnh, kiểu phòng, màu sắc — vẫn giữ bộ lọc ngày, số khách, giá.");
  return (
    <div className={`flex items-center gap-3 rounded-[18px] border p-2.5 pr-3 ${bad ? "border-[oklch(0.88_0.06_60)] bg-[oklch(0.97_0.03_80)]" : "border-[oklch(0.88_0.04_158)] bg-[oklch(0.97_0.02_158)]"}`}>
      <div className="relative h-14 w-14 flex-none overflow-hidden rounded-xl bg-gray-200 ring-2 ring-white">
        {img.preview && (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh blob: cục bộ của khách
          <img src={img.preview} alt={tr("Ảnh bạn chọn")} className="h-full w-full object-cover" />
        )}
        {img.status === "loading" && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-extrabold text-ink">{title}</div>
        <div className={`text-[12.5px] leading-snug ${bad ? "font-semibold text-[oklch(0.55_0.19_28)]" : "text-[oklch(0.45_0.03_160)]"}`}>{sub}</div>
      </div>
      <div className="flex flex-none flex-col gap-1.5 sm:flex-row">
        <button type="button" onClick={onChange} className="whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[12.5px] font-bold text-forest-800 ring-1 ring-forest-200 hover:bg-forest-50">{tr("Đổi ảnh")}</button>
        <button type="button" onClick={onClear} className="whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-bold text-gray-500 hover:bg-white hover:text-ink">✕ {tr("Bỏ")}</button>
      </div>
    </div>
  );
}

/** Nhãn "Giống N%" góc ảnh thẻ (ẩn khi quá ít giống). */
export function SimBadge({ s, className = "bottom-2 right-2 sm:bottom-3 sm:right-3" }: { s: number; className?: string }) {
  const tr = useT();
  const p = simPct(s);
  if (p < 30) return null;
  return (
    <span className={`pointer-events-none absolute rounded-full bg-[oklch(0.25_0.05_160_/.82)] px-2 py-0.5 text-[11px] font-extrabold text-white backdrop-blur-sm sm:px-2.5 sm:py-1 sm:text-xs ${className}`}>
      📷 {tr("Giống {0}%", [p])}
    </span>
  );
}

/** Nút "📷 Tìm theo ảnh" dạng viên (thanh công cụ kết quả combo). Nhận cả kéo-thả ảnh. */
export function ImageSearchChip({ onClick, dropProps, dragging, active }: { onClick: () => void; dropProps?: Record<string, unknown>; dragging?: boolean; active?: boolean }) {
  const tr = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      {...dropProps}
      title={tr("Gõ tên homestay, khu vực — hoặc dán, kéo-thả, bấm 📷 để tìm theo ảnh mẫu")}
      className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 py-2 text-[13px] font-extrabold transition ${
        dragging ? "border-forest-500 bg-forest-50 text-forest-800" : active ? "border-forest-700 bg-forest-700 text-white" : "border-[oklch(0.85_0.03_158)] bg-white text-forest-800 hover:border-forest-400"
      }`}
    >
      <CameraIcon className="h-4 w-4" />
      {dragging ? tr("Thả ảnh vào đây") : tr("Tìm theo ảnh")}
    </button>
  );
}
