"use client";

import { dmy } from "@/lib/date-format";
import { trackLeadConversion } from "@/lib/ads";
import { SupportHoursNote } from "@/components/SupportHours";
import { ItineraryLink } from "@/components/itinerary/ItineraryLink";
import { We } from "@/components/SiteContact";
import Link from "@/components/Link";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  ComboBusOption,
  ComboHomeOption,
  ComboRoomFeatures,
  ComboRoomOption,
  ComboStayPlan,
  ComboSearchResult,
} from "@/lib/combo";
import { ensureSheetFresh } from "@/components/ensureSheet";
import { cabinAllocation, busCostPerPerson, cabinSeatTotal } from "@/lib/combo-pricing";
import { vnPhoneError } from "@/lib/phone";
import { BookingEmailField, emailLooksValid } from "@/components/BookingEmailField";
import { PriceLine } from "@/components/WebPromo";
import { showGlobalLoading } from "@/components/useSearchNav";
import { CommitmentLink } from "@/components/trust/parts";
import { useT } from "@/components/i18n/I18nProvider";
import { ComboModeSlot } from "@/components/combo/ComboModeSwitch";
import { ComboSchedule } from "@/components/combo/ComboSchedule";
import { useComboBike, comboBikePayload, ComboBikeSummary, ComboBikePicker, ComboBikeDoneNote } from "@/components/combo/ComboBike";

// Phải khớp COMBO_DISCOUNT trong src/lib/combo.ts (server tính lại giá khi đặt).
const COMBO_DISCOUNT = 25000;

const G = "oklch(0.29 0.055 160)"; // xanh rừng
const O = "oklch(0.68 0.18 45)"; // cam điểm nhấn

/** Style select trong thanh lọc kết quả. */
/** Dropdown chữ mảnh trong thanh lọc kết quả (không khung, như trang danh sách homestay). */
const SEL = "min-w-0 max-w-[240px] cursor-pointer truncate border-0 bg-transparent p-0 text-[13px] font-extrabold outline-none";

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

/**
 * Giá combo/khách của một phương án (roomCost = TỔNG tiền phòng cả đoàn).
 * busPerPerson = tiền xe/khách theo cách xếp mặc định — cả đoàn nằm ghép (busCostPerPerson) — khớp giá khi đặt.
 */
function planPP(plan: ComboStayPlan, people: number, busPerPerson: number): number {
  return Math.max(0, Math.round(plan.roomCost / people) + busPerPerson - (plan.noDiscount ? 0 : COMBO_DISCOUNT));
}

/** Một thẻ kết quả = một PHƯƠNG ÁN ghép phòng của một homestay. */
interface PlanEntry {
  home: ComboHomeOption;
  plan: ComboStayPlan;
  bestPrice: number; // giá/khách với xe rẻ nhất (để sắp xếp/lọc)
  score: number; // điểm tổng hợp giá + tiện ích + vị trí (thấp = tốt)
}

