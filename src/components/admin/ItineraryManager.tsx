"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "./Toast";
import { saveItinerary } from "@/app/admin/itinerary/actions";
import { CAT_LABEL, UNIT_LABEL, type CostUnit, type FeaturedKey, type Incl, type ItineraryConfig, type ItPlan, type ItStop } from "@/lib/itinerary";
import { ItineraryCostSettings, MoneyInput } from "./ItineraryCostSettings";

export interface PlaceOption {
  id: string;
  kind: FeaturedKey;
  name: string;
  area: string;
  published: boolean;
  price: string; // giá tham khảo nhập ở trang địa điểm (chữ tự do)
}

const DAY_COLORS = ["oklch(0.66 0.17 45)", "oklch(0.52 0.13 155)", "oklch(0.52 0.13 250)"];
const KIND_LABEL: Record<FeaturedKey, string> = { checkin: "Điểm check-in", cafe: "Quán cafe", food: "Nhà hàng & quán ăn" };
const KINDS: FeaturedKey[] = ["checkin", "cafe", "food"];
const INPUT = "min-w-0 rounded-[10px] border-[1.5px] border-gray-200 bg-white px-2.5 py-2 text-sm focus:border-forest-500 focus:outline-none";
const ICON_BTN = "flex h-[30px] w-[28px] flex-none items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30";
const PILL = "whitespace-nowrap rounded-full border-[1.5px] border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50";

