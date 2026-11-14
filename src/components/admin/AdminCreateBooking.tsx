"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ServiceCategory } from "@prisma/client";
import { cabinSeatTotal } from "@/lib/combo-pricing";
import { adminExtraCost } from "@/lib/occupancy";
import {
  createAdminBooking,
  updateAdminBooking,
  quoteAdminBooking,
  quoteCabinFare,
  type AdminQuote,
  type CabinFareQuote,
} from "@/app/admin/bookings/new/actions";

type Kind = "stay" | "trip" | "rental" | "transport";

interface Props {
  categories: { key: ServiceCategory; label: string; kind: Kind }[];
  services: { id: string; title: string; category: ServiceCategory; published: boolean }[];
  ctvs: { id: string; name: string }[];
  todayKey: string;
  /** Giảm giá combo mỗi khách (COMBO_DISCOUNT). */
  comboDiscount: number;
  /** Có ⇒ chế độ SỬA ĐƠN: nạp sẵn dữ liệu đơn, lưu qua updateAdminBooking. */
  edit?: EditInit;
  /** Có ⇒ form nằm trong POPUP sửa đơn: lưu xong không chuyển trang mà gọi hàm này (đóng popup). */
  onSaved?: () => void;
}

/** Dữ liệu đơn hiện tại để nạp vào form sửa. */
export interface EditInit {
  bookingId: string;
  cat: ServiceCategory;
  serviceId: string;
  busId: string;
  from: string;
  to: string;
  qty: number;
  shared: number;
  solo: number;
  pick: string;
  pickIds: string[];
  outId: string;
  retId: string;
  origin: string;
  price: number | null;
  roomAmt: number | null;
  busAmt: number | null;
  discount: number;
  surchargeTotal: number;
  customerName: string;
  phone: string;
  customerFacebook: string;
  ctvId: string;
  note: string;
  adminNote: string;
  /** Đơn đang giữ chỗ (đã trừ tồn) ⇒ lưu sẽ trả chỗ cũ & giữ lại theo lựa chọn mới. */
  inventoryApplied: boolean;
}

const STATUS_OPTS = [
  { v: "NEW", l: "Mới", c: "oklch(0.6 0.14 250)" },
  { v: "CONTACTING", l: "Đang liên hệ", c: "oklch(0.7 0.15 80)" },
  { v: "CONFIRMED", l: "Đã xác nhận", c: "oklch(0.55 0.13 155)" },
  { v: "COMPLETED", l: "Hoàn thành", c: "oklch(0.5 0.03 160)" },
  { v: "CANCELLED", l: "Đã huỷ", c: "oklch(0.6 0.2 25)" },
] as const;

const PAY_OPTS = [
  { v: "UNPAID", l: "Chưa thu" },
  { v: "DEPOSITED", l: "Đã cọc" },
  { v: "PAID", l: "Đã thanh toán đủ" },
] as const;

const fmt = (n: number) => n.toLocaleString("vi-VN");
const digits = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;
const fmtInput = (s: string) => {
  const n = s.replace(/[^\d]/g, "");
  return n ? fmt(Number(n)) : "";
};

const card = "rounded-2xl border border-gray-200 bg-white p-4 sm:p-5";
const label = "mb-1 block text-[13px] font-bold text-gray-600";
const input =
  "w-full min-w-0 rounded-lg border-[1.5px] border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-forest-500 focus:outline-none";
const chip = (on: boolean) =>
  `cursor-pointer whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-2 text-sm font-bold ${
    on ? "border-forest-700 bg-forest-700 text-white" : "border-gray-200 bg-white text-ink hover:bg-gray-50"
  }`;

/**
 * Ô nhập tiền CÓ ĐIỀU KHIỂN (giá gợi ý tự điền) — cùng nguyên tắc với `MoneyInput`:
 * ĐANG GÕ chỉ hiện số thô (chèn dấu chấm giữa lúc gõ làm bàn phím điện thoại / bộ gõ
 * tiếng Việt nhân đôi ký tự: 600000 → 660000); rời ô mới định dạng "600.000".
 */
