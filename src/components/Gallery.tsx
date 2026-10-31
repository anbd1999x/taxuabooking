"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export function Gallery({
  images,
  title,
}: {
  images: { url: string; alt: string | null }[];
  title: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-forest-50 text-forest-300">
        Tà Xùa Booking
      </div>
    );
  }

  function go(i: number) {
    const track = trackRef.current;
    if (!track) return;
    const idx = Math.max(0, Math.min(images.length - 1, i));
    track.scrollTo({ left: idx * track.clientWidth, behavior: "smooth" });
    setActive(idx);
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    if (idx !== active) setActive(idx);
  }

  return (
    <div>
      <div className="relative">
        {/* Track vuốt ngang (snap) */}
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <div key={i} className="relative aspect-[16/10] w-full flex-none snap-center bg-forest-50">
              <Image
                src={img.url}
                alt={img.alt ?? `${title} ${i + 1}`}
                fill
                priority={i === 0}
                sizes="(max-width: 1024px) 100vw, 640px"
                className="object-cover"
                draggable={false}
              />
            </div>
          ))}
        </div>

        {images.length > 1 && (
          <>
            {/* Nút trái / phải (desktop) */}
            <button
              type="button"
              onClick={() => go(active - 1)}
              aria-label="Ảnh trước"
              className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-forest-800 shadow ring-1 ring-black/5 transition hover:bg-white sm:flex"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              aria-label="Ảnh sau"
              className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-forest-800 shadow ring-1 ring-black/5 transition hover:bg-white sm:flex"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" /></svg>
            </button>

            {/* Số ảnh */}
            <div className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
              {active + 1}/{images.length}
            </div>

            {/* Chấm chỉ số */}
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Tới ảnh ${i + 1}`}
                  onClick={() => go(i)}
                  className={`h-2 rounded-full transition-all ${i === active ? "w-5 bg-white" : "w-2 bg-white/60"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thu nhỏ (desktop) */}
      {images.length > 1 && (
        <div className="mt-3 hidden gap-2 overflow-x-auto pb-1 sm:flex">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              className={`relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                active === i ? "ring-forest-500" : "ring-transparent hover:ring-forest-200"
              }`}
            >
              <Image src={img.url} alt={img.alt ?? `${title} ${i + 1}`} fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
