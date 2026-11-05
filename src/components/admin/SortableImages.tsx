"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "./Toast";

export interface SortableItem {
  id: string;
  url: string;
  isCover: boolean;
  isVideo?: boolean;
  alt?: string | null;
}

type Action = (fd: FormData) => Promise<void>;

function makeFd(fields: Record<string, string>, extra: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fd;
}

/**
 * Lưới ảnh/video quản trị: GIỮ (mobile ~0.3s) hoặc KÉO (chuột) để đổi vị trí,
 * kèm nút ‹ › dự phòng + Đặt bìa + Xoá. Thứ tự mới lưu qua `reorderAction`.
 */
export function SortableImages({
  items,
  fields,
  reorderAction,
  coverAction,
  deleteAction,
  gridClass = "grid grid-cols-3 gap-2 sm:grid-cols-6",
  aspectClass = "aspect-square",
  coverLabel = "Bìa",
}: {
  items: SortableItem[];
  /** Các field chung gửi kèm mọi action (serviceId / roomTypeId / roomId...). */
  fields: Record<string, string>;
  reorderAction: Action;
  coverAction?: Action;
  deleteAction: Action;
  gridClass?: string;
  aspectClass?: string;
  coverLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState(items);
  const [dragId, setDragId] = useState<string | null>(null);
  const tileRefs = useRef(new Map<string, HTMLDivElement>());
  const press = useRef<{
    id: string;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout> | null;
    active: boolean;
    pointerId: number;
  } | null>(null);

  // Đồng bộ lại khi server trả dữ liệu mới (router.refresh sau khi lưu). Khoá gồm cả
  // cờ BÌA + url: trước đây chỉ theo thứ tự id nên "Đặt bìa" (không đổi thứ tự) không
  // hiện ra cho tới khi đổi vị trí ảnh.
  const propKey = useMemo(() => items.map((i) => `${i.id}:${i.isCover ? 1 : 0}:${i.url}`).join("|"), [items]);
  const propKeyRef = useRef(propKey);
  useEffect(() => {
    if (propKeyRef.current !== propKey) {
      propKeyRef.current = propKey;
      setList(items);
    }
  }, [propKey, items]);

  function persist(next: SortableItem[]) {
    startTransition(async () => {
      try {
        await reorderAction(makeFd(fields, { ids: JSON.stringify(next.map((i) => i.id)) }));
        router.refresh();
      } catch {
        showToast("Lưu thứ tự ảnh thất bại.", "error");
      }
    });
  }

  function moveBy(id: string, delta: number) {
    const idx = list.findIndex((i) => i.id === id);
    const j = idx + delta;
    if (idx < 0 || j < 0 || j >= list.length) return;
    const next = [...list];
    [next[idx], next[j]] = [next[j], next[idx]];
    setList(next);
    persist(next);
  }

  // ---- Kéo thả (pointer events, hỗ trợ cả chuột lẫn chạm giữ) ----
  const blockTouch = (e: TouchEvent) => e.preventDefault();

  function activateDrag(id: string) {
    setDragId(id);
    document.addEventListener("touchmove", blockTouch, { passive: false });
    if (navigator.vibrate) navigator.vibrate(10);
  }

  function endDrag(commit: boolean) {
    document.removeEventListener("touchmove", blockTouch);
    const p = press.current;
    press.current = null;
    if (p?.timer) clearTimeout(p.timer);
    setDragId(null);
    if (commit && p?.active) persist(listRef.current);
  }

  // list mới nhất cho handler document-level.
  const listRef = useRef(list);
  listRef.current = list;

  function onPointerDown(e: React.PointerEvent, id: string) {
    if (pending) return;
    // Không bắt đầu kéo từ nút bấm bên trong ô.
    if ((e.target as HTMLElement).closest("button")) return;
    const isTouch = e.pointerType === "touch";
    const start = { id, x: e.clientX, y: e.clientY, timer: null as ReturnType<typeof setTimeout> | null, active: false, pointerId: e.pointerId };
    press.current = start;
    if (isTouch) {
      start.timer = setTimeout(() => {
        if (press.current === start) {
          start.active = true;
          activateDrag(id);
        }
      }, 300);
    }

    const onMove = (ev: PointerEvent) => {
      const p = press.current;
      if (!p || ev.pointerId !== p.pointerId) return;
      const dx = ev.clientX - p.x;
      const dy = ev.clientY - p.y;
      if (!p.active) {
        const dist = Math.hypot(dx, dy);
        if (isTouch) {
          // Di chuyển trước khi giữ đủ lâu = đang cuộn trang → huỷ.
          if (dist > 10 && p.timer) {
            clearTimeout(p.timer);
            press.current = null;
            cleanup();
          }
          return;
        }
        if (dist > 6) {
          p.active = true;
          activateDrag(p.id);
        }
        return;
      }
      ev.preventDefault();
      // Tìm ô dưới con trỏ → hoán vị trong danh sách.
      const cur = listRef.current;
      const from = cur.findIndex((i) => i.id === p.id);
      if (from < 0) return;
      for (const [tid, el] of tileRefs.current) {
        if (tid === p.id) continue;
        const r = el.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
          const to = cur.findIndex((i) => i.id === tid);
          if (to >= 0 && to !== from) {
            const next = [...cur];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            setList(next);
          }
          break;
        }
      }
    };
    const onUp = (ev: PointerEvent) => {
      const p = press.current;
      if (!p || ev.pointerId !== p.pointerId) return;
      cleanup();
      endDrag(true);
    };
    const cleanup = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  function runAction(action: Action, extra: Record<string, string>) {
    startTransition(async () => {
      try {
        await action(makeFd(fields, extra));
        router.refresh();
      } catch {
        showToast("Thao tác thất bại.", "error");
      }
    });
  }

  if (list.length === 0) return null;

  return (
    <div className={`${gridClass} ${pending ? "opacity-70" : ""}`}>
      {list.map((img, idx) => (
        <div
          key={img.id}
          ref={(el) => {
            if (el) tileRefs.current.set(img.id, el);
            else tileRefs.current.delete(img.id);
          }}
          onPointerDown={(e) => onPointerDown(e, img.id)}
          className={`group relative select-none overflow-hidden rounded-xl ring-1 transition ${
            dragId === img.id ? "z-10 scale-[1.04] ring-2 ring-forest-500 shadow-xl" : "ring-black/5"
          }`}
          style={{ touchAction: dragId ? "none" : "pan-y", cursor: dragId === img.id ? "grabbing" : "grab" }}
        >
          <div className={`relative ${aspectClass} bg-black/5`}>
            {img.isVideo ? (
              <video src={img.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
            ) : (
              <Image src={img.url} alt={img.alt ?? ""} fill sizes="200px" className="pointer-events-none object-cover" draggable={false} />
            )}
          </div>
          {img.isCover && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-sunset-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {coverLabel}
            </span>
          )}
          {img.isVideo && (
            <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">▶</span>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/50 p-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
            <div className="flex gap-0.5">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => moveBy(img.id, -1)}
                className="rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-bold text-gray-700 disabled:opacity-40"
                aria-label="Chuyển lên trước"
              >
                ‹
              </button>
              <button
                type="button"
                disabled={idx === list.length - 1}
                onClick={() => moveBy(img.id, 1)}
                className="rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-bold text-gray-700 disabled:opacity-40"
                aria-label="Chuyển ra sau"
              >
                ›
              </button>
            </div>
            <div className="flex gap-0.5">
              {coverAction && !img.isCover && !img.isVideo && (
                <button
                  type="button"
                  onClick={() => {
                    // Hiện bìa mới NGAY (không chờ server), server trả về sẽ đồng bộ lại.
                    setList((cur) => cur.map((x) => ({ ...x, isCover: x.id === img.id })));
                    runAction(coverAction, { id: img.id });
                  }}
                  className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-forest-700"
                >
                  {coverLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => runAction(deleteAction, { id: img.id })}
                className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white"
              >
                Xoá
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
