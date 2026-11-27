"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";

export interface Slide {
  url: string;
  /** Nhãn góc ảnh (vd tên hạng phòng khi phương án ghép nhiều hạng). */
  label?: string;
}

/**
 * Ảnh thẻ dạng SLIDE — khách lướt xem ảnh phòng ngay trên thẻ, không cần mở "Xem phòng".
 * - Chỉ dựng ảnh đã lướt tới (+1 ảnh kế khi khách rê / chạm thẻ) ⇒ lần đầu mở trang tải đúng 1 ảnh/thẻ như cũ,
 *   HTML không phình (không in sẵn 8 thẻ <img>).
 * - `swipe=false`: chỉ đổi ảnh bằng mũi tên (dùng khi thẻ nằm trong một băng trượt ngang khác — tránh hai lớp vuốt đè nhau).
 * - Chạm / bấm ảnh ⇒ `onOpen(i)` (mở gallery đầy đủ); vuốt không phát sinh click.
 */
export function CardSlides({
  slides,
  alt,
  sizes,
  onOpen,
  swipe = true,
  small = false,
  empty,
  counterClass,
  dotsClass = "bottom-11",
  onWarm,
  children,
}: {
  slides: Slide[];
  alt: string;
  sizes: string;
  onOpen?: (i: number) => void;
  swipe?: boolean;
  small?: boolean;
  empty?: ReactNode;
  /** Vị trí + kiểu badge đếm "2/8" (mặc định góc dưới phải). */
  counterClass?: string;
  /** Vị trí hàng chấm (mặc định chừa chỗ cho hàng badge đáy thẻ). */
  dotsClass?: string;
  /** Gọi 1 lần khi khách rê / chạm thẻ — dùng nạp danh sách ảnh lười (slide url "" = ô chờ). */
  onWarm?: () => void;
  /** Lớp phủ (badge…) — nên đặt pointer-events-none. */
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [reached, setReached] = useState(0); // ảnh xa nhất đã dựng
  const [warm, setWarmState] = useState(false); // khách đã rê / chạm ⇒ tải sẵn ảnh kế
  const setWarm = () => {
    if (warm) return;
    setWarmState(true);
    onWarm?.();
  };
  const n = slides.length;
  const cur = Math.min(idx, Math.max(0, n - 1)); // danh sách ảnh đổi (đổi căn) ⇒ kẹp vị trí

  const go = (i: number) => {
    const el = ref.current;
    if (!el || n === 0) return;
    const to = (i + n) % n;
    setReached((r) => Math.max(r, to));
    el.scrollTo({ left: to * el.clientWidth, behavior: Math.abs(to - cur) > 1 ? "auto" : "smooth" });
    if (!swipe) setIdx(to);
  };

  if (n === 0) return <>{empty}{children}</>;

  const arrow = small
    ? "h-6 w-6 text-sm"
    : "h-8 w-8 text-lg";
  const btn = `pointer-events-auto flex items-center justify-center rounded-full bg-white/90 font-extrabold text-[oklch(0.3_0.04_160)] shadow transition hover:bg-white ${arrow}`;
  // Mũi tên: máy có chuột hiện khi rê; cảm ứng luôn hiện ở chế độ không vuốt, còn chế độ vuốt thì ẩn (vuốt là đủ).
  const arrowVis = swipe ? "opacity-0 [@media(hover:hover)]:group-hover/sl:opacity-100" : "opacity-100";

  return (
    <div
      className="group/sl absolute inset-0"
      onPointerEnter={setWarm}
      onTouchStart={setWarm}
      onFocus={setWarm}
    >
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (i !== idx) {
            setIdx(i);
            setReached((r) => Math.max(r, i));
          }
        }}
        className={`flex h-full w-full snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${swipe ? "overflow-x-auto overscroll-x-contain" : "overflow-hidden"}`}
      >
        {slides.map((s, i) => {
          const mount = i <= reached + (warm ? 1 : 0);
          const pic = !mount ? null : s.url ? (
            <Image src={s.url} alt={i === 0 ? alt : ""} fill sizes={sizes} className="object-cover" />
          ) : (
            <span className="absolute inset-0 animate-pulse bg-[oklch(0.92_0.01_160)]" />
          );
          const cls = "relative h-full w-full flex-none snap-start snap-always bg-[oklch(0.95_0.01_160)]";
          // Không có onOpen (thẻ nằm trong <Link>) ⇒ ô ảnh là div thường, bấm ảnh đi theo link của thẻ.
          return onOpen ? (
            <button
              key={i}
              type="button"
              tabIndex={i === cur ? 0 : -1}
              onClick={() => onOpen(i)}
              aria-label={n > 1 ? `${alt} (${i + 1}/${n})` : alt}
              className={`${cls} cursor-zoom-in`}
            >
              {pic}
            </button>
          ) : (
            <div key={i} className={cls}>{pic}</div>
          );
        })}
      </div>

      {children}

      {n > 1 && (
        <>
          <span className={`pointer-events-none absolute whitespace-nowrap rounded-full bg-black/55 font-bold text-white ${counterClass ?? (small ? "bottom-1.5 right-1.5 px-2 py-0.5 text-[11px]" : "bottom-2.5 right-2.5 px-2.5 py-1 text-xs")}`}>
            {cur + 1}/{n}
          </span>
          {slides[cur]?.label && (
            <span className={`pointer-events-none absolute left-1/2 -translate-x-1/2 truncate rounded-full bg-black/55 px-2.5 py-0.5 font-bold text-white ${small ? "top-1 max-w-[90%] text-[10px]" : "top-11 max-w-[80%] text-[11px]"}`}>
              {slides[cur].label}
            </span>
          )}
          <div className={`pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between transition-opacity ${small ? "px-1" : "px-2"} ${arrowVis}`}>
            <button type="button" aria-label="‹" onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(cur - 1); }} className={btn}>‹</button>
            <button type="button" aria-label="›" onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(cur + 1); }} className={btn}>›</button>
          </div>
          {/* Chấm vị trí (≤ 8 ảnh) — nhiều hơn thì chỉ số đếm ở badge */}
          {n <= 8 && !small && (
            <div className={`pointer-events-none absolute left-0 right-0 flex justify-center gap-1 ${dotsClass}`}>
              {slides.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === cur ? "w-4 bg-white" : "w-1.5 bg-white/60"}`} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
