"use client";

import Image from "next/image";
import { useRef, useState } from "react";

export interface MediaItem {
  url: string;
  video: boolean;
}

/** Khung ảnh/video vuốt ngang (scroll-snap) cho thẻ địa điểm trên trang lịch trình. */
export function MediaSlider({ items, name }: { items: MediaItem[]; name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const many = items.length > 1;

  function onScroll() {
    const el = box.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i === idx) return;
    setIdx(i);
    // rời khỏi video thì dừng phát
    el.querySelectorAll("video").forEach((v) => v.pause());
  }

  function go(dir: number) {
    const el = box.current;
    if (!el) return;
    const i = (idx + dir + items.length) % items.length;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  const ARROW = "absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-base font-bold text-white transition hover:bg-black/65";

  return (
    <>
      <div
        ref={box}
        onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((m, i) => (
          <div key={`${m.url}-${i}`} className="relative h-full w-full flex-none snap-center bg-black">
            {m.video ? (
              <video src={`${m.url}#t=0.1`} controls playsInline preload="metadata" className="h-full w-full object-cover" />
            ) : (
              <Image src={m.url} alt={i ? `${name} ${i + 1}` : name} fill sizes="(max-width:640px) 100vw, 360px" className="object-cover" />
            )}
          </div>
        ))}
      </div>
      {many && (
        <>
          <button type="button" aria-label="Ảnh trước" onClick={() => go(-1)} className={`${ARROW} left-2`}>‹</button>
          <button type="button" aria-label="Ảnh sau" onClick={() => go(1)} className={`${ARROW} right-2`}>›</button>
          {/* video có thanh điều khiển ở đáy → chỉ hiện bộ đếm khi đang xem ảnh */}
          {!items[idx]?.video && (
            <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">
              {idx + 1}/{items.length}
              {items.some((m) => m.video) ? " · có video" : ""}
            </span>
          )}
        </>
      )}
    </>
  );
}