export function ComboResults({ result }: { result: ComboSearchResult }) {
  const tr = useT();
  const { homes, buses, adults, childrenAges, nights, origin, budget, priceMax, priceMin, checkIn, checkOut, fromKey, toKey } = result;
  const exactBudget = priceMax == null && priceMin == null ? budget : null;

  const [zone, setZone] = useState("all");
  const [homeName, setHomeName] = useState("all");
  const [sort, setSort] = useState("match"); // match | priceAsc | priceDesc | near
  const zones = useMemo(() => [...new Set(homes.map((h) => h.area).filter((a): a is string => Boolean(a)))], [homes]);
  const homeNames = useMemo(
    () => [...new Set(homes.map((h) => h.title))].sort((a, b) => a.localeCompare(b, "vi")),
    [homes],
  );

  const entries = useMemo<PlanEntry[]>(() => {
    const distOf = (h: ComboHomeOption) =>
      h.distanceKm ?? (/trung tâm/i.test(h.area ?? "") ? 0 : Number.POSITIVE_INFINITY);
    // Giá rẻ nhất xét theo xe RẺ NHẤT CÒN ĐỦ CHỖ cho số tính phí của home (trẻ miễn phí ở cùng).
    // Tiền xe/khách rẻ nhất theo cách xếp mặc định (cả đoàn nằm ghép = 1 vé/người).
    const cheapestFareFor = (billable: number) => {
      const costs = buses.map((b) => busCostPerPerson(b, billable)).filter((c): c is number => c != null);
      return costs.length ? Math.min(...costs) : 0;
    };

    const arr: PlanEntry[] = [];
    for (const home of homes) {
      if (zone !== "all" && home.area !== zone) continue;
      if (homeName !== "all" && home.title !== homeName) continue;
      const cheapestFare = cheapestFareFor(home.billable);
      for (const plan of home.plans) {
        arr.push({ home, plan, bestPrice: planPP(plan, home.billable, cheapestFare), score: 0 });
      }
    }
    if (arr.length === 0) return arr;

    const priceOf = (e: PlanEntry) => (budget != null ? Math.abs(e.bestPrice - budget) : e.bestPrice);
    const pVals = arr.map(priceOf);
    const pMin = Math.min(...pVals);
    const pMax = Math.max(...pVals);
    for (const e of arr) {
      const sPrice = pMax > pMin ? (priceOf(e) - pMin) / (pMax - pMin) : 0;
      const d = distOf(e.home);
      const sDist = Number.isFinite(d) ? Math.min(d, 15) / 15 : 0.6;
      const sAmen = 1 - e.plan.amenityScore;
      e.score = 0.55 * sPrice + 0.25 * sAmen + 0.2 * sDist;
    }

    // Ưu tiên (Nổi bật lên đầu) CHỈ áp dụng ở trạng thái MẶC ĐỊNH: mọi mức giá +
    // sắp xếp "Tối ưu (phù hợp nhất)". Khi khách đã chọn khoảng giá hoặc đổi sắp xếp
    // → bỏ ưu tiên, xếp đúng theo bộ lọc/sắp xếp.
    const prRank = (e: PlanEntry) => (e.home.featured ? (e.home.priorityOrder || 0) + 1 : 0);
    const keepPriority = priceMax == null && priceMin == null && budget == null && sort === "match";
    arr.sort((a, b) => {
      if (keepPriority) {
        const pr = prRank(b) - prRank(a);
        if (pr !== 0) return pr;
      }
      if (sort === "priceAsc") return a.bestPrice - b.bestPrice;
      if (sort === "priceDesc") return b.bestPrice - a.bestPrice;
      if (sort === "near") return distOf(a.home) - distOf(b.home) || a.bestPrice - b.bestPrice;
      return a.score - b.score || a.bestPrice - b.bestPrice;
    });
    return arr;
  }, [homes, buses, budget, priceMax, priceMin, zone, homeName, sort]);

  const bestPlanId = buses.length > 0 && entries.length > 0 ? entries[0].plan.id : null;

  const [visible, setVisible] = useState(Math.min(3, entries.length));
  useEffect(() => {
    if (visible >= entries.length) return;
    const t = setTimeout(() => setVisible((v) => Math.min(entries.length, v + 1)), 140);
    return () => clearTimeout(t);
  }, [visible, entries.length]);

  return (
    <div>
      {/* Tiêu đề danh sách */}
      <div className="mb-3">
        <div className="text-[clamp(22px,2.6vw,28px)] font-extrabold tracking-[-0.02em] text-ink">
          {tr("{0} phương án combo", [entries.length])}
        </div>
        <ItineraryLink nights={nights} className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-forest-700 hover:text-sunset-500" />
        <div className="mt-1 text-sm text-gray-500">
          {buses.length}{" "}{tr("nhà xe ·")}{" "}{adults}{" "}{tr("người lớn")}{childrenAges.length > 0 ? tr(" · {0} trẻ em ({1} tuổi)", [childrenAges.length, childrenAges.join(", ")]) : ""} · {nights}{" "}{tr("đêm (")}{fmtDayKey(checkIn)} → {fmtDayKey(checkOut)})
          {origin && <>{" "}{tr("· đón tại")}{" "}<span className="font-bold text-ink">{tr(origin)}</span></>}
          {priceMax != null ? (
            <>{" "}{tr("· mức giá")}{" "}<span className="font-semibold text-forest-700">{tr("dưới {0}", [tr(vnd(priceMax))])}</span>{tr("/khách")}</>
          ) : priceMin != null ? (
            <>{" "}{tr("· mức giá")}{" "}<span className="font-semibold text-forest-700">{tr("trên {0}", [tr(vnd(priceMin))])}</span>{tr("/khách")}</>
          ) : budget != null ? (
            <>{" "}{tr("· khớp giá mong muốn")}{" "}<span className="font-semibold text-forest-700">{tr(vnd(budget))}</span>{tr("/khách")}</>
          ) : null}
        </div>
      </div>

      {/* Thanh lọc kết quả: Xem theo nhà · Khu vực · Sắp xếp — dropdown CHỮ MẢNH,
          không khung (đồng bộ kiểu lọc nhanh của trang danh sách homestay). */}
      {/* Desktop: bộ lọc (trái) + công tắc chế độ combo (phải) cùng MỘT hàng; mobile: công tắc full ngang bên dưới. */}
      <div className="mb-4 lg:flex lg:items-center lg:justify-between lg:gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 lg:flex-1 lg:flex-nowrap lg:gap-x-4">
        {homeNames.length > 1 && (
          <label className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-gray-500 lg:shrink">
            <span className="flex-none whitespace-nowrap">{tr("Xem theo homestay")}</span>
            <select value={homeName} onChange={(e) => setHomeName(e.target.value)} className={SEL} style={{ color: "oklch(0.29 0.055 160)" }}>
              <option value="all">{tr("Tất cả homestay")}</option>
              {homeNames.map((n) => (
                <option key={n} value={n}>{tr(n)}</option>
              ))}
            </select>
          </label>
        )}
        {zones.length > 1 && (
          <label className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-gray-500 lg:shrink">
            <span className="flex-none whitespace-nowrap">{tr("Khu vực")}</span>
            <select value={zone} onChange={(e) => setZone(e.target.value)} className={SEL} style={{ color: "oklch(0.52 0.12 50)" }}>
              <option value="all">{tr("Mọi khu vực")}</option>
              {zones.map((z) => (
                <option key={z} value={z}>{tr(z.replace(/^Trung tâm Tà Xùa$/i, "Trung tâm"))}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-gray-500 lg:shrink">
          <span className="flex-none whitespace-nowrap">{tr("Sắp xếp")}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={SEL} style={{ color: "oklch(0.29 0.055 160)" }}>
            <option value="match">{budget != null ? tr("Tối ưu (khớp giá · tiện ích · vị trí)") : tr("Tối ưu (giá · tiện ích · vị trí)")}</option>
            <option value="priceAsc">{tr("Giá thấp → cao")}</option>
            <option value="priceDesc">{tr("Giá cao → thấp")}</option>
            <option value="near">{tr("Gần trung tâm nhất")}</option>
          </select>
        </label>
      </div>
        <div className="flex justify-end pt-5 lg:ml-auto lg:flex-none lg:pt-0"><ComboModeSlot /></div>
      </div>

      <div className="flex flex-col gap-4">
        {entries.slice(0, visible).map((e) => (
          <ComboPlanCard
            key={e.plan.id}
            home={e.home}
            plan={e.plan}
            buses={buses}
            people={e.home.billable}
            freeChildren={e.home.freeChildren}
            adults={adults}
            childrenAges={childrenAges}
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

      {visible < entries.length && <p className="mt-4 text-center text-sm text-gray-400">{tr("Đang hiện thêm…")}</p>}

      {homes.length > 0 && entries.length === 0 && (
        <div className="flex flex-col items-center gap-2.5 rounded-[22px] border border-dashed border-[oklch(0.85_0.02_230)] bg-white px-6 py-12 text-center">
          <div className="text-[17px] font-extrabold text-ink">{tr("Không có phương án khớp bộ lọc")}</div>
          <div className="max-w-[420px] text-sm text-gray-500">{tr("Thử chọn khu vực hoặc homestay khác cho ngày này.")}</div>
          <button
            type="button"
            onClick={() => { setZone("all"); setHomeName("all"); }}
            className="mt-1 rounded-full bg-forest-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-forest-700"
          >
            {tr("Xoá bộ lọc")}
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
  freeChildren,
  adults,
  childrenAges,
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
  /** Số khách TÍNH PHÍ ở home này (người lớn + trẻ ≥ ngưỡng) — chia giá & xếp chỗ theo số này. */
  people: number;
  /** Số trẻ MIỄN PHÍ ở home này (ở cùng, không tính tiền). */
  freeChildren: number;
  adults: number;
  childrenAges: number[];
  nights: number;
  budget: number | null;
  best: boolean;
  checkIn: string;
  checkOut: string;
  fromKey: string;
  toKey: string;
  origin: string | null;
}) {
  const tr = useT();
  // Chỉ những xe còn đủ chỗ cho số khách tính phí của home này.
  const usableBuses = useMemo(
    () => buses.filter((b) => cabinAllocation(people, b.seatsAvailable) != null),
    [buses, people],
  );
  const [busId, setBusId] = useState(usableBuses[0]?.serviceId ?? "");
  const bus = useMemo(() => usableBuses.find((b) => b.serviceId === busId) ?? usableBuses[0], [usableBuses, busId]);

  // Chỗ nằm xe cabin THEO NGƯỜI: cbDouble = số khách nằm ghép, cbSingle = số khách nằm riêng
  // (×2 vé), tổng luôn = số khách. Mặc định cả đoàn nằm ghép. Đổi xe → xếp lại.
  const defaultAlloc = (b: ComboBusOption | undefined) =>
    (b && cabinAllocation(people, b.seatsAvailable)) ?? { nDouble: people, nSingle: 0 };
  const [cbDouble, setCbDouble] = useState(() => defaultAlloc(bus).nDouble);
  const [cbSingle, setCbSingle] = useState(() => defaultAlloc(bus).nSingle);
  useEffect(() => {
    const a = defaultAlloc(bus);
    setCbDouble(a.nDouble);
    setCbSingle(a.nSingle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus?.serviceId, people]);
  const cabinCovered = cbSingle + cbDouble;
  // Chuyển 1 khách giữa nằm ghép ↔ nằm riêng (tổng luôn = số khách).
  const toSolo = () => { if (cbDouble > 0) { setCbDouble(cbDouble - 1); setCbSingle(cbSingle + 1); } };
  const toShared = () => { if (cbSingle > 0) { setCbSingle(cbSingle - 1); setCbDouble(cbDouble + 1); } };

  // Khách chọn ĐÚNG CĂN cho từng nhóm (nhóm còn nhiều căn hơn số cần). pick[gi] = mảng roomId đã chọn.
  const [pick, setPick] = useState<Record<number, string[]>>({});
  const pickedFor = (gi: number, g: ComboStayPlan["groups"][number]) =>
    g.options.length <= g.count ? g.roomIds : pick[gi] ?? g.roomIds.slice(0, g.count);
  function toggleUnit(gi: number, g: ComboStayPlan["groups"][number], roomId: string) {
    setPick((prev) => {
      const cur = prev[gi] ?? g.roomIds.slice(0, g.count);
      let nx = cur.includes(roomId) ? cur.filter((x) => x !== roomId) : [...cur, roomId];
      if (nx.length > g.count) nx = nx.slice(nx.length - g.count); // giữ đúng số căn cần
      return { ...prev, [gi]: nx };
    });
  }
  const chosenRoomIds = useMemo(
    () => plan.groups.flatMap((g, i) => pickedFor(i, g)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, pick],
  );
  // Thiếu căn ở nhóm nào (chọn chưa đủ) → chặn đặt, nhắc chọn.
  const missing = plan.groups.some((g, i) => g.options.length > g.count && pickedFor(i, g).length !== g.count);

  // Tiêu đề = gộp theo hạng ("2× Phòng đôi + 1× Phòng đơn"); cover = ảnh phòng đại diện.
  // Dịch TỪNG tên hạng phòng trước khi ghép (tr() cả chuỗi ghép không khớp khoá nào ⇒ trước đây luôn hiện tiếng Việt).
  const title = plan.groups.map((g) => `${g.count}× ${tr(g.room.typeName)}`).join(" + ");
  const cover = plan.groups[0]?.room.cover ?? home.cover;
  const totalPics = plan.groups.reduce((n, g) => n + (g.room.images.length || (g.room.cover ? 1 : 0)), 0);

  const amenities = useMemo(() => {
    const out: string[] = [];
    for (const [k, label] of FEAT) if (plan.groups.some((g) => g.room.features[k])) out.push(label);
    const r0 = plan.groups[0]?.room;
    if (r0?.pool) out.push(tr("🏊 Hồ bơi"));
    if (r0?.easyRoad) out.push(tr("🛣️ Đường dễ đi"));
    return out;
  }, [plan]);

  const roomShare = Math.round(plan.roomCost / people);
  const fare = bus?.farePerPerson ?? 0;
  const cabinCost = cabinSeatTotal(fare, cbDouble, cbSingle); // ghép = fare/người, riêng = 2×fare/người
  // Tổng = tiền phòng thật cả đoàn (khớp server createComboBooking), không nhân lại roomShare đã làm tròn.
  const total = Math.max(0, plan.roomCost + cabinCost - (plan.noDiscount ? 0 : COMBO_DISCOUNT * people));
  const pricePerPerson = people > 0 ? Math.round(total / people) : 0;
  const diff = budget != null ? pricePerPerson - budget : null;
  // Giá gạch (niêm yết) trọn gói khi phòng có giảm theo ngày — chỉ phần phòng đổi.
  const totalOld =
    plan.roomCostOld != null
      ? Math.max(0, plan.roomCostOld + cabinCost - (plan.noDiscount ? 0 : COMBO_DISCOUNT * people))
      : null;
  const ppOld = totalOld != null && people > 0 ? Math.round(totalOld / people) : null;
  const hasStrike = ppOld != null && ppOld > pricePerPerson;
  // Bảng giá rõ ràng: giá bán (phòng theo giá niêm yết + vé) → KM đặt web (phần phòng) → KM combo → trọn gói.
  const roomShareOld = plan.roomCostOld != null && plan.roomCostOld > plan.roomCost ? Math.round(plan.roomCostOld / people) : roomShare;
  const webPromoPP = roomShareOld - roomShare; // / khách
  const comboPromoPP = plan.noDiscount ? 0 : COMBO_DISCOUNT; // / khách
  const webPromoTotal = plan.roomCostOld != null && plan.roomCostOld > plan.roomCost ? plan.roomCostOld - plan.roomCost : 0; // cả đoàn, không làm tròn
  const grossTotal = total + webPromoTotal + comboPromoPP * people; // giá bán cả đoàn (trước khuyến mãi)

  // Modal xem ảnh: giữ NHÓM đang mở + CĂN đang xem (ảnh/mô tả theo đúng căn đó).
  const [preview, setPreview] = useState<{ gi: number; roomId: string } | "bus" | null>(null);
  function openRoom(gi: number) {
    const g = plan.groups[gi];
    const first = pickedFor(gi, g)[0] ?? g.options[0]?.roomId ?? g.roomIds[0];
    setPreview({ gi, roomId: first });
  }

  // Tuỳ chọn thêm xe máy — dùng chung với Combo tự chọn (ComboBike.tsx).
  const bikeOpt = useComboBike({ people, nights, checkIn, checkOut });
  const { bikes, bikeTimeOk } = bikeOpt;

  const [openForm, setOpenForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
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
  useBodyScrollLock(openForm);

  async function tryOpenForm() {
    if (missing) { openRoomFirstMissing(); return; }
    setErr("");
    // Làm tươi tình trạng phòng ngay trước khi đặt (server bỏ qua nếu vừa đồng bộ <60s).
    showGlobalLoading(true, tr("Đang cập nhật tình trạng phòng mới nhất…"));
    try { await ensureSheetFresh(home.serviceId); } finally { showGlobalLoading(false); }
    setOpenForm(true);
  }
  function openRoomFirstMissing() {
    const gi = plan.groups.findIndex((g, i) => g.options.length > g.count && pickedFor(i, g).length !== g.count);
    if (gi >= 0) openRoom(gi);
  }

  const sendLock = useRef(false); // khoá tức thời chống bấm đúp ⇒ tạo 2 đơn
  async function book() {
    if (sendLock.current) return;
    setErr("");
    if (!bus) { setErr(tr("Vui lòng chọn xe cabin.")); return; }
    if (cabinCovered !== people) { setErr(tr("Chỗ nằm trên xe đang xếp {0}/{1} người.", [cabinCovered, people])); return; }
    if (people > bus.seatsAvailable) { setErr(tr("Xe chỉ còn {0} chỗ.", [bus.seatsAvailable])); return; }
    if (bikes > 0 && !bikeTimeOk) { setErr(tr("Trả xe trong ngày nhận thì giờ trả phải sau giờ nhận xe.")); return; }
    if (!name.trim()) { setErr(tr("Vui lòng nhập họ tên.")); return; }
    { const pe = vnPhoneError(phone); if (pe) { setErr(pe); return; } }
    if (!emailLooksValid(email)) { setErr(tr("Email không hợp lệ (có thể để trống).")); return; }
    sendLock.current = true;
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
          adults,
          childrenAges,
          cabinSingle: cbSingle,
          cabinDouble: cbDouble,
          ...comboBikePayload(bikeOpt),
          customerName: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) setErr(tr(data.error) ?? tr("Gửi yêu cầu thất bại, vui lòng thử lại."));
      else { trackLeadConversion(); setDone({ code: data.code }); }
    } catch {
      setErr(tr("Lỗi kết nối, vui lòng thử lại."));
    } finally {
      sendLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <article className={`overflow-hidden rounded-[22px] bg-white ${best ? "ring-2 ring-sunset-400" : "ring-1 ring-black/[0.07]"}`}>
      {best && (
        <div className="bg-sunset-500 px-4 py-1.5 text-[13px] font-bold tracking-wide text-white">
          {budget != null ? tr("Khớp giá nhất với mong muốn của bạn") : tr("Phương án tối ưu nhất (giá · tiện ích · vị trí)")}
        </div>
      )}
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
        {/* Ảnh — bấm mở gallery nhóm đầu */}
        <button type="button" onClick={() => openRoom(0)} className="group relative block min-h-[200px] cursor-zoom-in text-left">
          {cover ? (
            <Image src={cover} alt={tr(title)} fill sizes="280px" className="object-cover" />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center bg-gray-100 text-4xl">🛏️</div>
          )}
          {home.area && (
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[oklch(0.3_0.04_160)]">
              {tr(home.area)}
              {home.distanceKm != null && (home.distanceKm === 0 ? tr(" · trung tâm") : ` · ${home.distanceKm.toLocaleString("vi-VN")}km`)}
            </span>
          )}
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
            <span className="rounded-full bg-forest-700 px-2.5 py-1 text-xs font-bold text-white">
              {plan.roomCount > 1 ? tr("Ghép {0} {1}", [plan.roomCount, plan.communal ? tr("giường") : tr("phòng")]) : tr("1 phòng")}{" "}{tr("· đủ")}{" "}{plan.capacity}{" "}{tr("chỗ")}
            </span>
            {totalPics > 0 && (
              <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white">{tr("{0} ảnh", [totalPics])}</span>
            )}
          </div>
        </button>

        {/* Thân: thông tin + chọn căn + chọn xe */}
        <div className="flex min-w-0 flex-col gap-3.5 p-5">
          <div>
            <div className="text-[13px] font-semibold text-gray-500">{tr(home.title)}</div>
            <div className="text-[clamp(18px,2vw,21px)] font-extrabold leading-snug tracking-[-0.015em] text-ink">{tr(title)}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-500">
              <span>
                {plan.communal
                  ? <>{tr("Giường cộng đồng cho {0} khách · {1} đêm", [people, nights])}</>
                  : <>{tr("Đủ chỗ")}{" "}{plan.capacity}{" "}{tr("khách ·")}{" "}{nights}{" "}{tr("đêm · tiền phòng")}{" "}<b className="text-ink">{tr(vnd(plan.roomCost))}</b>{" "}{tr("cả kỳ")}</>}
              </span>
              {plan.extraGuests > 0 && (
                <span className="rounded-full bg-[oklch(0.95_0.06_70)] px-2.5 py-0.5 text-xs font-bold text-[oklch(0.48_0.15_50)]">
                  {tr("+{0} khách ở ghép · phụ thu {1}", [plan.extraGuests, tr(vnd(plan.extraCost))])}
                </span>
              )}
              {freeChildren > 0 && (
                <span className="rounded-full bg-[oklch(0.95_0.04_155)] px-2.5 py-0.5 text-xs font-bold text-[oklch(0.4_0.1_155)]">
                  {tr("+{0} trẻ dưới {1} tuổi · miễn phí, ở cùng", [freeChildren, home.childFreeUnderAge])}
                </span>
              )}
            </div>
          </div>

          {/* Từng hạng phòng trong phương án: tên + info + xem phòng + chip chọn căn */}
          <div className="flex flex-col gap-2">
            {plan.groups.map((g, gi) => {
              const sel = pickedFor(gi, g);
              const hasChoice = g.options.length > g.count;
              return (
                <div key={gi} className="flex flex-col gap-2.5 rounded-[14px] border border-[oklch(0.93_0.01_160)] bg-[oklch(0.975_0.008_160)] px-3.5 py-3">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="flex-none rounded-lg bg-forest-700 px-2 py-0.5 text-[13px] font-extrabold text-white">{g.count}×</span>
                      <div className="min-w-0">
                        <div className="text-[15px] font-bold leading-snug text-ink">{tr(g.room.typeName)}</div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {tr(vnd(g.unitCost))}/{plan.communal ? tr("người") : tr("phòng")}{" "}{tr("· tối đa")}{" "}{g.room.capacity}{" "}{tr("người")}
                          {hasChoice ? tr(" · còn {0} căn", [g.options.length]) : ""}
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={() => openRoom(gi)} className="flex-none text-[13px] font-bold text-forest-700 underline underline-offset-[3px] hover:text-sunset-600">
                      {tr("Xem phòng")}
                    </button>
                  </div>
                  {hasChoice && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-0.5 whitespace-nowrap text-xs font-bold" style={{ color: sel.length === g.count ? "oklch(0.45 0.1 155)" : O }}>
                        {tr("Chọn căn {0}/{1}:", [sel.length, g.count])}
                      </span>
                      {g.options.map((o) => {
                        const on = sel.includes(o.roomId);
                        return (
                          <button
                            key={o.roomId}
                            type="button"
                            onClick={() => toggleUnit(gi, g, o.roomId)}
                            className="rounded-full border-[1.5px] px-2.5 py-1 text-xs font-bold transition"
                            style={on ? { borderColor: G, background: G, color: "white" } : { borderColor: "oklch(0.88 0.015 160)", background: "white", color: "oklch(0.3 0.03 160)" }}
                          >
                            {tr(o.roomName)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {amenities.map((a, i) => (
                <span key={i} className="rounded-full bg-[oklch(0.95_0.025_155)] px-2.5 py-1 text-xs font-semibold text-[oklch(0.36_0.08_155)]">{tr(a)}</span>
              ))}
            </div>
          )}

          {/* Chọn xe */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">{tr("Xe cabin khứ hồi")}</div>
            {usableBuses.length === 0 ? (
              <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
                {buses.length === 0
                  ? tr("Chưa có nhà xe mở cả 2 chiều cho ngày này.")
                  : tr("Chưa có nhà xe còn đủ {0} chỗ cho ngày này.", [people])}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {usableBuses.map((b) => {
                  const on = b.serviceId === bus?.serviceId;
                  const low = b.seatsAvailable <= 5;
                  return (
                    <button
                      key={b.serviceId}
                      type="button"
                      onClick={() => setBusId(b.serviceId)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] border-[1.5px] p-2.5 text-left transition"
                      style={{ borderColor: on ? G : "oklch(0.88 0.015 160)", background: on ? "oklch(0.96 0.025 155)" : "white", flexBasis: "240px", maxWidth: "360px" }}
                    >
                      <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-2" style={{ borderColor: on ? G : "oklch(0.8 0.01 160)" }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: on ? G : "transparent" }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold text-ink">{tr(b.title)}</span>
                        <span className="block text-xs text-gray-500">{tr("Đi {0} · Về {1}", [tr(b.outboundTime), tr(b.returnTime)])}</span>
                      </span>
                      <span className="flex-none text-right">
                        <span className="block text-sm font-extrabold text-ink">{tr(vnd(b.farePerPerson))}</span>
                        <span className="block text-[11px] font-bold" style={{ color: low ? "oklch(0.52 0.15 50)" : "oklch(0.45 0.1 155)" }}>{low ? tr("Còn {0}", [b.seatsAvailable]) : tr("Còn chỗ")}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Giá + đặt */}
        <div className="flex flex-col gap-2.5 border-t border-gray-100 bg-[oklch(0.98_0.008_70)] p-5 lg:border-l lg:border-t-0">
          {diff != null && (
            <span className="self-start rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: Math.abs(diff) <= 50000 ? "oklch(0.95 0.05 155)" : "oklch(0.95 0.03 250)", color: Math.abs(diff) <= 50000 ? "oklch(0.38 0.1 155)" : "oklch(0.42 0.1 250)" }}>
              {diff === 0 ? tr("Đúng giá mong muốn") : diff > 0 ? tr("Cao hơn {0}", [tr(vnd(diff))]) : tr("Thấp hơn {0}", [tr(vnd(-diff))])}
            </span>
          )}
          <div>
            <div className="text-xs text-gray-500">{tr("Trọn gói / khách")}</div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              {hasStrike && <span className="whitespace-nowrap text-base font-semibold text-gray-400 line-through">{tr(vnd(ppOld!))}</span>}
              <span className="whitespace-nowrap text-[26px] min-[380px]:text-[30px] font-extrabold leading-tight tracking-[-0.03em] text-sunset-600">{tr(vnd(pricePerPerson))}</span>
            </div>
            <div className="mt-0.5 text-[13px] font-semibold text-gray-500">≈ {tr(vnd(total))} cho {people}{" "}{tr("người")}{freeChildren > 0 ? tr(" (+{0} trẻ miễn phí)", [freeChildren]) : ""}</div>
          </div>
          <div className="flex flex-col gap-1.5 border-t border-dashed border-[oklch(0.88_0.02_70)] pt-2.5 text-xs leading-relaxed text-gray-500">
            <div className="flex justify-between gap-2">
              <span>{plan.communal ? tr("Giường cộng đồng / khách") : tr("Tiền phòng ÷ {0} khách", [people])}</span>
              <span className="font-bold text-ink">{tr(vnd(roomShareOld))}</span>
            </div>
            <div className="flex justify-between gap-2"><span>{tr("Vé khứ hồi")}{bus?.fareOrigin ? tr(" từ {0}", [tr(bus.fareOrigin)]) : ""}{" "}{tr("/ khách")}</span><span className="font-bold text-ink">{tr(vnd(bus?.farePerPerson ?? 0))}</span></div>
            <PriceLine className="text-xs" promo label={tr("🎁 Khuyến mãi khi đặt trên website")} amount={webPromoPP} />
            <PriceLine className="text-xs" promo label={tr("🎁 Khuyến mãi combo khi đặt trên website")} amount={comboPromoPP} />
          </div>
          <div className="flex-1" />
          {missing && <div className="text-xs font-bold text-sunset-600">{tr("Chọn đủ căn phòng để đặt")}</div>}

          <button
            type="button"
            onClick={tryOpenForm}
            disabled={!bus}
            className="rounded-full py-3 text-center text-sm font-extrabold text-white transition hover:bg-sunset-500 disabled:opacity-50"
            style={{ background: G }}
          >
            {tr("Đặt combo này →")}
          </button>
          <button type="button" onClick={() => openRoom(0)} className="text-center text-[13px] font-bold text-forest-700 hover:text-sunset-600">
            {tr("Xem ảnh & chi tiết phòng")}
          </button>
          {bus && (
            <button type="button" onClick={() => setPreview("bus")} className="text-center text-[13px] font-semibold text-gray-400 hover:text-forest-700">
              {tr("Xem lộ trình xe")}
            </button>
          )}
        </div>
      </div>

      {/* Panel đặt combo (trượt phải desktop / full mobile) */}
      {/* Portal ra body: wrapper trang combo có `relative z-[5]` (stacking context) khiến header z-40 đè lên panel → mất nút đóng trên mobile */}
      {openForm && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => !submitting && setOpenForm(false)}
          className="fixed inset-0 z-[60] flex justify-end bg-black/50 transition-opacity duration-300"
          style={{ opacity: panelIn ? 1 : 0 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-[440px] flex-col overflow-y-auto overscroll-contain bg-white shadow-2xl transition-transform duration-300 will-change-transform"
            style={{ transform: panelIn ? "translateX(0)" : "translateX(100%)" }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
              <div className="text-lg font-extrabold text-ink">{done ? tr("Đã gửi yêu cầu combo") : tr("Đặt combo này")}</div>
              <button type="button" onClick={() => setOpenForm(false)} aria-label={tr("Đóng")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[oklch(0.95_0.005_160)] text-2xl leading-none text-gray-600 hover:bg-gray-200">×</button>
            </div>

            {done ? (
              <div className="flex flex-col gap-3 p-5">
                <div className="rounded-xl bg-forest-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-forest-700">{tr("Mã yêu cầu")}</div>
                  <div className="mt-0.5 text-2xl font-extrabold text-ink">{tr(done.code)}</div>
                  <div className="mt-1 text-sm leading-relaxed text-gray-600"><We cap />{" "}{tr("sẽ gọi")}{" "}<b>{tr(phone)}</b>{" "}{tr("để xác nhận xe, phòng và chốt giá. Chưa thanh toán online.")}</div>
                </div>
                <ComboBikeDoneNote state={bikeOpt} />
                <SupportHoursNote />
                <button type="button" onClick={() => setOpenForm(false)} className="rounded-full bg-forest-600 py-3 text-center text-sm font-bold text-white hover:bg-forest-700">Xong</button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-5">
                <div className="flex flex-col gap-1.5 rounded-xl bg-[oklch(0.975_0.008_150)] p-3.5 text-[13px]">
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Homestay</span><span className="font-bold text-ink">{tr(home.title)}</span></div>
                  {plan.groups.map((g, gi) => {
                    const names = pickedFor(gi, g)
                      .map((id) => g.options.find((o) => o.roomId === id)?.roomName)
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <div key={gi} className="flex justify-between gap-2">
                        <span className="text-gray-500">{gi === 0 ? tr("Phòng") : ""}</span>
                        <span className="text-right font-bold text-ink">{g.count}× {tr(g.room.typeName)}{names ? ` · ${tr(names)}` : ""}</span>
                      </div>
                    );
                  })}
                  {plan.extraGuests > 0 && (
                    <div className="flex justify-between gap-2"><span className="text-gray-500">{tr("Ở ghép")}</span><span className="font-bold text-sunset-600">{tr("+{0} khách · phụ thu {1}", [plan.extraGuests, tr(vnd(plan.extraCost))])}</span></div>
                  )}
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Xe cabin</span><span className="text-right font-bold text-ink">{tr("{0} · đi {1} / về {2}", [tr(bus?.title), tr(bus?.outboundTime), tr(bus?.returnTime)])}</span></div>
                  {origin && (
                    <div className="flex justify-between gap-2"><span className="text-gray-500">{tr("Điểm đón")}</span><span className="font-bold text-ink">{tr(origin)}</span></div>
                  )}
                  <ComboSchedule fromKey={fromKey} toKey={toKey} checkIn={checkIn} checkOut={checkOut} nights={nights} outTime={bus?.outboundTime ?? null} retTime={bus?.returnTime ?? null} origin={null} />
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{tr("Khách")}</span>
                    <span className="text-right font-bold text-ink">
                      {adults}{" "}{tr("người lớn")}{childrenAges.length > 0 ? tr(" · {0} trẻ ({1} tuổi)", [childrenAges.length, childrenAges.join(", ")]) : ""}
                      {freeChildren > 0 && <span className="font-bold text-forest-700">{" "}{tr("· {0} miễn phí", [freeChildren])}</span>}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-col gap-1 border-t border-gray-200 pt-1.5">
                    <PriceLine className="text-[13px]" label={tr("Giá bán ({0} người)", [people])} amount={grossTotal} />
                    <PriceLine className="text-[13px]" promo label={tr("🎁 Khuyến mãi khi đặt trên website")} amount={webPromoTotal} />
                    <PriceLine className="text-[13px]" promo label={tr("🎁 Khuyến mãi combo khi đặt trên website")} amount={comboPromoPP * people} />
                  </div>
                  <div className="mt-1 flex justify-between gap-2 border-t border-gray-200 pt-1.5"><span className="text-gray-500">{tr("Trọn gói")}</span><span className="text-right font-extrabold text-sunset-600">{hasStrike && <span className="mr-1.5 text-xs font-semibold text-gray-400 line-through">{tr(vnd(ppOld!))}</span>}{tr(vnd(pricePerPerson))}{tr("/khách ·")}{" "}{tr(vnd(total))} / {people}{" "}{tr("người")}</span></div>
                </div>

                {/* Xe máy = dịch vụ đi kèm TÍNH RIÊNG: không cộng vào bill combo, trả khi giao xe */}
                <ComboBikeSummary state={bikeOpt} />

                {/* Chỗ nằm trên xe cabin: chọn nằm ghép (đôi) / nằm riêng (đơn) */}
                <div className="flex flex-col gap-2.5 rounded-xl border border-gray-200 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-bold text-ink">{tr("Chỗ nằm trên xe cabin")}</div>
                    <div className="text-xs font-bold text-forest-700">{tr("{0} khách", [people])}</div>
                  </div>
                  {([
                    { label: tr("Cabin đôi · nằm ghép"), sub: tr("Tính theo người · đi lẻ nhà xe xếp ghép cùng khách khác"), value: cbDouble, per: fare, inc: toShared, dec: toSolo },
                    { label: tr("Cabin đơn · nằm riêng"), sub: tr("Bao trọn 1 buồng · ×2 giá vé"), value: cbSingle, per: 2 * fare, inc: toSolo, dec: toShared },
                  ] as const).map((r) => (
                    <div key={r.label} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-ink">{tr(r.label)}</div>
                        <div className="text-xs text-gray-500">{tr(r.sub)} · <b className="text-forest-700">{tr("{0}/người", [tr(vnd(r.per))])}</b></div>
                      </div>
                      <div className="flex flex-none items-center gap-2.5">
                        <button type="button" onClick={r.dec} disabled={r.value <= 0} className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-lg font-bold text-ink disabled:opacity-40">−</button>
                        <span className="w-5 text-center text-base font-extrabold text-ink">{r.value}</span>
                        <button type="button" onClick={r.inc} disabled={r.value >= people} className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-lg font-bold text-ink disabled:opacity-40">+</button>
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] leading-relaxed text-gray-400">{tr("Giá vé khứ hồi tính theo người. Nằm ghép: mỗi người 1 vé. Nằm riêng (bao trọn buồng): mỗi người ×2 giá vé.")}</p>
                </div>

                {/* Tuỳ chọn thêm: thuê xe máy (mặc định không tick) */}
                <ComboBikePicker state={bikeOpt} />

                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Họ và tên *")} className="rounded-xl border border-gray-200 px-3.5 py-3 text-sm outline-none focus:border-forest-500" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder={tr("Số điện thoại *")} className="rounded-xl border border-gray-200 px-3.5 py-3 text-sm outline-none focus:border-forest-500" />
                <BookingEmailField value={email} onChange={setEmail} inputClassName="rounded-xl border border-gray-200 px-3.5 py-3 text-sm outline-none focus:border-forest-500" />
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Ghi chú (giờ đón, trẻ nhỏ…)")} className="rounded-xl border border-gray-200 px-3.5 py-3 text-sm outline-none focus:border-forest-500" />
                {err && <div className="text-sm font-semibold text-red-600">{tr(err)}</div>}
                <button type="button" onClick={book} disabled={submitting} className="rounded-full bg-sunset-500 py-3.5 text-center text-sm font-bold text-white hover:bg-sunset-600 disabled:opacity-60">
                  {submitting ? tr("Đang gửi...") : tr("Gửi yêu cầu đặt combo")}
                </button>
                <ItineraryLink nights={nights} />
                <CommitmentLink className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-forest-700 transition hover:text-forest-900" />
                <p className="text-center text-xs leading-relaxed text-gray-500">{tr("Giá tham khảo · chủ dịch vụ gọi xác nhận, không thanh toán online.")}</p>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* Modal xem ảnh PHÒNG — theo đúng CĂN đang chọn (chuyển căn để xem ảnh/mô tả căn khác) */}
      {preview && preview !== "bus" && (() => {
        const g = plan.groups[preview.gi];
        const opt = g.options.find((o) => o.roomId === preview.roomId) ?? g.options[0];
        const room: ComboRoomOption = opt?.room ?? g.room;
        const imgs = room.images.length ? room.images : room.cover ? [room.cover] : [];
        const sel = pickedFor(preview.gi, g);
        const picked = sel.includes(room.roomId);
        return (
          <RoomPreview
            title={`${tr(g.room.typeName)}${opt ? ` · ${tr(opt.roomName)}` : ""}`}
            home={home.title}
            images={imgs}
            onClose={() => setPreview(null)}
          >
            {/* Chuyển giữa các căn trong nhóm — xem đúng ảnh từng căn (căn đang đặt có dấu ✓) */}
            {g.options.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 text-xs font-bold text-gray-500">
                  {g.count > 1 ? tr("Xem ảnh {0} căn (đặt {1} căn):", [g.options.length, g.count]) : tr("Xem ảnh căn:")}
                </span>
                {g.options.map((o) => {
                  const viewing = o.roomId === room.roomId;
                  const booked = sel.includes(o.roomId);
                  return (
                    <button
                      key={o.roomId}
                      type="button"
                      onClick={() => setPreview({ gi: preview.gi, roomId: o.roomId })}
                      className="rounded-full border-[1.5px] px-2.5 py-1 text-xs font-bold transition"
                      style={
                        viewing
                          ? { borderColor: G, background: G, color: "white" }
                          : booked
                            ? { borderColor: G, background: "oklch(0.96 0.025 155)", color: "oklch(0.3 0.06 160)" }
                            : { borderColor: "oklch(0.88 0.015 160)", background: "white", color: "oklch(0.3 0.03 160)" }
                      }
                    >
                      {booked && !viewing ? "✓ " : ""}{tr(o.roomName)}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {([
                [tr("Tiêu chuẩn"), tr("{0} người/{1}", [room.capacity, plan.communal ? tr("giường") : tr("phòng")])],
                [tr("Giá cả kỳ"), tr(vnd(g.unitCost))],
                // Số đêm + ngày tách 2 dòng: ô chỉ rộng 1/3 trên mobile, "1 đêm · 17/11→18/11" liền một khối sẽ tràn
                [tr("Thời gian"), tr("{0} đêm", [nights]), `${fmtDayKey(checkIn)} → ${fmtDayKey(checkOut)}`],
              ] as [string, string, string?][]).map(([k, v, sub]) => (
                <div key={k} className="min-w-0 rounded-xl bg-[oklch(0.97_0.008_160)] p-2.5">
                  <div className="text-[11px] font-semibold text-gray-500">{k}</div>
                  <div className="mt-0.5 break-words text-sm font-extrabold text-ink">{v}</div>
                  {sub && <div className="mt-0.5 break-words text-[12px] font-semibold text-gray-600">{sub}</div>}
                </div>
              ))}
            </div>
            {(amenities.length > 0 || room.amenityList.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {[...amenities, ...room.amenityList.filter((a) => !amenities.some((x) => x.includes(a)))].map((a, i) => (
                  <span key={i} className="rounded-full bg-[oklch(0.95_0.025_155)] px-2.5 py-1 text-xs font-semibold text-[oklch(0.36_0.08_155)]">{tr(a)}</span>
                ))}
              </div>
            )}
            {room.description && <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{tr(room.description)}</p>}
            <div className="rounded-xl bg-[oklch(0.98_0.008_70)] p-3.5 text-sm leading-relaxed text-gray-600">
              {tr("Phương án")}{" "}<b>{tr(title)}</b> · xe {tr(bus?.title) ?? "cabin"}: <b className="text-sunset-600">{tr("{0}/khách", [tr(vnd(pricePerPerson))])}</b> (≈ {tr(vnd(total))} cho {people}{" "}{tr("người)")}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  // Chọn luôn căn đang xem (nếu nhóm còn phải chọn) rồi mở form đặt.
                  if (g.options.length > g.count && !picked) toggleUnit(preview.gi, g, room.roomId);
                  setPreview(null);
                  setErr("");
                  setOpenForm(true);
                }}
                className="flex-1 rounded-full bg-sunset-500 py-3 text-center text-sm font-bold text-white hover:bg-sunset-600"
              >
                {g.options.length > g.count && !picked ? tr("Chọn căn này & đặt combo →") : tr("Đặt combo với phương án này →")}
              </button>
              <Link
                href={`/homestay/${home.slug}?from=${encodeURIComponent(checkIn)}&to=${encodeURIComponent(checkOut)}`}
                target="_blank"
                className="whitespace-nowrap text-xs font-semibold text-gray-400 underline-offset-2 hover:text-forest-700 hover:underline"
              >
                {tr("Trang chi tiết ↗")}
              </Link>
            </div>
          </RoomPreview>
        );
      })()}

      {/* Modal xem lộ trình XE */}
      {preview === "bus" && bus && (
        <RoomPreview title={tr("{0} · xe cabin khứ hồi", [tr(bus.title)])} home="" images={bus.images.length ? bus.images : bus.cover ? [bus.cover] : []} onClose={() => setPreview(null)}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-[oklch(0.975_0.008_150)] p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{tr("Chiều đi")}</div>
              <div className="mt-0.5 font-bold text-ink">{tr(fmtDayKey(fromKey))} · {tr(bus.outboundTime)}</div>
            </div>
            <div className="rounded-xl bg-[oklch(0.975_0.008_150)] p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{tr("Chiều về")}</div>
              <div className="mt-0.5 font-bold text-ink">{tr(fmtDayKey(toKey))} · {tr(bus.returnTime)}</div>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            {tr("Vé khứ hồi")}{bus.fareOrigin ? tr(" từ {0}", [tr(bus.fareOrigin)]) : ""} <b className="text-ink">{tr("{0}/khách", [tr(vnd(bus.farePerPerson))])}</b> ·{" "}
            <b className="text-[oklch(0.38_0.1_155)]">{bus.seatsAvailable <= 5 ? tr("Còn {0} chỗ", [bus.seatsAvailable]) : tr("Còn chỗ")}</b>
          </div>
          {[[tr("Lộ trình chiều đi"), bus.outboundStops] as const, [tr("Lộ trình chiều về"), bus.returnStops] as const].map(
            ([label, stops]) =>
              stops.length > 0 && (
                <div key={label}>
                  <div className="text-xs font-extrabold tracking-wide text-sunset-600">{label.toUpperCase()}</div>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {stops.map((st, i) => (
                      <li key={i} className="flex items-baseline gap-2.5 text-sm">
                        <span className="w-12 shrink-0 font-bold text-ink">{tr(st.time)}</span>
                        <span className="text-gray-600">{tr(st.place)}{st.tag ? <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">{tr(st.tag)}</span> : null}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )}
          <Link
            href={`/xe-cabin/${bus.slug}?from=${encodeURIComponent(fromKey)}&to=${encodeURIComponent(toKey)}`}
            target="_blank"
            className="self-start text-xs font-semibold text-gray-400 underline-offset-2 hover:text-forest-700 hover:underline"
          >
            {tr("Trang nhà xe ↗")}
          </Link>
        </RoomPreview>
      )}
    </article>
  );
}

function fmtDayKey(key: string): string {
  return dmy(key);
}

/** Khoá cuộn trang nền khi mở modal/panel — tránh vuốt xuyên làm thanh địa chỉ mobile co giãn, đẩy mép trên (nút ×) ra khỏi màn hình. */
function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [active]);
}

/** Modal ảnh + nội dung: bottom sheet mobile, hộp giữa desktop (theo thiết kế Combo Kết quả). */
function RoomPreview({ title, home, images, onClose, children }: { title: string; home: string; images: string[]; onClose: () => void; children: ReactNode }) {
  const tr = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useBodyScrollLock(true);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[22px] bg-white shadow-2xl sm:max-w-[760px] sm:rounded-[22px]"
      >
        <div className="flex flex-none items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          <div className="min-w-0">
            {home && <div className="text-[12px] font-semibold text-gray-500">{tr(home)}</div>}
            <div className="truncate text-[17px] font-extrabold text-ink">{tr(title)}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={tr("Đóng")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[oklch(0.95_0.005_160)] text-2xl leading-none text-gray-600 hover:bg-gray-200">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 pb-0">
            <Gallery images={images} alt={tr(title)} />
          </div>
          <div className="flex flex-col gap-3 p-5">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Ảnh lớn 16:9 + nút ‹ › + dải thumbnail (reset khi đổi bộ ảnh / đổi căn). */
function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const tr = useT();
  const [idx, setIdx] = useState(0);
  const key = images[0] ?? "";
  useEffect(() => { setIdx(0); }, [key]);
  if (images.length === 0) {
    return <div className="flex aspect-[16/9] items-center justify-center rounded-2xl bg-gray-100 text-5xl">🛏️</div>;
  }
  const cur = images[Math.min(idx, images.length - 1)];
  const go = (d: number) => setIdx((i) => (i + d + images.length) % images.length);
  return (
    <div>
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-gray-100">
        <Image src={cur} alt={tr(alt)} fill sizes="760px" className="object-cover" />
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={tr("Ảnh trước")} className="absolute left-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-ink hover:bg-white">‹</button>
            <button type="button" onClick={() => go(1)} aria-label={tr("Ảnh sau")} className="absolute right-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-ink hover:bg-white">›</button>
            <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white">{idx + 1} / {images.length}</span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {images.map((u, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              className="relative h-[56px] w-[80px] shrink-0 overflow-hidden rounded-lg"
              style={i === idx ? { boxShadow: `0 0 0 2px ${O}` } : { opacity: 0.7 }}
            >
              <Image src={u} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
