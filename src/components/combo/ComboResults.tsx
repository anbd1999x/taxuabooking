"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  ComboBusOption,
  ComboHomeOption,
  ComboPlanGroup,
  ComboRoomFeatures,
  ComboStayPlan,
  ComboSearchResult,
} from "@/lib/combo";

const COMBO_DISCOUNT = 50000;

const FEAT: [keyof ComboRoomFeatures, string][] = [
  ["cloudView", "⛅ View mây"],
  ["hasBathtub", "🛁 Bồn tắm"],
  ["breakfast", "🍳 Ăn sáng"],
  ["airCon", "❄️ Điều hòa"],
  ["heating", "🔥 Đêm sưởi"],
];

function vnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

/** Giá combo/khách của một phương án (roomCost = TỔNG tiền phòng cả đoàn). */
function planPP(plan: ComboStayPlan, people: number, fare: number): number {
  return Math.max(0, Math.round(plan.roomCost / people) + fare - (plan.communal ? 0 : COMBO_DISCOUNT));
}

/** Một thẻ kết quả = một PHƯƠNG ÁN ghép phòng của một homestay. */
interface PlanEntry {
  home: ComboHomeOption;
  plan: ComboStayPlan;
  bestPrice: number; // giá/khách với xe rẻ nhất (để sắp xếp/lọc)
  score: number; // điểm tổng hợp giá + tiện ích + vị trí (thấp = tốt)
}

