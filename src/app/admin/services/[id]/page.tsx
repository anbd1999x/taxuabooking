import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";
import { toNumber, formatDate } from "@/lib/format";
import { toDateKey, today, addDays } from "@/lib/dates";
import { ServiceForm } from "@/components/admin/ServiceForm";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { ServiceTabNav } from "@/components/admin/ServiceTabNav";
import { CabinScheduleEditor } from "@/components/admin/CabinScheduleEditor";
import { ActionForm } from "@/components/admin/ActionForm";
import { upsertCabinPrice, deleteCabinPrice } from "../../cabin-prices/actions";
import {
  upsertCabinRoute,
  upsertCabinStop,
  deleteCabinStop,
} from "../actions";
import {
  updateService,
  deleteService,
  deleteImage,
  setCover,
  upsertRoomType,
  deleteRoomType,
  upsertRoom,
  deleteRoom,
  deleteRoomImage,
  setRoomImageCover,
  deleteRoomPhoto,
  setRoomPhotoCover,
  upsertVehicle,
  deleteVehicle,
  upsertTrip,
  deleteTrip,
  upsertTransport,
} from "../actions";
import {
  enableRoomIcal,
  addIcalSource,
  deleteIcalSource,
  syncRoomIcalNow,
} from "../ical-actions";
import { saveSheetUrl, syncServiceSheetNow } from "../sheet-actions";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

const inp = "w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus:border-forest-500 focus:outline-none";

