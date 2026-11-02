"use client";

import { useActionState, useState } from "react";
import type { ServiceCategory } from "@prisma/client";
import { CATEGORIES, AREA_OPTIONS } from "@/lib/constants";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { createServiceFull, type ActionState } from "@/app/admin/services/actions";

const inp =
  "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200";
const cell = "w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus:border-forest-500 focus:outline-none";

function titleLabel(cat: ServiceCategory) {
  switch (cat) {
    case "CABIN": return "Tên nhà xe";
    case "HOMESTAY": return "Tên homestay";
    case "BUNGALOW": return "Tên khu bungalow";
    case "MOTORBIKE": return "Tên bên cho thuê xe";
    case "XEOM": return "Tên dịch vụ xe ôm";
    case "TAXI": return "Tên dịch vụ taxi";
    default: return "Tên combo";
  }
}

let seq = 0;
const nextKey = () => ++seq;

export function ServiceCreateWizard({ category }: { category: ServiceCategory }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createServiceFull, {});
  const meta = CATEGORIES[category];
  const kind = meta.availabilityKind;
  const isStay = category === "HOMESTAY" || category === "BUNGALOW";

  const [rooms, setRooms] = useState<number[]>([nextKey()]);
  const [trips, setTrips] = useState<number[]>([nextKey()]);
  const [vehicles, setVehicles] = useState<number[]>([nextKey()]);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="category" value={category} />

      {/* Thông tin chung */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-lg font-semibold text-ink">Thông tin chung</h2>
        <label className="block">
          <span className="text-sm font-medium text-gray-600">{titleLabel(category)} *</span>
          <input name="title" required className={inp} />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-gray-600">Mô tả ngắn *</span>
          <input name="summary" required className={inp} placeholder="Một câu giới thiệu ngắn" />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-gray-600">Mô tả chi tiết *</span>
          <textarea name="description" required rows={4} className={inp} />
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-600">
              {kind === "trip" ? "Tuyến đường" : "Khu vực"}
            </span>
            {isStay ? (
              <select name="area" defaultValue="" className={inp}>
                <option value="">— Chọn khu vực —</option>
                {AREA_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            ) : (
              <input name="area" className={inp} placeholder={kind === "trip" ? "Hà Nội → Tà Xùa" : "Trung tâm Tà Xùa"} />
            )}
          </label>
          {isStay && (
            <label className="block">
              <span className="text-sm font-medium text-gray-600">Cách trung tâm (km)</span>
              <input name="distanceKm" type="number" inputMode="decimal" step="0.1" min="0" className={inp} placeholder="VD: 1.5 — 0 = ngay trung tâm" />
            </label>
          )}
          <label className="block">
            <span className="text-sm font-medium text-gray-600">Giá cơ bản (đ)</span>
            <MoneyInput name="basePrice" className={inp} placeholder="Tự tính nếu để trống" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-600">Đơn vị giá</span>
            <input name="priceUnit" defaultValue={meta.priceUnit} className={inp} />
          </label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-600">Người liên hệ</span>
            <input name="contactName" className={inp} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-600">Điện thoại</span>
            <input name="contactPhone" className={inp} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-600">Zalo</span>
            <input name="contactZalo" className={inp} />
          </label>
        </div>
        <div className="mt-4 flex gap-6">
          <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked className="h-4 w-4 accent-forest-600" /><span className="text-sm text-gray-700">Hiển thị</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" name="featured" className="h-4 w-4 accent-forest-600" /><span className="text-sm text-gray-700">Nổi bật</span></label>
        </div>
      </section>

      {/* STAY: hạng phòng */}
      {isStay && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Các hạng phòng</h2>
            <button type="button" onClick={() => setRooms((r) => [...r, nextKey()])} className="rounded-lg bg-forest-100 px-3 py-1.5 text-sm font-medium text-forest-700">+ Thêm hạng phòng</button>
          </div>
          <div className="space-y-2">
            <div className="hidden grid-cols-12 gap-2 px-1 text-[11px] font-medium text-gray-400 sm:grid">
              <span className="col-span-4">Tên hạng phòng</span><span className="col-span-2">Sức chứa</span><span className="col-span-2">Giá thường</span><span className="col-span-2">Giá cuối tuần</span><span className="col-span-1">SL</span>
            </div>
            {rooms.map((k) => (
              <div key={k} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-12">
                <input name="roomName" placeholder="Phòng đôi view mây" className={`${cell} col-span-4`} />
                <input name="roomCapacity" type="number" defaultValue={2} className={`${cell} sm:col-span-2`} />
                <MoneyInput name="roomWeekday" placeholder="450.000" className={`${cell} sm:col-span-2`} />
                <MoneyInput name="roomWeekend" placeholder="650.000" className={`${cell} sm:col-span-2`} />
                <input name="roomTotal" type="number" defaultValue={1} className={`${cell} sm:col-span-1`} />
                <button type="button" onClick={() => setRooms((r) => r.filter((x) => x !== k))} className="text-sm text-red-500 sm:col-span-1">Xoá</button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">Sau khi tạo: mỗi hạng phòng có mục tải <b>nhiều ảnh</b> riêng, và cập nhật số phòng trống theo ngày ở “Lịch giá &amp; tình trạng”.</p>
        </section>
      )}

      {/* CABIN: chuyến xe */}
      {kind === "trip" && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Chuyến xe ban đầu</h2>
            <button type="button" onClick={() => setTrips((t) => [...t, nextKey()])} className="rounded-lg bg-forest-100 px-3 py-1.5 text-sm font-medium text-forest-700">+ Thêm chuyến</button>
          </div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-xs font-medium text-gray-500">Điểm đón</span><input name="pickupPoint" defaultValue="Đón nội thành Hà Nội" className={inp} /></label>
            <label className="block"><span className="text-xs font-medium text-gray-500">Điểm trả</span><input name="dropoffPoint" defaultValue="Trung tâm Tà Xùa" className={inp} /></label>
          </div>
          <div className="space-y-2">
            <div className="hidden grid-cols-12 gap-2 px-1 text-[11px] font-medium text-gray-400 sm:grid">
              <span className="col-span-3">Ngày đi</span><span className="col-span-3">Giờ</span><span className="col-span-3">Giá vé</span><span className="col-span-2">Tổng chỗ</span>
            </div>
            {trips.map((k) => (
              <div key={k} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-12">
                <input name="tripDate" type="date" className={`${cell} sm:col-span-3`} />
                <input name="tripTime" placeholder="21:30" className={`${cell} sm:col-span-3`} />
                <MoneyInput name="tripPrice" placeholder="350.000" className={`${cell} sm:col-span-3`} />
                <input name="tripSeats" type="number" defaultValue={22} className={`${cell} sm:col-span-2`} />
                <button type="button" onClick={() => setTrips((t) => t.filter((x) => x !== k))} className="text-sm text-red-500 sm:col-span-1">Xoá</button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">Có thể thêm chuyến cho nhiều ngày khác sau khi tạo. Bỏ trống nếu chưa có lịch.</p>
        </section>
      )}

      {/* MOTORBIKE: loại xe */}
      {kind === "rental" && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Các loại xe</h2>
            <button type="button" onClick={() => setVehicles((v) => [...v, nextKey()])} className="rounded-lg bg-forest-100 px-3 py-1.5 text-sm font-medium text-forest-700">+ Thêm loại xe</button>
          </div>
          <div className="space-y-2">
            <div className="hidden grid-cols-12 gap-2 px-1 text-[11px] font-medium text-gray-400 sm:grid">
              <span className="col-span-5">Loại xe</span><span className="col-span-3">Giá / ngày</span><span className="col-span-3">Số xe</span>
            </div>
            {vehicles.map((k) => (
              <div key={k} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-12">
                <input name="vehType" placeholder="Honda Wave" className={`${cell} sm:col-span-5`} />
                <MoneyInput name="vehPrice" placeholder="150.000" className={`${cell} sm:col-span-3`} />
                <input name="vehTotal" type="number" defaultValue={1} className={`${cell} sm:col-span-3`} />
                <button type="button" onClick={() => setVehicles((v) => v.filter((x) => x !== k))} className="text-sm text-red-500 sm:col-span-1">Xoá</button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">Số xe trống theo từng ngày cập nhật ở “Lịch giá & tình trạng” sau khi tạo.</p>
        </section>
      )}

      {/* XEOM/TAXI: tuyến */}
      {kind === "transport" && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-lg font-semibold text-ink">Thông tin tuyến</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="text-sm font-medium text-gray-600">Điểm đón</span><input name="fromPoint" className={inp} /></label>
            <label className="block"><span className="text-sm font-medium text-gray-600">Điểm đến / khu vực</span><input name="toArea" className={inp} /></label>
            <label className="block"><span className="text-sm font-medium text-gray-600">Loại xe</span><input name="transportVehicle" className={inp} /></label>
            <label className="block"><span className="text-sm font-medium text-gray-600">Giá cố định (đ)</span><MoneyInput name="fixedPrice" className={inp} placeholder="Để trống = Liên hệ xác nhận giá" /></label>
            <label className="block sm:col-span-2"><span className="text-sm font-medium text-gray-600">Ghi chú giá</span><input name="priceNote" className={inp} /></label>
          </div>
        </section>
      )}

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-xl bg-forest-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50">
          {pending ? "Đang tạo..." : "Tạo & thêm ảnh"}
        </button>
        <span className="text-sm text-gray-400">Sau khi tạo, bạn sẽ tới trang thêm ảnh và tinh chỉnh chi tiết.</span>
      </div>
    </form>
  );
}
