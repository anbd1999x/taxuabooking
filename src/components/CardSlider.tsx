"use client";

import { useRef, useState } from "react";
import Image from "next/image";

/** Slider ảnh nhỏ trong thẻ dịch vụ — vuốt được, nằm trong <Link> nên chặn điều hướng khi bấm chấm. */
export function CardSlider({
  images,
  title,
}: {
  images: { url: string; alt: string | null }[];
  title: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return <div className="flex h-full items-center justify-center text-forest-300">Tà Xùa</div>;
  }

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(i);
  }
  function go(e: React.MouseEvent, i: number) {
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setActive(i);
  }

  return (
    <>
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((img, i) => (
          <div key={i} className="relative h-full w-full flex-none snap-center">
            <Image
              src={img.url}
              alt={img.alt ?? `${title} ${i + 1}`}
              fill
              sizes="(max-width: 640px) 100vw, 320px"
              className="object-cover transition duration-500 group-hover:scale-105"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ảnh ${i + 1}`}
              onClick={(e) => go(e, i)}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
            />
          ))}
        </div>
      )}
    </>
  );
}