function MoneyField({
  name,
  value,
  onChange,
  readOnly,
  required,
  placeholder,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const raw = value.replace(/[^\d]/g, "");
  return (
    <>
      <input
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={focused && !readOnly ? raw : fmtInput(value)}
        readOnly={readOnly}
        required={required}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        className={`${input} ${readOnly ? "bg-gray-50" : ""}`}
      />
      {focused && !readOnly && raw && <p className="mt-0.5 text-xs font-semibold text-gray-500">= {fmt(Number(raw))}đ</p>}
    </>
  );
}

function addDay(key: string): string {
  const d = new Date(key + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function AdminCreateBooking({ categories, services, ctvs, todayKey, comboDiscount, edit, onSaved }: Props) {
  const [state, formAction, submitting] = useActionState(edit ? updateAdminBooking : createAdminBooking, {});
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });
  useEffect(() => {
    if (state.ok) onSavedRef.current?.();
  }, [state]);
  const [cat, setCat] = useState<ServiceCategory>(edit?.cat ?? categories[0]?.key ?? "HOMESTAY");
  const [serviceId, setServiceId] = useState(edit?.serviceId ?? "");
  const [from, setFrom] = useState(edit?.from ?? todayKey);
  const [to, setTo] = useState(edit?.to ?? "");
  const [qty, setQty] = useState(edit?.qty ?? 2);
  const [shared, setShared] = useState(edit?.shared ?? 2);
  const [solo, setSolo] = useState(edit?.solo ?? 0);

  const [quote, setQuote] = useState<AdminQuote | null>(null);
  const [loading, startQuote] = useTransition();
  const [pick, setPick] = useState(edit?.pick ?? "");
  const [outId, setOutId] = useState(edit?.outId ?? "");
  const [retId, setRetId] = useState(edit?.retId ?? "");
  const [fare, setFare] = useState<number | null>(null);

  const [price, setPrice] = useState(edit?.price != null ? fmt(edit.price) : "");
  const [priceTouched, setPriceTouched] = useState(Boolean(edit));
  const [status, setStatus] = useState("CONFIRMED");
  const [pay, setPay] = useState("UNPAID");
  const [collected, setCollected] = useState("");

  // Combo = nhà xe cabin (chuyến đi/về) + homestay (1 hoặc nhiều phòng).
  const isCombo = cat === "COMBO";
  const [busId, setBusId] = useState(edit?.busId ?? "");
  const [busQuote, setBusQuote] = useState<AdminQuote | null>(null);
  const [pickIds, setPickIds] = useState<string[]>(edit?.pickIds ?? []);
  const [roomAmt, setRoomAmt] = useState(edit?.roomAmt != null ? fmt(edit.roomAmt) : "");
  const [busAmt, setBusAmt] = useState(edit?.busAmt != null ? fmt(edit.busAmt) : "");
  const [discount, setDiscount] = useState(edit ? fmt(edit.discount) : "");
  // Sửa đơn: giữ nguyên tiền đã chốt (không tự điền giá hệ thống) cho tới khi admin bấm "Dùng giá hệ thống".
  const [touched, setTouched] = useState({ room: Boolean(edit), bus: Boolean(edit), discount: Boolean(edit) });

  const kind: Kind = categories.find((c) => c.key === cat)?.kind ?? "transport";
  const isCabin = cat === "CABIN";
  const hasEnd = isCabin || isCombo || kind === "stay" || kind === "rental";
  const list = useMemo(() => services.filter((s) => s.category === cat), [services, cat]);
  const cabinList = useMemo(() => services.filter((s) => s.category === "CABIN"), [services]);
  const homeList = useMemo(() => services.filter((s) => s.category === "HOMESTAY"), [services]);
  const people = shared + solo;
  // Homestay chọn được NHIỀU phòng (như đặt web) — dùng chung danh sách pickIds với combo.
  const multi = isCombo || kind === "stay";
  // Phòng đơn này đang giữ (khi sửa) — hiện "Đơn này đang giữ" thay vì "Đã kín".
  const ownRooms = useMemo(() => new Set(edit?.inventoryApplied ? edit.pickIds : []), [edit]);
  const checkIn = useMemo(() => (from ? addDay(from) : ""), [from]);

  // Đổi danh mục → bỏ chọn dịch vụ cũ (bỏ qua lần nạp đầu khi sửa đơn).
  const catInit = useRef(Boolean(edit));
  useEffect(() => {
    if (catInit.current) {
      catInit.current = false;
      return;
    }
    setServiceId("");
    setBusId("");
    setQuote(null);
    setBusQuote(null);
    setPickIds([]);
  }, [cat]);

  // Tải lựa chọn + giá mỗi khi đổi dịch vụ / ngày / số lượng.
  useEffect(() => {
    if (!serviceId || !from) return;
    if (isCombo && (!to || to <= checkIn)) {
      setQuote({ kind: "manual", nights: 0, error: "Chọn ngày về sau ngày nhận phòng (ngày đi + 1)." });
      return;
    }
    startQuote(async () => {
      const q = isCombo
        ? await quoteAdminBooking(serviceId, checkIn, to, Math.max(1, people))
        : await quoteAdminBooking(serviceId, from, to || null, isCabin ? 1 : qty);
      setQuote(q);
      setPick((p) => (q.items?.some((i) => i.id === p) ? p : ""));
      setPickIds((ps) => ps.filter((p) => q.items?.some((i) => i.id === p)));
      if (!isCombo) {
        setOutId((p) => (q.outbound?.some((i) => i.id === p) ? p : (q.outbound?.[0]?.id ?? "")));
        setRetId((p) => (q.returns?.some((i) => i.id === p) ? p : (q.returns?.[0]?.id ?? "")));
      }
    });
  }, [serviceId, from, to, qty, isCabin, isCombo, checkIn, people]);

  // Combo: chuyến đi (ngày đi) + chuyến về (ngày về) của nhà xe.
  useEffect(() => {
    if (!isCombo || !busId || !from) {
      setBusQuote(null);
      return;
    }
    let live = true;
    quoteAdminBooking(busId, from, to || null, 1).then((q) => {
      if (!live) return;
      setBusQuote(q);
      setOutId((p) => (q.outbound?.some((i) => i.id === p) ? p : (q.outbound?.[0]?.id ?? "")));
      setRetId((p) => (q.returns?.some((i) => i.id === p) ? p : (q.returns?.[0]?.id ?? "")));
    });
    return () => {
      live = false;
    };
  }, [isCombo, busId, from, to]);

  // Cabin / combo: giá/khách theo chuyến đã chọn (bảng giá chặng của nhà xe).
  const fareSvc = isCombo ? busId : serviceId;
  // Tuyến (điểm xuất phát) — danh sách + giá theo bảng giá chặng của nhà xe đang chọn.
  const [fareQuote, setFareQuote] = useState<CabinFareQuote | null>(null);
  const [origin, setOrigin] = useState(edit?.origin || "Hà Nội");
  // Admin tự nhập điểm đón ngoài bảng giá chặng (VD Hưng Yên) ⇒ giữ nguyên, không ép về Hà Nội.
  const [customOrigin, setCustomOrigin] = useState(false);
  const originTouched = useRef(Boolean(edit?.origin));
  const originRef = useRef(origin);
  useEffect(() => {
    originRef.current = origin;
  }, [origin]);
  const changeOrigin = (v: string) => {
    originTouched.current = true;
    setOrigin(v);
  };
  useEffect(() => {
    if (!(isCabin || isCombo) || !fareSvc || !outId) {
      setFareQuote(null);
      return;
    }
    let live = true;
    quoteCabinFare(fareSvc, outId, retId || null).then((q) => {
      if (!live) return;
      setFareQuote(q);
      // Giữ tuyến đang chọn nếu nhà xe có; không thì ưu tiên Hà Nội, rồi tuyến đầu tiên.
      const cur = originRef.current;
      const norm = (s: string) => s.trim().toLowerCase();
      // Bảng giá nhà xe mới có cùng điểm (khác hoa/thường, khoảng trắng) ⇒ dùng tên theo bảng giá.
      const same = q.options.find((x) => norm(x.origin) === norm(cur));
      const known = Boolean(same);
      if (same) {
        if (same.origin !== cur) setOrigin(same.origin);
        setCustomOrigin(false);
      } else if (originTouched.current && cur.trim()) {
        // Điểm admin đã gõ tay mà bảng giá không có ⇒ chuyển sang ô nhập tay, giữ nguyên.
        if (q.options.length) setCustomOrigin(true);
      } else if (!known) {
        setOrigin(q.options.find((x) => x.origin.toLowerCase() === "hà nội")?.origin ?? q.options[0]?.origin ?? cur);
      }
    });
    return () => {
      live = false;
    };
  }, [isCabin, isCombo, fareSvc, outId, retId]);
  useEffect(() => {
    if (!fareQuote) setFare(null);
    else if (fareQuote.options.length) setFare(fareQuote.options.find((x) => x.origin === origin)?.fare ?? null);
    else setFare(fareQuote.fallback);
  }, [fareQuote, origin]);

  // Combo: gợi ý tiền phòng / tiền xe / giảm giá — tự điền cho tới khi admin sửa tay.
  // Phụ thu người thêm: số khách vượt TỔNG sức chứa chuẩn các phòng đã chọn × mức/người/đêm.
  const stayExtra = useMemo(
    () =>
      adminExtraCost(
        isCombo ? people : qty,
        pickIds.map((id) => quote?.items?.find((i) => i.id === id)?.capacity ?? 0),
        quote?.extraFee,
        quote?.nights ?? 1,
      ),
    [isCombo, people, qty, pickIds, quote],
  );
  const comboRoomSuggest = useMemo(() => {
    const its = pickIds.map((id) => quote?.items?.find((i) => i.id === id));
    if (!its.length || its.some((i) => !i || i.price == null)) return null;
    return its.reduce((n, i) => n + (i!.price ?? 0), 0) + stayExtra.cost;
  }, [pickIds, quote, stayExtra]);
  const comboBusSuggest = fare != null ? cabinSeatTotal(fare, shared, solo) : null;
  useEffect(() => {
    if (!touched.room) setRoomAmt(comboRoomSuggest != null ? fmt(comboRoomSuggest) : "");
  }, [comboRoomSuggest, touched.room]);
  useEffect(() => {
    if (!touched.bus) setBusAmt(comboBusSuggest != null ? fmt(comboBusSuggest) : "");
  }, [comboBusSuggest, touched.bus]);
  useEffect(() => {
    if (!touched.discount) setDiscount(people > 0 ? fmt(comboDiscount * people) : "");
  }, [people, comboDiscount, touched.discount]);

  // Giá gợi ý (server tính) — tự điền vào ô Tổng tiền cho tới khi admin sửa tay.
  const suggested = useMemo<number | null>(() => {
    if (isCombo) {
      if (!roomAmt && !busAmt) return null;
      return Math.max(0, digits(roomAmt) + digits(busAmt) - digits(discount));
    }
    if (!quote) return null;
    if (isCabin) return fare != null ? cabinSeatTotal(fare, shared, solo) : null;
    if (quote.items?.length) {
      if (kind === "stay") {
        const its = pickIds.map((id) => quote.items?.find((i) => i.id === id));
        if (!its.length || its.some((i) => !i || i.price == null)) return null;
        return its.reduce((n, i) => n + (i!.price ?? 0), 0) + stayExtra.cost;
      }
      const it = quote.items.find((i) => i.id === pick);
      if (!it || it.price == null) return null;
      return kind === "rental" ? it.price * qty : it.price;
    }
    return quote.fixedPrice != null ? quote.fixedPrice * (kind === "transport" ? 1 : qty) : null;
  }, [isCombo, roomAmt, busAmt, discount, quote, isCabin, fare, shared, solo, pick, pickIds, kind, qty, stayExtra]);

  useEffect(() => {
    if (!priceTouched || isCombo) setPrice(suggested != null ? fmt(suggested) : "");
  }, [suggested, priceTouched, isCombo]);

  const total = digits(price);
  const paid = pay === "PAID" ? total : pay === "DEPOSITED" ? digits(collected) : 0;
  const remain = Math.max(0, total - paid);
  const pickedItem = quote?.items?.find((i) => i.id === pick);
  const holds = status === "CONFIRMED" || status === "COMPLETED";

  // Chọn phòng/xe đang kín ⇒ mặc định coi là nhập bù đơn cũ (không trừ tồn lần nữa).
  const [skipInv, setSkipInv] = useState(false);
  const pickedFull = multi
    ? pickIds.some((id) => !ownRooms.has(id) && quote?.items?.find((i) => i.id === id && !i.bookable))
    : Boolean(pickedItem && !pickedItem.bookable);
  useEffect(() => {
    if (!edit) setSkipInv(pickedFull);
  }, [pick, pickIds, pickedFull, edit]);
  const tripQuote = isCombo ? busQuote : quote;

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-[1fr_340px]">
      {edit && <input type="hidden" name="bookingId" value={edit.bookingId} />}
      {edit && onSaved && <input type="hidden" name="stay" value="1" />}
      <div className="flex min-w-0 flex-col gap-4">
        {/* 1. Dịch vụ */}
        <section className={card}>
          <h2 className="mb-3 text-base font-extrabold text-ink">1. Dịch vụ</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button key={c.key} type="button" onClick={() => setCat(c.key)} className={chip(cat === c.key)}>
                {c.label}
              </button>
            ))}
          </div>
          {isCombo ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="mode" value="combo" />
              <div>
                <label className={label}>Nhà xe cabin</label>
                <select name="busServiceId" value={busId} onChange={(e) => setBusId(e.target.value)} className={input} required>
                  <option value="">— Chọn nhà xe —</option>
                  {cabinList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                      {s.published ? "" : " (đang ẩn)"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Homestay</label>
                <select name="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={input} required>
                  <option value="">— Chọn homestay —</option>
                  {homeList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                      {s.published ? "" : " (đang ẩn)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <>
              <label className={label}>Chọn {categories.find((c) => c.key === cat)?.label.toLowerCase()}</label>
              <select
                name="serviceId"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className={input}
                required
              >
                <option value="">— Chọn —</option>
                {list.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                    {s.published ? "" : " (đang ẩn)"}
                  </option>
                ))}
              </select>
              {list.length === 0 && <p className="mt-2 text-sm text-gray-500">Chưa có dịch vụ nào trong danh mục này.</p>}
            </>
          )}
        </section>

        {/* 2. Ngày & lựa chọn */}
        <section className={card}>
          <h2 className="mb-3 text-base font-extrabold text-ink">2. Ngày & lựa chọn</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className={label}>
                {isCombo ? "Ngày đi (đêm lên xe)" : isCabin ? "Ngày đi" : kind === "stay" ? "Nhận phòng" : "Ngày sử dụng"}
              </label>
              <input type="date" name="useDate" value={from} onChange={(e) => setFrom(e.target.value)} className={input} required />
              {isCombo && checkIn && <p className="mt-1 text-xs text-gray-500">Nhận phòng: {checkIn}</p>}
            </div>
            {hasEnd && (
              <div>
                <label className={label}>
                  {isCombo ? "Ngày về (trả phòng)" : isCabin ? "Ngày về (bỏ trống = 1 chiều)" : kind === "stay" ? "Trả phòng" : "Ngày trả"}
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={to}
                  min={isCombo ? checkIn : from}
                  onChange={(e) => setTo(e.target.value)}
                  className={input}
                  required={isCombo}
                />
              </div>
            )}
            {isCabin || isCombo ? (
              <>
                <div>
                  <label className={label}>Khách nằm ghép</label>
                  <input type="number" name="shared" min={0} value={shared} onChange={(e) => setShared(Math.max(0, +e.target.value))} className={input} />
                </div>
                <div>
                  <label className={label}>Khách nằm riêng (×2 giá)</label>
                  <input type="number" name="solo" min={0} value={solo} onChange={(e) => setSolo(Math.max(0, +e.target.value))} className={input} />
                </div>
              </>
            ) : (
              <div>
                <label className={label}>{kind === "stay" ? "Số khách" : kind === "rental" ? "Số xe" : "Số lượng"}</label>
                <input type="number" name="quantity" min={1} value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value))} className={input} />
              </div>
            )}
          </div>

          {!serviceId ? (
            <p className="mt-3 text-sm text-gray-500">
              {isCombo ? "Chọn homestay để xem phòng." : "Chọn dịch vụ để xem phòng / chuyến / giá."}
            </p>
          ) : loading && !quote ? (
            <p className="mt-3 text-sm text-gray-500">Đang tải…</p>
          ) : quote ? (
            <div className={`mt-4 ${loading ? "opacity-60" : ""}`}>
              {quote.error && <p className="mb-2 text-sm font-semibold text-amber-700">{quote.error}</p>}
              {quote.policyNote && <p className="mb-2 text-sm font-semibold text-amber-700">⚠ {quote.policyNote}</p>}

              {quote.items && quote.items.length > 0 && (
                <>
                  <label className={label}>
                    {multi
                      ? `Chọn phòng (chọn nhiều được) · ${quote.nights} đêm · đã chọn ${pickIds.length} phòng, ${pickIds.reduce((n, id) => n + (quote.items?.find((i) => i.id === id)?.capacity ?? 0), 0)}/${isCombo ? people : qty} chỗ`
                      : `Chọn loại xe · ${quote.nights} ngày`}
                  </label>
                  {multi ? (
                    pickIds.map((id) => <input key={id} type="hidden" name="roomIds" value={id} />)
                  ) : (
                    <input type="hidden" name="rentalVehicleId" value={pick} />
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {quote.items.map((it) => {
                      const on = multi ? pickIds.includes(it.id) : pick === it.id;
                      const own = ownRooms.has(it.id);
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() =>
                            multi
                              ? setPickIds((ps) => (ps.includes(it.id) ? ps.filter((p) => p !== it.id) : [...ps, it.id]))
                              : setPick(it.id)
                          }
                          className={`flex items-start justify-between gap-2 rounded-xl border-[1.5px] p-3 text-left ${
                            on ? "border-forest-700 bg-forest-50" : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-ink">{it.name}</span>
                            <span className="text-xs text-gray-500">
                              {it.note} ·{" "}
                              <span className={it.bookable || own ? "font-bold text-emerald-700" : "font-bold text-red-600"}>
                                {own ? "Đơn này đang giữ" : it.bookable ? "Còn trống" : "Đã kín / chưa cập nhật"}
                              </span>
                            </span>
                          </span>
                          <span className="whitespace-nowrap text-sm font-extrabold text-ink">
                            {it.price != null ? fmt(it.price) + "đ" : "—"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {multi && stayExtra.extraGuests > 0 && (
                    <p className="mt-2 text-sm font-semibold text-sunset-600">
                      {stayExtra.cost > 0
                        ? `Phụ thu ${stayExtra.extraGuests} người thêm × ${quote.nights} đêm × ${fmt(quote.extraFee ?? 0)}đ = ${fmt(stayExtra.cost)}đ — đã cộng vào ${isCombo ? "tiền phòng" : "giá hệ thống"}.`
                        : `Vượt sức chứa chuẩn ${stayExtra.extraGuests} khách — homestay chưa khai mức phụ thu người thêm nên chưa cộng, nhập tay nếu có.`}
                    </p>
                  )}
                  {pickedFull && !edit && (
                    <p className="mt-2 text-sm font-semibold text-amber-700">
                      Có phòng đang kín — vẫn tạo được đơn để ghi nhận (đã tự bật “Nhập bù đơn cũ”, lịch phòng giữ nguyên).
                    </p>
                  )}
                </>
              )}
            </div>
          ) : null}

          {(isCabin || isCombo) && tripQuote && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={label}>{isCombo ? "Chuyến xe đi" : "Chuyến đi"}</label>
                    <select name="cabinTripId" value={outId} onChange={(e) => setOutId(e.target.value)} className={input}>
                      <option value="">— Không gán chuyến —</option>
                      {tripQuote.outbound?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label} · còn {t.seatsAvailable}
                        </option>
                      ))}
                    </select>
                    {tripQuote.outbound?.length === 0 && (
                      <p className="mt-1 text-xs text-amber-700">Ngày này chưa mở bán chuyến đi — đơn sẽ không trừ vé.</p>
                    )}
                  </div>
                  {to && (
                    <div>
                      <label className={label}>{isCombo ? "Chuyến xe về" : "Chuyến về"}</label>
                      <select name="cabinReturnTripId" value={retId} onChange={(e) => setRetId(e.target.value)} className={input}>
                        <option value="">— Không gán chuyến —</option>
                        {tripQuote.returns?.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label} · còn {t.seatsAvailable}
                          </option>
                        ))}
                      </select>
                      {tripQuote.returns?.length === 0 && (
                        <p className="mt-1 text-xs text-amber-700">Ngày về chưa mở bán chuyến.</p>
                      )}
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className={label}>Tuyến / điểm xuất phát</label>
                    {fareQuote && fareQuote.options.length > 0 && !customOrigin ? (
                      <select
                        name="origin"
                        value={origin}
                        onChange={(e) => {
                          if (e.target.value === "__custom") {
                            setCustomOrigin(true);
                            changeOrigin("");
                          } else changeOrigin(e.target.value);
                        }}
                        className={input}
                      >
                        {fareQuote.options.map((o) => (
                          <option key={o.origin} value={o.origin}>
                            {o.origin} ⇄ Tà Xùa · {fmt(o.fare)}đ/khách {retId ? "khứ hồi" : "1 chiều"}
                          </option>
                        ))}
                        <option value="__custom">Điểm đón khác (nhập tay)…</option>
                      </select>
                    ) : (
                      <>
                        <input
                          name="origin"
                          value={origin}
                          onChange={(e) => changeOrigin(e.target.value)}
                          required
                          placeholder="VD: Hưng Yên"
                          className={input}
                        />
                        {outId && fareQuote && fareQuote.options.length === 0 && (
                          <p className="mt-1 text-xs text-gray-500">Nhà xe chưa có bảng giá chặng — giá tính theo giá chuyến.</p>
                        )}
                        {fareQuote && fareQuote.options.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomOrigin(false);
                              originTouched.current = false;
                              setOrigin(fareQuote.options.find((x) => x.origin.toLowerCase() === "hà nội")?.origin ?? fareQuote.options[0].origin);
                            }}
                            className="mt-1 text-xs font-semibold text-forest-700 hover:underline"
                          >
                            ← Chọn từ bảng giá chặng
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {fare != null && (
                    <p className="text-sm text-gray-600 sm:col-span-2">
                      Giá vé: <b>{fmt(fare)}đ</b>/khách {retId ? "khứ hồi" : "1 chiều"} từ {origin} (nằm riêng ×2)
                    </p>
                  )}
                  {outId && fareQuote && fare == null && (
                    <p className="text-sm font-semibold text-amber-700 sm:col-span-2">Chưa có giá cho tuyến này — nhập tiền tay.</p>
                  )}
                </div>
          )}
          {isCombo && !busId && <p className="mt-3 text-sm text-gray-500">Chọn nhà xe để xem chuyến đi / về.</p>}
        </section>

        {/* 3. Khách hàng */}
        <section className={card}>
          <h2 className="mb-3 text-base font-extrabold text-ink">3. Khách hàng</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Tên khách *</label>
              <input name="customerName" defaultValue={edit?.customerName} className={input} required />
            </div>
            <div>
              <label className={label}>Số điện thoại *</label>
              <input name="phone" inputMode="tel" defaultValue={edit?.phone} className={input} required />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Link Facebook khách (nếu có)</label>
              <input
                name="customerFacebook"
                type="text"
                inputMode="url"
                autoComplete="off"
                placeholder="facebook.com/ten.khach hoặc link tin nhắn"
                defaultValue={edit?.customerFacebook}
                className={input}
              />
            </div>
            <div>
              <label className={label}>CTV đặt hộ (nếu có)</label>
              <select name="ctvId" className={input} defaultValue={edit?.ctvId ?? ""}>
                <option value="">— Không —</option>
                {ctvs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Ghi chú của khách (điểm đón, yêu cầu…)</label>
              <textarea name="note" rows={2} defaultValue={edit?.note} className={input} />
            </div>
          </div>
        </section>
      </div>

      {/* Cột phải: trạng thái + tiền */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        {edit ? (
          <section className={card}>
            <h2 className="mb-2 text-base font-extrabold text-ink">Sửa đơn</h2>
            <p className="text-sm text-gray-600">
              Trạng thái và thanh toán giữ nguyên — đổi ở trang đơn.
              {edit.inventoryApplied
                ? " Đơn đang giữ chỗ: khi lưu sẽ trả phòng/vé cũ và giữ lại theo lựa chọn mới (thiếu chỗ ⇒ báo lỗi, không lưu gì)."
                : " Đơn chưa giữ chỗ: chỉ cập nhật thông tin, không đụng lịch phòng/vé."}
            </p>
          </section>
        ) : (
        <section className={card}>
          <h2 className="mb-3 text-base font-extrabold text-ink">Trạng thái đơn</h2>
          <input type="hidden" name="status" value={status} />
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTS.map((s) => (
              <button
                key={s.v}
                type="button"
                onClick={() => setStatus(s.v)}
                className={chip(status === s.v)}
                style={status === s.v ? { background: s.c, borderColor: s.c } : undefined}
              >
                {s.l}
              </button>
            ))}
          </div>
          {holds && (
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-gray-50 p-2.5 text-sm">
              <input
                type="checkbox"
                name="skipInventory"
                checked={skipInv}
                onChange={(e) => setSkipInv(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-forest-700"
              />
              <span>
                <b>Nhập bù đơn cũ — không trừ tồn</b>
                <span className="block text-xs text-gray-500">
                  Dùng cho đơn đã nhận trước đây, phòng/vé đã đánh dấu kín sẵn. Cho phép đặt cả phòng đã kín.
                </span>
              </span>
            </label>
          )}
          <p className="mt-2 text-xs text-gray-500">
            {!holds
              ? "Chưa giữ chỗ — xác nhận sau ở trang đơn."
              : skipInv
                ? "Chỉ ghi nhận đơn, lịch phòng/vé giữ nguyên."
                : "Sẽ giữ chỗ ngay (trừ phòng/vé/xe) khi tạo."}
          </p>
        </section>
        )}

        <section className={card}>
          <h2 className="mb-3 text-base font-extrabold text-ink">Thanh toán</h2>
          {isCombo && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              {(
                [
                  ["room", "roomAmount", "Tiền phòng (→ homestay)", roomAmt, setRoomAmt, comboRoomSuggest],
                  ["bus", "busAmount", "Tiền vé xe (→ nhà xe)", busAmt, setBusAmt, comboBusSuggest],
                  ["discount", "discount", `Giảm giá combo (${fmt(comboDiscount)}/khách)`, discount, setDiscount, null],
                ] as const
              ).map(([k, name, l, v, set, sug]) => (
                <div key={k} className={k === "discount" ? "col-span-2" : ""}>
                  <label className={label}>{l}</label>
                  <MoneyField
                    name={name}
                    value={v}
                    onChange={(val) => {
                      setTouched((t) => ({ ...t, [k]: true }));
                      set(val);
                    }}
                  />
                  {sug != null && touched[k] && digits(v) !== sug && (
                    <button
                      type="button"
                      onClick={() => setTouched((t) => ({ ...t, [k]: false }))}
                      className="mt-0.5 text-xs font-bold text-forest-700 underline"
                    >
                      Dùng giá hệ thống {fmt(sug)}đ
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <label className={label}>Tổng tiền khách trả</label>
          <MoneyField
            name="price"
            value={price}
            readOnly={isCombo}
            onChange={(val) => {
              setPriceTouched(true);
              setPrice(val);
            }}
            placeholder="Để trống = chờ báo giá"
          />
          {isCombo && <p className="mt-1 text-xs text-gray-500">= tiền phòng + tiền vé − giảm giá</p>}
          {edit && edit.surchargeTotal > 0 && (
            <p className="mt-1 text-xs font-semibold text-amber-700">
              Chưa gồm phụ thu {fmt(edit.surchargeTotal)}đ đã ghi ở đơn (tự cộng khi lưu).
            </p>
          )}
          {!isCombo && suggested != null && (
            <p className="mt-1 text-xs text-gray-500">
              Giá hệ thống: {fmt(suggested)}đ
              {priceTouched && digits(price) !== suggested && (
                <button
                  type="button"
                  onClick={() => {
                    setPriceTouched(false);
                    setPrice(fmt(suggested));
                  }}
                  className="ml-2 font-bold text-forest-700 underline"
                >
                  Dùng giá này
                </button>
              )}
            </p>
          )}

          {!edit && (<>
          <input type="hidden" name="paymentStatus" value={pay} />
          <div className="mt-3 flex flex-wrap gap-2">
            {PAY_OPTS.map((p) => (
              <button key={p.v} type="button" onClick={() => setPay(p.v)} className={chip(pay === p.v)}>
                {p.l}
              </button>
            ))}
          </div>

          {pay === "DEPOSITED" && (
            <div className="mt-3">
              <label className={label}>Số tiền đã cọc</label>
              <MoneyField name="amountCollected" value={collected} onChange={setCollected} required />
              {total > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[30, 50].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCollected(fmt(Math.round((total * p) / 100 / 1000) * 1000))}
                      className="rounded-full border-[1.5px] border-gray-200 px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100"
                    >
                      Cọc {p}%
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {pay === "PAID" && <input type="hidden" name="amountCollected" value={price} />}
          {pay !== "UNPAID" && (
            <div className="mt-3">
              <label className={label}>Hình thức</label>
              <select name="payMethod" className={input}>
                <option>Chuyển khoản</option>
                <option>Tiền mặt</option>
                <option>CTV thu hộ</option>
              </select>
            </div>
          )}

          </>)}
          {!edit && (
          <dl className="mt-4 space-y-1 border-t border-dashed border-gray-200 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Tổng</dt>
              <dd className="font-bold">{total ? fmt(total) + "đ" : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Đã thu</dt>
              <dd className="font-bold text-emerald-700">{fmt(paid)}đ</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Còn phải thu</dt>
              <dd className="font-extrabold text-sunset-600">{fmt(remain)}đ</dd>
            </div>
          </dl>
          )}
        </section>

        <section className={card}>
          <label className={label}>Ghi chú nội bộ</label>
          <textarea name="adminNote" rows={2} defaultValue={edit?.adminNote} className={input} />
          {state.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{state.error}</p>}
          <button
            type="submit"
            disabled={submitting || !serviceId}
            className="mt-3 w-full rounded-full bg-sunset-500 px-4 py-3 text-sm font-extrabold text-white hover:bg-sunset-600 disabled:opacity-50"
          >
            {submitting ? (edit ? "Đang lưu…" : "Đang tạo…") : edit ? "Lưu thay đổi" : "Tạo đơn"}
          </button>
        </section>
      </div>
    </form>
  );
}
