"use client";

/**
 * Ảnh ghép đầu trang chi tiết homestay (theo claude.ai/design `Chi tiet Homestay v3.dc.html`):
 * desktop 1 ảnh lớn + 4 ảnh nhỏ, điện thoại 1 lớn + 2 nhỏ; bấm ảnh / "Xem N ảnh" mở trình xem toàn màn hình.
 */
import Image from "next/image";
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n/I18nProvider";

export function StayMosaic({ images, title }: { images: { url: string; alt?: string | null }[]; title: string }) {
  const tr = useT();
  const [at, setAt] = useState<number | null>(null);
  const n = images.length;
  useEffect(() => {
    if (at == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAt(null);
      else if (e.key === "ArrowRight") setAt((i) => (i == null ? i : (i + 1) % n));
      else if (e.key === "ArrowLeft") setAt((i) => (i == null ? i : (i - 1 + n) % n));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [at, n]);
  if (!n) return null;

  // Vị trí từng ô: [mobile, desktop]; ít ảnh hơn thì ô còn lại tự giãn.
  const shown = images.slice(0, 5);
  const cell = (k: number) =>
    n === 1
      ? "col-span-full row-span-full"
      : k === 0
        ? `col-span-2 row-start-1 lg:col-span-1 lg:row-span-2 ${n === 2 ? "max-lg:row-span-1" : ""}`
        : k === 1
          ? `row-start-2 lg:row-start-1 ${n === 2 ? "col-span-2 lg:col-span-2 lg:row-span-2" : n === 3 ? "lg:col-span-2" : ""}`
          : k === 2
            ? `row-start-2 ${n === 3 ? "lg:col-span-2 lg:row-start-2" : "lg:row-start-1"}`
            : k === 3
              ? `max-lg:hidden lg:row-start-2 ${n === 4 ? "lg:col-span-2" : ""}`
              : "max-lg:hidden lg:row-start-2";

  return (
    <>
      <div className="relative">
        <div className="grid h-[340px] grid-cols-2 grid-rows-[2fr_1fr] gap-1.5 overflow-hidden rounded-[22px] lg:h-[430px] lg:grid-cols-[2fr_1fr_1fr] lg:grid-rows-2">
          {shown.map((im, k) => (
            <button key={k} type="button" onClick={() => setAt(k)} aria-label={tr("Xem ảnh {0}", [k + 1])} className={`group relative min-h-0 cursor-pointer overflow-hidden bg-[oklch(0.93_0.02_150)] ${cell(k)}`}>
              <Image src={im.url} alt={im.alt || `${title} – ${tr("ảnh {0}", [k + 1])}`} fill priority={k === 0} sizes={k === 0 ? "(max-width:1024px) 100vw, 600px" : "(max-width:1024px) 50vw, 300px"} className="object-cover transition duration-500 group-hover:scale-[1.03]" />
            </button>
          ))}
        </div>
        {n > 1 && (
          <button type="button" onClick={() => setAt(0)} className="absolute bottom-2.5 right-2.5 cursor-pointer rounded-full bg-white px-3 py-2 text-[13px] font-extrabold text-[oklch(0.22_0.03_160)] shadow-[0_6px_16px_-6px_oklch(0.2_0.03_160/.5)]">
            {tr("Xem {0} ảnh", [n])}
          </button>
        )}
      </div>

      {at != null && (
        <div onClick={() => setAt(null)} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
          <button type="button" onClick={() => setAt(null)} aria-label={tr("Đóng")} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25">×</button>
          {n > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); setAt((at - 1 + n) % n); }} aria-label={tr("Trước")} className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-3xl text-white hover:bg-white/25">‹</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setAt((at + 1) % n); }} aria-label={tr("Sau")} className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-3xl text-white hover:bg-white/25">›</button>
            </>
          )}
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-5xl flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={at} src={images[at].url} alt={images[at].alt || title} className="max-h-[80vh] max-w-full rounded-xl object-contain" />
            <span className="text-sm font-semibold text-white/90">{at + 1} / {n}</span>
          </div>
        </div>
      )}
    </>
  );
}

/** Nút "Chia sẻ": dùng bảng chia sẻ của máy nếu có, không thì chép link. */
export function ShareButton({ title }: { title: string }) {
  const tr = useT();
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }
    } catch {
      /* khách đóng bảng chia sẻ */
    }
  };
  return (
    <button type="button" onClick={share} className="cursor-pointer whitespace-nowrap rounded-full border-[1.5px] border-[oklch(0.88_0.015_160)] bg-white px-3.5 py-[9px] text-[13px] font-bold hover:border-[oklch(0.5_0.1_158)]">
      {done ? tr("Đã chép link ✓") : tr("Chia sẻ")}
    </button>
  );
}
