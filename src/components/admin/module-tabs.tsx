"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Tab của các module lớn (Quản lý xe máy · Quản lý phòng · Vé & đặt bàn · Gọi món QR) hiện thành MỤC CON trong menu
 * trái (AdminShell, DemoNav) thay cho thanh tab cuộn ngang. Module đang mở tự đăng ký danh sách tab (đã lọc theo vai trò,
 * kèm badge) bằng `usePublishTabs`; menu đọc bằng `useModuleTabs` và hiện dưới mục menu đang mở. Cấp 2 (`parent`) =
 * tab con của một tab (VD các mục của "Gọi món QR"), hiện thụt vào dưới đúng tab cha.
 */
export type ModTab = { key: string; label: string; badge?: number };
export type ModTabsPub = { tabs: ModTab[]; active: string; pick: (key: string) => void; parent?: string };
type State = { main: ModTabsPub | null; sub: ModTabsPub | null };

const EMPTY: State = { main: null, sub: null };
let state: State = EMPTY;
const listeners = new Set<() => void>();
function put(level: keyof State, v: ModTabsPub | null) {
  state = { ...state, [level]: v };
  listeners.forEach((f) => f());
}

export function useModuleTabs(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => EMPTY,
  );
}

/** Đăng ký tab của module đang mở lên menu trái. `parent` = đây là tab con của tab `parent` (cấp 2). */
export function usePublishTabs(tabs: ModTab[], active: string, pick: (key: string) => void, parent?: string) {
  const level: keyof State = parent ? "sub" : "main";
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });
  const sig = JSON.stringify([tabs, active, parent]);
  useEffect(() => {
    put(level, { tabs, active, parent, pick: (k) => pickRef.current(k) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đăng ký lại khi nội dung (sig) đổi
  }, [sig, level]);
  useEffect(() => () => put(level, null), [level]);
}

/** Mục con trong menu trái: tab của module (+ tab cấp 2 dưới tab đang chọn). Dùng chung AdminShell và DemoNav. */
export function ModuleSubNav({ onPick, depth = 0 }: { onPick?: () => void; depth?: number }) {
  const { main, sub } = useModuleTabs();
  if (!main || !main.tabs.length) return null;
  const go = (p: ModTabsPub, k: string) => {
    p.pick(k);
    onPick?.();
    window.scrollTo({ top: 0 });
  };
  const row = (on: boolean) =>
    `flex w-full items-center justify-between gap-2 rounded-lg py-2 pr-3 text-left text-[13px] transition ${on ? "bg-white/10 font-semibold text-white" : "text-forest-200/90 hover:bg-white/5 hover:text-white"}`;
  const badge = (n?: number) =>
    n ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-xs font-bold text-white">{n > 99 ? "99+" : n}</span> : null;
  return (
    <div className="mb-1 mt-0.5 space-y-0.5 border-l border-white/10" style={{ marginLeft: 20 + depth * 12 }}>
      {main.tabs.map((t) => {
        const on = t.key === main.active;
        return (
          <div key={t.key}>
            <button type="button" onClick={() => go(main, t.key)} className={row(on)} style={{ paddingLeft: 12 }}>
              <span className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 flex-none rounded-full ${on ? "bg-orange-400" : "bg-white/25"}`} />
                {t.label}
              </span>
              {badge(t.badge)}
            </button>
            {on && sub && sub.parent === t.key && sub.tabs.length > 0 && (
              <div className="mb-1 ml-5 space-y-0.5 border-l border-white/10">
                {sub.tabs.map((s) => (
                  <button key={s.key} type="button" onClick={() => go(sub, s.key)} className={row(s.key === sub.active)} style={{ paddingLeft: 12 }}>
                    <span>{s.label}</span>
                    {badge(s.badge)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Nhãn tab đang mở (VD "Gọi món QR · Thực đơn") — hiện ở thanh trên điện thoại để biết đang ở đâu. */
export function useActiveTabLabel(): string {
  const { main, sub } = useModuleTabs();
  if (!main) return "";
  const a = main.tabs.find((t) => t.key === main.active)?.label ?? "";
  const b = sub && sub.parent === main.active ? sub.tabs.find((t) => t.key === sub.active)?.label ?? "" : "";
  return [a, b].filter(Boolean).join(" · ");
}
