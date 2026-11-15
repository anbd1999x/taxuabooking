"use client";

import { BookingEmailField, emailLooksValid } from "@/components/BookingEmailField";

import { SupportHoursNote } from "@/components/SupportHours";
import { trackLeadConversion } from "@/lib/ads";
import { ItineraryLink } from "@/components/itinerary/ItineraryLink";
import { useState } from "react";
import type { ServiceCategory, AvailabilityStatus } from "@prisma/client";
import { DateField } from "@/components/DateField";
import { QtyInput } from "@/components/QtyInput";
import { AVAILABILITY_META } from "@/lib/constants";
import type { AvailabilityKind } from "@/lib/constants";
import { Badge } from "./ui/Badge";
import { CommitmentLink } from "@/components/trust/parts";
import { ensureSheetFresh } from "@/components/ensureSheet";
import { showGlobalLoading } from "@/components/useSearchNav";
import { quoteTransport, minDrivers, OTHER_POINT, type TransportMode, type TransportPointDTO, type TransportPricing } from "@/lib/transport-legs";
import { RENTAL_HOURS, RENTAL_DEFAULT_HOUR, rentalChargeDays, rentalDaysLabel } from "@/lib/rental-days";
import { useT } from "@/components/i18n/I18nProvider";

function formatVnd(n: number | null | undefined, fallback = "Liên hệ") {
  if (n == null) return fallback;
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

interface StayOption {
  id: string;
  name: string;
  capacity: number;
  status: AvailabilityStatus;
  bookable: boolean;
  availableUnits: number;
  pricePerUnit: number | null;
  count: number;
  colors?: string[];
}
interface TripOption {
  id: string;
  label: string;
  departureTime: string;
  price: number;
  seatsAvailable: number;
  status: AvailabilityStatus;
  bookable: boolean;
}
interface AvailabilityResponse {
  kind: AvailabilityKind;
  nights: number;
  stayOptions?: StayOption[];
  tripOptions?: TripOption[];
  transport?: { fixedPrice: number | null; note: string | null; points?: TransportPointDTO[]; pricing?: TransportPricing };
  manualConfirmOnly?: boolean;
  basePrice?: number | null;
  policyNote?: string;
}

function StatusBadge({ status }: { status: AvailabilityStatus }) {
  const tr = useT();
  const m = AVAILABILITY_META[status];
  return <Badge tone={m.tone}>{tr(m.label)}</Badge>;
}

export function BookingPanel({
  serviceId,
  category,
  kind,
  phone,
  zalo,
  initialTransport,
}: {
  serviceId: string;
  category: ServiceCategory;
  kind: AvailabilityKind;
  phone: string;
  zalo?: string | null;
  /** Taxi / xe ôm: lựa chọn mang sang từ trang danh sách (?from=&dpt=&dst=&tm=&pax=&drv=). */
  initialTransport?: { date?: string; from?: string; to?: string; mode?: string; pax?: number; drv?: number };
}) {
  const tr = useT();
  const needsRange = kind === "stay" || kind === "rental";
  const [from, setFrom] = useState(initialTransport?.date ?? "");
  const [to, setTo] = useState("");
  const [quantity, setQuantity] = useState(Math.max(1, initialTransport?.pax ?? 1));
  // Thuê xe máy: giờ nhận / giờ trả — tiền thuê tính theo số ngày quy đổi từ khoảng thời gian này.
  const isRental = kind === "rental";
  const [pickupTime, setPickupTime] = useState(RENTAL_DEFAULT_HOUR);
  const [returnTime, setReturnTime] = useState(RENTAL_DEFAULT_HOUR);
  // Ngày trả trùng ngày nhận (hoặc để trống) = trả trong ngày.
  const rentTo = isRental && to && to > from ? to : null;
  const rentDays = isRental && from ? rentalChargeDays(from, rentTo, pickupTime, returnTime) : null;

  const [checking, setChecking] = useState(false);
  const [avail, setAvail] = useState<AvailabilityResponse | null>(null);
  const [availError, setAvailError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Taxi / xe ôm: chặng 1 chiều (điểm đón → điểm đến) hoặc thuê nguyên ngày, số người (= quantity) + số tài xế / xe.
  const [fromPt, setFromPt] = useState(initialTransport?.from ?? "");
  const [toPt, setToPt] = useState(initialTransport?.to ?? "");
  const [fromOther, setFromOther] = useState("");
  const [toOther, setToOther] = useState("");
  const [tMode, setTMode] = useState<TransportMode>(initialTransport?.mode === "DAY" ? "DAY" : "LEG");
  const [drivers, setDrivers] = useState(Math.max(1, initialTransport?.drv ?? 1));
  const legPoints = avail?.transport?.points ?? [];
  const pricing = avail?.transport?.pricing;
  const isTransport = kind === "transport" && Boolean(pricing);
  const ptName = (id: string, other: string) => (id === OTHER_POINT ? other.trim() : legPoints.find((p) => p.id === id)?.name ?? "");
  const fromName = ptName(fromPt, fromOther);
  const toName = ptName(toPt, toOther);
  const tQuote = pricing ? quoteTransport(pricing, { mode: tMode, fromId: fromPt, toId: toPt, people: quantity, drivers }) : null;
  const legReady = tMode === "DAY" || (Boolean(fromName) && Boolean(toName) && fromName !== toName);
  // Thuê xe máy: màu xe khách chọn ("" = màu nào cũng được). Đổi loại xe ⇒ chọn lại.
  const [color, setColor] = useState("");

  const [name, setName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; needsConfirmation: boolean } | null>(null);

  const qtyLabel =
    kind === "stay" ? tr("Số phòng") : kind === "rental" ? tr("Số xe") : kind === "trip" ? tr("Số vé") : tr("Số khách");

  async function check() {
    setAvailError(null);
    setSelectedId(null);
    if (!from) {
      setAvailError(tr("Vui lòng chọn ngày."));
      return;
    }
    // Thuê xe: nhận & trả cùng ngày vẫn được (tính 1 ngày); lưu trú thì ngày trả phải sau ngày nhận.
    if (needsRange && to && (kind === "rental" ? to < from : to <= from)) {
      setAvailError(kind === "rental" ? tr("Ngày trả xe không được trước ngày nhận xe.") : tr("Ngày trả phải sau ngày nhận."));
      return;
    }
    if (isRental && rentDays == null) {
      setAvailError(tr("Giờ trả xe phải sau giờ nhận xe (hoặc chọn ngày trả sau ngày nhận)."));
      return;
    }
    setChecking(true);
    // Homestay: làm tươi lịch phòng từ Google Sheet trước khi hiện tình trạng
    // (server bỏ qua nếu vừa đồng bộ <60s) — hiện overlay loading trong lúc chờ.
    if (category === "HOMESTAY" || category === "BUNGALOW") {
      showGlobalLoading(true, tr("Đang cập nhật tình trạng phòng mới nhất…"));
      try { await ensureSheetFresh(serviceId); } finally { showGlobalLoading(false); }
    }
    try {
      const params = new URLSearchParams({ serviceId, from, quantity: String(quantity) });
      if (isRental) {
        if (rentTo) params.set("to", rentTo);
        params.set("pickup", pickupTime);
        params.set("ret", returnTime);
      } else if (needsRange && to) params.set("to", to);
      const res = await fetch(`/api/availability?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setAvailError(tr(data.error) ?? tr("Không kiểm tra được tình trạng."));
        setAvail(null);
      } else {
        setAvail(data as AvailabilityResponse);
      }
    } catch {
      setAvailError(tr("Lỗi kết nối, vui lòng thử lại."));
    } finally {
      setChecking(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const payload = {
        serviceId,
        useDate: from,
        endDate: isRental ? rentTo : needsRange && to ? to : null,
        rentalColor: isRental && color ? color : null,
        pickupTime: isRental ? pickupTime : null,
        returnTime: isRental ? returnTime : null,
        quantity: kind === "stay" ? 1 : quantity,
        roomTypeId: null,
        roomId: kind === "stay" ? selectedId : null,
        rentalVehicleId: kind === "rental" ? selectedId : null,
        cabinTripId: kind === "trip" ? selectedId : null,
        ...(isTransport
          ? { transportMode: tMode, drivers, fromPointId: fromPt || null, toPointId: tMode === "LEG" ? toPt || null : null, fromOther: fromPt === OTHER_POINT ? fromOther : null, toOther: toPt === OTHER_POINT ? toOther : null }
          : {}),
        customerName: name,
        phone: custPhone,
        email: email.trim() || null,
        note: note || null,
      };
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(tr(data.error) ?? tr("Gửi yêu cầu thất bại."));
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
      } else {
        trackLeadConversion();
        setResult(data);
      }
    } catch {
      setSubmitError(tr("Lỗi kết nối, vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Thành công ----
  if (result) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-100 text-3xl">
            ✓
          </div>
          <h3 className="mt-3 text-lg font-bold text-forest-800">
            {tr("Đã gửi yêu cầu thành công!")}
          </h3>
          <p className="mt-1 text-sm text-gray-600">{tr("Mã yêu cầu của bạn:")}</p>
          <p className="mt-1 text-2xl font-extrabold tracking-wider text-sunset-600">
            {tr(result.code)}
          </p>
          {result.needsConfirmation ? (
            <p className="mt-3 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
              {tr("Yêu cầu sẽ được xác nhận sau khi quản trị viên kiểm tra tình trạng. Chúng tôi sẽ liên hệ bạn qua số điện thoại đã cung cấp.")}
            </p>
          ) : (
            <p className="mt-3 rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-800">
              {tr("Chúng tôi sẽ liên hệ bạn sớm để xác nhận chi tiết.")}
            </p>
          )}
          <SupportHoursNote className="mt-3" />
          <div className="mt-4 flex gap-2">
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-700"
            >
              {tr("📞 Gọi xác nhận")}
            </a>
            {zalo && (
              <a
                href={`https://zalo.me/${zalo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-sunset-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sunset-600"
              >
                💬 Chat Zalo
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  const options = avail?.stayOptions ?? [];
  const trips = avail?.tripOptions ?? [];
  const requireSelection = kind === "stay" || kind === "rental" || kind === "trip";
  // Taxi / xe ôm: chặng phải có điểm đón + điểm đến khác nhau; số người / tài xế phải hợp lệ.
  const legOk = !isTransport || (legReady && !tQuote?.error);
  const canSubmit =
    Boolean(from) && (!requireSelection || Boolean(selectedId)) && legOk && !submitting;

  return (
    <form
      onSubmit={submit}
      className="sticky top-20 rounded-2xl bg-white p-5 shadow-md ring-1 ring-black/5"
    >
      <h3 className="text-lg font-bold text-ink">{tr("Đặt dịch vụ")}</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        {tr("Không cần tài khoản. Chọn ngày để xem giá và tình trạng.")}
      </p>

      {/* Ngày */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">
            {kind === "trip" ? tr("Ngày đi") : kind === "rental" ? tr("Ngày nhận xe") : needsRange ? tr("Nhận") : tr("Ngày dùng")}
          </span>
          <DateField
            value={from}
            min={todayKey()}
            onChange={(v) => { setFrom(v); setAvail(null); }}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
            displayClassName="px-3 text-sm text-gray-900"
            ariaLabel={kind === "trip" ? tr("Ngày đi") : needsRange ? tr("Nhận") : tr("Ngày dùng")}
            required
          />
        </label>
        {needsRange && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">{kind === "rental" ? tr("Ngày trả xe") : tr("Trả")}</span>
            <DateField
              value={to}
              min={from || todayKey()}
              onChange={(v) => { setTo(v); setAvail(null); }}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
              displayClassName="px-3 text-sm text-gray-900"
              ariaLabel={tr("Trả")}
            />
          </label>
        )}
        {isRental && (
          <>
            {([
              [tr("Giờ nhận xe"), pickupTime, setPickupTime],
              [tr("Giờ trả xe"), returnTime, setReturnTime],
            ] as const).map(([label, value, set]) => (
              <label key={label} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500">{tr(label)}</span>
                <select
                  value={value}
                  onChange={(e) => { set(e.target.value); setAvail(null); }}
                  aria-label={tr(label)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
                >
                  {RENTAL_HOURS.map((h) => <option key={h} value={h}>{tr(h)}</option>)}
                </select>
              </label>
            ))}
          </>
        )}
        {kind !== "stay" && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">{tr(qtyLabel)}</span>
            <QtyInput
              min={1}
              max={20}
              value={quantity}
              onChange={(n) => { setQuantity(n); setAvail(null); }}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
              ariaLabel={tr(qtyLabel)}
            />
          </label>
        )}
      </div>

      {isRental && (
        <p className="mt-3 rounded-xl bg-forest-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
          {from && rentDays != null && <b className="text-forest-800">{tr("Thời gian thuê tính {0}.", [rentalDaysLabel(rentDays, tr)])}{" "}</b>}
          {from && rentDays == null && <b className="text-red-600">{tr("Giờ trả xe phải sau giờ nhận xe.")}{" "}</b>}
          {tr("Cách tính: mỗi 24 giờ kể từ giờ nhận = 1 ngày; trả trễ tới 6 giờ tính thêm nửa ngày, trễ hơn 6 giờ tính thêm 1 ngày.")}
        </p>
      )}

      <button
        type="button"
        onClick={check}
        disabled={checking || !from}
        className="mt-3 w-full rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-700 disabled:opacity-50"
      >
        {checking ? tr("Đang kiểm tra...") : tr("Kiểm tra giá & tình trạng")}
      </button>

      {availError && (
        <p className="mt-2 text-sm text-red-600">{tr(availError)}</p>
      )}

      {/* Kết quả tình trạng */}
      {avail && (
        <div className="mt-4 space-y-2">
          {/* Vi phạm chính sách bán cuối tuần theo cụm → không cho chọn/đặt */}
          {avail.policyNote && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              ⚠️ {tr(avail.policyNote)}
            </p>
          )}

          {/* stay / rental */}
          {(kind === "stay" || kind === "rental") && !avail.manualConfirmOnly && !avail.policyNote && (
            options.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                {tr("Chưa có loại")}{" "}{kind === "stay" ? tr("phòng") : "xe"}{" "}{tr("nào.")}
              </p>
            ) : (
              options.map((o) => (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                    selectedId === o.id
                      ? "border-forest-500 bg-forest-50"
                      : "border-gray-200 hover:border-forest-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="option"
                    className="mt-1 accent-forest-600"
                    checked={selectedId === o.id}
                    onChange={() => { setSelectedId(o.id); setColor(""); }}
                  />
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">{tr(o.name)}</span>
                      <StatusBadge status={o.status} />
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {kind === "stay" ? tr("Sức chứa {0} người · ", [o.capacity]) : ""}
                      {kind === "stay" ? tr("{0} đêm", [o.count]) : tr("tính {0} thuê", [rentalDaysLabel(o.count, tr)])}
                      {o.bookable ? tr(" · còn {0}", [o.availableUnits]) : ""}
                    </span>
                    <span className="mt-1 block font-bold text-forest-700">
                      {o.pricePerUnit != null
                        ? `${tr(formatVnd(o.pricePerUnit * quantity))} cho ${quantity} ${kind === "stay" ? tr("phòng") : `xe × ${rentalDaysLabel(o.count, tr)}`}`
                        : tr("Liên hệ xác nhận giá")}
                    </span>
                    {/* Chọn màu xe (admin cấu hình ở loại xe) — chỉ hiện ở loại xe đang chọn. */}
                    {kind === "rental" && selectedId === o.id && (o.colors?.length ?? 0) > 0 && (
                      <span className="mt-2 block">
                        <span className="block text-xs font-medium text-gray-500">{tr("Màu xe")}</span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {["", ...o.colors!].map((c) => (
                            <button
                              key={c || "any"}
                              type="button"
                              onClick={(e) => { e.preventDefault(); setColor(c); }}
                              aria-pressed={color === c}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${color === c ? "border-forest-600 bg-forest-600 text-white" : "border-gray-200 bg-white text-ink hover:border-forest-300"}`}
                            >
                              {tr(c) || tr("Màu nào cũng được")}
                            </button>
                          ))}
                        </span>
                      </span>
                    )}
                  </span>
                </label>
              ))
            )
          )}

          {/* trip (cabin) */}
          {kind === "trip" &&
            (trips.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {tr("Chưa có chuyến nào cho ngày này. Vui lòng chọn ngày khác hoặc gửi yêu cầu để được hỗ trợ.")}
              </p>
            ) : (
              trips.map((t) => (
                <label
                  key={t.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                    selectedId === t.id ? "border-forest-500 bg-forest-50" : "border-gray-200 hover:border-forest-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="option"
                    className="mt-1 accent-forest-600"
                    checked={selectedId === t.id}
                    onChange={() => setSelectedId(t.id)}
                  />
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">🕐 {tr(t.departureTime)}</span>
                      <StatusBadge status={t.status} />
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {tr(t.label)}{t.bookable ? tr(" · còn {0} chỗ", [t.seatsAvailable]) : ""}
                    </span>
                    <span className="mt-1 block font-bold text-forest-700">
                      {tr("{0} / {1} vé", [tr(formatVnd(t.price * quantity)), quantity])}
                    </span>
                  </span>
                </label>
              ))
            ))}

          {/* transport */}
          {/* taxi / xe ôm: chặng 1 chiều hoặc nguyên ngày · số tài xế / xe ⇒ báo giá theo bảng giá của bác tài */}
          {isTransport && pricing && (
            <div className="space-y-3 rounded-xl border border-gray-200 p-3">
              <div className="inline-flex w-full gap-1 rounded-xl bg-gray-100 p-1">
                {(["LEG", "DAY"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setTMode(k)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${tMode === k ? "bg-white text-forest-700 shadow-sm" : "text-gray-500"}`}>
                    {k === "LEG" ? tr("Chặng 1 chiều") : tr("Thuê nguyên ngày")}
                  </button>
                ))}
              </div>
              {([
                [tr("Điểm đón"), fromPt, setFromPt, fromOther, setFromOther, true],
                [tr("Điểm đến"), toPt, setToPt, toOther, setToOther, tMode === "LEG"],
              ] as const).filter((x) => x[5]).map(([label, val, setVal, other, setOther]) => (
                <label key={label} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">{label}</span>
                  <select value={val} onChange={(e) => setVal(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200">
                    <option value="">{tr("Chọn điểm…")}</option>
                    {legPoints.map((p) => <option key={p.id} value={p.id}>{tr(p.name)}</option>)}
                    <option value={OTHER_POINT}>{tr("Điểm khác (nhắn tin báo giá)")}</option>
                  </select>
                  {val === OTHER_POINT && (
                    <input value={other} onChange={(e) => setOther(e.target.value)} maxLength={120} placeholder={tr("Ghi tên điểm, VD: homestay A, bản B…")} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200" />
                  )}
                </label>
              ))}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500">{pricing.bike ? tr("Số tài xế (mỗi xe máy chở tối đa {0} người)", [pricing.capacity === 1 ? 1 : 2]) : tr("Số xe (mỗi xe tối đa {0} khách)", [pricing.capacity])}</span>
                <QtyInput min={1} max={20} value={drivers} onChange={(n) => setDrivers(n)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200" ariaLabel={tr("Số tài xế")} />
              </label>
              {tQuote?.error ? (
                <p className="text-sm text-red-600">
                  {tr(tQuote.error)}{" "}
                  <button type="button" onClick={() => setDrivers(minDrivers(pricing.bike, pricing.capacity, quantity))} className="font-semibold underline">{tr("Chọn {0}", [minDrivers(pricing.bike, pricing.capacity, quantity)])}</button>
                </p>
              ) : !legReady ? (
                fromName && toName && fromName === toName ? <p className="text-sm text-red-600">{tr("Điểm đón và điểm đến phải khác nhau.")}</p> : null
              ) : tQuote?.total != null ? (
                <div className="rounded-xl bg-forest-50 px-3 py-2.5">
                  <div className="text-xs text-gray-500">
                    {tMode === "LEG" ? `${tr(fromName)} → ${tr(toName)} · ${tr("1 chiều")}` : tr("Thuê nguyên ngày")} · {tr("{0} người", [quantity])} · {drivers} {pricing.bike ? tr("tài xế") : tr("xe")}
                    {tQuote.twos > 0 ? ` · ${tr("{0} xe chở 2", [tQuote.twos])}` : ""}
                  </div>
                  <div className="text-lg font-extrabold text-forest-700">{tr(formatVnd(tQuote.total))}</div>
                  {tQuote.leg?.note && <div className="text-xs text-gray-500">{tr(tQuote.leg.note)}</div>}
                </div>
              ) : (
                <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                  <div className="font-semibold">{tMode === "LEG" ? tr("Chặng này chưa có giá sẵn — nhắn tin để được báo giá.") : tr("Chưa có giá nguyên ngày — nhắn tin để được báo giá.")}</div>
                  <div className="mt-1 text-xs">{tr("Bạn vẫn có thể gửi yêu cầu, tụi mình sẽ báo giá trước khi chốt.")}</div>
                  {zalo && (
                    <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block rounded-lg bg-sunset-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-sunset-600">{tr("Nhắn Zalo hỏi giá")}</a>
                  )}
                </div>
              )}
              {avail.transport?.note && <p className="text-xs text-gray-500">{tr(avail.transport.note)}</p>}
              <p className="text-xs text-gray-500">{tr("Yêu cầu sẽ được xác nhận sau khi kiểm tra.")}</p>
            </div>
          )}

          {/* combo / manual */}
          {avail.manualConfirmOnly && (
            <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
              <p className="font-semibold text-forest-700">
                {tr(formatVnd(avail.basePrice != null ? avail.basePrice * quantity : null))}
                {avail.basePrice != null ? tr(" cho {0} khách (tham khảo)", [quantity]) : ""}
              </p>
              <p className="mt-1">
                {tr("Combo được xác nhận chỗ sau khi quản trị viên kiểm tra. Gửi yêu cầu để được tư vấn lịch khởi hành.")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Thông tin khách */}
      <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">{tr("Họ và tên *")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
            required
          />
          {fieldErrors.customerName && (
            <span className="text-xs text-red-600">{tr(fieldErrors.customerName)}</span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">{tr("Số điện thoại *")}</span>
          <input
            value={custPhone}
            onChange={(e) => setCustPhone(e.target.value)}
            inputMode="tel"
            placeholder="VD: 0987654321"
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
            required
          />
          {fieldErrors.phone && (
            <span className="text-xs text-red-600">{tr(fieldErrors.phone)}</span>
          )}
        </label>
        <BookingEmailField
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
          inputClassName="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
        />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">{tr("Ghi chú")}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
          />
        </label>
      </div>

      {submitError && <p className="mt-2 text-sm text-red-600">{tr(submitError)}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-4 w-full rounded-xl bg-sunset-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-sunset-600 disabled:opacity-50"
      >
        {submitting ? tr("Đang gửi...") : tr("Gửi yêu cầu đặt")}
      </button>
      {kind === "stay" && avail && <ItineraryLink nights={avail.nights} className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-forest-700 transition hover:text-forest-900" />}
      <CommitmentLink />
      {isTransport && !legOk && avail && (
        <p className="mt-2 text-center text-xs text-gray-500">{tQuote?.error ? tr(tQuote.error) : tr("Vui lòng chọn điểm đón và điểm đến.")}</p>
      )}
      {requireSelection && !selectedId && avail && (
        <p className="mt-2 text-center text-xs text-gray-500">
          {tr("Vui lòng chọn một phương án ở trên.")}
        </p>
      )}
    </form>
  );
}
