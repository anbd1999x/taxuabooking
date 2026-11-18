"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Công tắc 2 chế độ kiểu "người tí hon đẩy núm" — theo claude.ai/design `Nut chuyen che do.dc.html`
 * (bản gọn): ô đang bật giãn rộng nền xanh đậm, ô còn lại thu nhỏ ở mép; núm "ĐẨY" nằm giữa hai ô,
 * nhân vật cầm cờ đẩy núm sang bên kia rồi nhảy qua đứng chờ. Toàn bộ chuyển động chạy bằng rAF,
 * ghi thẳng vào style (không re-render).
 */
export interface PushOption<T extends string> {
  k: T;
  name: string;
  n: number | string;
}

const G = "oklch(0.29 0.055 160)";
const C = 139; // bề rộng ô thu nhỏ (tính cả nửa núm)
const K = 40; // bề rộng núm
const S = 0.85; // tỉ lệ nhân vật
const PW = 34 * S;
const PAD = 5;
const SLOW = 1.5; // hệ số làm chậm cảnh đẩy núm so với thiết kế gốc
const STAR = "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
const FLAG_L = "polygon(9% 50%, 0 0, 100% 0, 100% 100%, 0 100%)";
const FLAG_R = "polygon(0 0, 100% 0, 91% 50%, 100% 100%, 0 100%)";