const toMin = (t: string) => {
  const [a, b] = (t || "0:0").split(":").map(Number);
  return (a || 0) * 60 + (b || 0);
};
const newStop = (o: Partial<ItStop> = {}): ItStop => ({ time: "", end: "", placeId: null, name: "", title: "", note: "", cost: 0, unit: "pp", cat: "", incl: "", subs: [], ...o });
/** "Vé ~20.000đ" → 20000, "30k" → 30000, "Miễn phí" → 0; không đọc được ⇒ null. */
function parsePrice(t: string): number | null {
  if (/miễn phí|free/i.test(t)) return 0;
  const m = t.match(/(\d[\d.,]*)\s*(k|nghìn|ngàn)?/i);
  if (!m) return null;
  let n = Number(m[1].replace(/[.,]/g, ""));
  if (m[2]) n *= 1000;
  return n >= 1000 ? n : null;
}
const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
const UNITS = Object.keys(UNIT_LABEL) as CostUnit[];
const INCLS: [Incl, string][] = [["", "Khách tự trả"], ["combo", "Trong combo"], ["free", "Không mất tiền"]];
function move<T>(arr: T[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

export function ItineraryManager({
  initial, defaults, places, saved,
}: { initial: ItineraryConfig; defaults: ItineraryConfig; places: PlaceOption[]; saved: boolean }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<ItineraryConfig>(initial);
  const [cur, setCur] = useState(0);
  const [dirty, setDirty] = useState(!saved);
  const [pending, start] = useTransition();
  const [section, setSection] = useState<"plans" | "cost" | "featured">("plans");

  // Cảnh báo khi rời trang mà chưa lưu.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const byKind = useMemo(() => {
    const m: Record<FeaturedKey, PlaceOption[]> = { checkin: [], cafe: [], food: [] };
    for (const p of places) m[p.kind].push(p);
    return m;
  }, [places]);

  const curIdx = Math.min(cur, cfg.plans.length - 1);
  const plan = cfg.plans[curIdx];

  /** Sửa cấu hình trên bản sao sâu (dữ liệu nhỏ, JSON thuần). */
  function edit(fn: (c: ItineraryConfig) => void) {
    setCfg((c) => {
      const next = JSON.parse(JSON.stringify(c)) as ItineraryConfig;
      fn(next);
      return next;
    });
    setDirty(true);
  }
  const editPlan = (fn: (p: ItPlan) => void) => edit((c) => fn(c.plans[curIdx]));

  function save() {
    start(async () => {
      const res = await saveItinerary(cfg);
      if (!res.ok) { showToast(res.error ?? "Lưu thất bại.", "error"); return; }
      setDirty(false);
      showToast("Đã lưu, trang khách cập nhật ngay", "ok");
      router.refresh();
    });
  }

  function addPlan() {
    edit((c) => c.plans.push({ id: "lt" + Date.now(), name: "Mới", sub: "", published: false, transport: "cabin", nights: 1, days: [{ label: "", title: "Ngày 1", stops: [newStop({ time: "05:30", name: "Tới Tà Xùa", note: "Xe đến nơi.", incl: "combo" })] }] }));
    setCur(cfg.plans.length);
  }
  function dupPlan() {
    edit((c) => {
      const copy = JSON.parse(JSON.stringify(c.plans[curIdx])) as ItPlan;
      copy.id = "lt" + Date.now();
      copy.name = (copy.name + " (bản sao)").slice(0, 20);
      copy.published = false;
      c.plans.push(copy);
    });
    setCur(cfg.plans.length);
  }
  function delPlan() {
    if (cfg.plans.length <= 1) { showToast("Cần giữ ít nhất 1 lịch trình", "error"); return; }
    if (!confirm(`Xoá lịch trình ${plan.name || "này"}?`)) return;
    edit((c) => c.plans.splice(curIdx, 1));
    setCur(0);
  }
  function resetAll() {
    if (!confirm("Khôi phục nội dung mặc định? Thay đổi hiện tại sẽ mất sau khi bấm Lưu.")) return;
    setCfg(JSON.parse(JSON.stringify(defaults)));
    setCur(0);
    setDirty(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">Lịch trình mẫu</h1>
          <p className="mt-1 text-sm text-gray-500">
            Nội dung trang <b>/lich-trinh</b>. Điểm check-in, quán cafe, quán ăn chọn từ danh sách thật ở{" "}
            <Link href="/admin/places" className="font-semibold text-forest-700 hover:underline">Nhà hàng, Cafe &amp; Check-in</Link>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/lich-trinh" target="_blank" className={PILL}>Xem trang khách ↗</Link>
          <button type="button" onClick={resetAll} className={PILL}>Khôi phục mặc định</button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className={`whitespace-nowrap rounded-full px-[18px] py-2 text-sm font-extrabold text-white ${dirty ? "bg-sunset-500 hover:bg-sunset-600" : "bg-forest-700"} disabled:opacity-80`}
          >
            {pending ? "Đang lưu…" : dirty ? "Lưu thay đổi" : "Đã lưu"}
          </button>
        </div>
      </div>

      {!saved && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800 ring-1 ring-amber-200">
          Đang hiển thị nội dung mặc định (chưa lưu lần nào). Bấm <b>Lưu thay đổi</b> để chốt.
        </div>
      )}

      <div className="inline-flex gap-1 self-start rounded-xl bg-gray-100 p-1">
        {([["plans", "Lịch trình & giá từng điểm"], ["cost", "Bảng giá xe & phòng"], ["featured", "Địa điểm nổi bật & lưu ý"]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setSection(k)} className={`rounded-lg px-3.5 py-2 text-sm font-bold ${section === k ? "bg-white text-forest-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {section === "plans" && plan && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {cfg.plans.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setCur(i)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-[14px] border-[1.5px] px-4 py-2.5 text-sm font-extrabold ${i === curIdx ? "border-forest-800 bg-forest-800 text-white" : "border-gray-200 bg-white text-gray-700"}`}
              >
                {p.name || "Chưa đặt tên"}
                <span className={`rounded-full px-[7px] py-0.5 text-[11px] font-bold ${p.published ? "bg-forest-100 text-forest-700" : "bg-gray-200 text-gray-600"}`}>{p.published ? "Hiện" : "Ẩn"}</span>
              </button>
            ))}
            <button type="button" onClick={addPlan} className="whitespace-nowrap rounded-[14px] border-[1.5px] border-dashed border-gray-300 px-3.5 py-2.5 text-sm font-bold text-gray-600 hover:bg-white">
              + Thêm lịch trình
            </button>
          </div>

          <div className="grid gap-2.5 rounded-[18px] border border-gray-200 bg-white p-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">Tên ngắn (tab)
              <input value={plan.name} maxLength={20} onChange={(e) => editPlan((p) => { p.name = e.target.value; })} placeholder="2N1Đ" className={`${INPUT} text-[15px] font-bold`} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">Mô tả ngắn
              <input value={plan.sub} maxLength={200} onChange={(e) => editPlan((p) => { p.sub = e.target.value; })} placeholder="Xe cabin đêm thứ 6, về chiều chủ nhật…" className={INPUT} />
            </label>
            <div className="flex flex-wrap gap-2.5 sm:col-span-2">
              <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">Cách đi
                <select value={plan.transport} onChange={(e) => editPlan((p) => { p.transport = e.target.value as ItPlan["transport"]; })} className={`${INPUT} font-semibold`}>
                  <option value="cabin">{cfg.cost.transports.cabin.name} (xe cabin)</option>
                  <option value="limo">{cfg.cost.transports.limo.name} (limousine)</option>
                </select>
              </label>
              <label className="flex w-28 flex-col gap-1 text-xs font-bold text-gray-500">Số đêm homestay
                <input type="number" min={0} max={10} value={plan.nights} onChange={(e) => editPlan((p) => { p.nights = Math.max(0, Math.min(10, Math.round(Number(e.target.value) || 0))); })} className={`${INPUT} font-bold`} />
              </label>
              <p className="min-w-[220px] flex-1 self-end pb-1 text-xs text-gray-500">
                Lịch trình <b>cùng tên ngắn</b> (VD hai bản “2N1Đ”) hiện chung một tab trên trang khách, khách chọn cách đi bằng thẻ cabin / limousine. Tiền combo = giá xe × số người + giá phòng × số phòng × số đêm.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2.5 sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-gray-700">
                <input type="checkbox" checked={plan.published} onChange={(e) => editPlan((p) => { p.published = e.target.checked; })} className="h-[18px] w-[18px] accent-forest-700" />
                Hiển thị cho khách
              </label>
              <div className="flex gap-1.5">
                <button type="button" onClick={dupPlan} className="whitespace-nowrap rounded-full border-[1.5px] border-gray-200 px-3 py-2 text-[13px] font-bold text-gray-700 hover:bg-gray-50">Nhân bản</button>
                <button type="button" onClick={delPlan} className="whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-bold text-red-600 hover:bg-red-50">Xoá lịch trình</button>
              </div>
            </div>
          </div>

          {plan.days.map((d, di) => {
            const color = DAY_COLORS[di % DAY_COLORS.length];
            const unordered = d.stops.some((s, i) => i > 0 && toMin(s.time) < toMin(d.stops[i - 1].time));
            return (
              <div key={di} className="flex flex-col gap-2.5 rounded-[18px] border border-gray-200 bg-white px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <input value={d.label} maxLength={20} onChange={(e) => editPlan((p) => { p.days[di].label = e.target.value; })} placeholder={`Ngày ${di + 1}`} title="Nhãn ngày (để trống = Ngày N; VD “Đêm 0” cho đêm lên xe)" className="w-[84px] rounded-full border-0 px-2.5 py-1 text-center text-xs font-extrabold text-white placeholder:text-white/80 focus:outline-none focus:ring-2 focus:ring-forest-300" style={{ background: color }} />
                  <input value={d.title} maxLength={80} onChange={(e) => editPlan((p) => { p.days[di].title = e.target.value; })} placeholder="Tên ngày, VD: Săn mây & sống lưng" className={`${INPUT} min-w-[160px] flex-1 text-[15px] font-bold`} />
                  <span className="whitespace-nowrap text-xs font-semibold text-gray-500">{d.stops.length} điểm</span>
                  <button type="button" title="Lên" disabled={di === 0} onClick={() => editPlan((p) => move(p.days, di, -1))} className={`${ICON_BTN} border border-gray-200`}>↑</button>
                  <button type="button" title="Xuống" disabled={di === plan.days.length - 1} onClick={() => editPlan((p) => move(p.days, di, 1))} className={`${ICON_BTN} border border-gray-200`}>↓</button>
                  <button
                    type="button"
                    title="Xoá ngày"
                    onClick={() => {
                      if (plan.days.length <= 1) { showToast("Lịch trình cần ít nhất 1 ngày", "error"); return; }
                      if (confirm(`Xoá Ngày ${di + 1}?`)) editPlan((p) => { p.days.splice(di, 1); });
                    }}
                    className={`${ICON_BTN} font-extrabold !text-red-600`}
                  >✕</button>
                </div>

                <div className="flex flex-col gap-1.5">
                  {d.stops.map((s, si) => {
                    const pl = s.placeId ? byId.get(s.placeId) : undefined;
                    const badTime = !/^\d{2}:\d{2}$/.test(s.time) || (si > 0 && toMin(s.time) < toMin(d.stops[si - 1].time));
                    const setStop = (fn: (st: ItStop) => void) => editPlan((p) => fn(p.days[di].stops[si]));
                    const timeIn = (v: string, set: (x: string) => void, bad: boolean, ph: string) => (
                      <input
                        value={v}
                        inputMode="numeric"
                        maxLength={5}
                        placeholder={ph}
                        onChange={(e) => {
                          let x = e.target.value.replace(/[^\d:]/g, "");
                          if (/^\d{4}$/.test(x)) x = x.slice(0, 2) + ":" + x.slice(2);
                          set(x);
                        }}
                        className={`${INPUT} w-[62px] px-1.5 text-center font-bold ${bad ? "!border-amber-500" : ""}`}
                      />
                    );
                    const subTotal = s.subs.reduce((a, x) => a + x.cost, 0);
                    return (
                      <div key={si} className={`flex flex-col gap-1.5 rounded-xl p-2 ${si % 2 ? "bg-white ring-1 ring-gray-100" : "bg-gray-50"}`}>
                        <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-1.5 lg:grid-cols-[24px_auto_minmax(0,1.1fr)_minmax(0,1fr)_auto]">
                          <span className="mt-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold text-white" style={{ background: color }}>{si + 1}</span>
                          <div className="flex items-center gap-1">
                            {timeIn(s.time, (x) => setStop((st) => { st.time = x; }), badTime, "HH:MM")}
                            <span className="text-xs text-gray-400">–</span>
                            {timeIn(s.end, (x) => setStop((st) => { st.end = x; }), !!s.end && !/^\d{2}:\d{2}$/.test(s.end), "đến")}
                          </div>
                          <div className="col-span-3 col-start-1 flex min-w-0 flex-col gap-1 lg:col-span-1 lg:col-start-auto">
                            <select
                              value={s.placeId ?? ""}
                              onChange={(e) => setStop((st) => {
                                st.placeId = e.target.value || null;
                                // giữ tên dự phòng theo địa điểm đã chọn (dùng khi địa điểm bị ẩn/xoá)
                                const picked = byId.get(e.target.value);
                                if (picked) {
                                  st.name = picked.name;
                                  // chưa nhập giá ⇒ lấy giá ở trang địa điểm (nếu đọc được số)
                                  const pr = parsePrice(picked.price);
                                  if (!st.cost && !st.incl && !st.subs.length && pr) st.cost = pr;
                                }
                              })}
                              className={`${INPUT} font-semibold`}
                            >
                              <option value="">— Tự nhập (di chuyển, nghỉ, quán chưa có…) —</option>
                              {s.placeId && !pl && <option value={s.placeId}>(địa điểm đã xoá)</option>}
                              {KINDS.map((k) => (
                                <optgroup key={k} label={KIND_LABEL[k]}>
                                  {byKind[k].map((o) => <option key={o.id} value={o.id}>{o.name}{o.published ? "" : " (đang ẩn)"}</option>)}
                                </optgroup>
                              ))}
                            </select>
                            {!s.placeId && (
                              <input value={s.name} maxLength={80} onChange={(e) => setStop((st) => { st.name = e.target.value; })} placeholder="Địa điểm, VD: VP xe trung tâm xã" className={`${INPUT} ${s.name || s.title ? "" : "!border-amber-500"}`} />
                            )}
                            {pl?.price && <span className="text-[11px] font-semibold text-gray-500">Giá ở trang địa điểm: {pl.price}</span>}
                            {pl && !pl.published && <span className="text-[11px] font-semibold text-amber-600">Địa điểm đang ẩn — trang khách sẽ hiện như điểm tự nhập.</span>}
                          </div>
                          <input value={s.title} maxLength={80} onChange={(e) => setStop((st) => { st.title = e.target.value; })} placeholder="Hoạt động (tuỳ chọn), VD: Ăn nướng" className={`${INPUT} col-span-3 col-start-1 lg:col-span-1 lg:col-start-auto`} />
                          <div className="col-start-3 row-start-1 flex gap-0.5 lg:col-start-5">
                            <button type="button" disabled={si === 0} onClick={() => editPlan((p) => move(p.days[di].stops, si, -1))} className={ICON_BTN}>↑</button>
                            <button type="button" disabled={si === d.stops.length - 1} onClick={() => editPlan((p) => move(p.days[di].stops, si, 1))} className={ICON_BTN}>↓</button>
                            <button type="button" onClick={() => editPlan((p) => { p.days[di].stops.splice(si, 1); })} className={`${ICON_BTN} font-extrabold !text-red-600 hover:!bg-red-50`}>✕</button>
                          </div>
                        </div>
                        <input value={s.note} maxLength={240} onChange={(e) => setStop((st) => { st.note = e.target.value; })} placeholder="Ghi chú cho khách, VD: Vé vào 30k. Đường có đoạn sỏi…" className={`${INPUT} lg:ml-[30px]`} />

                        {/* Giá */}
                        <div className="flex flex-wrap items-center gap-1.5 lg:ml-[30px]">
                          <select value={s.incl} onChange={(e) => setStop((st) => { st.incl = e.target.value as Incl; })} className={`${INPUT} font-semibold ${s.incl === "combo" ? "!border-forest-300 bg-forest-50 text-forest-800" : ""}`}>
                            {INCLS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          {!s.incl && !s.subs.length && (
                            <>
                              <MoneyInput value={s.cost} onChange={(n) => setStop((st) => { st.cost = n; })} className="w-[120px]" />
                              <select value={s.unit} onChange={(e) => setStop((st) => { st.unit = e.target.value as CostUnit; })} className={INPUT}>
                                {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
                              </select>
                            </>
                          )}
                          {!s.incl && (
                            <>
                              <select value={s.cat} onChange={(e) => setStop((st) => { st.cat = e.target.value as ItStop["cat"]; })} className={INPUT} title="Nhóm chi phí ở bảng dự trù">
                                <option value="">Nhóm: theo loại địa điểm</option>
                                {(Object.keys(CAT_LABEL) as (keyof typeof CAT_LABEL)[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                              </select>
                              <button
                                type="button"
                                onClick={() => setStop((st) => { st.subs.push({ name: "", cost: 0, unit: "pp", note: "" }); })}
                                className="whitespace-nowrap rounded-full border-[1.5px] border-dashed border-gray-300 px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-white"
                              >
                                + Điểm con
                              </button>
                            </>
                          )}
                          <span className="text-xs font-semibold text-gray-500">
                            {s.incl === "combo"
                              ? "Hiện nhãn “Trong combo”."
                              : s.incl === "free"
                                ? "Hiện 0đ, không cộng vào dự trù."
                                : s.subs.length
                                  ? `Tổng các điểm con: ${vnd(subTotal)} (trước khi nhân số người / xe)`
                                  : s.cost
                                    ? `VD 2 người: ${vnd(s.cost * (s.unit === "pp" ? 2 : 1))}`
                                    : "Chưa có giá ⇒ hiện 0đ."}
                          </span>
                        </div>
                        {!s.incl && s.subs.length > 0 && (
                          <div className="flex flex-col gap-1 rounded-lg bg-white p-1.5 ring-1 ring-gray-100 lg:ml-[30px]">
                            {s.subs.map((x, xi) => (
                              <div key={xi} className="flex flex-wrap items-center gap-1.5">
                                <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: color }} />
                                <input value={x.name} maxLength={60} onChange={(e) => setStop((st) => { st.subs[xi].name = e.target.value; })} placeholder="Tên điểm, VD: Cây cô đơn" className={`${INPUT} min-w-[140px] flex-1 ${x.name ? "" : "!border-amber-500"}`} />
                                <MoneyInput value={x.cost} onChange={(n) => setStop((st) => { st.subs[xi].cost = n; })} className="w-[110px]" />
                                <select value={x.unit} onChange={(e) => setStop((st) => { st.subs[xi].unit = e.target.value as CostUnit; })} className={INPUT}>
                                  {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
                                </select>
                                <input value={x.note} maxLength={60} onChange={(e) => setStop((st) => { st.subs[xi].note = e.target.value; })} placeholder="Ghi chú, VD: vé vào 25k" className={`${INPUT} w-[150px]`} />
                                <button type="button" onClick={() => setStop((st) => { st.subs.splice(xi, 1); })} className={`${ICON_BTN} font-extrabold !text-red-600`}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {(d.stops.length === 0 || unordered) && (
                  <div className="text-xs font-bold text-amber-600">{d.stops.length === 0 ? "Ngày này chưa có điểm dừng nào." : "Giờ chưa theo thứ tự tăng dần, kiểm tra lại."}</div>
                )}
                <button
                  type="button"
                  onClick={() => editPlan((p) => {
                    const l = p.days[di].stops;
                    const m = l.length ? toMin(l[l.length - 1].time) + 90 : 8 * 60;
                    const t = String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
                    l.push(newStop({ time: t }));
                  })}
                  className="self-start whitespace-nowrap rounded-full border-[1.5px] border-dashed border-gray-300 px-3 py-2 text-[13px] font-bold text-gray-700 hover:bg-gray-50"
                >
                  + Thêm điểm
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => editPlan((p) => { p.days.push({ label: "", title: "", stops: [] }); })}
            className="rounded-2xl border-[1.5px] border-dashed border-gray-300 bg-white p-3 text-center text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            + Thêm ngày
          </button>
        </>
      )}

      {section === "cost" && <ItineraryCostSettings cost={cfg.cost} onChange={(fn) => edit((c) => fn(c.cost))} />}

      {section === "featured" && (
        <>
          <p className="text-[13px] text-gray-500">
            Chọn địa điểm hiện ở mục <b>“Nên ghé ở Tà Xùa”</b> trên trang lịch trình, theo đúng thứ tự bạn sắp. Để trống một nhóm = hiện tất cả địa điểm đang hiển thị của nhóm đó.
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            {KINDS.map((k) => {
              const picked = cfg.featured[k];
              const rest = byKind[k].filter((o) => !picked.includes(o.id));
              return (
                <div key={k} className="flex flex-col gap-2.5 rounded-[18px] border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[15px] font-extrabold text-ink">{KIND_LABEL[k]} nổi bật</div>
                    <span className="text-xs font-semibold text-gray-500">{picked.length ? `${picked.length} đã chọn` : `tất cả (${byKind[k].filter((o) => o.published).length})`}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {picked.map((id, i) => {
                      const o = byId.get(id);
                      return (
                        <div key={id} className="flex items-center gap-1.5 rounded-xl bg-gray-50 py-1 pl-2.5 pr-1">
                          <span className="w-5 flex-none text-xs font-extrabold text-gray-400">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-gray-800">{o?.name ?? "(địa điểm đã xoá)"}</div>
                            <div className="truncate text-[11px] text-gray-500">{o ? `${o.area}${o.published ? "" : " · đang ẩn, không hiện cho khách"}` : ""}</div>
                          </div>
                          <button type="button" disabled={i === 0} onClick={() => edit((c) => move(c.featured[k], i, -1))} className={ICON_BTN}>↑</button>
                          <button type="button" disabled={i === picked.length - 1} onClick={() => edit((c) => move(c.featured[k], i, 1))} className={ICON_BTN}>↓</button>
                          <button type="button" onClick={() => edit((c) => { c.featured[k].splice(i, 1); })} className={`${ICON_BTN} font-extrabold !text-red-600`}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                  {rest.length > 0 ? (
                    <select
                      value=""
                      onChange={(e) => { const v = e.target.value; if (v) edit((c) => { c.featured[k].push(v); }); }}
                      className={`${INPUT} font-semibold text-gray-600`}
                    >
                      <option value="">+ Chọn thêm từ danh sách…</option>
                      {rest.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.area}{o.published ? "" : " (đang ẩn)"}</option>)}
                    </select>
                  ) : byKind[k].length === 0 ? (
                    <div className="text-[13px] text-gray-500">
                      Chưa có {KIND_LABEL[k].toLowerCase()} nào. <Link href="/admin/places" className="font-semibold text-forest-700 hover:underline">Thêm ở trang quản lý địa điểm →</Link>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 rounded-[18px] border border-gray-200 bg-white p-4">
            <div className="text-[15px] font-extrabold text-ink">Lưu ý chuẩn bị <span className="text-xs font-semibold text-gray-500">· hiện ở cột bên phải lịch trình</span></div>
            {cfg.prep.map((t, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input value={t} maxLength={120} onChange={(e) => edit((c) => { c.prep[i] = e.target.value; })} className={`${INPUT} flex-1`} />
                <button type="button" onClick={() => edit((c) => { c.prep.splice(i, 1); })} className={`${ICON_BTN} font-extrabold !text-red-600`}>✕</button>
              </div>
            ))}
            {cfg.prep.length < 8 && (
              <button type="button" onClick={() => edit((c) => { c.prep.push(""); })} className="self-start whitespace-nowrap rounded-full border-[1.5px] border-dashed border-gray-300 px-3 py-2 text-[13px] font-bold text-gray-700 hover:bg-gray-50">
                + Thêm lưu ý
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
