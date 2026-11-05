"use client";

import { useEffect, useRef, useState } from "react";

/** File nhạc nền (bóc từ video, bắt đầu từ giây thứ 3, có fade đầu/cuối để lặp mượt). */
const SRC = "/audio/nhac-nen.mp3";
/** Khách đã tắt nhạc → nhớ lại, lần sau vào web không tự phát. */
const MUTE_KEY = "txb-music-off";
const VOLUME = 0.35;

/**
 * Nhạc nền khi mở website + nút bật/tắt nổi góc trái dưới.
 *
 * Trình duyệt CHẶN tự phát nhạc có tiếng khi khách chưa tương tác với trang, nên:
 * thử phát ngay khi vào; bị chặn thì chờ cú chạm/bấm/gõ phím ĐẦU TIÊN rồi phát.
 * Khách bấm tắt → nhớ (localStorage), lần sau không tự phát. Ẩn tab → tạm dừng.
 */
export function BackgroundMusic() {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [off, setOff] = useState(true); // mặc định "tắt" tới khi đọc xong lựa chọn của khách

  useEffect(() => {
    let userOff = false;
    try {
      userOff = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      /* chế độ riêng tư / chặn storage → coi như chưa tắt */
    }
    setOff(userOff);
    const a = ref.current;
    if (!a || userOff) return;
    a.volume = VOLUME;

    const start = () => {
      a.play().then(
        () => setPlaying(true),
        () => {}, // vẫn bị chặn → chờ tương tác kế tiếp
      );
    };
    const onFirst = () => {
      start();
      remove();
    };
    const evts = ["pointerdown", "keydown", "touchstart"] as const;
    const remove = () => evts.forEach((e) => window.removeEventListener(e, onFirst));

    // Thử phát ngay (được phép nếu khách đã tương tác với site trước đó); không được thì chờ.
    a.play().then(
      () => setPlaying(true),
      () => evts.forEach((e) => window.addEventListener(e, onFirst, { once: true, passive: true })),
    );

    // Ẩn tab → dừng; quay lại → phát tiếp (nếu đang phát trước đó).
    let wasPlaying = false;
    const onVis = () => {
      if (document.hidden) {
        wasPlaying = !a.paused;
        a.pause();
      } else if (wasPlaying) {
        start();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      remove();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      setOff(true);
      try {
        localStorage.setItem(MUTE_KEY, "1");
      } catch {}
    } else {
      a.volume = VOLUME;
      a.play().then(() => setPlaying(true), () => {});
      setOff(false);
      try {
        localStorage.removeItem(MUTE_KEY);
      } catch {}
    }
  }

  return (
    <>
      <audio ref={ref} src={SRC} loop preload="auto" onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Tắt nhạc nền" : "Bật nhạc nền"}
        title={playing ? "Tắt nhạc nền" : off ? "Bật nhạc nền" : "Chạm vào trang để phát nhạc"}
        className="fixed bottom-[88px] left-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-forest-800/90 text-white shadow-lg ring-2 ring-white/70 backdrop-blur transition hover:bg-forest-700 lg:bottom-5 lg:left-5"
      >
        {playing ? (
          // Sóng nhạc chuyển động khi đang phát
          <span className="flex h-4 items-end gap-[3px]" aria-hidden="true">
            {[0, 0.2, 0.4, 0.1].map((d, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-white"
                style={{ height: "100%", animation: `txbEq .9s ${d}s ease-in-out infinite alternate`, transformOrigin: "bottom" }}
              />
            ))}
          </span>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
            {off && <line x1="2" y1="2" x2="22" y2="22" />}
          </svg>
        )}
      </button>
      <style>{`@keyframes txbEq{from{transform:scaleY(.25)}to{transform:scaleY(1)}}`}</style>
    </>
  );
}
