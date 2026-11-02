"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "./Toast";

export interface SheetSyncItem {
  id: string;
  title: string;
  /** Kết quả lần đồng bộ gần nhất đã lưu ("9 tab · 12 phòng…" | "Lỗi: …"), null = chưa từng. */
  last: string | null;
}

type ItemState = { status: "idle" | "running" | "ok" | "error"; note: string | null };

const CONCURRENCY = 2; // mỗi homestay đã tự tải song song nhiều tab — chạy 2 nhà một để không bị Google chặn

/**
 * Nút "Đồng bộ tất cả" lịch Google Sheet cho mọi homestay có link: gọi API
 * /api/admin/sheet-sync từng nhà một (2 nhà song song), hiện tiến độ + kết quả
 * từng nhà. Tách thành nhiều request ngắn để không vượt timeout proxy.
 */
export function SheetSyncAll({ items }: { items: SheetSyncItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [states, setStates] = useState<Record<string, ItemState>>({});

  const set = (id: string, st: ItemState) => setStates((s) => ({ ...s, [id]: st }));

  async function syncOne(item: SheetSyncItem): Promise<boolean> {
    set(item.id, { status: "running", note: null });
    try {
      const res = await fetch("/api/admin/sheet-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: item.id }),
      });
      const data: {
        ok?: boolean; error?: string; summary?: string;
        unmatchedRows?: string[]; missingRooms?: string[];
      } = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const warns: string[] = [];
        if (data.unmatchedRows?.length) warns.push(`${data.unmatchedRows.length} dòng sheet không khớp`);
        if (data.missingRooms?.length) warns.push(`${data.missingRooms.length} phòng không thấy trong sheet`);
        set(item.id, { status: "ok", note: (data.summary ?? "Đã đồng bộ") + (warns.length ? ` · ⚠ ${warns.join(", ")}` : "") });
        return true;
      }
      set(item.id, { status: "error", note: data.error ?? `Lỗi HTTP ${res.status}` });
      return false;
    } catch {
      set(item.id, { status: "error", note: "Mất kết nối — thử lại sau." });
      return false;
    }
  }

  async function run() {
    if (running || items.length === 0) return;
    setRunning(true);
    setOpen(true);
    setStates(Object.fromEntries(items.map((i) => [i.id, { status: "idle", note: null } satisfies ItemState])));
    const queue = [...items];
    let ok = 0;
    const worker = async () => {
      for (;;) {
        const item = queue.shift();
        if (!item) return;
        if (await syncOne(item)) ok++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
    setRunning(false);
    const fail = items.length - ok;
    showToast(
      fail === 0 ? `✅ Đã đồng bộ ${ok}/${items.length} homestay.` : `Đồng bộ xong: ${ok} OK · ${fail} lỗi — xem chi tiết bên dưới.`,
      fail === 0 ? "ok" : "error",
    );
    router.refresh(); // cập nhật lưới lịch đang mở theo dữ liệu mới
  }

  if (items.length === 0) return null;

  const DOT: Record<ItemState["status"], string> = {
    idle: "bg-gray-300",
    running: "bg-amber-400 animate-pulse",
    ok: "bg-emerald-500",
    error: "bg-red-500",
  };
  const done = Object.values(states).filter((s) => s.status === "ok" || s.status === "error").length;

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Đồng bộ lịch Google Sheet hàng loạt</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {items.length} homestay có link sheet — kéo lịch phòng mới nhất về cho tất cả trong một lần bấm.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(open || running) && (
            <span className="text-xs text-gray-500">{running ? `Đang chạy… ${done}/${items.length}` : `Xong ${done}/${items.length}`}</span>
          )}
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-medium text-forest-700 hover:bg-forest-100/80 disabled:opacity-60"
          >
            {running ? "Đang đồng bộ…" : "⟳ Đồng bộ tất cả"}
          </button>
          {!running && (
            <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50">
              {open ? "Thu gọn" : "Chi tiết"}
            </button>
          )}
        </div>
      </div>

      {open && (
        <ul className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
          {items.map((item) => {
            const st = states[item.id] ?? { status: "idle" as const, note: null };
            return (
              <li key={item.id} className="flex items-start gap-2.5 py-2 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[st.status]}`} />
                <div className="min-w-0">
                  <span className="font-medium text-ink">{item.title}</span>
                  <span className={`ml-2 text-xs ${st.status === "error" ? "text-red-600" : "text-gray-500"}`}>
                    {st.status === "running" ? "đang đồng bộ…" : st.note ?? (st.status === "idle" ? (running ? "chờ…" : item.last ?? "") : "")}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
