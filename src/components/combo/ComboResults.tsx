"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ComboBusOption, ComboHomeOption, ComboRoomFeatures, ComboRoomOption, ComboSearchResult } from "@/lib/combo";

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

/** Một thẻ kết quả = MỘT phòng cụ thể (kèm homestay chứa nó). */
interface RoomEntry {
  home: ComboHomeOption;
  room: ComboRoomOption;
  bestPrice: number; // giá/khách với xe rẻ nhất (để sắp xếp)
}

export function ComboResults({ result }: { result: ComboSearchResult }) {
  const { homes, buses, people, nights, budget, checkIn, checkOut, fromKey, toKey } = result;

  // Hiện đúng từng căn phòng phù hợp (không gom theo homestay), sắp theo mức
  // gần giá mong muốn nhất (không nhập giá → rẻ trước).
  const rooms = useMemo<RoomEntry[]>(() => {
    const cheapestFare = buses.length ? Math.min(...buses.map((b) => b.farePerPerson)) : 0;
    const arr = homes.flatMap((home) =>
      home.rooms.map((room) => ({
        home,
        room,
        bestPrice: Math.max(0, Math.round(room.roomCost / people) + cheapestFare - COMBO_DISCOUNT),
      })),
    );
    arr.sort((a, b) => {
      const da = budget != null ? Math.abs(a.bestPrice - budget) : a.bestPrice;
      const db = budget != null ? Math.abs(b.bestPrice - budget) : b.bestPrice;
      return da - db || a.bestPrice - b.bestPrice;
    });
    return arr;
  }, [homes, buses, people, budget]);

  const bestRoomId = buses.length > 0 && rooms.length > 0 ? rooms[0].room.roomId : null;

  const [visible, setVisible] = useState(Math.min(3, rooms.length));
  useEffect(() => {
    if (visible >= rooms.length) return;
    const t = setTimeout(() => setVisible((v) => Math.min(rooms.length, v + 1)), 140);
    return () => clearTimeout(t);
  }, [visible, rooms.length]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-gray-600">
          <span className="font-bold text-ink">{rooms.length}</span> phòng · {buses.length} nhà xe · {people} người ·{" "}
          {nights} đêm ({checkIn} → {checkOut})
        </p>
        {budget != null && (
          <p className="text-sm text-gray-500">
            Khớp giá mong muốn <span className="font-semibold text-forest-700">{vnd(budget)}</span>/khách
          </p>
        )}
      </div>

      <div className="flex flex-col gap-[18px]">
        {rooms.slice(0, visible).map((e) => (
          <ComboRoomCard
            key={e.room.roomId}
            home={e.home}
            room={e.room}
            buses={buses}
            people={people}
            nights={nights}
            budget={budget}
            best={e.room.roomId === bestRoomId}
            checkIn={checkIn}
            checkOut={checkOut}
            fromKey={fromKey}
            toKey={toKey}
          />
        ))}
      </div>

      {visible < rooms.length && <p className="mt-4 text-center text-sm text-gray-400">Đang hiện thêm…</p>}
    </div>
  );
}

function ComboRoomCard({
  home,
  room,
  buses,
  people,
  nights,
  budget,
  best,
  checkIn,
  checkOut,
  fromKey,
  toKey,
}: {
  home: ComboHomeOption;
  room: ComboRoomOption;
  buses: ComboBusOption[];
  people: number;
  nights: number;
  budget: number | null;
  best: boolean;
  checkIn: string;
  checkOut: string;
  fromKey: string;
  toKey: string;
}) {
  const [busId, setBusId] = useState(buses[0]?.serviceId ?? "");
  const bus = useMemo(() => buses.find((b) => b.serviceId === busId) ?? buses[0], [buses, busId]);

  const amenities = useMemo(() => {
    const out = FEAT.filter(([k]) => room.features[k]).map(([, label]) => label);
    if (room.pool) out.push("🏊 Hồ bơi");
    if (room.easyRoad) out.push("🛣️ Đường dễ đi");
    return out;
  }, [room]);

  const roomShare = Math.round(room.roomCost / people);
  const pricePerPerson = Math.max(0, roomShare + (bus?.farePerPerson ?? 0) - COMBO_DISCOUNT);
  const total = pricePerPerson * people;
  const diff = budget != null ? pricePerPerson - budget : null;

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
          roomId: room.roomId,
          outboundTripId: bus.outboundTripId,
          returnTripId: bus.returnTripId,
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
          Khớp giá nhất với mong muốn của bạn
        </div>
      )}
      <div className="grid gap-0 lg:grid-cols-[210px_minmax(0,1fr)_268px]">
        {/* Ảnh phòng (thiếu thì ảnh hạng phòng / homestay) */}
        <div className="relative min-h-[180px]">
          {room.cover ? (
            <Image src={room.cover} alt={room.roomName} fill sizes="220px" className="object-cover" />
          ) : (
            <div className="flex h-full min-h-[180px] items-center justify-center bg-gray-100 text-4xl">🛏️</div>
          )}
          {home.area && (
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[oklch(0.3_0.04_160)]">
              {home.area}
            </span>
          )}
        </div>

        {/* Thông tin phòng + chọn xe */}
        <div className="flex min-w-0 flex-col gap-3.5 p-5">
          <div>
            <div className="text-[13px] font-semibold text-gray-500">{home.title}</div>
            <div className="text-[19px] font-extrabold tracking-[-0.015em] text-ink">{room.roomName}</div>
            <div className="mt-0.5 text-[13px] text-gray-500">
              Tối đa {room.capacity} người · {nights} đêm · <span className="font-bold text-ink">{vnd(room.roomCost)}</span>/phòng cả kỳ ·{" "}
              <span className="font-bold text-[oklch(0.38_0.1_155)]">Còn phòng</span>
            </div>
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
            <div className="flex justify-between gap-2"><span>Phòng ÷ {people}</span><span className="font-bold text-ink">{vnd(roomShare)}</span></div>
            <div className="flex justify-between gap-2"><span>Vé khứ hồi / khách</span><span className="font-bold text-ink">{vnd(bus?.farePerPerson ?? 0)}</span></div>
            <div className="flex justify-between gap-2"><span>Giảm combo</span><span className="font-bold text-forest-700">− {vnd(COMBO_DISCOUNT)}</span></div>
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
            <Link href={`/homestay/${home.slug}?from=${encodeURIComponent(checkIn)}&to=${encodeURIComponent(checkOut)}`} className="flex-1 rounded-full border border-forest-200 py-2 text-center text-[13px] font-bold text-forest-700 hover:bg-forest-50">Xem phòng</Link>
            {bus && (
              <Link href={`/xe-cabin/${bus.slug}?from=${encodeURIComponent(fromKey)}&to=${encodeURIComponent(toKey)}`} className="flex-1 rounded-full border border-forest-200 py-2 text-center text-[13px] font-bold text-forest-700 hover:bg-forest-50">Xem xe</Link>
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
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Phòng</span><span className="font-bold text-ink">{room.roomName}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Xe cabin</span><span className="font-bold text-ink">{bus?.title} · đi {bus?.outboundTime} / về {bus?.returnTime}</span></div>
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
    </article>
  );
}
