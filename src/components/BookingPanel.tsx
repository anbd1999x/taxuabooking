"use client";

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
  transport?: { fixedPrice: number | null; note: string | null };
  manualConfirmOnly?: boolean;
  basePrice?: number | null;
  policyNote?: string;
}

function StatusBadge({ status }: { status: AvailabilityStatus }) {
  const m = AVAILABILITY_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function BookingPanel({
  serviceId,
  category,
  kind,
  phone,
  zalo,
}: {
  serviceId: string;
  category: ServiceCategory;
  kind: AvailabilityKind;
  phone: string;
  zalo?: string | null;
}) {
  const needsRange = kind === "stay" || kind === "rental";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [checking, setChecking] = useState(false);
  const [avail, setAvail] = useState<AvailabilityResponse | null>(null);
  const [availError, setAvailError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; needsConfirmation: boolean } | null>(null);

  const qtyLabel =
    kind === "stay" ? "Số phòng" : kind === "rental" ? "Số xe" : kind === "trip" ? "Số vé" : "Số khách";

  async function check() {
    setAvailError(null);
    setSelectedId(null);
    if (!from) {
      setAvailError("Vui lòng chọn ngày.");
      return;
    }
    if (needsRange && to && to <= from) {
      setAvailError("Ngày trả phải sau ngày nhận.");
      return;
    }
    setChecking(true);
    // Homestay: làm tươi lịch phòng từ Google Sheet trước khi hiện tình trạng
    // (server bỏ qua nếu vừa đồng bộ <60s) — hiện overlay loading trong lúc chờ.
    if (category === "HOMESTAY" || category === "BUNGALOW") {
      showGlobalLoading(true, "Đang cập nhật tình trạng phòng mới nhất…");
      try { await ensureSheetFresh(serviceId); } finally { showGlobalLoading(false); }
    }
    try {
      const params = new URLSearchParams({ serviceId, from, quantity: String(quantity) });
      if (needsRange && to) params.set("to", to);
      const res = await fetch(`/api/availability?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setAvailError(data.error ?? "Không kiểm tra được tình trạng.");
        setAvail(null);
      } else {
        setAvail(data as AvailabilityResponse);
      }
    } catch {
      setAvailError("Lỗi kết nối, vui lòng thử lại.");
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
        endDate: needsRange && to ? to : null,
        quantity: kind === "stay" ? 1 : quantity,
        roomTypeId: null,
        roomId: kind === "stay" ? selectedId : null,
        rentalVehicleId: kind === "rental" ? selectedId : null,
        cabinTripId: kind === "trip" ? selectedId : null,
        customerName: name,
        phone: custPhone,
        note: note || null,
      };
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Gửi yêu cầu thất bại.");
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
      } else {
        setResult(data);
      }
    } catch {
      setSubmitError("Lỗi kết nối, vui lòng thử lại.");
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
            Đã gửi yêu cầu thành công!
          </h3>
          <p className="mt-1 text-sm text-gray-600">Mã yêu cầu của bạn:</p>
          <p className="mt-1 text-2xl font-extrabold tracking-wider text-sunset-600">
            {result.code}
          </p>
          {result.needsConfirmation ? (
            <p className="mt-3 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
              Yêu cầu sẽ được xác nhận sau khi quản trị viên kiểm tra tình trạng.
              Chúng tôi sẽ liên hệ bạn qua số điện thoại đã cung cấp.
            </p>
          ) : (
            <p className="mt-3 rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-800">
              Chúng tôi sẽ liên hệ bạn sớm để xác nhận chi tiết.
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-700"
            >
              📞 Gọi xác nhận
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
  const canSubmit =
    Boolean(from) && (!requireSelection || Boolean(selectedId)) && !submitting;

  return (
    <form
      onSubmit={submit}
      className="sticky top-20 rounded-2xl bg-white p-5 shadow-md ring-1 ring-black/5"
    >
      <h3 className="text-lg font-bold text-ink">Đặt dịch vụ</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Không cần tài khoản. Chọn ngày để xem giá và tình trạng.
      </p>

      {/* Ngày */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">
            {kind === "trip" ? "Ngày đi" : needsRange ? "Nhận" : "Ngày dùng"}
          </span>
          <DateField
            value={from}
            min={todayKey()}
            onChange={(v) => { setFrom(v); setAvail(null); }}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
            displayClassName="px-3 text-sm text-gray-900"
            ariaLabel={kind === "trip" ? "Ngày đi" : needsRange ? "Nhận" : "Ngày dùng"}
            required
          />
        </label>
        {needsRange && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">Trả</span>
            <DateField
              value={to}
              min={from || todayKey()}
              onChange={(v) => { setTo(v); setAvail(null); }}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
              displayClassName="px-3 text-sm text-gray-900"
              ariaLabel="Trả"
            />
          </label>
        )}
        {kind !== "stay" && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">{qtyLabel}</span>
            <QtyInput
              min={1}
              max={20}
              value={quantity}
              onChange={(n) => { setQuantity(n); setAvail(null); }}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
              ariaLabel={qtyLabel}
            />
          </label>
        )}
      </div>

      <button
        type="button"
        onClick={check}
        disabled={checking || !from}
        className="mt-3 w-full rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-700 disabled:opacity-50"
      >
        {checking ? "Đang kiểm tra..." : "Kiểm tra giá & tình trạng"}
      </button>

      {availError && (
        <p className="mt-2 text-sm text-red-600">{availError}</p>
      )}

      {/* Kết quả tình trạng */}
      {avail && (
        <div className="mt-4 space-y-2">
          {/* Vi phạm chính sách bán cuối tuần theo cụm → không cho chọn/đặt */}
          {avail.policyNote && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              ⚠️ {avail.policyNote}
            </p>
          )}

          {/* stay / rental */}
          {(kind === "stay" || kind === "rental") && !avail.manualConfirmOnly && !avail.policyNote && (
            options.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Chưa có loại {kind === "stay" ? "phòng" : "xe"} nào.
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
                    onChange={() => setSelectedId(o.id)}
                  />
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">{o.name}</span>
                      <StatusBadge status={o.status} />
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {kind === "stay" ? `Sức chứa ${o.capacity} người · ` : ""}
                      {o.count} {kind === "stay" ? "đêm" : "ngày"}
                      {o.bookable ? ` · còn ${o.availableUnits}` : ""}
                    </span>
                    <span className="mt-1 block font-bold text-forest-700">
                      {o.pricePerUnit != null
                        ? `${formatVnd(o.pricePerUnit * quantity)} cho ${quantity} ${kind === "stay" ? "phòng" : "xe"}`
                        : "Liên hệ xác nhận giá"}
                    </span>
                  </span>
                </label>
              ))
            )
          )}

          {/* trip (cabin) */}
          {kind === "trip" &&
            (trips.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Chưa có chuyến nào cho ngày này. Vui lòng chọn ngày khác hoặc
                gửi yêu cầu để được hỗ trợ.
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
                      <span className="font-medium text-ink">🕐 {t.departureTime}</span>
                      <StatusBadge status={t.status} />
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {t.label}{t.bookable ? ` · còn ${t.seatsAvailable} chỗ` : ""}
                    </span>
                    <span className="mt-1 block font-bold text-forest-700">
                      {formatVnd(t.price * quantity)} / {quantity} vé
                    </span>
                  </span>
                </label>
              ))
            ))}

          {/* transport */}
          {kind === "transport" && avail.transport && (
            <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
              {avail.transport.fixedPrice != null ? (
                <p className="font-semibold text-forest-700">
                  Giá tham khảo: {formatVnd(avail.transport.fixedPrice)}
                </p>
              ) : (
                <p className="font-semibold">Liên hệ xác nhận giá</p>
              )}
              {avail.transport.note && <p className="mt-1">{avail.transport.note}</p>}
              <p className="mt-1">Yêu cầu sẽ được xác nhận sau khi kiểm tra.</p>
            </div>
          )}

          {/* combo / manual */}
          {avail.manualConfirmOnly && (
            <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
              <p className="font-semibold text-forest-700">
                {formatVnd(avail.basePrice != null ? avail.basePrice * quantity : null)}
                {avail.basePrice != null ? ` cho ${quantity} khách (tham khảo)` : ""}
              </p>
              <p className="mt-1">
                Combo được xác nhận chỗ sau khi quản trị viên kiểm tra. Gửi yêu
                cầu để được tư vấn lịch khởi hành.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Thông tin khách */}
      <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Họ và tên *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
            required
          />
          {fieldErrors.customerName && (
            <span className="text-xs text-red-600">{fieldErrors.customerName}</span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Số điện thoại *</span>
          <input
            value={custPhone}
            onChange={(e) => setCustPhone(e.target.value)}
            inputMode="tel"
            placeholder="VD: 0987654321"
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
            required
          />
          {fieldErrors.phone && (
            <span className="text-xs text-red-600">{fieldErrors.phone}</span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Ghi chú</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
          />
        </label>
      </div>

      {submitError && <p className="mt-2 text-sm text-red-600">{submitError}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-4 w-full rounded-xl bg-sunset-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-sunset-600 disabled:opacity-50"
      >
        {submitting ? "Đang gửi..." : "Gửi yêu cầu đặt"}
      </button>
      {kind === "stay" && avail && <ItineraryLink nights={avail.nights} className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-forest-700 transition hover:text-forest-900" />}
      <CommitmentLink />
      {requireSelection && !selectedId && avail && (
        <p className="mt-2 text-center text-xs text-gray-500">
          Vui lòng chọn một phương án ở trên.
        </p>
      )}
    </form>
  );
}
