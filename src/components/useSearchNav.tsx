"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useSyncExternalStore, useTransition } from "react";

/* ---- Store nhỏ theo dõi "đang tìm" toàn hệ thống (nhiều ô tìm dùng chung) ---- */
const activeIds = new Set<string>();
const subs = new Set<() => void>();
let snapshot = false;
function recompute() {
  const v = activeIds.size > 0;
  if (v !== snapshot) {
    snapshot = v;
    subs.forEach((f) => f());
  }
}
function setBusy(id: string, busy: boolean) {
  if (busy) activeIds.add(id);
  else activeIds.delete(id);
  recompute();
}

/**
 * Điều hướng TÌM KIẾM có loading: push/replace + refresh chạy trong transition.
 * `pending` bật suốt lúc server render lại kết quả và được gom vào store global
 * để <SearchLoadingOverlay> phủ nguyên màn hình (logo Tà Xùa xoay).
 */
export function useSearchNav() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const id = useId();

  useEffect(() => {
    setBusy(id, pending);
  }, [id, pending]);
  // Rời trang/đổi route khi còn pending → đảm bảo tắt overlay.
  useEffect(() => () => setBusy(id, false), [id]);

  function go(url: string, opts?: { replace?: boolean; refresh?: boolean }) {
    startTransition(() => {
      if (opts?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
      if (opts?.refresh !== false) router.refresh();
    });
  }

  return { pending, go };
}

/** Lớp phủ toàn màn hình + logo Tà Xùa Booking xoay — hiện khi bất kỳ ô tìm nào đang tải. */
export function SearchLoadingOverlay() {
  const busy = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => snapshot,
    () => false,
  );
  if (!busy) return null;
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5"
      style={{ background: "oklch(1 0 0 / .72)", backdropFilter: "blur(4px)", animation: "txfade .18s ease" }}
    >
      <style>{`@keyframes txspin{to{transform:rotate(360deg)}}@keyframes txfade{from{opacity:0}to{opacity:1}}`}</style>
      <div className="relative h-[72px] w-[72px]">
        {/* Vòng xoay thương hiệu quanh logo */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: "4px solid oklch(0.9 0.03 160)",
            borderTopColor: "oklch(0.68 0.18 45)",
            borderRightColor: "oklch(0.35 0.08 160)",
            animation: "txspin .8s linear infinite",
          }}
        />
        {/* Logo TX đứng yên ở giữa cho dễ đọc */}
        <div
          className="absolute inset-[11px] flex items-center justify-center rounded-full text-[17px] font-extrabold text-white"
          style={{ background: "oklch(0.35 0.08 160)" }}
        >
          TX
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="text-[15px] font-extrabold tracking-tight text-[oklch(0.3_0.05_160)]">
          Tà Xùa <span style={{ color: "oklch(0.68 0.18 45)" }}>Booking</span>
        </div>
        <div className="text-[13px] font-semibold text-gray-500">Đang tìm chỗ phù hợp…</div>
      </div>
    </div>
  );
}
