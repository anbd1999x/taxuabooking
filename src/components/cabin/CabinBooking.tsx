"use client";

import { useMemo, useState } from "react";
import type { CabinDirectionOptions, CabinTripAvail, CabinDay } from "@/lib/cabin";
import { vnPhoneError } from "@/lib/phone";

function vnd(n: number | null | undefined, fallback = "Liên hệ") {
  if (n == null) return fallback;
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

const STATE_META: Record<CabinDay["state"], { text: string; cls: string }> = {
  ok: { text: "Còn chỗ", cls: "text-forest-700" },
  low: { text: "Còn ít chỗ", cls: "text-sunset-600" },
  full: { text: "Hết chỗ", cls: "text-gray-400" },
  unk: { text: "Chưa cập nhật", cls: "text-gray-400" },
};

interface Props {
  serviceId: string;
  operatorName: string;
  outbound: CabinDirectionOptions;
  ret: CabinDirectionOptions | null;
  phone: string;
  zalo?: string | null;
  /** Tỉnh khách chọn ở trang tìm (điểm đón → Tà Xùa). */
  pickupProvince?: string | null;
}

export function CabinBooking({ serviceId, operatorName, outbound, ret, phone, zalo, pickupProvince }: Props) {
  const roundTrip = Boolean(ret);
  const [dir, setDir] = useState<"di" | "ve">("di");
  const [outIdx, setOutIdx] = useState(outbound.pickIndex);
  const [retIdx, setRetIdx] = useState(ret?.pickIndex ?? 0);
  const [single, setSingle] = useState(1);
  const [double, setDouble] = useState(0);
  const [step, setStep] = useState(1);
  const [pickup, setPickup] = useState<string | null>(null);
  const [drop, setDrop] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const outTrip = outbound.days[outIdx]?.trip ?? null;
  const retTrip = roundTrip ? ret!.days[retIdx]?.trip ?? null : null;
  const activeDays = dir === "di" ? outbound.days : ret!.days;
  const activeIdx = dir === "di" ? outIdx : retIdx;
  const setActiveIdx = (i: number) => (dir === "di" ? setOutIdx(i) : setRetIdx(i));
  const activeTrip = dir === "di" ? outTrip : retTrip;

  // Chỗ còn cho từng loại (lấy min giữa chiều đi & về).
  const legSingle = (t: CabinTripAvail | null) =>
    !t ? 0 : t.status === "SOLD_OUT" ? 0 : t.status === "AVAILABLE" || t.status === "LIMITED" ? t.singleAvailable : 10;
  const legDouble = (t: CabinTripAvail | null) =>
    !t || t.priceDouble == null ? 0 : t.status === "SOLD_OUT" ? 0 : t.status === "AVAILABLE" || t.status === "LIMITED" ? t.doubleAvailable : 10;
  const legs = roundTrip ? [outTrip, retTrip] : [outTrip];
  const maxSingle = Math.min(...legs.map(legSingle));
  const maxDouble = Math.min(...legs.map(legDouble));

  const priceDouble = outTrip?.priceDouble ?? null;
  // Giá MỖI VÉ theo hành trình đang đặt: khứ hồi = cộng cả 2 chiều, một chiều = chiều đó.
  const unitSingle = (outTrip?.priceSingle ?? 0) + (roundTrip ? retTrip?.priceSingle ?? 0 : 0);
  const unitDouble = priceDouble == null ? null : priceDouble + (roundTrip ? retTrip?.priceDouble ?? 0 : 0);
  const total = useMemo(
    () => single * unitSingle + double * (unitDouble ?? 0),
    [single, double, unitSingle, unitDouble],
  );

  const bookable = Boolean(outTrip) && (!roundTrip || Boolean(retTrip)) && single + double >= 1;

  // ---- Điểm đón / trả (suy ra từ chuyến đi + tỉnh khách chọn) ----
  const province = pickupProvince?.trim() || null;
  const pickOpts = outTrip
    ? [
        ...(province && province !== outTrip.pickupPoint
          ? [{ name: `Đón tại ${province}`, sub: "Tỉnh bạn đã chọn khi tìm vé · nhà xe xác nhận điểm đón cụ thể" }]
          : []),
        { name: outTrip.pickupPoint, sub: "Điểm đón của nhà xe" },
        { name: "Đón nội thành (liên hệ)", sub: "Báo địa chỉ, nhà xe xác nhận giờ & phụ phí" },
      ]
    : [];
  const dropOpts = outTrip
    ? [
        { name: outTrip.dropoffPoint, sub: "Điểm trả của nhà xe" },
        { name: "Trả tại homestay", sub: "Ghi tên homestay ở ghi chú" },
      ]
    : [];

  // Số di động VN thật (đầu số nhà mạng, chặn số dãy/lặp) — server kiểm tra lại.
  const phoneErr = vnPhoneError(custPhone);
  const phoneOk = phoneErr === null;

  function step1Next() {
    if (!bookable) {
      setErr(!outTrip ? "Ngày này chưa có chuyến. Hãy chọn ngày khác." : "Vui lòng chọn ít nhất 1 vé.");
      return;
    }
    setErr(null);
    setPickup((p) => p ?? pickOpts[0]?.name ?? null);
    setDrop((d) => d ?? dropOpts[0]?.name ?? null);
    setStep(2);
  }

  async function submit() {
    setTried(true);
    if (!name.trim() || !phoneOk) {
      setErr(!name.trim() ? "Vui lòng nhập họ tên." : phoneErr);
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/cabin/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          outboundTripId: outTrip?.id,
          returnTripId: retTrip?.id ?? null,
          single,
          double,
          pickup,
          drop,
          customerName: name,
          phone: custPhone,
          note: note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Gửi yêu cầu thất bại.");
      } else {
        setCode(data.code);
        setNeedsConfirm(Boolean(data.needsConfirmation));
        setStep(4);
      }
    } catch {
      setErr("Lỗi kết nối, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep(1);
    setSingle(1);
    setDouble(0);
    setName("");
    setCustPhone("");
    setNote("");
    setTried(false);
    setErr(null);
    setCode(null);
  }

  const steps = ["Chọn vé", "Điểm đón trả", "Liên hệ"];

  return (
    <aside className="lg:sticky lg:top-20">
      <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_14px_40px_-22px_rgba(30,70,45,0.4)] ring-1 ring-black/[0.07]">
        {/* Header */}
        <div className="flex flex-col gap-3.5 px-[18px] pt-[18px]">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[19px] font-extrabold tracking-tight text-ink">Đặt vé</div>
            <div className="text-xs text-gray-500">Không cần tài khoản</div>
          </div>

          {/* Toggle chiều */}
          {roundTrip && step < 4 && (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[oklch(0.95_0.008_150)] p-1">
              {([["di", "Chiều đi"], ["ve", "Chiều về"]] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDir(k)}
                  className={`rounded-[9px] px-1.5 py-2 text-[13px] font-bold transition ${
                    dir === k ? "bg-white text-forest-700 shadow-sm" : "text-gray-500"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}

          {/* Dải ngày */}
          {step < 4 && (
            <div className="-mx-[18px] flex gap-1.5 overflow-x-auto px-[18px] pb-0.5">
              {activeDays.map((d, i) => {
                const a = i === activeIdx;
                const sm = STATE_META[d.state];
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className={`w-16 flex-none rounded-xl px-1.5 py-2 text-center transition ${
                      a ? "bg-forest-700 text-white" : d.state === "unk" ? "border border-dashed border-gray-300 bg-white" : "border border-gray-200 bg-white"
                    }`}
                  >
                    <div className={`text-[11px] ${a ? "text-white/80" : "text-gray-500"}`}>{d.wd}</div>
                    <div className={`text-base font-extrabold ${a ? "text-white" : "text-ink"}`}>{d.dd.slice(0, 2)}</div>
                    <div className={`flex min-h-[25px] items-center justify-center text-[10px] font-bold leading-tight ${a ? "text-white" : sm.cls}`}>
                      {sm.text}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tóm tắt chuyến đang xem */}
          {step < 4 && (
            <div className="flex items-center justify-between gap-2.5 rounded-2xl bg-[oklch(0.97_0.006_150)] px-3.5 py-3">
              <div className="min-w-0">
                <div className="text-[15px] font-extrabold text-ink">
                  {activeTrip ? `${activeTrip.departureTime} · ${dir === "di" ? "Đi" : "Về"}` : dir === "di" ? "Chiều đi" : "Chiều về"}
                </div>
                <div className="truncate text-xs text-gray-500">
                  {activeTrip ? activeTrip.pickupPoint : "Chưa có chuyến ngày này"}
                </div>
              </div>
              <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-bold ${
                activeTrip && (activeTrip.status === "AVAILABLE" || activeTrip.status === "LIMITED")
                  ? "bg-forest-50 text-forest-700"
                  : "bg-gray-100 text-gray-500"
              }`}>
                {activeTrip ? STATE_META[activeDays[activeIdx].state].text : "Chưa cập nhật"}
              </span>
            </div>
          )}

          {/* Thanh bước */}
          {step < 4 && (
            <div className="flex items-center gap-2">
              {steps.map((name, i) => {
                const n = i + 1;
                const done = step > n;
                const cur = step === n;
                return (
                  <div key={name} className="flex flex-1 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => done && setStep(n)}
                      className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-[11px] font-extrabold ${
                        cur || done ? "bg-forest-700 text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {done ? "✓" : n}
                    </button>
                    {cur && <span className="whitespace-nowrap text-[13px] font-bold text-ink">{name}</span>}
                    {i < 2 && <span className={`h-0.5 flex-1 ${done ? "bg-forest-700" : "bg-gray-200"}`} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Thân */}
        <div className="px-[18px] pt-4">
          {/* STEP 1 — chọn vé */}
          {step === 1 && (
            activeTrip ? (
              <div className="flex flex-col gap-3">
                <TicketStepper
                  label="Cabin đơn"
                  sub={roundTrip ? "1 người / cabin · khứ hồi" : "1 người / cabin · 1 chiều"}
                  price={unitSingle}
                  value={single}
                  max={maxSingle}
                  onChange={setSingle}
                  accent="forest"
                />
                {priceDouble != null && (
                  <TicketStepper
                    label="Cabin đôi"
                    sub={roundTrip ? "2 người / cabin · khứ hồi" : "2 người / cabin · 1 chiều"}
                    price={unitDouble ?? 0}
                    value={double}
                    max={maxDouble}
                    onChange={setDouble}
                    accent="sunset"
                  />
                )}
                <p className="text-center text-xs leading-relaxed text-gray-500">
                  Chỗ được giữ sau khi nhà xe gọi xác nhận. Chưa cần thanh toán.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 rounded-2xl bg-sky-50 p-4">
                <div className="text-[15px] font-extrabold text-ink">Chưa có chuyến cho ngày này</div>
                <div className="text-[13px] leading-relaxed text-gray-600">
                  Hãy chọn ngày khác ở dải ngày phía trên, hoặc gọi {phone} để được hỗ trợ.
                </div>
              </div>
            )
          )}

          {/* STEP 2 — điểm đón trả */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <PointGroup title="Điểm đón" opts={pickOpts} value={pickup} onPick={setPickup} />
              <PointGroup title="Điểm trả" opts={dropOpts} value={drop} onPick={setDrop} />
            </div>
          )}

          {/* STEP 3 — liên hệ */}
          {step === 3 && (
            <div className="flex flex-col gap-3">
              <Field label="Họ và tên *">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className={`rounded-xl border-[1.5px] px-3 py-2.5 text-base outline-none ${tried && !name.trim() ? "border-red-400" : "border-gray-200"}`}
                />
              </Field>
              <Field label="Số điện thoại *">
                <input
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="VD: 0987 654 321"
                  className={`rounded-xl border-[1.5px] px-3 py-2.5 text-base outline-none ${tried && !phoneOk ? "border-red-400" : "border-gray-200"}`}
                />
              </Field>
              <Field label="Ghi chú">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Đi cùng trẻ nhỏ, cần đón tận nhà…"
                  className="resize-y rounded-xl border-[1.5px] border-gray-200 px-3 py-2.5 text-[15px] outline-none"
                />
              </Field>
              <div className="flex flex-col gap-1.5 rounded-xl bg-[oklch(0.97_0.006_150)] p-3">
                {[
                  { k: "Chuyến đi", v: outTrip ? `${outbound.days[outIdx].dd} · ${outTrip.departureTime}` : "—" },
                  ...(roundTrip ? [{ k: "Chuyến về", v: retTrip ? `${ret!.days[retIdx].dd} · ${retTrip.departureTime}` : "—" }] : []),
                  { k: "Vé", v: [single ? `${single} đơn` : null, double ? `${double} đôi` : null].filter(Boolean).join(", ") || "—" },
                  { k: "Đón", v: pickup ?? "—" },
                  { k: "Trả", v: drop ?? "—" },
                ].map((r) => (
                  <div key={r.k} className="flex justify-between gap-2.5 text-[13px]">
                    <span className="text-gray-500">{r.k}</span>
                    <span className="text-right font-bold text-ink">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DONE */}
          {step === 4 && (
            <div className="mb-[18px] flex flex-col gap-2 rounded-2xl bg-forest-50 p-[18px]">
              <div className="text-xs font-bold uppercase tracking-wider text-forest-700">Đã gửi yêu cầu</div>
              <div className="text-2xl font-extrabold tracking-tight text-ink">Mã: {code}</div>
              <div className="text-[13px] leading-relaxed text-gray-700">
                {needsConfirm
                  ? `Tụi mình sẽ gọi ${custPhone} để xác nhận chỗ. Yêu cầu được xác nhận sau khi nhà xe kiểm tra, chưa cần thanh toán.`
                  : `Tụi mình sẽ gọi ${custPhone} để xác nhận chi tiết. Chưa cần thanh toán.`}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {zalo && (
                  <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-sunset-500 py-2.5 text-center text-sm font-bold text-white">
                    Nhắn Zalo
                  </a>
                )}
                <button type="button" onClick={reset} className="rounded-xl bg-white py-2.5 text-center text-sm font-bold text-ink ring-1 ring-black/10">
                  Đặt thêm
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 4 && (
          <div className="mt-4 flex flex-col gap-2.5 border-t border-gray-100 px-[18px] pb-[18px] pt-3.5">
            <div className="flex items-baseline justify-between gap-2.5">
              <div className="min-w-0 truncate text-xs text-gray-500">
                {single + double > 0 ? `${single + double} vé${roundTrip ? " × 2 chiều" : ""}` : "Chưa chọn vé"}
              </div>
              <div className="whitespace-nowrap text-[22px] font-extrabold tracking-tight text-sunset-600">
                {bookable ? vnd(total) : "—"}
              </div>
            </div>
            {err && <p className="text-[13px] font-semibold text-red-600">{err}</p>}
            <div className="flex gap-2">
              {step > 1 && (
                <button type="button" onClick={() => { setErr(null); setStep(step - 1); }} className="flex-none rounded-xl bg-[oklch(0.95_0.008_150)] px-3.5 py-3 text-sm font-bold text-ink">
                  ←
                </button>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  if (step === 1) return step1Next();
                  if (step === 2) return setStep(3);
                  if (step === 3) return submit();
                }}
                className={`flex-1 rounded-xl py-3 text-[15px] font-bold text-white transition ${
                  (step === 1 && !bookable) || submitting ? "bg-gray-300" : "bg-sunset-500 hover:bg-sunset-600"
                }`}
              >
                {submitting ? "Đang gửi..." : step === 3 ? "Gửi yêu cầu đặt" : "Tiếp tục"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="rounded-[10px] border border-gray-200 py-2.5 text-center text-[13px] font-bold text-forest-700">
                Gọi {phone}
              </a>
              <a href={zalo ? `https://zalo.me/${zalo}` : `tel:${phone.replace(/\s/g, "")}`} target="_blank" rel="noopener noreferrer" className="rounded-[10px] border border-gray-200 py-2.5 text-center text-[13px] font-bold text-sunset-600">
                Chat Zalo
              </a>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function TicketStepper({
  label, sub, price, value, max, onChange, accent,
}: {
  label: string; sub: string; price: number; value: number; max: number;
  onChange: (n: number) => void; accent: "forest" | "sunset";
}) {
  const ring = accent === "forest" ? "text-forest-700" : "text-sunset-600";
  const dot = accent === "forest" ? "bg-forest-600" : "bg-sunset-500";
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`h-3.5 w-3 flex-none rounded-sm ${dot}`} />
          <span className="text-sm font-bold text-ink">{label}</span>
        </div>
        <div className="mt-0.5 text-xs text-gray-500">{sub}</div>
        <div className={`mt-0.5 text-sm font-extrabold ${ring}`}>
          {new Intl.NumberFormat("vi-VN").format(price)}đ
        </div>
      </div>
      <div className="flex flex-none items-center gap-2.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-lg font-bold text-ink disabled:opacity-40"
        >
          −
        </button>
        <span className="w-5 text-center text-base font-extrabold text-ink">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-lg font-bold text-ink disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function PointGroup({
  title, opts, value, onPick,
}: {
  title: string;
  opts: { name: string; sub: string }[];
  value: string | null;
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[13px] font-bold text-ink">{title}</div>
      {opts.map((o) => {
        const a = value === o.name;
        return (
          <button
            key={o.name}
            type="button"
            onClick={() => onPick(o.name)}
            className={`grid grid-cols-[18px_minmax(0,1fr)] items-start gap-2.5 rounded-xl border p-3 text-left transition ${
              a ? "border-forest-600 bg-forest-50" : "border-gray-200 bg-white hover:border-forest-300"
            }`}
          >
            <span className={`mt-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${a ? "border-forest-600" : "border-gray-300"}`}>
              <span className={`h-2 w-2 rounded-full ${a ? "bg-forest-600" : "bg-transparent"}`} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">{o.name}</span>
              <span className="mt-0.5 block text-xs text-gray-500">{o.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
      {label}
      {children}
    </label>
  );
}