export function ComboResults({ result }: { result: ComboSearchResult }) {
  const { homes, buses, people, nights, origin, budget, priceMax, priceMin, checkIn, checkOut, fromKey, toKey } = result;
  // Chọn KHOẢNG giá (dropdown) → badge chênh lệch so với 1 con số không còn ý nghĩa.
  const exactBudget = priceMax == null && priceMin == null ? budget : null;

  // Bộ lọc khu vực + homestay + tiêu chí sắp xếp sau khi có kết quả.
  const [zone, setZone] = useState("all");
  const [homeName, setHomeName] = useState("all"); // lọc theo TÊN homestay (xem riêng từng nhà)
  const [sort, setSort] = useState("match"); // match | priceAsc | priceDesc | near
  const zones = useMemo(() => [...new Set(homes.map((h) => h.area).filter((a): a is string => Boolean(a)))], [homes]);
  const homeNames = useMemo(
    () => [...new Set(homes.map((h) => h.title))].sort((a, b) => a.localeCompare(b, "vi")),
    [homes],
  );

  // Mỗi thẻ = 1 phương án ghép phòng (VD 10 người: "5× Phòng đơn" / "4× Phòng đôi
  // + 2× Phòng đơn" / dorm). Mặc định sắp theo ĐIỂM TỔNG HỢP: giá (khớp giá mong
  // muốn nếu có), view/tiện ích, khoảng cách tới trung tâm.
  const entries = useMemo<PlanEntry[]>(() => {
    const distOf = (h: ComboHomeOption) =>
      h.distanceKm ?? (/trung tâm/i.test(h.area ?? "") ? 0 : Number.POSITIVE_INFINITY);
    const cheapestFare = buses.length ? Math.min(...buses.map((b) => b.farePerPerson)) : 0;

    const arr: PlanEntry[] = [];
    for (const home of homes) {
      if (zone !== "all" && home.area !== zone) continue;
      if (homeName !== "all" && home.title !== homeName) continue;
      for (const plan of home.plans) {
        arr.push({ home, plan, bestPrice: planPP(plan, people, cheapestFare), score: 0 });
      }
    }
    if (arr.length === 0) return arr;

    // Điểm tổng hợp (0..1, thấp = tốt): 55% giá, 25% view/tiện ích, 20% vị trí.
    const priceOf = (e: PlanEntry) => (budget != null ? Math.abs(e.bestPrice - budget) : e.bestPrice);
    const pVals = arr.map(priceOf);
    const pMin = Math.min(...pVals);
    const pMax = Math.max(...pVals);
    for (const e of arr) {
      const sPrice = pMax > pMin ? (priceOf(e) - pMin) / (pMax - pMin) : 0;
      const d = distOf(e.home);
      const sDist = Number.isFinite(d) ? Math.min(d, 15) / 15 : 0.6; // thiếu số km → coi như hơi xa
      const sAmen = 1 - e.plan.amenityScore;
      e.score = 0.55 * sPrice + 0.25 * sAmen + 0.2 * sDist;
    }

    arr.sort((a, b) => {
      if (sort === "priceAsc") return a.bestPrice - b.bestPrice;
      if (sort === "priceDesc") return b.bestPrice - a.bestPrice;
      if (sort === "near") return distOf(a.home) - distOf(b.home) || a.bestPrice - b.bestPrice;
      return a.score - b.score || a.bestPrice - b.bestPrice;
    });
    return arr;
  }, [homes, buses, people, budget, zone, homeName, sort]);

  const bestPlanId = buses.length > 0 && entries.length > 0 ? entries[0].plan.id : null;

  const [visible, setVisible] = useState(Math.min(3, entries.length));
  useEffect(() => {
    if (visible >= entries.length) return;
    const t = setTimeout(() => setVisible((v) => Math.min(entries.length, v + 1)), 140);
    return () => clearTimeout(t);
  }, [visible, entries.length]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-gray-600">
          <span className="font-bold text-ink">{entries.length}</span> phương án · {buses.length} nhà xe · {people} người ·{" "}
          {nights} đêm ({checkIn} → {checkOut})
          {origin && <> · đón tại <span className="font-bold text-ink">{origin}</span></>}
        </p>
        {priceMax != null ? (
          <p className="text-sm text-gray-500">
            Mức giá <span className="font-semibold text-forest-700">dưới {vnd(priceMax)}</span>/khách
          </p>
        ) : priceMin != null ? (
          <p className="text-sm text-gray-500">
            Mức giá <span className="font-semibold text-forest-700">trên {vnd(priceMin)}</span>/khách
          </p>
        ) : budget != null ? (
          <p className="text-sm text-gray-500">
            Khớp giá mong muốn <span className="font-semibold text-forest-700">{vnd(budget)}</span>/khách
          </p>
        ) : null}
      </div>

      {/* Sắp xếp kết quả */}
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-500">
          Sắp xếp
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-full bg-white px-3 py-2 text-[13px] font-bold text-ink outline-none"
            style={{ boxShadow: "inset 0 0 0 1px oklch(0.9 0.01 200)" }}
          >
            <option value="match">{budget != null ? "Tối ưu (khớp giá · tiện ích · vị trí)" : "Tối ưu (giá · tiện ích · vị trí)"}</option>
            <option value="priceAsc">Giá thấp → cao</option>
            <option value="priceDesc">Giá cao → thấp</option>
            <option value="near">Gần trung tâm nhất</option>
          </select>
        </label>
      </div>

      {/* Lọc nhanh ngay trên kết quả — dropdown chữ nhỏ: theo TÊN homestay & theo KHU VỰC */}
      {(homeNames.length > 1 || zones.length > 1) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          {homeNames.length > 1 && (
            <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-500">
              Xem theo nhà
              <select
                value={homeName}
                onChange={(e) => setHomeName(e.target.value)}
                className="max-w-[260px] cursor-pointer border-0 bg-transparent p-0 text-[13px] font-extrabold text-forest-700 outline-none"
              >
                <option value="all">Tất cả homestay</option>
                {homeNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          )}
          {zones.length > 1 && (
            <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-500">
              Khu vực
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="max-w-[220px] cursor-pointer border-0 bg-transparent p-0 text-[13px] font-extrabold outline-none"
                style={{ color: "oklch(0.29 0.055 160)" }}
              >
                <option value="all">Mọi khu vực</option>
                {zones.map((z) => (
                  <option key={z} value={z}>{z.replace(/^Trung tâm Tà Xùa$/i, "Trung tâm")}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="flex flex-col gap-[18px]">
        {entries.slice(0, visible).map((e) => (
          <ComboPlanCard
            key={e.plan.id}
            home={e.home}
            plan={e.plan}
            buses={buses}
            people={people}
            nights={nights}
            budget={exactBudget}
            best={e.plan.id === bestPlanId}
            checkIn={checkIn}
            checkOut={checkOut}
            fromKey={fromKey}
            toKey={toKey}
            origin={origin}
          />
        ))}
      </div>

      {visible < entries.length && <p className="mt-4 text-center text-sm text-gray-400">Đang hiện thêm…</p>}

      {/* Bộ lọc khu vực/homestay loại hết phương án → gợi ý xoá lọc thay vì trang trống */}
      {homes.length > 0 && entries.length === 0 && (
        <div className="flex flex-col items-center gap-2.5 rounded-[22px] border border-dashed border-[oklch(0.85_0.02_230)] bg-white px-6 py-12 text-center">
          <div className="text-[17px] font-extrabold text-ink">Không có phương án khớp bộ lọc</div>
          <div className="max-w-[420px] text-sm text-gray-500">Thử chọn khu vực hoặc homestay khác cho ngày này.</div>
          <button
            type="button"
            onClick={() => { setZone("all"); setHomeName("all"); }}
            className="mt-1 rounded-full bg-forest-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-forest-700"
          >
            Xoá bộ lọc
          </button>
        </div>
      )}
    </div>
  );
}

function ComboPlanCard({
  home,
  plan,
  buses,
  people,
  nights,
  budget,
  best,
  checkIn,
  checkOut,
  fromKey,
  toKey,
  origin,
}: {
  home: ComboHomeOption;
  plan: ComboStayPlan;
  buses: ComboBusOption[];
  people: number;
  nights: number;
  budget: number | null;
  best: boolean;
  checkIn: string;
  checkOut: string;
  fromKey: string;
  toKey: string;
  origin: string | null;
}) {
  const [busId, setBusId] = useState(buses[0]?.serviceId ?? "");
  const bus = useMemo(() => buses.find((b) => b.serviceId === busId) ?? buses[0], [buses, busId]);

  const single = plan.roomCount === 1 ? plan.groups[0] : null;
  const title = single ? single.room.roomName : plan.label;
  const cover = plan.groups[0]?.room.cover ?? home.cover;

  // Tiện ích chung của các phòng trong phương án (hiện chip).
  const amenities = useMemo(() => {
    const out: string[] = [];
    for (const [k, label] of FEAT) if (plan.groups.some((g) => g.room.features[k])) out.push(label);
    const r0 = plan.groups[0]?.room;
    if (r0?.pool) out.push("🏊 Hồ bơi");
    if (r0?.easyRoad) out.push("🛣️ Đường dễ đi");
    return out;
  }, [plan]);

  // roomCost của phương án = TỔNG tiền phòng cả đoàn (dorm đã nhân số người).
  const roomShare = Math.round(plan.roomCost / people);
  const pricePerPerson = Math.max(0, roomShare + (bus?.farePerPerson ?? 0) - (plan.communal ? 0 : COMBO_DISCOUNT));
  const total = pricePerPerson * people;
  const diff = budget != null ? pricePerPerson - budget : null;

  // Khách chọn ĐÚNG CĂN trong nhóm phòng giống nhau (nhóm cần 1 phòng mà còn nhiều căn trống).
  const [pick, setPick] = useState<Record<number, string>>({});
  const chosenRoomIds = useMemo(
    () =>
      plan.groups.flatMap((g, i) =>
        g.count === 1 && g.options.length > 1 ? [pick[i] ?? g.roomIds[0]] : g.roomIds,
      ),
    [plan, pick],
  );

  // Xem nhanh phòng (theo nhóm) / xe ngay trong trang (không rời phễu đặt combo).
  const [preview, setPreview] = useState<{ kind: "room"; group: ComboPlanGroup } | { kind: "bus" } | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ code: string } | null>(null);
  const [panelIn, setPanelIn] = useState(false);

  useEffect(() => {
    if (openForm) {
      const r = requestAnimationFrame(() => setPanelIn(true));
      return () => cancelAnimationFrame(r);
    }
    setPanelIn(false);
  }, [openForm]);

  async function book() {
    setErr("");
    if (!bus) { setErr("Vui lòng chọn xe cabin."); return; }
    if (!name.trim()) { setErr("Vui lòng nhập họ tên."); return; }
    if (!/^0\d{9}$/.test(phone.replace(/\s/g, ""))) { setErr("Số điện thoại chưa đúng (10 số, bắt đầu bằng 0)."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/combo/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromKey, toKey,
          roomIds: chosenRoomIds,
          outboundTripId: bus.outboundTripId,
          returnTripId: bus.returnTripId,
          origin: origin || null,
          people,
          customerName: name.trim(),
          phone: phone.trim(),
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Gửi yêu cầu thất bại, vui lòng thử lại.");
      else setDone({ code: data.code });
    } catch {
      setErr("Lỗi kết nối, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className={`overflow-hidden rounded-[22px] bg-white ring-1 ${best ? "ring-2 ring-sunset-400" : "ring-black/[0.07]"}`}>
      {best && (
        <div className="bg-sunset-500 px-4 py-1.5 text-[13px] font-bold tracking-wide text-white">
          {budget != null ? "Khớp giá nhất với mong muốn của bạn" : "Phương án tối ưu nhất (giá · tiện ích · vị trí)"}
        </div>
      )}
      <div className="grid gap-0 lg:grid-cols-[210px_minmax(0,1fr)_268px]">
        {/* Ảnh phòng (thiếu thì ảnh hạng phòng / homestay) */}
        <div className="relative min-h-[180px]">
          {cover ? (
            <Image src={cover} alt={title} fill sizes="220px" className="object-cover" />
          ) : (
            <div className="flex h-full min-h-[180px] items-center justify-center bg-gray-100 text-4xl">🛏️</div>
          )}
          {home.area && (
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[oklch(0.3_0.04_160)]">
              {home.area}
              {home.distanceKm != null && (home.distanceKm === 0 ? " · trung tâm" : ` · ${home.distanceKm.toLocaleString("vi-VN")}km`)}
            </span>
          )}
          {plan.roomCount > 1 && (
            <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-forest-600 px-2.5 py-1 text-xs font-bold text-white">
              Ghép {plan.roomCount} phòng · đủ {plan.capacity} chỗ
            </span>
          )}
        </div>

        {/* Thông tin phương án + chọn xe */}
        <div className="flex min-w-0 flex-col gap-3.5 p-5">
          <div>
            <div className="text-[13px] font-semibold text-gray-500">{home.title}</div>
            <div className="text-[19px] font-extrabold tracking-[-0.015em] text-ink">{title}</div>
            <div className="mt-0.5 text-[13px] text-gray-500">
              {plan.communal ? (
                <>Giường cộng đồng cho {people} khách · {nights} đêm · <span className="font-bold text-ink">{vnd(plan.roomCost)}</span> cả kỳ</>
              ) : (
                <>
                  Đủ chỗ {plan.capacity} khách · {nights} đêm · tiền phòng <span className="font-bold text-ink">{vnd(plan.roomCost)}</span> cả kỳ
                  {plan.extraGuests > 0 && (
                    <> · <span className="font-semibold text-sunset-600">{plan.extraGuests} khách ở ghép, đã gồm phụ thu {vnd(plan.extraCost)}</span></>
                  )}
                </>
              )}
            </div>
            {/* Chi tiết từng nhóm phòng của phương án — bấm để xem ảnh/mô tả */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plan.groups.map((g, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPreview({ kind: "room", group: g })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-2.5 py-1 text-xs font-semibold text-forest-700 transition hover:bg-forest-50"
                >
                  {g.count}× {g.room.typeName}
                  <span className="text-gray-400">· {vnd(g.unitCost)}{plan.communal ? "/người" : "/phòng"}</span>
                </button>
              ))}
            </div>
            {/* Nhóm còn NHIỀU căn giống nhau trống → liệt kê để khách biết (chọn đúng căn khi đặt) */}
            {plan.groups.some((g) => g.options.length > g.count) && (
              <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-gray-500">
                {plan.groups
                  .filter((g) => g.options.length > g.count)
                  .map((g, i) => (
                    <div key={i}>
                      Còn <b className="text-forest-700">{g.options.length} căn</b> {g.room.typeName.toLowerCase()} trống:{" "}
                      {g.options.map((o) => o.roomName).join(" · ")}
                    </div>
                  ))}
              </div>
            )}
            {amenities.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {amenities.map((a, i) => (
                  <span key={i} className="rounded-full bg-[oklch(0.95_0.025_155)] px-2.5 py-1 text-xs font-semibold text-[oklch(0.36_0.08_155)]">{a}</span>
                ))}
              </div>
            )}
          </div>

          {/* Chọn xe */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-extrabold tracking-wide text-sunset-600">CHỌN XE CABIN KHỨ HỒI</div>
            {buses.length === 0 ? (
              <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">Chưa có nhà xe mở cả 2 chiều cho ngày này.</div>
            ) : (
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%,190px), 1fr))" }}>
                {buses.map((b) => {
                  const on = b.serviceId === bus?.serviceId;
                  const low = b.seatsAvailable <= 5;
                  return (
                    <button
                      key={b.serviceId}
                      type="button"
                      onClick={() => setBusId(b.serviceId)}
                      className="flex flex-col gap-0.5 rounded-xl border-2 p-2.5 text-left transition"
                      style={{ borderColor: on ? "oklch(0.29 0.055 160)" : "oklch(0.92 0.01 200)", background: on ? "oklch(0.97 0.02 155)" : "white" }}
                    >
                      <div className="flex items-baseline justify-between gap-1.5">
                        <span className="truncate text-sm font-extrabold text-ink">{b.title}</span>
                        <span className="whitespace-nowrap text-xs font-bold" style={{ color: low ? "oklch(0.52 0.15 50)" : "oklch(0.38 0.1 155)" }}>{low ? `Còn ${b.seatsAvailable}` : "Còn chỗ"}</span>
                      </div>
                      <div className="text-xs text-gray-500">Đi {b.outboundTime} · Về {b.returnTime}</div>
                      <div className="text-[13px] font-bold text-[oklch(0.35_0.03_160)]">{vnd(b.farePerPerson)}/khách</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Giá + đặt */}
        <div className="flex flex-col gap-2.5 border-t border-gray-100 bg-[oklch(0.975_0.008_150)] p-5 lg:border-l lg:border-t-0">
          {diff != null && (
            <span className="self-start rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: Math.abs(diff) <= 50000 ? "oklch(0.95 0.05 155)" : "oklch(0.95 0.03 250)", color: Math.abs(diff) <= 50000 ? "oklch(0.38 0.1 155)" : "oklch(0.42 0.1 250)" }}>
              {diff === 0 ? "Đúng giá mong muốn" : diff > 0 ? `Cao hơn ${vnd(diff)}` : `Thấp hơn ${vnd(-diff)}`}
            </span>
          )}
          <div>
            <div className="text-xs text-gray-500">Trọn gói / khách</div>
            <div className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-sunset-600">{vnd(pricePerPerson)}</div>
            <div className="mt-0.5 text-[13px] font-semibold text-gray-500">≈ {vnd(total)} cho {people} người</div>
          </div>
          <div className="flex flex-col gap-1 text-xs leading-relaxed text-gray-500">
            <div className="flex justify-between gap-2">
              <span>{plan.communal ? "Giường cộng đồng / khách" : plan.roomCount > 1 ? `${plan.roomCount} phòng ÷ ${people} khách` : `Phòng ÷ ${people}`}</span>
              <span className="font-bold text-ink">{vnd(roomShare)}</span>
            </div>
            <div className="flex justify-between gap-2"><span>Vé khứ hồi{bus?.fareOrigin ? ` từ ${bus.fareOrigin}` : ""} / khách</span><span className="font-bold text-ink">{vnd(bus?.farePerPerson ?? 0)}</span></div>
            {!plan.communal && (
              <div className="flex justify-between gap-2"><span>Khuyến mãi combo</span><span className="font-bold text-forest-700">− {vnd(COMBO_DISCOUNT)}</span></div>
            )}
          </div>
          <div className="flex-1" />

          <button
            type="button"
            onClick={() => { setErr(""); setOpenForm(true); }}
            disabled={!bus}
            className="rounded-full bg-forest-600 py-3 text-center text-sm font-bold text-white transition hover:bg-sunset-500 disabled:opacity-50"
          >
            Đặt combo này →
          </button>

          <div className="flex gap-2">
            <button type="button" onClick={() => setPreview({ kind: "room", group: plan.groups[0] })} className="flex-1 rounded-full border border-forest-200 py-2 text-center text-[13px] font-bold text-forest-700 hover:bg-forest-50">Xem phòng</button>
            {bus && (
              <button type="button" onClick={() => setPreview({ kind: "bus" })} className="flex-1 rounded-full border border-forest-200 py-2 text-center text-[13px] font-bold text-forest-700 hover:bg-forest-50">Xem xe</button>
            )}
          </div>
        </div>
      </div>

      {/* Panel đặt combo (trượt ra bên phải ở desktop) */}
      {openForm && (
        <div
          onClick={() => !submitting && setOpenForm(false)}
          className="fixed inset-0 z-50 flex justify-end bg-black/50 transition-opacity duration-300"
          style={{ opacity: panelIn ? 1 : 0 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-[440px] flex-col overflow-y-auto bg-white shadow-2xl transition-transform duration-300 will-change-transform"
            style={{ transform: panelIn ? "translateX(0)" : "translateX(100%)" }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
              <div className="text-lg font-extrabold text-ink">{done ? "Đã gửi yêu cầu combo" : "Đặt combo này"}</div>
              <button type="button" onClick={() => setOpenForm(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-gray-400 hover:bg-gray-100">×</button>
            </div>

            {done ? (
              <div className="flex flex-col gap-3 p-5">
                <div className="rounded-xl bg-forest-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-forest-700">Mã yêu cầu</div>
                  <div className="mt-0.5 text-2xl font-extrabold text-ink">{done.code}</div>
                  <div className="mt-1 text-sm leading-relaxed text-gray-600">Tụi mình sẽ gọi <b>{phone}</b> để xác nhận xe, phòng và chốt giá. Chưa thanh toán online.</div>
                </div>
                <button type="button" onClick={() => setOpenForm(false)} className="rounded-full bg-forest-600 py-3 text-center text-sm font-bold text-white hover:bg-forest-700">Xong</button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-5">
                {/* Tóm tắt combo đã chọn */}
                <div className="flex flex-col gap-1.5 rounded-xl bg-[oklch(0.975_0.008_150)] p-3.5 text-[13px]">
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Homestay</span><span className="font-bold text-ink">{home.title}</span></div>
                  {plan.groups.map((g, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-gray-500">{i === 0 ? (plan.roomCount > 1 ? "Phòng (ghép)" : "Phòng") : ""}</span>
                      {g.count === 1 && g.options.length > 1 ? (
                        // Còn nhiều căn giống nhau → khách chọn đúng căn muốn ở.
                        <span className="flex items-center gap-1.5 font-bold text-ink">
                          {g.room.typeName} ·
                          <select
                            value={pick[i] ?? g.roomIds[0]}
                            onChange={(e) => setPick({ ...pick, [i]: e.target.value })}
                            className="rounded-lg border border-forest-200 bg-white px-2 py-1 text-[13px] font-bold text-forest-700 outline-none"
                          >
                            {g.options.map((o) => (
                              <option key={o.roomId} value={o.roomId}>{o.roomName}</option>
                            ))}
                          </select>
                        </span>
                      ) : (
                        <span className="font-bold text-ink">{g.count}× {g.room.typeName}{g.count === 1 && plan.roomCount === 1 ? ` · ${g.room.roomName}` : ""}</span>
                      )}
                    </div>
                  ))}
                  {plan.extraGuests > 0 && (
                    <div className="flex justify-between gap-2"><span className="text-gray-500">Ở ghép</span><span className="font-bold text-sunset-600">+{plan.extraGuests} khách · phụ thu {vnd(plan.extraCost)}</span></div>
                  )}
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Xe cabin</span><span className="font-bold text-ink">{bus?.title} · đi {bus?.outboundTime} / về {bus?.returnTime}</span></div>
                  {origin && (
                    <div className="flex justify-between gap-2"><span className="text-gray-500">Điểm đón</span><span className="font-bold text-ink">{origin}</span></div>
                  )}
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Ngày</span><span className="font-bold text-ink">{checkIn} → {checkOut} · {nights} đêm</span></div>
                  <div className="mt-1 flex justify-between gap-2 border-t border-gray-200 pt-1.5"><span className="text-gray-500">Trọn gói</span><span className="font-extrabold text-sunset-600">{vnd(pricePerPerson)}/khách · {vnd(total)} / {people} người</span></div>
                </div>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Họ và tên *" className="rounded-xl border border-gray-200 px-3.5 py-3 text-sm outline-none focus:border-forest-500" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Số điện thoại *" className="rounded-xl border border-gray-200 px-3.5 py-3 text-sm outline-none focus:border-forest-500" />
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (giờ đón, trẻ nhỏ…)" className="rounded-xl border border-gray-200 px-3.5 py-3 text-sm outline-none focus:border-forest-500" />
                {err && <div className="text-sm font-semibold text-red-600">{err}</div>}
                <button type="button" onClick={book} disabled={submitting} className="rounded-full bg-sunset-500 py-3.5 text-center text-sm font-bold text-white hover:bg-sunset-600 disabled:opacity-60">
                  {submitting ? "Đang gửi..." : "Gửi yêu cầu đặt combo"}
                </button>
                <p className="text-center text-xs leading-relaxed text-gray-500">Giá tham khảo · chủ dịch vụ gọi xác nhận, không thanh toán online.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Xem nhanh PHÒNG (theo nhóm trong phương án) — ở lại trang combo */}
      {preview?.kind === "room" && preview.group && (
        <QuickView
          title={`${home.title} · ${preview.group.count}× ${preview.group.room.typeName}`}
          onClose={() => setPreview(null)}
        >
          <MiniGallery
            images={preview.group.room.images.length ? preview.group.room.images : preview.group.room.cover ? [preview.group.room.cover] : []}
            alt={preview.group.room.roomName}
          />
          <div className="flex flex-col gap-3 p-5">
            <div className="text-sm text-gray-600">
              Tiêu chuẩn <b>{preview.group.room.capacity} người</b>/phòng · {nights} đêm ({checkIn} → {checkOut}) ·{" "}
              <b className="text-ink">{vnd(preview.group.unitCost)}</b>/{plan.communal ? "người" : "phòng"} cả kỳ
              {preview.group.count > 1 && <> · phương án dùng <b>{preview.group.count} phòng</b> hạng này</>}
            </div>
            {(amenities.length > 0 || preview.group.room.amenityList.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {[...amenities, ...preview.group.room.amenityList.filter((a) => !amenities.some((x) => x.includes(a)))].map((a, i) => (
                  <span key={i} className="rounded-full bg-[oklch(0.95_0.025_155)] px-2.5 py-1 text-xs font-semibold text-[oklch(0.36_0.08_155)]">{a}</span>
                ))}
              </div>
            )}
            {preview.group.room.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{preview.group.room.description}</p>
            )}
            <div className="rounded-xl bg-[oklch(0.975_0.008_150)] p-3.5 text-sm">
              Phương án {plan.label} với xe {bus?.title ?? "cabin"}: <b className="text-sunset-600">{vnd(pricePerPerson)}/khách</b> · ≈ {vnd(total)} cho {people} người
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-gray-100 p-4">
            <button
              type="button"
              onClick={() => { setPreview(null); setErr(""); setOpenForm(true); }}
              className="flex-1 rounded-full bg-sunset-500 py-3 text-center text-sm font-bold text-white hover:bg-sunset-600"
            >
              Đặt combo với phương án này →
            </button>
            <Link
              href={`/homestay/${home.slug}?from=${encodeURIComponent(checkIn)}&to=${encodeURIComponent(checkOut)}`}
              target="_blank"
              className="whitespace-nowrap text-xs font-semibold text-gray-400 underline-offset-2 hover:text-forest-700 hover:underline"
            >
              Trang chi tiết ↗
            </Link>
          </div>
        </QuickView>
      )}

      {/* Xem nhanh XE — giờ chạy + lộ trình đón trả của xe đang chọn */}
      {preview?.kind === "bus" && bus && (
        <QuickView title={`${bus.title} · xe cabin khứ hồi`} onClose={() => setPreview(null)}>
          <MiniGallery images={bus.images.length ? bus.images : bus.cover ? [bus.cover] : []} alt={bus.title} />
          <div className="flex flex-col gap-3 p-5">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-[oklch(0.975_0.008_150)] p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Chiều đi</div>
                <div className="mt-0.5 font-bold text-ink">{fmtDayKey(fromKey)} · {bus.outboundTime}</div>
              </div>
              <div className="rounded-xl bg-[oklch(0.975_0.008_150)] p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Chiều về</div>
                <div className="mt-0.5 font-bold text-ink">{fmtDayKey(toKey)} · {bus.returnTime}</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Vé khứ hồi{bus.fareOrigin ? ` từ ${bus.fareOrigin}` : ""} <b className="text-ink">{vnd(bus.farePerPerson)}/khách</b> ·{" "}
              <b className="text-[oklch(0.38_0.1_155)]">{bus.seatsAvailable <= 5 ? `Còn ${bus.seatsAvailable} chỗ` : "Còn chỗ"}</b>
            </div>
            {[["Lộ trình chiều đi", bus.outboundStops] as const, ["Lộ trình chiều về", bus.returnStops] as const].map(
              ([label, stops]) =>
                stops.length > 0 && (
                  <div key={label}>
                    <div className="text-xs font-extrabold tracking-wide text-sunset-600">{label.toUpperCase()}</div>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {stops.map((st, i) => (
                        <li key={i} className="flex items-baseline gap-2.5 text-sm">
                          <span className="w-12 shrink-0 font-bold text-ink">{st.time}</span>
                          <span className="text-gray-600">{st.place}{st.tag ? <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">{st.tag}</span> : null}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
            )}
          </div>
          <div className="flex items-center gap-3 border-t border-gray-100 p-4">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="flex-1 rounded-full bg-forest-600 py-3 text-center text-sm font-bold text-white hover:bg-forest-700"
            >
              Dùng xe này cho combo ✓
            </button>
            <Link
              href={`/xe-cabin/${bus.slug}?from=${encodeURIComponent(fromKey)}&to=${encodeURIComponent(toKey)}`}
              target="_blank"
              className="whitespace-nowrap text-xs font-semibold text-gray-400 underline-offset-2 hover:text-forest-700 hover:underline"
            >
              Trang nhà xe ↗
            </Link>
          </div>
        </QuickView>
      )}
    </article>
  );
}

function fmtDayKey(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

/** Hộp xem nhanh: bottom sheet trên mobile, hộp giữa màn hình trên desktop. */
function QuickView({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 sm:items-center sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[22px] bg-white shadow-2xl sm:max-w-[640px] sm:rounded-[22px]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          <div className="min-w-0 truncate text-base font-extrabold text-ink">{title}</div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-gray-400 hover:bg-gray-100">×</button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/** Ảnh lớn + dải thumbnail bấm chuyển (dùng trong hộp xem nhanh). */
function MiniGallery({ images, alt }: { images: string[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) {
    return <div className="flex aspect-[16/9] items-center justify-center bg-gray-100 text-5xl">🛏️</div>;
  }
  const cur = images[Math.min(idx, images.length - 1)];
  return (
    <div>
      <div className="relative aspect-[16/9] bg-gray-100">
        <Image src={cur} alt={alt} fill sizes="640px" className="object-cover" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
          {images.map((u, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              className="relative h-[52px] w-[72px] shrink-0 overflow-hidden rounded-lg"
              style={i === idx ? { boxShadow: "0 0 0 2px oklch(0.29 0.055 160)" } : { opacity: 0.75 }}
            >
              <Image src={u} alt="" fill sizes="72px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