export function PushSwitch<T extends string>({
  value,
  onChange,
  left,
  right,
  ariaLabel,
  flag,
  pushLabel,
  tip,
}: {
  value: T;
  onChange: (v: T) => void;
  left: PushOption<T>;
  right: PushOption<T>;
  ariaLabel: string;
  /** Chữ trên lá cờ. */
  flag: string;
  /** Chữ trên núm (vd "ĐẨY"). */
  pushLabel: string;
  /** Tooltip của núm, nhận tên chế độ sẽ chuyển sang. */
  tip: (name: string) => string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLButtonElement>(null);
  const personRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lRef = useRef<HTMLDivElement>(null);
  const rRef = useRef<HTMLDivElement>(null);
  const flagRef = useRef<HTMLDivElement>(null);
  const capeRef = useRef<HTMLDivElement>(null);
  const poleRef = useRef<HTMLDivElement>(null);
  const armRef = useRef<HTMLDivElement>(null);

  // p: 1 = ô PHẢI đang bật (núm nằm bên trái), 0 = ô TRÁI đang bật.
  const [initP] = useState(() => (value === right.k ? 1 : 0)); // vị trí lúc mount (cho style SSR)
  const anim = useRef<{ p: number; face: number; seq: { t0: number; from: number; to: number } | null; hop: number | null; reduce: boolean }>({
    p: initP,
    face: initP ? 1 : -1,
    seq: null,
    hop: null,
    reduce: false,
  });

  // Đổi chế độ ⇒ chạy cảnh đẩy núm (giảm chuyển động ⇒ nhảy thẳng tới đích).
  useEffect(() => {
    const a = anim.current;
    const to = value === right.k ? 1 : 0;
    const cur = a.seq ? a.seq.to : a.p;
    if (cur === to) return;
    if (a.reduce) { a.p = to; a.face = to ? 1 : -1; a.seq = null; return; }
    a.seq = { t0: performance.now(), from: a.p, to };
  }, [value, right.k]);

  useEffect(() => {
    const a = anim.current;
    a.reduce = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    const eio = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    const lerp = (x: number, y: number, k: number) => x + (y - x) * k;
    const cl = (v: number) => Math.max(0, Math.min(1, v));
    const setPanel = (el: HTMLElement, on: number) => {
      const d = el.querySelector<HTMLElement>("[data-dark]");
      const f = el.querySelector<HTMLElement>("[data-full]");
      const m = el.querySelector<HTMLElement>("[data-mini]");
      if (d) d.style.opacity = String(on);
      if (f) f.style.opacity = String(cl((on - 0.45) / 0.55));
      if (m) m.style.opacity = String(cl((0.55 - on) / 0.55));
    };
    let raf = 0;
    const loop = (now: number) => {
      const tr = trackRef.current, kn = knobRef.current, pe = personRef.current, bo = bodyRef.current, L = lRef.current, R = rRef.current;
      if (tr && kn && pe && bo && L && R) {
        const t = now / 1000, W = tr.offsetWidth, r = K / 2;
        const kx = (p: number) => C + (1 - p) * (W - 2 * C);
        const pos = (p: number, f: number) => Math.max(0, Math.min(W - PW, f === 1 ? kx(p) - r - PW + 4 * S : kx(p) + r - 4 * S));
        let p = a.p, face = a.face, x = 0, y = 0, lean = 0, legA = 0, legS = 0, nud = 0, arm = 0;
        if (a.seq) {
          const e = (now - a.seq.t0) / 1000 / SLOW, dir = a.seq.to < a.seq.from ? 1 : -1;
          if (e < 0.25) { face = dir; x = pos(a.seq.from, dir); lean = 10 * (e / 0.25); legA = 20; }
          else if (e < 1.15) { const k = eio((e - 0.25) / 0.9); p = lerp(a.seq.from, a.seq.to, k); face = dir; x = pos(p, dir); lean = 16; legA = 32; legS = 22; }
          else if (e < 1.6) { const k = (e - 1.15) / 0.45; p = a.seq.to; x = lerp(pos(p, dir), pos(p, -dir), eio(k)); y = -Math.sin(Math.PI * k) * 46 * S; face = k < 0.5 ? dir : -dir; legA = 30; arm = -40; }
          else { a.p = a.seq.to; a.face = -dir; a.seq = null; p = a.p; face = a.face; x = pos(p, face); }
        } else {
          x = pos(p, face);
          if (!a.reduce) {
            const s = t % 2.4, inten = s < 1.1 ? Math.sin((Math.PI * s) / 1.1) : 0;
            lean = 4 + inten * 14; legA = inten * 24; legS = 15; nud = inten * 3 * face;
          }
          if (a.hop === -1) a.hop = now; // -1 = vừa được yêu cầu nhảy, lấy mốc ở khung hình này
          if (a.hop) { const k = (now - a.hop) / 420; if (k >= 1) a.hop = null; else { y = -Math.sin(Math.PI * k) * 22 * S; arm = -50; lean = 0; } }
        }
        const k0 = kx(p), rl = k0 + 3;
        L.style.left = `${PAD}px`; L.style.width = `${k0 - PAD - 3}px`;
        R.style.left = `${rl}px`; R.style.width = `${W - PAD - rl}px`;
        setPanel(L, 1 - p); setPanel(R, p);
        kn.style.left = "0px"; kn.style.transform = `translateX(${k0 - r + nud}px)`;
        pe.style.transform = `translate(${x}px, ${y}px)`; pe.style.opacity = "1";
        bo.style.transform = `scaleX(${face}) rotate(${lean}deg)`;
        const PO = poleRef.current, FL = flagRef.current, CA = capeRef.current, AR = armRef.current;
        if (PO) PO.style.left = `${face === 1 ? 4 : 27}px`;
        if (FL && FL.dataset.side !== String(face)) {
          FL.dataset.side = String(face);
          const l1 = face === 1;
          FL.style.left = l1 ? "auto" : "2px"; FL.style.right = l1 ? "2px" : "auto";
          FL.style.transformOrigin = l1 ? "100% 50%" : "0 50%";
          FL.style.clipPath = l1 ? FLAG_L : FLAG_R;
          FL.style.paddingLeft = l1 ? "7px" : "0"; FL.style.paddingRight = l1 ? "0" : "7px";
        }
        const wv = a.reduce ? 0 : 1;
        if (FL) FL.style.transform = `skewY(${-face * Math.sin(t * 5) * 6 * wv}deg) scaleX(${0.94 + Math.sin(t * 3.3) * 0.06 * wv + (legS ? 0.04 : 0)})`;
        if (CA) CA.style.transform = `rotate(${8 + lean * 0.9 + Math.sin(t * 6) * 5 * wv + (legS ? 10 : 0)}deg) skewY(${Math.sin(t * 7) * 4 * wv}deg)`;
        if (AR) AR.style.transform = `rotate(${arm}deg)`;
        const legs = bo.querySelectorAll<HTMLElement>("[data-leg]"), sw = Math.sin(t * legS) * legA;
        if (legs[0]) legs[0].style.transform = `rotate(${legS ? sw : legA}deg)`;
        if (legs[1]) legs[1].style.transform = `rotate(${legS ? -sw : -legA * 0.6}deg)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pick = (to: T) => {
    const a = anim.current;
    if (a.seq) return; // đang đẩy dở
    onChange(to);
  };
  const other = value === right.k ? left : right;
  // Bấm BẤT KỲ đâu trên thanh (kể cả ô đang bật) đều chuyển sang chế độ còn lại — không cần nhắm đúng núm.
  const toggle = () => pick(other.k);

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      onClick={toggle}
      className="relative h-[58px] w-full cursor-pointer select-none rounded-[20px] bg-[oklch(0.955_0.012_155)] shadow-[inset_0_1px_3px_oklch(0.2_0.03_160_/.1)]"
    >
      {/* Hai ô: vị trí ban đầu (SSR) theo initP — sau đó vòng rAF tự ghi đè theo bề rộng thật. */}
      {([{ o: left, side: "left", ref: lRef }, { o: right, side: "right", ref: rRef }] as const).map(({ o, side, ref }) => {
        const on0 = (side === "right") === Boolean(initP);
        const left0 = side === "left" ? `${PAD}px` : initP ? `${C + 3}px` : `calc(100% - ${C - 3}px)`;
        const w0 = on0 ? `calc(100% - ${C + 3 + PAD}px)` : `${C - 3 - PAD}px`;
        return (
          <div
            key={side}
            ref={ref}
            role="tab"
            tabIndex={0}
            aria-selected={value === o.k}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
            className="absolute cursor-pointer overflow-hidden rounded-[15px] bg-[oklch(0.93_0.025_155)]"
            style={{ top: PAD, bottom: PAD, left: left0, width: w0 }}
          >
            <div data-dark="1" className="absolute inset-0" style={{ background: G, opacity: on0 ? 1 : 0 }} />
            <div data-full="1" className="absolute inset-0 flex items-center justify-center text-center text-white" style={{ padding: `0 ${K / 2 + 12}px`, opacity: on0 ? 1 : 0 }}>
              <span className="flex items-center gap-1.5 whitespace-nowrap text-[15px] font-extrabold">
                {o.name}
                <span className="rounded-full bg-[oklch(0.68_0.18_45)] px-[7px] py-0.5 text-[11px] font-extrabold text-white">{o.n}</span>
              </span>
            </div>
            <div
              data-mini="1"
              className="absolute bottom-0 top-0 flex flex-col justify-center gap-0.5 px-2.5 text-[oklch(0.3_0.06_158)]"
              style={{ [side]: 0, alignItems: side === "left" ? "flex-start" : "flex-end", opacity: on0 ? 0 : 1 }}
            >
              <span className="whitespace-nowrap text-[12px] font-extrabold">{o.name}</span>
              <span className="rounded-full bg-white px-1.5 py-px text-[10px] font-extrabold text-[oklch(0.4_0.04_160)]">{o.n}</span>
            </div>
          </div>
        );
      })}

      <button
        ref={knobRef}
        type="button"
        title={tip(other.name)}
        aria-label={tip(other.name)}
        className="absolute z-[2] flex cursor-pointer flex-col items-center justify-center rounded-full bg-white p-0 will-change-transform"
        style={{
          top: PAD, bottom: PAD, width: K,
          left: initP ? C - K / 2 : `calc(100% - ${C + K / 2}px)`,
          border: `2.5px solid ${G}`,
          boxShadow: "0 8px 18px -8px oklch(0.2 0.05 160 / .6), inset 0 -3px 0 oklch(0.92 0.02 155)",
        }}
      >
        <span className="text-[15px] font-extrabold leading-none text-[oklch(0.62_0.18_42)]">{value === right.k ? "→" : "←"}</span>
        <span className="text-[8px] font-extrabold tracking-[0.08em]" style={{ color: G }}>{pushLabel}</span>
      </button>

      {/* Nhân vật cầm cờ (bấm vào thì nhảy) */}
      <div
        ref={personRef}
        aria-hidden="true"
        onClick={(e) => { e.stopPropagation(); anim.current.hop = -1; }}
        className="absolute left-0 z-[3] cursor-pointer will-change-transform"
        style={{ bottom: 6, width: PW, height: 52 * S, transform: `translate(${initP ? C - K / 2 - PW + 4 * S : 0}px, 0)`, opacity: initP ? 1 : 0 }}
      >
        <div className="absolute bottom-0 left-0 h-[52px] w-[34px]" style={{ transform: `scale(${S})`, transformOrigin: "0 100%" }}>
          <div className="absolute rounded-[50%]" style={{ left: 5, bottom: -3, width: 26, height: 6, background: "oklch(0.2 0.03 160 / .18)" }} />
          <div ref={poleRef} className="absolute z-[1] rounded-[2px]" style={{ left: 4, bottom: 14, width: 2.5, height: 62, background: "oklch(0.45 0.06 50)" }}>
            <div
              ref={flagRef}
              className="absolute top-0 flex items-center justify-center"
              style={{ right: 2, width: 64, height: 20, transformOrigin: "100% 50%", background: "oklch(0.68 0.18 45)", clipPath: FLAG_L, paddingLeft: 7, boxShadow: "inset 0 -2px 0 oklch(0.6 0.17 42)" }}
            >
              <span className="block whitespace-nowrap text-[8px] font-extrabold text-white">{flag}</span>
            </div>
          </div>
          <div ref={bodyRef} className="absolute inset-0" style={{ transformOrigin: "17px 100%" }}>
            <div ref={capeRef} className="absolute" style={{ left: 0, bottom: 7, width: 17, height: 21, transformOrigin: "100% 0", background: "oklch(0.55 0.21 27)", borderRadius: "2px 2px 3px 8px", boxShadow: "inset -2px 0 0 oklch(0.47 0.19 27)" }}>
              <div className="absolute" style={{ left: 3, top: 6, width: 9, height: 9, background: "oklch(0.88 0.17 95)", clipPath: STAR }} />
            </div>
            <div data-leg="1" className="absolute rounded-[2px]" style={{ left: 12, bottom: 0, width: 4.5, height: 11, background: "oklch(0.3 0.04 250)", transformOrigin: "50% 0" }} />
            <div data-leg="2" className="absolute rounded-[2px]" style={{ left: 18, bottom: 0, width: 4.5, height: 11, background: "oklch(0.3 0.04 250)", transformOrigin: "50% 0" }} />
            <div className="absolute" style={{ left: 10, bottom: 9, width: 16, height: 15, borderRadius: "7px 7px 4px 4px", background: "oklch(0.58 0.21 27)" }}>
              <div className="absolute" style={{ left: 5, top: 3, width: 7, height: 7, background: "oklch(0.88 0.17 95)", clipPath: STAR }} />
            </div>
            <div className="absolute rounded-[2px]" style={{ left: 4, bottom: 17, width: 8, height: 4, background: "oklch(0.5 0.2 27)" }} />
            <div ref={armRef} className="absolute rounded-[2px]" style={{ left: 21, bottom: 15, width: 12, height: 4.5, background: "oklch(0.5 0.2 27)", transformOrigin: "0 50%" }}>
              <div className="absolute rounded-full" style={{ right: -2, top: -1, width: 6, height: 6, background: "oklch(0.86 0.06 60)" }} />
            </div>
            <div className="absolute rounded-full" style={{ left: 8, bottom: 22, width: 19, height: 19, background: "oklch(0.87 0.06 60)" }} />
            <div className="absolute rounded-full" style={{ left: 21, bottom: 30, width: 3, height: 3.5, background: "oklch(0.22 0.03 160)" }} />
            <div className="absolute rounded-full" style={{ left: 21, bottom: 25, width: 5, height: 3, background: "oklch(0.78 0.1 20)" }} />
            <div className="absolute" style={{ left: 7, bottom: 35, width: 21, height: 11, borderRadius: "11px 11px 2px 2px", background: "oklch(0.55 0.21 27)" }}>
              <div className="absolute" style={{ left: 7, top: 2, width: 7, height: 7, background: "oklch(0.88 0.17 95)", clipPath: STAR }} />
            </div>
            <div className="absolute rounded-[2px]" style={{ left: 5, bottom: 33, width: 27, height: 3.5, background: "oklch(0.47 0.19 27)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
