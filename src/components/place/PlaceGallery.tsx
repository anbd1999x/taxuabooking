"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const BORDER = "oklch(0.92 0.01 160)";
const ACCENT = "oklch(0.68 0.18 45)";

/** Lưới ảnh (ảnh lớn + thumbnail) + dải cuộn ngang + lightbox phóng to có phím ←/→/Esc. */
export function PlaceGallery({ images, name }: { images: string[]; name: string }) {
  const [w, setW] = useState(1280);
  const [lb, setLb] = useState(-1); // chỉ số ảnh đang mở trong lightbox, -1 = đóng

  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    onR();
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  useEffect(() => {
    if (lb < 0) return;
    const onK = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLb(-1);
      else if (e.key === "ArrowRight") setLb((i) => (i + 1) % images.length);
      else if (e.key === "ArrowLeft") setLb((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onK);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onK); document.body.style.overflow = ""; };
  }, [lb, images.length]);

  if (images.length === 0) return null;

  const narrow = w < 760;
  const nThumb = narrow ? 2 : 4;
  const thumbs = images.slice(1, 1 + nThumb);
  const hiddenMore = images.length - 1 - nThumb; // số ảnh còn ẩn → badge "+N"

  const galH = narrow ? 300 : w < 980 ? 380 : 460;
  const galCols = narrow ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)";

  return (
    <>
      {/* Lưới ảnh */}
      <div className="grid gap-2 overflow-hidden rounded-[22px]" style={{ gridTemplateColumns: galCols, gridTemplateRows: "minmax(0,1fr) minmax(0,1fr)", height: galH }}>
        <button type="button" onClick={() => setLb(0)} className="relative row-span-2 min-h-0 cursor-zoom-in bg-forest-50" aria-label={`Xem ảnh ${name}`}>
          <Image src={images[0]} alt={name} fill priority sizes="(max-width:760px) 50vw, 620px" className="object-cover" />
        </button>
        {thumbs.map((src, i) => {
          const isLast = i === nThumb - 1;
          return (
            <button key={i} type="button" onClick={() => setLb(i + 1)} className="relative min-h-0 cursor-zoom-in bg-forest-50" aria-label={`Xem ảnh ${i + 2}`}>
              <Image src={src} alt={`${name} ${i + 2}`} fill sizes="(max-width:760px) 50vw, 300px" className="object-cover" />
              {isLast && hiddenMore > 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[15px] font-extrabold text-white" style={{ background: "oklch(0.15 0.03 200 / .55)" }}>
                  +{hiddenMore} ảnh
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Dải thumbnail cuộn ngang */}
      {images.length > 1 && (
        <div className="-mt-2.5 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((src, i) => (
            <button key={i} type="button" onClick={() => setLb(i)} className="relative h-[68px] w-[92px] flex-none cursor-pointer overflow-hidden rounded-xl" style={{ border: `2px solid ${lb === i ? ACCENT : "transparent"}` }} aria-label={`Ảnh ${i + 1}`}>
              <Image src={src} alt={`${name} thumbnail ${i + 1}`} fill sizes="92px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lb >= 0 && (
        <div onClick={() => setLb(-1)} className="fixed inset-0 z-[60] flex cursor-zoom-out flex-col items-center justify-center gap-3.5 p-5" style={{ background: "oklch(0.12 0.02 200 / .92)" }}>
          <div className="absolute right-5 top-4 text-sm font-bold text-white">{lb + 1} / {images.length}</div>
          {images.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); setLb((i) => (i - 1 + images.length) % images.length); }} className="absolute left-3.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[22px] text-white" style={{ background: "oklch(1 0 0 / .14)" }} aria-label="Ảnh trước">‹</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setLb((i) => (i + 1) % images.length); }} className="absolute right-3.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[22px] text-white" style={{ background: "oklch(1 0 0 / .14)" }} aria-label="Ảnh sau">›</button>
            </>
          )}
          <div onClick={(e) => e.stopPropagation()} className="relative cursor-default overflow-hidden rounded-2xl" style={{ width: "min(1100px,92vw)", height: "min(70vh,720px)" }}>
            <Image src={images[lb]} alt={`${name} ${lb + 1}`} fill sizes="92vw" className="object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

export { BORDER };
