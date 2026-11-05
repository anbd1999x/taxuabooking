"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "./Toast";

export interface SortableRoom {
  id: string;
  name: string;
  typeName: string;
  price: string; // đã format sẵn
  color?: string;
}

type Action = (fd: FormData) => Promise<void>;

/**
 * Khu vực sắp THỨ TỰ HIỂN THỊ PHÒNG trên web (chung mọi hạng): kéo-thả (desktop)
 * hoặc nút ↑ ↓ để đổi vị trí; lưu ngay qua `reorderAction` (gán lại 0..n, không nhảy).
 */
export function SortableRooms({
  items,
  serviceId,
  reorderAction,
}: {
  items: SortableRoom[];
  serviceId: string;
  reorderAction: Action;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState(items);
  const [dragId, setDragId] = useState<string | null>(null);

  const propKey = useMemo(() => items.map((i) => i.id).join("|"), [items]);
  const propKeyRef = useRef(propKey);
  useEffect(() => {
    if (propKeyRef.current !== propKey) {
      propKeyRef.current = propKey;
      setList(items);
    }
  }, [propKey, items]);

  function persist(next: SortableRoom[]) {
    setList(next);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("serviceId", serviceId);
        fd.append("ids", JSON.stringify(next.map((i) => i.id)));
        await reorderAction(fd);
        router.refresh();
      } catch {
        showToast("Lưu thứ tự phòng thất bại.", "error");
      }
    });
  }

  function moveBy(id: string, delta: number) {
    const idx = list.findIndex((i) => i.id === id);
    const j = idx + delta;
    if (idx < 0 || j < 0 || j >= list.length) return;
    const next = [...list];
    [next[idx], next[j]] = [next[j], next[idx]];
    persist(next);
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return setDragId(null);
    const from = list.findIndex((i) => i.id === dragId);
    const to = list.findIndex((i) => i.id === targetId);
    if (from < 0 || to < 0) return setDragId(null);
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragId(null);
    persist(next);
  }

  return (
    <div className={`flex flex-col gap-1.5 ${pending ? "opacity-60" : ""}`}>
      {list.map((r, i) => (
        <div
          key={r.id}
          draggable
          onDragStart={() => setDragId(r.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(r.id)}
          onDragEnd={() => setDragId(null)}
          className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 ${
            dragId === r.id ? "border-forest-400 opacity-50" : "border-gray-200"
          }`}
        >
          <span className="cursor-grab select-none text-gray-400" title="Kéo để đổi vị trí">⠿</span>
          <span className="w-6 flex-none text-center text-xs font-bold text-gray-400">{i + 1}</span>
          {r.color && <span className="h-5 w-1.5 flex-none rounded-full" style={{ background: r.color }} />}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-ink">{r.name}</span>
            <span className="text-xs text-gray-500">{r.typeName} · {r.price}</span>
          </span>
          <span className="flex flex-none gap-1">
            <button
              type="button"
              onClick={() => moveBy(r.id, -1)}
              disabled={i === 0 || pending}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-sm font-bold text-ink disabled:opacity-30"
              title="Lên trên"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveBy(r.id, 1)}
              disabled={i === list.length - 1 || pending}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-sm font-bold text-ink disabled:opacity-30"
              title="Xuống dưới"
            >
              ↓
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
