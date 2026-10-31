"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ComboBusOption, ComboHomeOption, ComboRoomOption, ComboSearchResult } from "@/lib/combo";

const COMBO_DISCOUNT = 50000;

function vnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

export function ComboResults({ result }: { result: ComboSearchResult }) {
  const { homes, buses, bestHomeId, people, nights, budget, checkIn, checkOut, fromKey, toKey } = result;

  const [visible, setVisible] = useState(Math.min(3, homes.length));
  useEffect(() => {
    if (visible >= homes.length) return;
    const t = setTimeout(() => setVisible((v) => Math.min(homes.length, v + 1)), 140);
    return () => clearTimeout(t);
  }, [visible, homes.length]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-gray-600">
          <span className="font-bold text-ink">{homes.length}</span> homestay · {buses.length} nhà xe · {people} người ·{" "}
          {nights} đêm ({checkIn} → {checkOut})
        </p>
        {budget != null && (
          <p className="text-sm text-gray-500">
            Khớp giá mong muốn <span className="font-semibold text-forest-700">{vnd(budget)}</span>/khách
          </p>
        )}
      </div>

      <div className="flex flex-col gap-[18px]">
        {homes.slice(0, visible).map((h) => (
          <ComboHomeCard
            key={h.serviceId}
            home={h}
            buses={buses}
            people={people}
            nights={nights}
            budget={budget}
            best={h.serviceId === bestHomeId}
            checkIn={checkIn}
            checkOut={checkOut}
            fromKey={fromKey}
            toKey={toKey}
          />
        ))}
      </div>

      {visible < homes.length && <p className="mt-4 text-center text-sm text-gray-400">Đang hiện thêm…</p>}
    </div>
  );
}

function ComboHomeCard({
  home,
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
  const [roomId, setRoomId] = useState(home.rooms[0]?.roomId ?? "");

  const bus = useMemo(() => buses.find((b) => b.serviceId === busId) ?? buses[0], [buses, busId]);
  const room = useMemo<ComboRoomOption | undefined>(
    () => home.rooms.find((r) => r.roomId === roomId) ?? home.rooms[0],
    [home.rooms, roomId],
  );

  const roomShare = room ? Math.round(room.roomCost / people) : 0;
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
    if (!bus || !room) { setErr("Vui lòng chọn xe và phòng."); return; }
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
        {/* Ảnh homestay */}
        <div className="relative min-h-[180px]">
          {home.cover ? (
            <Image src={home.cover} alt={home.title} fill sizes="220px" className="object-cover" />
          ) : (
            <div className="flex h-full min-h-[180px] items-center justify-center bg-gray-100 text-4xl">🏠</div>
          )}
          {home.area && (
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[oklch(0.3_0.04_160)]">
              {home.area}
            </span>
          )}
        </div>

        {/* Chọn xe + phòng */}
        <div className="flex min-w-0 flex-col gap-3.5 p-5">
          <div>
            <div className="text-[19px] font-extrabold tracking-[-0.015em] text-ink">{home.title}</div>
            {home.amenities.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {home.amenities.map((a, i) => (
                  <span key={i} className="rounded-full bg-[oklch(0.95_0.025_155)] px-2.5 py-1 text-xs font-semibold text-[oklch(0.36_0.08_155)]">{a}</span>
                ))}
              </div>
            )}
          </div>

          {/* 1 · Chọn xe */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-extrabold tracking-wide text-sunset-600">1 · CHỌN XE CABIN KHỨ HỒI</div>
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

          {/* 2 · Chọn phòng */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-extrabold tracking-wide text-sunset-600">2 · CHỌN LOẠI PHÒNG</span>
              {home.rooms.length > 2 && (
                <span className="text-[11px] font-semibold text-gray-400">{home.rooms.length} phòng · cuộn để xem thêm</span>
              )}
            </div>
            <div
              className={`flex flex-col rounded-[14px] border border-[oklch(0.92_0.01_200)] ${home.rooms.length > 2 ? "overflow-y-auto overscroll-contain" : "overflow-hidden"}`}
              style={home.rooms.length > 2 ? { maxHeight: 128 } : undefined}
            >
              {home.rooms.map((r, i) => {
                const on = r.roomId === room?.roomId;
                return (
                  <button
                    key={r.roomId}
                    type="button"
                    onClick={() => setRoomId(r.roomId)}
                    className="grid items-center gap-3 px-3.5 py-3 text-left transition"
                    style={{ gridTemplateColumns: "20px minmax(0,1fr) auto", background: on ? "oklch(0.97 0.02 155)" : "white", borderTop: i === 0 ? "none" : "1px solid oklch(0.94 0.01 200)" }}
                  >
                    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-2" style={{ borderColor: on ? "oklch(0.29 0.055 160)" : "oklch(0.75 0.02 200)" }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: on ? "oklch(0.29 0.055 160)" : "transparent" }} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-ink">{r.roomName}</div>
                      <div className="text-xs text-gray-500">Tối đa {r.capacity} người · {nights} đêm</div>
                    </div>
                    <div className="text-right">
                      <div className="whitespace-nowrap text-xs font-bold text-[oklch(0.38_0.1_155)]">Còn phòng</div>
                      <div className="whitespace-nowrap text-[13px] font-bold text-ink">{vnd(r.roomCost)}/phòng</div>
                    </div>
                  </button>
                );
              })}
            </div>
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
            disabled={!bus || !room}
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
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Phòng</span><span className="font-bold text-ink">{room?.roomName}</span></div>
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