const TICKET_OPTIONS = [
  { value: "ROUND_TRIP", label: "Khứ hồi" },
  { value: "OUTBOUND", label: "Chiều đi" },
  { value: "RETURN", label: "Chiều về" },
];

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      roomTypes: {
        orderBy: { sortOrder: "asc" },
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          rooms: {
            orderBy: { sortOrder: "asc" },
            include: {
              images: { orderBy: { sortOrder: "asc" } },
              icalSources: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
      rentalVehicles: { orderBy: { sortOrder: "asc" } },
      cabinTrips: { where: { departureDate: { gte: today() } }, orderBy: { departureDate: "asc" }, take: 30 },
      transport: true,
      cabinPriceRows: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      cabinRoutes: { include: { stops: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!service) notFound();

  const providers = await prisma.adminUser.findMany({
    where: { role: "PROVIDER" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const cat = CATEGORIES[service.category];
  const kind = cat.availabilityKind;

  // ---- CABIN: giao diện quản lý theo tab (bám sát thiết kế) ----
  if (service.category === "CABIN") {
    const cover = service.images.find((i) => i.isCover)?.url ?? service.images[0]?.url ?? null;
    const stopCount = service.cabinRoutes.reduce((a, r) => a + r.stops.length, 0);
    const firstTrip = service.cabinTrips[0];
    const genStart = toDateKey(today());
    const genEnd = toDateKey(addDays(today(), 13));
    const cardCls = "rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6";
    const labelCls = "mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-gray-500 first:mt-0";
    const tabs = [
      { key: "info", label: "Thông tin" },
      { key: "img", label: "Hình ảnh", badge: String(service.images.length) },
      { key: "route", label: "Lộ trình", badge: `${stopCount} điểm` },
      { key: "fare", label: "Giá vé", badge: `${service.cabinPriceRows.length} chặng` },
      { key: "trip", label: "Chuyến xe", badge: `${service.cabinTrips.length}` },
    ];

    return (
      <div className="max-w-[1180px] space-y-5">
        <div className="text-sm text-gray-500">
          <Link href="/admin/services" className="hover:text-forest-700">Dịch vụ</Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-gray-700">{service.title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="relative h-14 w-14 flex-none overflow-hidden rounded-[14px] bg-gray-100 ring-1 ring-black/5">
            {cover ? <Image src={cover} alt={service.title} fill sizes="56px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-xl">🚐</div>}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{service.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
              <span className={`rounded-full px-2.5 py-1 font-bold ${service.published ? "bg-forest-50 text-forest-700" : "bg-gray-100 text-gray-500"}`}>{service.published ? "Đang hiển thị" : "Đang ẩn"}</span>
              <span className="text-gray-500">{cat.label}</span>
              <Link href={`/${cat.slug}/${service.slug}`} target="_blank" className="font-bold text-forest-700 hover:underline">Xem trên website ↗</Link>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <ServiceTabNav tabs={tabs} />

          <div className="min-w-0 space-y-4">
            {/* 1 · Thông tin */}
            <div id="sec-info" className="scroll-mt-20">
              <div className={labelCls}>1 · Thông tin</div>
              <section className={`${cardCls} mt-2`}>
                <ServiceForm
                  action={updateService}
                  submitLabel="Lưu thay đổi"
                  providers={providers}
                  initial={{
                    id: service.id, category: service.category, title: service.title, slug: service.slug,
                    summary: service.summary, description: service.description, area: service.area, mapUrl: service.mapUrl, policy: service.policy,
                    basePrice: toNumber(service.basePrice), priceUnit: service.priceUnit,
                    contactName: service.contactName, contactPhone: service.contactPhone, contactZalo: service.contactZalo,
                    featured: service.featured, published: service.published, easyRoad: service.easyRoad, pool: service.pool, ownerId: service.ownerId,
                  }}
                />
              </section>
              <section className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-red-100 bg-red-50/40 px-5 py-4">
                <div>
                  <div className="text-[15px] font-extrabold text-ink">Xoá bài đăng</div>
                  <div className="mt-0.5 text-[13px] text-gray-500">Muốn tạm ẩn thì tắt “Hiển thị trên website” thay vì xoá.</div>
                </div>
                <form action={deleteService}>
                  <input type="hidden" name="id" value={service.id} />
                  <button className="rounded-xl border-[1.5px] border-red-300 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50">Xoá bài đăng</button>
                </form>
              </section>
            </div>

            {/* 2 · Hình ảnh */}
            <div id="sec-img" className="scroll-mt-20">
              <div className={labelCls}>2 · Hình ảnh</div>
              <section className={`${cardCls} mt-2`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[17px] font-extrabold text-ink">Hình ảnh</div>
                    <div className="text-[13px] text-gray-500">Ảnh đầu tiên là ảnh bìa.</div>
                  </div>
                  <ImageUploader serviceId={service.id} />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {service.images.map((img) => (
                    <div key={img.id} className="group relative overflow-hidden rounded-xl ring-1 ring-black/5">
                      <div className="relative aspect-[4/3]"><Image src={img.url} alt={img.alt ?? ""} fill sizes="200px" className="object-cover" /></div>
                      {img.isCover && <span className="absolute left-1.5 top-1.5 rounded-full bg-sunset-500 px-2 py-0.5 text-[10px] font-bold text-white">Ảnh bìa</span>}
                      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1.5 opacity-0 transition group-hover:opacity-100">
                        {!img.isCover && (
                          <form action={setCover}>
                            <input type="hidden" name="id" value={img.id} />
                            <input type="hidden" name="serviceId" value={service.id} />
                            <button className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-forest-700">Đặt bìa</button>
                          </form>
                        )}
                        <form action={deleteImage} className="ml-auto">
                          <input type="hidden" name="id" value={img.id} />
                          <input type="hidden" name="serviceId" value={service.id} />
                          <button className="rounded bg-red-500 px-2 py-1 text-[11px] font-medium text-white">Xoá</button>
                        </form>
                      </div>
                    </div>
                  ))}
                  {service.images.length === 0 && <p className="col-span-full text-sm text-gray-400">Chưa có ảnh.</p>}
                </div>
              </section>
            </div>

            {/* 3 · Lộ trình */}
            <div id="sec-route" className="scroll-mt-20">
              <div className={labelCls}>3 · Lộ trình</div>
              <section className={`${cardCls} mt-2`}>
                <div className="mb-4">
                  <div className="text-[17px] font-extrabold text-ink">Lộ trình giờ chạy</div>
                  <div className="text-[13px] text-gray-500">Chiều đi & chiều về — hiển thị timeline ở trang nhà xe.</div>
                </div>
                <div className="space-y-6">
                  <CabinRouteBlock serviceId={service.id} direction="OUTBOUND" label="Chiều đi" route={service.cabinRoutes.find((r) => r.direction === "OUTBOUND")} />
                  <CabinRouteBlock serviceId={service.id} direction="RETURN" label="Chiều về" route={service.cabinRoutes.find((r) => r.direction === "RETURN")} />
                </div>
              </section>
            </div>

            {/* 4 · Giá vé */}
            <div id="sec-fare" className="scroll-mt-20">
              <div className={labelCls}>4 · Giá vé</div>
              <section className={`${cardCls} mt-2`}>
                <div className="mb-3">
                  <div className="text-[17px] font-extrabold text-ink">Giá vé theo chặng</div>
                  <div className="text-[13px] text-gray-500">Giá để 0 hoặc trống sẽ hiện “Liên hệ xác nhận giá”.</div>
                </div>
                <div className="space-y-2">
                  {service.cabinPriceRows.map((row) => (
                    <ActionForm key={row.id} action={upsertCabinPrice} className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-12 sm:items-end">
                      <input type="hidden" name="serviceId" value={service.id} />
                      <input type="hidden" name="id" value={row.id} />
                      <L label="Thứ tự" cls="sm:col-span-1"><input name="sortOrder" type="number" defaultValue={row.sortOrder} className={inp} /></L>
                      <L label="Loại vé" cls="sm:col-span-2"><select name="ticketType" defaultValue={row.ticketType} className={inp}>{TICKET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></L>
                      <L label="Điểm đón" cls="sm:col-span-3"><input name="pickupPoint" defaultValue={row.pickupPoint} className={inp} /></L>
                      <L label="Điểm đến" cls="sm:col-span-2"><input name="destination" defaultValue={row.destination} className={inp} /></L>
                      <L label="Giá (đ)" cls="sm:col-span-2"><input name="price" type="number" defaultValue={toNumber(row.price) ?? 0} className={inp} /></L>
                      <L label="Ghi chú" cls="sm:col-span-2"><input name="note" defaultValue={row.note ?? ""} className={inp} /></L>
                      <div className="flex gap-1 sm:col-span-12">
                        <button className="rounded-lg bg-forest-600 px-3 py-2 text-sm text-white">Lưu</button>
                        <button formAction={deleteCabinPrice} formNoValidate className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">Xoá</button>
                      </div>
                    </ActionForm>
                  ))}
                  <ActionForm action={upsertCabinPrice} className="grid grid-cols-2 gap-2 rounded-xl border border-dashed border-forest-300 p-3 sm:grid-cols-12 sm:items-end">
                    <input type="hidden" name="serviceId" value={service.id} />
                    <L label="Thứ tự" cls="sm:col-span-1"><input name="sortOrder" type="number" defaultValue={service.cabinPriceRows.length} className={inp} /></L>
                    <L label="Loại vé" cls="sm:col-span-2"><select name="ticketType" defaultValue="ROUND_TRIP" className={inp}>{TICKET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></L>
                    <L label="Điểm đón" cls="sm:col-span-3"><input name="pickupPoint" placeholder="VD: Hà Nội" className={inp} required /></L>
                    <L label="Điểm đến" cls="sm:col-span-2"><input name="destination" defaultValue="Tà Xùa" className={inp} /></L>
                    <L label="Giá (đ)" cls="sm:col-span-2"><input name="price" type="number" defaultValue={0} className={inp} /></L>
                    <L label="Ghi chú" cls="sm:col-span-2"><input name="note" className={inp} /></L>
                    <div className="sm:col-span-12"><button className="rounded-lg bg-forest-100 px-3 py-2 text-sm font-medium text-forest-700">+ Thêm chặng</button></div>
                  </ActionForm>
                </div>
              </section>
            </div>

            {/* 5 · Chuyến xe */}
            <div id="sec-trip" className="scroll-mt-20">
              <div className={labelCls}>5 · Chuyến xe</div>
              <section className={`${cardCls} mt-2`}>
                <div className="mb-3">
                  <div className="text-[17px] font-extrabold text-ink">Tạo nhanh nhiều ngày</div>
                  <div className="text-[13px] text-gray-500">Mở chuyến hằng đêm cho một khoảng ngày (bỏ qua ngày đã có chuyến cùng chiều).</div>
                </div>
                <CabinScheduleEditor
                  serviceId={service.id}
                  defaultStart={genStart}
                  defaultEnd={genEnd}
                  defaultTime={firstTrip?.departureTime ?? "21:00"}
                  defaultSeats={firstTrip?.seatsTotal ?? 22}
                  defaultPrice={toNumber(firstTrip?.price) ?? 0}
                />
              </section>
              <section className={`${cardCls} mt-3`}>
                <div className="mb-3">
                  <div className="text-[17px] font-extrabold text-ink">Chuyến xe theo ngày</div>
                  <div className="text-[13px] text-gray-500">Mỗi chuyến gắn một ngày khởi hành. Cập nhật số chỗ còn lại tại đây.</div>
                </div>
                <div className="space-y-3">
                  {service.cabinTrips.map((t) => (
                    <ActionForm key={t.id} action={upsertTrip} className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-10 sm:items-end">
                      <input type="hidden" name="serviceId" value={service.id} />
                      <input type="hidden" name="id" value={t.id} />
                      <L label="Ngày"><input name="departureDate" type="date" defaultValue={toDateKey(t.departureDate)} className={inp} /></L>
                      <L label="Chiều"><select name="direction" defaultValue={t.direction} className={inp}><option value="OUTBOUND">Đi</option><option value="RETURN">Về</option></select></L>
                      <L label="Giờ"><input name="departureTime" defaultValue={t.departureTime} className={inp} /></L>
                      <L label="Nhà xe"><input name="operatorName" defaultValue={t.operatorName} className={inp} /></L>
                      <L label="Giá đơn"><input name="price" type="number" defaultValue={toNumber(t.price) ?? 0} className={inp} /></L>
                      <L label="Đơn còn"><input name="seatsAvailable" type="number" defaultValue={t.seatsAvailable} className={inp} /></L>
                      <L label="Giá đôi"><input name="priceDouble" type="number" defaultValue={toNumber(t.priceDouble) ?? ""} placeholder="—" className={inp} /></L>
                      <L label="Đôi còn"><input name="seatsDoubleAvailable" type="number" defaultValue={t.seatsDoubleAvailable} className={inp} /></L>
                      <L label="Tình trạng"><select name="status" defaultValue={t.status} className={inp}>{(["AVAILABLE", "LIMITED", "SOLD_OUT", "NOT_UPDATED", "PENDING_CONFIRM"] as const).map((st) => <option key={st} value={st}>{st}</option>)}</select></L>
                      <input type="hidden" name="route" value={t.route} />
                      <input type="hidden" name="seatsTotal" value={t.seatsTotal} />
                      <input type="hidden" name="seatsDoubleTotal" value={t.seatsDoubleTotal} />
                      <input type="hidden" name="pickupPoint" defaultValue={t.pickupPoint} />
                      <input type="hidden" name="dropoffPoint" defaultValue={t.dropoffPoint} />
                      <div className="flex gap-1 sm:col-span-10">
                        <button className="rounded-lg bg-forest-600 px-4 py-2 text-sm text-white">Lưu</button>
                        <DeleteBtn action={deleteTrip} />
                      </div>
                    </ActionForm>
                  ))}
                  <ActionForm action={upsertTrip} className="grid grid-cols-2 gap-2 rounded-xl border border-dashed border-forest-200 p-3 sm:grid-cols-10 sm:items-end">
                    <input type="hidden" name="serviceId" value={service.id} />
                    <L label="Ngày"><input name="departureDate" type="date" className={inp} required /></L>
                    <L label="Chiều"><select name="direction" defaultValue="OUTBOUND" className={inp}><option value="OUTBOUND">Đi</option><option value="RETURN">Về</option></select></L>
                    <L label="Giờ"><input name="departureTime" placeholder="21:00" className={inp} /></L>
                    <L label="Nhà xe"><input name="operatorName" defaultValue={service.title} className={inp} /></L>
                    <L label="Giá đơn"><input name="price" type="number" defaultValue={toNumber(service.basePrice) ?? 0} className={inp} /></L>
                    <L label="Đơn còn"><input name="seatsAvailable" type="number" defaultValue={22} className={inp} /></L>
                    <L label="Giá đôi"><input name="priceDouble" type="number" placeholder="—" className={inp} /></L>
                    <L label="Đôi còn"><input name="seatsDoubleAvailable" type="number" defaultValue={0} className={inp} /></L>
                    <input type="hidden" name="route" defaultValue={service.area ?? ""} />
                    <input type="hidden" name="seatsTotal" value={22} />
                    <input type="hidden" name="seatsDoubleTotal" value={0} />
                    <input type="hidden" name="pickupPoint" defaultValue="Đón nội thành" />
                    <input type="hidden" name="dropoffPoint" defaultValue="Trung tâm Tà Xùa" />
                    <input type="hidden" name="status" defaultValue="AVAILABLE" />
                    <button className="rounded-lg bg-forest-100 px-3 py-2 text-sm font-medium text-forest-700 sm:col-span-10">+ Thêm chuyến</button>
                  </ActionForm>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- HOMESTAY / BUNGALOW: giao diện quản lý theo tab (bám sát thiết kế) ----
  if (service.category === "HOMESTAY" || service.category === "BUNGALOW") {
    const cover = service.images.find((i) => i.isCover)?.url ?? service.images[0]?.url ?? null;
    const roomTotal = service.roomTypes.reduce((a, rt) => a + rt.rooms.length, 0);
    const typeTotal = service.roomTypes.length;
    const cardCls = "rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6";
    const labelCls = "mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-gray-500 first:mt-0";
    const COLORS = ["#4b9b6e", "#d98a3d", "#5b7fc7", "#b063b0", "#4aa6a0"];
    const eff = (rm: { salePrice: unknown; listPrice: unknown }) =>
      toNumber(rm.salePrice as never) ?? toNumber(rm.listPrice as never) ?? 0;
    const tabs = [
      { key: "info", label: "Thông tin" },
      { key: "img", label: "Ảnh chung", badge: String(service.images.length) },
      { key: "type", label: "Hạng phòng", badge: String(typeTotal) },
      { key: "room", label: "Phòng", badge: String(roomTotal) },
      { key: "ota", label: "Đồng bộ OTA" },
      { key: "sheet", label: "Google Sheet" },
    ];

    return (
      <div className="max-w-[1180px] space-y-5">
        <div className="text-sm text-gray-500">
          <Link href="/admin/services" className="hover:text-forest-700">Dịch vụ</Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-gray-700">{service.title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="relative h-14 w-14 flex-none overflow-hidden rounded-[14px] bg-gray-100 ring-1 ring-black/5">
            {cover ? <Image src={cover} alt={service.title} fill sizes="56px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-xl">🏠</div>}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{service.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
              <span className={`rounded-full px-2.5 py-1 font-bold ${service.published ? "bg-forest-50 text-forest-700" : "bg-gray-100 text-gray-500"}`}>{service.published ? "Đang hiển thị" : "Đang ẩn"}</span>
              <span className="text-gray-500">{cat.label} · {roomTotal} phòng · {typeTotal} hạng</span>
              <Link href={`/${cat.slug}/${service.slug}`} target="_blank" className="font-bold text-forest-700 hover:underline">Xem trên website ↗</Link>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <ServiceTabNav tabs={tabs} />

          <div className="min-w-0 space-y-4">
            {/* 1 · Thông tin */}
            <div id="sec-info" className="scroll-mt-20">
              <div className={labelCls}>1 · Thông tin</div>
              <section className={`${cardCls} mt-2`}>
                <ServiceForm
                  action={updateService}
                  submitLabel="Lưu thay đổi"
                  providers={providers}
                  initial={{
                    id: service.id, category: service.category, title: service.title, slug: service.slug,
                    summary: service.summary, description: service.description, area: service.area, mapUrl: service.mapUrl, policy: service.policy,
                    basePrice: toNumber(service.basePrice), priceUnit: service.priceUnit,
                    contactName: service.contactName, contactPhone: service.contactPhone, contactZalo: service.contactZalo,
                    featured: service.featured, published: service.published, easyRoad: service.easyRoad, pool: service.pool, ownerId: service.ownerId,
                  }}
                />
              </section>
              <section className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-red-100 bg-red-50/40 px-5 py-4">
                <div>
                  <div className="text-[15px] font-extrabold text-ink">Xoá bài đăng</div>
                  <div className="mt-0.5 text-[13px] text-gray-500">Muốn tạm ẩn thì tắt “Hiển thị trên website” thay vì xoá.</div>
                </div>
                <form action={deleteService}>
                  <input type="hidden" name="id" value={service.id} />
                  <button className="rounded-xl border-[1.5px] border-red-300 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50">Xoá bài đăng</button>
                </form>
              </section>
            </div>

            {/* 2 · Ảnh chung */}
            <div id="sec-img" className="scroll-mt-20">
              <div className={labelCls}>2 · Ảnh chung</div>
              <section className={`${cardCls} mt-2`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[17px] font-extrabold text-ink">Ảnh homestay</div>
                    <div className="text-[13px] text-gray-500">Toàn cảnh, khu chung, view. Ảnh đầu là ảnh bìa.</div>
                  </div>
                  <ImageUploader serviceId={service.id} />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {service.images.map((img) => (
                    <div key={img.id} className="group relative overflow-hidden rounded-xl ring-1 ring-black/5">
                      <div className="relative aspect-[4/3]"><Image src={img.url} alt={img.alt ?? ""} fill sizes="200px" className="object-cover" /></div>
                      {img.isCover && <span className="absolute left-1.5 top-1.5 rounded-full bg-sunset-500 px-2 py-0.5 text-[10px] font-bold text-white">Ảnh bìa</span>}
                      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1.5 opacity-0 transition group-hover:opacity-100">
                        {!img.isCover && (
                          <form action={setCover}>
                            <input type="hidden" name="id" value={img.id} />
                            <input type="hidden" name="serviceId" value={service.id} />
                            <button className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-forest-700">Đặt bìa</button>
                          </form>
                        )}
                        <form action={deleteImage} className="ml-auto">
                          <input type="hidden" name="id" value={img.id} />
                          <input type="hidden" name="serviceId" value={service.id} />
                          <button className="rounded bg-red-500 px-2 py-1 text-[11px] font-medium text-white">Xoá</button>
                        </form>
                      </div>
                    </div>
                  ))}
                  {service.images.length === 0 && <p className="col-span-full text-sm text-gray-400">Chưa có ảnh.</p>}
                </div>
              </section>
            </div>

            {/* 3 · Hạng phòng */}
            <div id="sec-type" className="scroll-mt-20">
              <div className={labelCls}>3 · Hạng phòng</div>
              <section className={`${cardCls} mt-2`}>
                <div className="mb-3">
                  <div className="text-[17px] font-extrabold text-ink">Hạng phòng</div>
                  <div className="text-[13px] text-gray-500">Nhóm các phòng giống nhau, giữ tiện ích & ảnh chung. Giá và sức chứa đặt ở từng phòng (mục 4).</div>
                </div>
                <div className="space-y-3">
                  {service.roomTypes.map((rt, ti) => {
                    const prices = rt.rooms.map(eff).filter((n) => n > 0);
                    const lo = prices.length ? Math.min(...prices) : 0;
                    const hi = prices.length ? Math.max(...prices) : 0;
                    const priceRange = prices.length ? (lo === hi ? priceK(lo) : `${priceK(lo)}–${priceK(hi)}`) : "—";
                    const caps = rt.rooms.map((r) => r.capacity);
                    const capRange = caps.length ? (Math.min(...caps) === Math.max(...caps) ? `${caps[0]} người` : `${Math.min(...caps)}–${Math.max(...caps)} người`) : "—";
                    const color = COLORS[ti % COLORS.length];
                    return (
                      <div key={rt.id} className="rounded-[18px] border border-gray-200 p-4">
                        <ActionForm action={upsertRoomType} className="grid grid-cols-2 gap-2 sm:grid-cols-7 sm:items-end">
                          <input type="hidden" name="serviceId" value={service.id} />
                          <input type="hidden" name="id" value={rt.id} />
                          <input type="hidden" name="imageUrl" defaultValue={rt.imageUrl ?? ""} />
                          <div className="col-span-2 flex items-end gap-2.5 sm:col-span-5">
                            <span className="mb-1 h-9 w-2.5 flex-none rounded-full" style={{ background: color }} />
                            <L label="Tên hạng" cls="flex-1"><input name="name" defaultValue={rt.name} className={inp} /></L>
                          </div>
                          <L label="Số phòng (tự tính)"><input name="totalRooms" type="number" defaultValue={rt.totalRooms} className={inp} /></L>
                          <RoomFeatures room={rt} />
                          <div className="flex gap-1 sm:col-span-7">
                            <button className="rounded-lg bg-forest-600 px-3 py-2 text-sm text-white">Lưu</button>
                            <DeleteBtn action={deleteRoomType} />
                          </div>
                        </ActionForm>
                        <div className="mt-3 flex flex-wrap gap-6 border-t border-gray-100 pt-3">
                          <Stat label="Số phòng" value={String(rt.rooms.length)} />
                          <Stat label="Giá / đêm" value={priceRange} />
                          <Stat label="Sức chứa" value={capRange} />
                        </div>
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500">Ảnh / video hạng phòng ({rt.images.length})</span>
                            <ImageUploader roomTypeId={rt.id} label="📤 Thêm ảnh / video" compact accept="image/*,video/*" />
                          </div>
                          {rt.images.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                              {rt.images.map((img) => (
                                <div key={img.id} className="group relative overflow-hidden rounded-lg bg-black/5 ring-1 ring-black/5">
                                  <div className="relative aspect-square">
                                    {img.type === "video" ? (
                                      <video src={img.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                                    ) : (
                                      <Image src={img.url} alt={img.alt ?? rt.name} fill sizes="120px" className="object-cover" />
                                    )}
                                  </div>
                                  {img.type === "video" && <span className="absolute right-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-semibold text-white">▶ video</span>}
                                  {img.isCover && <span className="absolute left-1 top-1 rounded bg-forest-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">Bìa</span>}
                                  <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1 opacity-0 transition group-hover:opacity-100">
                                    {!img.isCover && (
                                      <form action={setRoomImageCover}>
                                        <input type="hidden" name="id" value={img.id} />
                                        <input type="hidden" name="roomTypeId" value={rt.id} />
                                        <input type="hidden" name="serviceId" value={service.id} />
                                        <button className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-forest-700">Bìa</button>
                                      </form>
                                    )}
                                    <form action={deleteRoomImage} className="ml-auto">
                                      <input type="hidden" name="id" value={img.id} />
                                      <input type="hidden" name="serviceId" value={service.id} />
                                      <button className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">Xoá</button>
                                    </form>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <ActionForm action={upsertRoomType} className="grid grid-cols-2 gap-2 rounded-[18px] border border-dashed border-forest-300 p-4 sm:grid-cols-7 sm:items-end">
                    <input type="hidden" name="serviceId" value={service.id} />
                    <L label="Tên hạng mới" cls="col-span-2 sm:col-span-5"><input name="name" placeholder="VD: Bungalow view mây" className={inp} /></L>
                    <L label="Số phòng"><input name="totalRooms" type="number" defaultValue={1} className={inp} /></L>
                    <RoomFeatures />
                    <button className="rounded-lg bg-forest-100 px-3 py-2 text-sm font-medium text-forest-700 sm:col-span-7">+ Thêm hạng</button>
                  </ActionForm>
                </div>
              </section>
            </div>

            {/* 4 · Phòng */}
            <div id="sec-room" className="scroll-mt-20">
              <div className={labelCls}>4 · Phòng</div>
              <section className={`${cardCls} mt-2`}>
                <div className="mb-3">
                  <div className="text-[17px] font-extrabold text-ink">Phòng</div>
                  <div className="text-[13px] text-gray-500">Bấm vào phòng để mở & sửa. Giá, sức chứa, giá theo thứ đặt ở đây.</div>
                </div>
                {service.roomTypes.length === 0 ? (
                  <p className="text-sm text-gray-400">Hãy tạo hạng phòng trước (mục 3), rồi thêm phòng.</p>
                ) : (
                  <div className="space-y-4">
                    {service.roomTypes.map((rt, ti) => {
                      const color = COLORS[ti % COLORS.length];
                      return (
                        <div key={rt.id} className="overflow-hidden rounded-2xl border border-gray-200">
                          <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2.5">
                            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: color }} />
                            <span className="text-sm font-extrabold text-ink">{rt.name}</span>
                            <span className="text-xs font-medium text-gray-500">{rt.rooms.length} phòng</span>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {rt.rooms.map((room) => {
                              const list = toNumber(room.listPrice) ?? 0;
                              const sale = toNumber(room.salePrice);
                              const hasDisc = sale != null && sale < list;
                              return (
                                <details key={room.id} className="group">
                                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 hover:bg-gray-50">
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-[15px] font-bold text-ink">{room.name}</span>
                                      <span className="text-xs text-gray-500">{room.capacity} khách · {room.images.length} ảnh</span>
                                    </span>
                                    <span className="flex-none text-right">
                                      <span className="block text-sm font-extrabold text-ink">{priceK(eff(room))}</span>
                                      {hasDisc && <span className="text-[11px] font-bold text-sunset-600">CK {priceK(sale!)}</span>}
                                    </span>
                                    <span className="flex-none text-gray-400 transition group-open:rotate-90">›</span>
                                  </summary>
                                  <div className="bg-gray-50/60 px-3 pb-4 pt-1">
                                    <ActionForm action={upsertRoom} className="grid grid-cols-1 gap-2 rounded-xl bg-white p-3 ring-1 ring-black/5 sm:grid-cols-12 sm:items-end">
                                      <input type="hidden" name="serviceId" value={service.id} />
                                      <input type="hidden" name="id" value={room.id} />
                                      <input type="hidden" name="sortOrder" value={room.sortOrder} />
                                      <L label="Hạng phòng" cls="sm:col-span-3">
                                        <select name="roomTypeId" defaultValue={room.roomTypeId} className={inp}>
                                          {service.roomTypes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                                        </select>
                                      </L>
                                      <L label="Tên phòng" cls="sm:col-span-3"><input name="name" defaultValue={room.name} className={inp} /></L>
                                      <L label="Sức chứa" cls="sm:col-span-2"><input name="capacity" type="number" min={1} defaultValue={room.capacity} className={inp} /></L>
                                      <L label="Giá thường" cls="sm:col-span-2"><input name="listPrice" type="number" min={0} defaultValue={toNumber(room.listPrice) ?? 0} className={inp} /></L>
                                      <L label="Giá chiết khấu" cls="sm:col-span-2"><input name="salePrice" type="number" min={0} defaultValue={toNumber(room.salePrice) ?? ""} placeholder="(nếu có)" className={inp} /></L>
                                      <L label="Tiện ích (cách nhau dấu phẩy)" cls="sm:col-span-7"><input name="amenities" defaultValue={room.amenities ?? ""} placeholder="Wifi, Nóng lạnh, Ban công" className={inp} /></L>
                                      <L label="Mô tả ngắn" cls="sm:col-span-5"><input name="description" defaultValue={room.description ?? ""} className={inp} /></L>
                                      <RoomConDayPrices room={room} />
                                      <div className="flex gap-1 sm:col-span-12">
                                        <button className="rounded-lg bg-forest-600 px-3 py-2 text-sm text-white">Lưu</button>
                                        <DeleteBtn action={deleteRoom} />
                                      </div>
                                    </ActionForm>
                                    <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2">
                                      <div className="mb-2 flex items-center justify-between gap-2">
                                        <span className="text-xs font-medium text-gray-500">Ảnh của phòng <b className="text-forest-800">{room.name}</b> ({room.images.length})</span>
                                        <ImageUploader roomId={room.id} label="📤 Thêm ảnh / video cho phòng này" compact accept="image/*,video/*" />
                                      </div>
                                      {room.images.length > 0 && (
                                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                                          {room.images.map((img) => (
                                            <div key={img.id} className="group relative overflow-hidden rounded-lg bg-black/5 ring-1 ring-black/5">
                                              <div className="relative aspect-square">{/\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(img.url) ? <video src={img.url} className="h-full w-full object-cover" muted playsInline preload="metadata" /> : <Image src={img.url} alt={img.alt ?? room.name} fill sizes="120px" className="object-cover" />}</div>
                                              {img.isCover && <span className="absolute left-1 top-1 rounded bg-forest-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">Bìa</span>}
                                              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1 opacity-0 transition group-hover:opacity-100">
                                                {!img.isCover && (
                                                  <form action={setRoomPhotoCover}>
                                                    <input type="hidden" name="id" value={img.id} />
                                                    <input type="hidden" name="roomId" value={room.id} />
                                                    <input type="hidden" name="serviceId" value={service.id} />
                                                    <button className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-forest-700">Bìa</button>
                                                  </form>
                                                )}
                                                <form action={deleteRoomPhoto} className="ml-auto">
                                                  <input type="hidden" name="id" value={img.id} />
                                                  <input type="hidden" name="serviceId" value={service.id} />
                                                  <button className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">Xoá</button>
                                                </form>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </details>
                              );
                            })}
                          </div>
                          <ActionForm action={upsertRoom} className="grid grid-cols-1 gap-2 border-t border-gray-200 bg-gray-50 p-3 sm:grid-cols-12 sm:items-end">
                            <input type="hidden" name="serviceId" value={service.id} />
                            <input type="hidden" name="roomTypeId" value={rt.id} />
                            <L label="Tên phòng mới" cls="sm:col-span-4"><input name="name" placeholder={`VD: ${rt.name} ${rt.rooms.length + 1}`} className={inp} /></L>
                            <L label="Sức chứa" cls="sm:col-span-2"><input name="capacity" type="number" min={1} defaultValue={2} className={inp} /></L>
                            <L label="Giá thường" cls="sm:col-span-3"><input name="listPrice" type="number" min={0} defaultValue={0} className={inp} /></L>
                            <L label="Giá chiết khấu" cls="sm:col-span-3"><input name="salePrice" type="number" min={0} placeholder="(nếu có)" className={inp} /></L>
                            <div className="sm:col-span-12"><button className="rounded-lg bg-forest-100 px-3 py-2 text-sm font-medium text-forest-700">+ Thêm phòng vào {rt.name}</button></div>
                          </ActionForm>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* 5 · Đồng bộ OTA (iCal) */}
            <div id="sec-ota" className="scroll-mt-20">
              <div className={labelCls}>5 · Đồng bộ OTA (iCal)</div>
              <section className={`${cardCls} mt-2`}>
                <div className="mb-3">
                  <div className="text-[17px] font-extrabold text-ink">Đồng bộ lịch với Booking / Agoda / Airbnb…</div>
                  <div className="text-[13px] text-gray-500">
                    Mỗi phòng có một link lịch riêng. <b>Xuất</b>: dán link (hoặc tải file <code>.ics</code>) sang extranet OTA.
                    <b> Nhập</b>: thêm link <code>.ics</code> của OTA để tự khoá ngày đã kín.
                  </div>
                </div>
                {roomTotal === 0 ? (
                  <p className="text-sm text-gray-400">Chưa có phòng nào. Hãy thêm phòng ở mục “Phòng” trước.</p>
                ) : (
                  <div className="space-y-4">
                    {service.roomTypes.flatMap((rt) =>
                      rt.rooms.map((room) => (
                        <div key={room.id} className="rounded-2xl border border-gray-200 p-3">
                          <div className="flex items-center gap-2 text-sm font-extrabold text-ink">
                            {room.name} <span className="text-xs font-medium text-gray-400">· {rt.name}</span>
                          </div>
                          <RoomIcalPanel room={room} serviceId={service.id} />
                        </div>
                      )),
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* 6 · Đồng bộ Google Sheet */}
            <div id="sec-sheet" className="scroll-mt-20">
              <div className={labelCls}>6 · Đồng bộ Google Sheet</div>
              <section className={`${cardCls} mt-2`}>
                <div className="mb-3">
                  <div className="text-[17px] font-extrabold text-ink">Lịch phòng từ Google Sheet</div>
                  <div className="text-[13px] text-gray-500">
                    Dán <b>1 link</b> Google Sheet của homestay này — hệ thống tự đọc <b>tất cả các tab (mỗi tháng 1 tab)</b>.
                    Với mỗi tab, nó <b>tự dò bố trí cột</b> (mỗi sheet một kiểu), tìm hàng chứa các ngày rồi
                    <b> khớp tên phòng trong sheet với tên phòng trong app</b>. Ô trống = còn trống, “ĐÃ ĐẶT” = đã đặt, “CHỜ” = chờ.
                    Tab không phải lịch (vd “Thông tin hạng phòng”) và tháng đã qua tự bỏ qua.
                    Sheet phải để chế độ chia sẻ <b>“Bất kỳ ai có đường liên kết: Người xem”</b>.
                  </div>
                </div>

                <ActionForm action={saveSheetUrl} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="serviceId" value={service.id} />
                  <label className="min-w-[260px] flex-1">
                    <span className="mb-0.5 block text-[10px] font-medium text-gray-500">Link Google Sheet</span>
                    <input
                      name="sheetUrl"
                      defaultValue={service.sheetUrl ?? ""}
                      placeholder="https://docs.google.com/spreadsheets/d/.../htmlview#gid=..."
                      className={inp}
                    />
                  </label>
                  <button className="rounded-lg bg-sky-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-sky-700">Lưu link</button>
                </ActionForm>

                {service.sheetUrl && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <ActionForm action={syncServiceSheetNow}>
                      <input type="hidden" name="serviceId" value={service.id} />
                      <button className="rounded-lg bg-forest-600 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-forest-700">↻ Đồng bộ ngay</button>
                    </ActionForm>
                    <div className="text-[12px] text-gray-500">
                      {service.sheetSyncedAt ? (
                        <>
                          Lần gần nhất: {service.sheetSyncedAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                          {service.sheetSyncResult ? <> · {service.sheetSyncResult}</> : null}
                        </>
                      ) : (
                        <>Chưa đồng bộ lần nào.</>
                      )}
                    </div>
                  </div>
                )}

                {roomTotal > 0 && (
                  <div className="mt-3 text-[12px] text-gray-400">
                    Tên phòng trong app để đối chiếu với sheet:{" "}
                    <span className="text-gray-500">
                      {service.roomTypes.flatMap((rt) => rt.rooms.map((rm) => rm.name)).join(" · ")}
                    </span>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <nav className="text-sm text-gray-500">
        <Link href="/admin/services" className="hover:text-forest-700">Dịch vụ</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{service.title}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{service.title}</h1>
          <p className="text-sm text-gray-500">{cat.label} · <Link href={`/${cat.slug}/${service.slug}`} target="_blank" className="text-forest-700 hover:underline">Xem trên website ↗</Link></p>
        </div>
        <form action={deleteService}>
          <input type="hidden" name="id" value={service.id} />
          <button className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Xoá bài đăng</button>
        </form>
      </div>

      {/* Thông tin cơ bản */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-lg font-semibold text-ink">Thông tin cơ bản</h2>
        <ServiceForm
          action={updateService}
          submitLabel="Lưu thay đổi"
          providers={providers}
          initial={{
            id: service.id,
            category: service.category,
            title: service.title,
            slug: service.slug,
            summary: service.summary,
            description: service.description,
            area: service.area,
            mapUrl: service.mapUrl, policy: service.policy,
            basePrice: toNumber(service.basePrice),
            priceUnit: service.priceUnit,
            contactName: service.contactName,
            contactPhone: service.contactPhone,
            contactZalo: service.contactZalo,
            featured: service.featured,
            published: service.published,
            easyRoad: service.easyRoad, pool: service.pool,
            ownerId: service.ownerId,
          }}
        />
      </section>

      {/* Hình ảnh */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-lg font-semibold text-ink">Hình ảnh</h2>
        <ImageUploader serviceId={service.id} />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {service.images.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-xl ring-1 ring-black/5">
              <div className="relative aspect-square">
                <Image src={img.url} alt={img.alt ?? ""} fill sizes="160px" className="object-cover" />
              </div>
              {img.isCover && <span className="absolute left-1.5 top-1.5 rounded-full bg-forest-600 px-2 py-0.5 text-[10px] font-semibold text-white">Ảnh bìa</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1.5 opacity-0 transition group-hover:opacity-100">
                {!img.isCover && (
                  <form action={setCover}>
                    <input type="hidden" name="id" value={img.id} />
                    <input type="hidden" name="serviceId" value={service.id} />
                    <button className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-forest-700">Đặt bìa</button>
                  </form>
                )}
                <form action={deleteImage} className="ml-auto">
                  <input type="hidden" name="id" value={img.id} />
                  <input type="hidden" name="serviceId" value={service.id} />
                  <button className="rounded bg-red-500 px-2 py-1 text-[11px] font-medium text-white">Xoá</button>
                </form>
              </div>
            </div>
          ))}
          {service.images.length === 0 && <p className="col-span-full text-sm text-gray-400">Chưa có ảnh.</p>}
        </div>
      </section>

      {/* STAY: loại phòng */}
      {kind === "stay" && cat.key !== "COMBO" && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-1 text-lg font-semibold text-ink">Hạng phòng (nhóm)</h2>
          <p className="mb-4 text-sm text-gray-500">Hạng phòng gom nhóm & giữ tiện ích/ảnh chung. <strong>Giá, sức chứa & giá theo thứ cấu hình ở từng phòng</strong> ở mục “Phòng” bên dưới.</p>
          <div className="space-y-3">
            {service.roomTypes.map((r) => (
              <div key={r.id} className="rounded-xl bg-gray-50 p-3">
                <ActionForm action={upsertRoomType} className="grid grid-cols-2 gap-2 sm:grid-cols-7 sm:items-end">
                  <input type="hidden" name="serviceId" value={service.id} />
                  <input type="hidden" name="id" value={r.id} />
                  <L label="Tên hạng" cls="col-span-2 sm:col-span-5"><input name="name" defaultValue={r.name} className={inp} /></L>
                  <L label="Số phòng (tự tính theo phòng con)"><input name="totalRooms" type="number" defaultValue={r.totalRooms} className={inp} /></L>
                  <input type="hidden" name="imageUrl" defaultValue={r.imageUrl ?? ""} />
                  <RoomFeatures room={r} />
                  <div className="flex gap-1">
                    <button className="rounded-lg bg-forest-600 px-3 py-2 text-sm text-white">Lưu</button>
                    <DeleteBtn action={deleteRoomType} />
                  </div>
                </ActionForm>

                {/* Ảnh của hạng phòng */}
                <div className="mt-3 border-t border-gray-200 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Ảnh / video hạng phòng ({r.images.length})</span>
                    <ImageUploader roomTypeId={r.id} label="📤 Thêm ảnh / video" compact accept="image/*,video/*" />
                  </div>
                  {r.images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {r.images.map((img) => (
                        <div key={img.id} className="group relative overflow-hidden rounded-lg bg-black/5 ring-1 ring-black/5">
                          <div className="relative aspect-square">
                            {img.type === "video" ? (
                              <video src={img.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                            ) : (
                              <Image src={img.url} alt={img.alt ?? r.name} fill sizes="120px" className="object-cover" />
                            )}
                          </div>
                          {img.type === "video" && <span className="absolute right-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-semibold text-white">▶ video</span>}
                          {img.isCover && <span className="absolute left-1 top-1 rounded bg-forest-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">Bìa</span>}
                          <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1 opacity-0 transition group-hover:opacity-100">
                            {!img.isCover && (
                              <form action={setRoomImageCover}>
                                <input type="hidden" name="id" value={img.id} />
                                <input type="hidden" name="roomTypeId" value={r.id} />
                                <input type="hidden" name="serviceId" value={service.id} />
                                <button className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-forest-700">Bìa</button>
                              </form>
                            )}
                            <form action={deleteRoomImage} className="ml-auto">
                              <input type="hidden" name="id" value={img.id} />
                              <input type="hidden" name="serviceId" value={service.id} />
                              <button className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">Xoá</button>
                            </form>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ))}
            {/* Thêm mới */}
            <ActionForm action={upsertRoomType} className="grid grid-cols-2 gap-2 rounded-xl border border-dashed border-forest-200 p-3 sm:grid-cols-7 sm:items-end">
              <input type="hidden" name="serviceId" value={service.id} />
              <L label="Tên hạng" cls="col-span-2 sm:col-span-5"><input name="name" placeholder="Phòng đôi view mây" className={inp} /></L>
              <L label="Số phòng"><input name="totalRooms" type="number" defaultValue={1} className={inp} /></L>
              <RoomFeatures />
              <button className="rounded-lg bg-forest-100 px-3 py-2 text-sm font-medium text-forest-700 sm:col-span-7">+ Thêm</button>
            </ActionForm>
          </div>
        </section>
      )}

      {/* Phòng (con) — có tiện ích, có trang chi tiết */}
      {kind === "stay" && cat.key !== "COMBO" && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-1 text-lg font-semibold text-ink">Phòng (con)</h2>
          <p className="mb-4 text-sm text-gray-500">
            Mỗi phòng thuộc một hạng phòng, có tên riêng và tiện ích. Khách bấm vào phòng sẽ xem trang chi tiết.
          </p>
          {service.roomTypes.length === 0 ? (
            <p className="text-sm text-gray-400">Hãy tạo hạng phòng trước, rồi thêm phòng.</p>
          ) : (
            <div className="space-y-5">
              {service.roomTypes.map((rt) => (
                <div key={rt.id}>
                  <p className="mb-2 text-sm font-semibold text-forest-800">{rt.name} ({rt.rooms.length} phòng)</p>
                  <div className="space-y-2">
                    {rt.rooms.map((room) => (
                      <div key={room.id} className="space-y-2 rounded-2xl border-2 border-forest-100 bg-forest-50/30 p-2.5">
                      <ActionForm action={upsertRoom} className="grid grid-cols-1 gap-2 rounded-xl bg-white p-3 ring-1 ring-black/5 sm:grid-cols-12 sm:items-end">
                        <input type="hidden" name="serviceId" value={service.id} />
                        <input type="hidden" name="id" value={room.id} />
                        <input type="hidden" name="sortOrder" value={room.sortOrder} />
                        <L label="Hạng phòng" cls="sm:col-span-3">
                          <select name="roomTypeId" defaultValue={room.roomTypeId} className={inp}>
                            {service.roomTypes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </L>
                        <L label="Tên phòng" cls="sm:col-span-3"><input name="name" defaultValue={room.name} className={inp} /></L>
                        <L label="Sức chứa" cls="sm:col-span-2"><input name="capacity" type="number" min={1} defaultValue={room.capacity} className={inp} /></L>
                        <L label="Giá thường" cls="sm:col-span-2"><input name="listPrice" type="number" min={0} defaultValue={toNumber(room.listPrice) ?? 0} className={inp} /></L>
                        <L label="Giá chiết khấu" cls="sm:col-span-2"><input name="salePrice" type="number" min={0} defaultValue={toNumber(room.salePrice) ?? ""} placeholder="(nếu có)" className={inp} /></L>
                        <L label="Tiện ích (cách nhau dấu phẩy)" cls="sm:col-span-7"><input name="amenities" defaultValue={room.amenities ?? ""} placeholder="Wifi, Nóng lạnh, Ban công" className={inp} /></L>
                        <L label="Mô tả ngắn" cls="sm:col-span-5"><input name="description" defaultValue={room.description ?? ""} className={inp} /></L>
                        <RoomConDayPrices room={room} />
                        <div className="flex gap-1 sm:col-span-12">
                          <button className="rounded-lg bg-forest-600 px-3 py-2 text-sm text-white">Lưu</button>
                          <DeleteBtn action={deleteRoom} />
                        </div>
                      </ActionForm>

                      {/* Ảnh của phòng riêng */}
                      <div className="rounded-xl border border-gray-200 bg-white p-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-gray-500">
                            Ảnh của phòng <b className="text-forest-800">{room.name}</b> ({room.images.length})
                          </span>
                          <ImageUploader roomId={room.id} label="📤 Thêm ảnh / video cho phòng này" compact accept="image/*,video/*" />
                        </div>
                        {room.images.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                            {room.images.map((img) => (
                              <div key={img.id} className="group relative overflow-hidden rounded-lg bg-black/5 ring-1 ring-black/5">
                                <div className="relative aspect-square">
                                  {/\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(img.url) ? (
                                    <video src={img.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                                  ) : (
                                    <Image src={img.url} alt={img.alt ?? room.name} fill sizes="120px" className="object-cover" />
                                  )}
                                </div>
                                {img.isCover && <span className="absolute left-1 top-1 rounded bg-forest-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">Bìa</span>}
                                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1 opacity-0 transition group-hover:opacity-100">
                                  {!img.isCover && (
                                    <form action={setRoomPhotoCover}>
                                      <input type="hidden" name="id" value={img.id} />
                                      <input type="hidden" name="roomId" value={room.id} />
                                      <input type="hidden" name="serviceId" value={service.id} />
                                      <button className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-forest-700">Bìa</button>
                                    </form>
                                  )}
                                  <form action={deleteRoomPhoto} className="ml-auto">
                                    <input type="hidden" name="id" value={img.id} />
                                    <input type="hidden" name="serviceId" value={service.id} />
                                    <button className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">Xoá</button>
                                  </form>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {/* Thêm phòng mới */}
              <ActionForm action={upsertRoom} className="grid grid-cols-1 gap-2 rounded-xl border border-dashed border-forest-300 p-3 sm:grid-cols-12 sm:items-end">
                <input type="hidden" name="serviceId" value={service.id} />
                <L label="Hạng phòng" cls="sm:col-span-3">
                  <select name="roomTypeId" className={inp}>
                    {service.roomTypes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </L>
                <L label="Tên phòng" cls="sm:col-span-3"><input name="name" placeholder="VD: Rustic 4" className={inp} /></L>
                <L label="Sức chứa" cls="sm:col-span-2"><input name="capacity" type="number" min={1} defaultValue={2} className={inp} /></L>
                <L label="Giá thường" cls="sm:col-span-2"><input name="listPrice" type="number" min={0} defaultValue={0} className={inp} /></L>
                <L label="Giá chiết khấu" cls="sm:col-span-2"><input name="salePrice" type="number" min={0} placeholder="(nếu có)" className={inp} /></L>
                <L label="Tiện ích (cách nhau dấu phẩy)" cls="sm:col-span-7"><input name="amenities" placeholder="Wifi, Nóng lạnh, Ban công" className={inp} /></L>
                <L label="Mô tả ngắn" cls="sm:col-span-5"><input name="description" className={inp} /></L>
                <RoomConDayPrices />
                <div className="sm:col-span-12">
                  <button className="rounded-lg bg-forest-100 px-3 py-2 text-sm font-medium text-forest-700">+ Thêm phòng</button>
                </div>
              </ActionForm>
            </div>
          )}
        </section>
      )}

      {/* RENTAL: loại xe */}
      {kind === "rental" && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-4 text-lg font-semibold text-ink">Loại xe cho thuê</h2>
          <div className="space-y-3">
            {service.rentalVehicles.map((v) => (
              <ActionForm key={v.id} action={upsertVehicle} className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-6 sm:items-end">
                <input type="hidden" name="serviceId" value={service.id} />
                <input type="hidden" name="id" value={v.id} />
                <L label="Loại xe" cls="col-span-2"><input name="vehicleType" defaultValue={v.vehicleType} className={inp} /></L>
                <L label="Giá/ngày"><input name="pricePerDay" type="number" defaultValue={toNumber(v.pricePerDay) ?? 0} className={inp} /></L>
                <L label="Số xe"><input name="totalUnits" type="number" defaultValue={v.totalUnits} className={inp} /></L>
                <L label="Phí giao"><input name="deliveryFee" type="number" defaultValue={toNumber(v.deliveryFee) ?? ""} className={inp} /></L>
                <input type="hidden" name="imageUrl" defaultValue={v.imageUrl ?? ""} />
                <div className="flex gap-1">
                  <button className="rounded-lg bg-forest-600 px-3 py-2 text-sm text-white">Lưu</button>
                  <DeleteBtn action={deleteVehicle} />
                </div>
              </ActionForm>
            ))}
            <ActionForm action={upsertVehicle} className="grid grid-cols-2 gap-2 rounded-xl border border-dashed border-forest-200 p-3 sm:grid-cols-6 sm:items-end">
              <input type="hidden" name="serviceId" value={service.id} />
              <L label="Loại xe" cls="col-span-2"><input name="vehicleType" placeholder="Honda Wave" className={inp} /></L>
              <L label="Giá/ngày"><input name="pricePerDay" type="number" defaultValue={0} className={inp} /></L>
              <L label="Số xe"><input name="totalUnits" type="number" defaultValue={1} className={inp} /></L>
              <L label="Phí giao"><input name="deliveryFee" type="number" placeholder="0" className={inp} /></L>
              <button className="rounded-lg bg-forest-100 px-3 py-2 text-sm font-medium text-forest-700">+ Thêm</button>
            </ActionForm>
          </div>
        </section>
      )}

      {/* CABIN: lộ trình (đi / về) */}
      {kind === "trip" && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-1 text-lg font-semibold text-ink">Lộ trình (giờ chạy)</h2>
          <p className="mb-4 text-sm text-gray-500">Cấu hình lộ trình chiều đi & chiều về: mốc giờ, điểm dừng, ghi chú. Hiển thị dạng timeline ở trang nhà xe.</p>
          <div className="space-y-6">
            <CabinRouteBlock serviceId={service.id} direction="OUTBOUND" label="Chiều đi" route={service.cabinRoutes.find((r) => r.direction === "OUTBOUND")} />
            <CabinRouteBlock serviceId={service.id} direction="RETURN" label="Chiều về" route={service.cabinRoutes.find((r) => r.direction === "RETURN")} />
          </div>
        </section>
      )}

      {/* CABIN: giá vé theo chặng (3 loại vé) */}
      {kind === "trip" && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-1 text-lg font-semibold text-ink">Giá vé theo chặng</h2>
          <p className="mb-4 text-sm text-gray-500">Mỗi dòng: loại vé (khứ hồi / chiều đi / chiều về) + điểm đón → đích + giá.</p>
          <div className="space-y-2">
            {service.cabinPriceRows.map((row) => (
              <ActionForm key={row.id} action={upsertCabinPrice} className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-12 sm:items-end">
                <input type="hidden" name="serviceId" value={service.id} />
                <input type="hidden" name="id" value={row.id} />
                <L label="Thứ tự" cls="sm:col-span-1"><input name="sortOrder" type="number" defaultValue={row.sortOrder} className={inp} /></L>
                <L label="Loại vé" cls="sm:col-span-2"><select name="ticketType" defaultValue={row.ticketType} className={inp}>{TICKET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></L>
                <L label="Điểm đón" cls="sm:col-span-3"><input name="pickupPoint" defaultValue={row.pickupPoint} className={inp} /></L>
                <L label="Điểm đến" cls="sm:col-span-2"><input name="destination" defaultValue={row.destination} className={inp} /></L>
                <L label="Giá (đ)" cls="sm:col-span-2"><input name="price" type="number" defaultValue={toNumber(row.price) ?? 0} className={inp} /></L>
                <L label="Ghi chú" cls="sm:col-span-2"><input name="note" defaultValue={row.note ?? ""} className={inp} /></L>
                <div className="flex gap-1 sm:col-span-12">
                  <button className="rounded-lg bg-forest-600 px-3 py-2 text-sm text-white">Lưu</button>
                  <button formAction={deleteCabinPrice} formNoValidate className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">Xoá</button>
                </div>
              </ActionForm>
            ))}
            <ActionForm action={upsertCabinPrice} className="grid grid-cols-2 gap-2 rounded-xl border border-dashed border-forest-300 p-3 sm:grid-cols-12 sm:items-end">
              <input type="hidden" name="serviceId" value={service.id} />
              <L label="Thứ tự" cls="sm:col-span-1"><input name="sortOrder" type="number" defaultValue={service.cabinPriceRows.length} className={inp} /></L>
              <L label="Loại vé" cls="sm:col-span-2"><select name="ticketType" defaultValue="ROUND_TRIP" className={inp}>{TICKET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></L>
              <L label="Điểm đón" cls="sm:col-span-3"><input name="pickupPoint" placeholder="VD: Hà Nội" className={inp} required /></L>
              <L label="Điểm đến" cls="sm:col-span-2"><input name="destination" defaultValue="Tà Xùa" className={inp} /></L>
              <L label="Giá (đ)" cls="sm:col-span-2"><input name="price" type="number" defaultValue={0} className={inp} /></L>
              <L label="Ghi chú" cls="sm:col-span-2"><input name="note" className={inp} /></L>
              <div className="sm:col-span-12"><button className="rounded-lg bg-forest-100 px-3 py-2 text-sm font-medium text-forest-700">+ Thêm chặng</button></div>
            </ActionForm>
          </div>
        </section>
      )}

      {/* TRIP: chuyến cabin */}
      {kind === "trip" && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-1 text-lg font-semibold text-ink">Chuyến xe (theo ngày)</h2>
          <p className="mb-4 text-sm text-gray-500">Mỗi chuyến gắn một ngày khởi hành. Cập nhật số chỗ còn lại tại đây.</p>
          <div className="space-y-3">
            {service.cabinTrips.map((t) => (
              <ActionForm key={t.id} action={upsertTrip} className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-10 sm:items-end">
                <input type="hidden" name="serviceId" value={service.id} />
                <input type="hidden" name="id" value={t.id} />
                <L label="Ngày"><input name="departureDate" type="date" defaultValue={toDateKey(t.departureDate)} className={inp} /></L>
                <L label="Chiều">
                  <select name="direction" defaultValue={t.direction} className={inp}>
                    <option value="OUTBOUND">Đi</option>
                    <option value="RETURN">Về</option>
                  </select>
                </L>
                <L label="Giờ"><input name="departureTime" defaultValue={t.departureTime} className={inp} /></L>
                <L label="Nhà xe"><input name="operatorName" defaultValue={t.operatorName} className={inp} /></L>
                <L label="Giá đơn"><input name="price" type="number" defaultValue={toNumber(t.price) ?? 0} className={inp} /></L>
                <L label="Đơn còn"><input name="seatsAvailable" type="number" defaultValue={t.seatsAvailable} className={inp} /></L>
                <L label="Giá đôi"><input name="priceDouble" type="number" defaultValue={toNumber(t.priceDouble) ?? ""} placeholder="—" className={inp} /></L>
                <L label="Đôi còn"><input name="seatsDoubleAvailable" type="number" defaultValue={t.seatsDoubleAvailable} className={inp} /></L>
                <L label="Tình trạng">
                  <select name="status" defaultValue={t.status} className={inp}>
                    {(["AVAILABLE", "LIMITED", "SOLD_OUT", "NOT_UPDATED", "PENDING_CONFIRM"] as const).map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </L>
                <input type="hidden" name="route" value={t.route} />
                <input type="hidden" name="seatsTotal" value={t.seatsTotal} />
                <input type="hidden" name="seatsDoubleTotal" value={t.seatsDoubleTotal} />
                <input type="hidden" name="pickupPoint" defaultValue={t.pickupPoint} />
                <input type="hidden" name="dropoffPoint" defaultValue={t.dropoffPoint} />
                <div className="flex gap-1 sm:col-span-10">
                  <button className="rounded-lg bg-forest-600 px-4 py-2 text-sm text-white">Lưu</button>
                  <DeleteBtn action={deleteTrip} />
                </div>
              </ActionForm>
            ))}
            <ActionForm action={upsertTrip} className="grid grid-cols-2 gap-2 rounded-xl border border-dashed border-forest-200 p-3 sm:grid-cols-10 sm:items-end">
              <input type="hidden" name="serviceId" value={service.id} />
              <L label="Ngày"><input name="departureDate" type="date" className={inp} required /></L>
              <L label="Chiều">
                <select name="direction" defaultValue="OUTBOUND" className={inp}>
                  <option value="OUTBOUND">Đi</option>
                  <option value="RETURN">Về</option>
                </select>
              </L>
              <L label="Giờ"><input name="departureTime" placeholder="21:00" className={inp} /></L>
              <L label="Nhà xe"><input name="operatorName" defaultValue={service.title} className={inp} /></L>
              <L label="Giá đơn"><input name="price" type="number" defaultValue={toNumber(service.basePrice) ?? 0} className={inp} /></L>
              <L label="Đơn còn"><input name="seatsAvailable" type="number" defaultValue={22} className={inp} /></L>
              <L label="Giá đôi"><input name="priceDouble" type="number" placeholder="—" className={inp} /></L>
              <L label="Đôi còn"><input name="seatsDoubleAvailable" type="number" defaultValue={0} className={inp} /></L>
              <input type="hidden" name="route" defaultValue={service.area ?? ""} />
              <input type="hidden" name="seatsTotal" value={22} />
              <input type="hidden" name="seatsDoubleTotal" value={0} />
              <input type="hidden" name="pickupPoint" defaultValue="Đón nội thành" />
              <input type="hidden" name="dropoffPoint" defaultValue="Trung tâm Tà Xùa" />
              <input type="hidden" name="status" defaultValue="AVAILABLE" />
              <button className="rounded-lg bg-forest-100 px-3 py-2 text-sm font-medium text-forest-700 sm:col-span-10">+ Thêm chuyến</button>
            </ActionForm>
          </div>
        </section>
      )}

      {/* TRANSPORT: xe ôm / taxi */}
      {kind === "transport" && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-1 text-lg font-semibold text-ink">Thông tin tuyến</h2>
          <p className="mb-4 text-sm text-gray-500">Để trống “Giá cố định” nếu muốn hiển thị “Liên hệ xác nhận giá”.</p>
          <ActionForm action={upsertTransport} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="serviceId" value={service.id} />
            <L label="Điểm đón"><input name="fromPoint" defaultValue={service.transport?.fromPoint ?? ""} className={inp} /></L>
            <L label="Điểm đến / khu vực"><input name="toArea" defaultValue={service.transport?.toArea ?? ""} className={inp} /></L>
            <L label="Loại xe"><input name="vehicleType" defaultValue={service.transport?.vehicleType ?? ""} className={inp} /></L>
            <L label="Giá cố định (đ)"><input name="fixedPrice" type="number" defaultValue={toNumber(service.transport?.fixedPrice) ?? ""} placeholder="Để trống = Liên hệ" className={inp} /></L>
            <L label="Ghi chú giá" cls="sm:col-span-2"><input name="priceNote" defaultValue={service.transport?.priceNote ?? ""} className={inp} /></L>
            <div className="sm:col-span-2">
              <button className="rounded-xl bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white">Lưu thông tin tuyến</button>
            </div>
          </ActionForm>
        </section>
      )}

      {cat.key === "COMBO" && (
        <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-800 ring-1 ring-sky-100">
          Combo nhận yêu cầu và được quản trị viên xác nhận thủ công. Giá hiển thị lấy từ “Giá cơ bản” phía trên.
        </p>
      )}
    </div>
  );
}

/** Rút gọn tiền: 450000 -> "450k", 1200000 -> "1,2tr". 0/undefined -> "—". */
function priceK(n: number | null | undefined): string {
  const v = Number(n) || 0;
  if (!v) return "—";
  return v >= 1_000_000 ? (v / 1_000_000).toLocaleString("vi-VN") + "tr" : Math.round(v / 1000) + "k";
}

/** Ô thống kê nhỏ cho thẻ hạng phòng. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[12px] text-gray-500">{label}</div>
      <div className="text-[18px] font-extrabold text-ink">{value}</div>
    </div>
  );
}

const DAY_FIELDS = [
  { name: "priceMon", label: "T2" },
  { name: "priceTue", label: "T3" },
  { name: "priceWed", label: "T4" },
  { name: "priceThu", label: "T5" },
  { name: "priceFri", label: "T6" },
  { name: "priceSat", label: "T7" },
  { name: "priceSun", label: "CN" },
] as const;

interface RoomDayPrices {
  priceMon: unknown; priceTue: unknown; priceWed: unknown; priceThu: unknown;
  priceFri: unknown; priceSat: unknown; priceSun: unknown;
}

const ROOM_FEATURES = [
  { name: "cloudView", label: "⛅ View mây" },
  { name: "hasBathtub", label: "🛁 Bồn tắm" },
  { name: "breakfast", label: "🍳 Ăn sáng" },
  { name: "airCon", label: "❄️ Điều hòa" },
  { name: "heating", label: "🔥 Đêm sưởi" },
] as const;

type RoomFeatureFlags = { hasBathtub: boolean; cloudView: boolean; breakfast: boolean; airCon: boolean; heating: boolean };

/** Hàng tick tiện ích của hạng phòng (dùng để lọc combo). */
function RoomFeatures({ room }: { room?: RoomFeatureFlags }) {
  return (
    <div className="col-span-2 mt-1 flex flex-wrap gap-x-4 gap-y-1.5 sm:col-span-7">
      <span className="text-[11px] font-medium text-gray-500">Tiện ích:</span>
      {ROOM_FEATURES.map((f) => (
        <label key={f.name} className="flex items-center gap-1.5 text-[12px] text-gray-700">
          <input type="checkbox" name={f.name} defaultChecked={room ? room[f.name] : false} className="h-4 w-4 accent-forest-600" />
          {f.label}
        </label>
      ))}
    </div>
  );
}

/** Giá theo thứ (T2–CN) cho PHÒNG CON — lưới 12 cột. Để trống = dùng giá thường/chiết khấu. */
function RoomConDayPrices({ room }: { room?: RoomDayPrices }) {
  const vals = DAY_FIELDS.map((d) => (room ? toNumber(room[d.name] as never) : null));
  const hasAny = vals.some((v) => v != null);
  return (
    <details open={hasAny} className="col-span-1 mt-1 sm:col-span-12">
      <summary className="cursor-pointer text-[11px] font-medium text-forest-700">
        Giá theo thứ (tuỳ chọn — để trống = dùng giá chiết khấu/giá thường)
      </summary>
      <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {DAY_FIELDS.map((d, i) => (
          <L key={d.name} label={d.label}>
            <input name={d.name} type="number" defaultValue={vals[i] ?? ""} placeholder="—" className={inp} />
          </L>
        ))}
      </div>
    </details>
  );
}


interface IcalSourceLite {
  id: string;
  label: string;
  url: string;
  lastSyncedAt: Date | null;
  lastResult: string | null;
}
interface RoomIcalLite {
  id: string;
  name: string;
  icalToken: string | null;
  icalSources: IcalSourceLite[];
}

/**
 * Bảng đồng bộ OTA (iCal 2 chiều) cho một phòng:
 * - Link XUẤT lịch (các đêm bận) để chủ homestay dán vào extranet Booking/Agoda/Airbnb…
 * - Danh sách link NHẬP (.ics của từng OTA) → kéo về khoá ngày bận.
 */
function RoomIcalPanel({ room, serviceId }: { room: RoomIcalLite; serviceId: string }) {
  const exportUrl = room.icalToken ? `${SITE.url}/api/ical/${room.icalToken}` : null;
  return (
    <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50/60 p-2.5">
      <div className="text-xs font-semibold text-sky-800">
        🔁 Đồng bộ OTA (iCal) — Booking / Agoda / Airbnb{room.icalSources.length > 0 ? ` · ${room.icalSources.length} nguồn` : ""}
      </div>
      <div className="mt-3 space-y-4">
        {/* XUẤT: link lịch của phòng để dán sang OTA */}
        <div>
          <p className="mb-1 text-[11px] font-semibold text-sky-900">1. Xuất lịch sang OTA</p>
          {exportUrl ? (
            <>
              <p className="mb-1.5 text-[11px] text-gray-500">
                Dán link này vào mục “Import calendar / iCal” trên extranet của Booking, Agoda, Airbnb… để các nền tảng đó biết đêm nào đã kín.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  defaultValue={exportUrl}
                  className="min-w-0 flex-1 rounded-lg border border-sky-200 bg-white px-2 py-1.5 font-mono text-[11px] text-gray-700"
                />
                <a href={exportUrl} download={`phong-${room.id}.ics`} className="rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-sky-700 hover:bg-sky-50">⬇ Tải .ics</a>
              </div>
            </>
          ) : (
            <form action={enableRoomIcal}>
              <input type="hidden" name="roomId" value={room.id} />
              <input type="hidden" name="serviceId" value={serviceId} />
              <p className="mb-1.5 text-[11px] text-gray-500">Chưa bật. Bật để tạo link iCal bí mật cho phòng này.</p>
              <button className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-700">Bật đồng bộ iCal</button>
            </form>
          )}
        </div>

        {/* NHẬP: các nguồn .ics từ OTA */}
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-sky-900">2. Nhập lịch từ OTA (khoá ngày bận)</p>
            {room.icalSources.length > 0 && (
              <form action={syncRoomIcalNow}>
                <input type="hidden" name="roomId" value={room.id} />
                <input type="hidden" name="serviceId" value={serviceId} />
                <button className="rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50">⟳ Đồng bộ ngay</button>
              </form>
            )}
          </div>
          {room.icalSources.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {room.icalSources.map((src) => (
                <li key={src.id} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">{src.label}</span>
                      {src.lastResult && <span className="truncate text-[10px] text-gray-500">{src.lastResult}</span>}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-gray-400">{src.url}</p>
                  </div>
                  <form action={deleteIcalSource}>
                    <input type="hidden" name="id" value={src.id} />
                    <input type="hidden" name="serviceId" value={serviceId} />
                    <button className="rounded border border-red-200 px-1.5 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50">Xoá</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addIcalSource} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="roomId" value={room.id} />
            <input type="hidden" name="serviceId" value={serviceId} />
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-medium text-gray-500">Tên OTA</span>
              <input name="label" placeholder="Booking" className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-[11px]" />
            </label>
            <label className="block min-w-0 flex-1">
              <span className="mb-0.5 block text-[10px] font-medium text-gray-500">Link iCal (.ics) từ extranet OTA</span>
              <input name="url" placeholder="https://…/calendar.ics" className="w-full rounded-lg border border-gray-200 px-2 py-1.5 font-mono text-[11px]" />
            </label>
            <button className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-700">+ Thêm nguồn</button>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}

function L({ label, cls, children }: { label: string; cls?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${cls ?? ""}`}>
      <span className="mb-0.5 block text-[11px] font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}

interface StopLite { id: string; sortOrder: number; time: string; place: string; note: string | null; tag: string | null }
interface RouteLite { id: string; title: string | null; totalTime: string | null; startLabel: string | null; startInfo: string | null; fromPoint: string | null; toPoint: string | null; stops: StopLite[] }

function CabinRouteBlock({
  serviceId,
  direction,
  label,
  route,
}: {
  serviceId: string;
  direction: "OUTBOUND" | "RETURN";
  label: string;
  route?: RouteLite;
}) {
  const stops = route?.stops ?? [];
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="mb-2 font-semibold text-forest-800">{label}</p>
      <ActionForm action={upsertCabinRoute} className="grid grid-cols-2 gap-2 sm:grid-cols-6 sm:items-end">
        <input type="hidden" name="serviceId" value={serviceId} />
        <input type="hidden" name="direction" value={direction} />
        <L label="Tiêu đề" cls="sm:col-span-3"><input name="title" defaultValue={route?.title ?? ""} placeholder="Ngủ một giấc, mở mắt là tới mây." className={inp} /></L>
        <L label="Tổng thời gian"><input name="totalTime" defaultValue={route?.totalTime ?? ""} placeholder="~8 tiếng" className={inp} /></L>
        <L label="Nhãn khởi hành"><input name="startLabel" defaultValue={route?.startLabel ?? ""} placeholder="Khởi hành" className={inp} /></L>
        <L label="Giờ khởi hành"><input name="startInfo" defaultValue={route?.startInfo ?? ""} placeholder="21:00 hằng tối" className={inp} /></L>
        <L label="Điểm đón" cls="sm:col-span-3"><input name="fromPoint" defaultValue={route?.fromPoint ?? ""} className={inp} /></L>
        <L label="Điểm trả" cls="sm:col-span-3"><input name="toPoint" defaultValue={route?.toPoint ?? ""} className={inp} /></L>
        <div className="sm:col-span-6"><button className="rounded-lg bg-forest-600 px-3 py-2 text-sm text-white">Lưu lộ trình {label}</button></div>
      </ActionForm>

      <div className="mt-3 space-y-2">
        <p className="text-xs font-medium text-gray-500">Các điểm dừng (giờ)</p>
        {stops.map((st) => (
          <ActionForm key={st.id} action={upsertCabinStop} className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-12 sm:items-end">
            <input type="hidden" name="serviceId" value={serviceId} />
            <input type="hidden" name="direction" value={direction} />
            <input type="hidden" name="id" value={st.id} />
            <L label="TT" cls="sm:col-span-1"><input name="sortOrder" type="number" defaultValue={st.sortOrder} className={inp} /></L>
            <L label="Giờ" cls="sm:col-span-1"><input name="time" defaultValue={st.time} className={inp} /></L>
            <L label="Địa điểm" cls="sm:col-span-3"><input name="place" defaultValue={st.place} className={inp} /></L>
            <L label="Ghi chú" cls="sm:col-span-4"><input name="note" defaultValue={st.note ?? ""} className={inp} /></L>
            <L label="Nhãn" cls="sm:col-span-2"><input name="tag" defaultValue={st.tag ?? ""} className={inp} /></L>
            <div className="flex gap-1 sm:col-span-1">
              <button className="rounded bg-forest-600 px-2 py-2 text-xs text-white">Lưu</button>
              <button formAction={deleteCabinStop} formNoValidate className="rounded border border-red-200 px-2 py-2 text-xs text-red-600">✕</button>
            </div>
          </ActionForm>
        ))}
        <ActionForm action={upsertCabinStop} className="grid grid-cols-2 gap-2 rounded-lg border border-dashed border-forest-300 p-2 sm:grid-cols-12 sm:items-end">
          <input type="hidden" name="serviceId" value={serviceId} />
          <input type="hidden" name="direction" value={direction} />
          <L label="TT" cls="sm:col-span-1"><input name="sortOrder" type="number" defaultValue={stops.length} className={inp} /></L>
          <L label="Giờ" cls="sm:col-span-1"><input name="time" placeholder="21:00" className={inp} required /></L>
          <L label="Địa điểm" cls="sm:col-span-3"><input name="place" placeholder="Phú Thọ" className={inp} required /></L>
          <L label="Ghi chú" cls="sm:col-span-4"><input name="note" className={inp} /></L>
          <L label="Nhãn" cls="sm:col-span-2"><input name="tag" placeholder="Nghỉ chân" className={inp} /></L>
          <div className="sm:col-span-1"><button className="rounded bg-forest-100 px-2 py-2 text-xs font-medium text-forest-700">+ Thêm</button></div>
        </ActionForm>
      </div>
    </div>
  );
}

function DeleteBtn({ action }: { action: (fd: FormData) => void }) {
  // id/serviceId được gửi qua input ẩn của form cha; formAction đổi action sang xoá.
  return (
    <button
      formAction={action}
      className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
      formNoValidate
    >
      Xoá
    </button>
  );
}
