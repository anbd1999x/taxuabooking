"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, requireAdmin } from "@/lib/auth";
import {
  guard,
  requireServiceEditor,
  requireServiceManager,
  serviceIdOfRoom,
  serviceIdOfRoomImage,
  serviceIdOfRoomType,
  serviceIdOfRoomTypeImage,
  serviceIdOfServiceImage,
} from "@/lib/partner-access";
import { serviceInputSchema, availabilityBulkSchema } from "@/lib/validation";
import { slugify } from "@/lib/utils";
import { parseLatLng, resolveMapLatLng } from "@/lib/map-link";
import { CATEGORIES } from "@/lib/constants";
import {
  parseDateOnly,
  enumerateDays,
  isWeekend,
  today,
} from "@/lib/dates";
import { resyncRoomTypeWindow } from "@/lib/room-availability";
import type { AvailabilityStatus } from "@prisma/client";

export interface ActionState {
  ok?: boolean;
  error?: string;
  serviceId?: string;
  message?: string;
}

function s(v: FormDataEntryValue | null): string | undefined {
  const t = v == null ? undefined : String(v).trim();
  return t ? t : undefined;
}
/** Danh sách ngày yyyy-mm-dd từ input ẩn (cách nhau dấu phẩy); không có ô này trong form → undefined. */
function dateList(v: FormDataEntryValue | null): string[] | undefined {
  if (typeof v !== "string") return undefined;
  return [...new Set(v.split(",").map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)))].sort();
}
function num(v: FormDataEntryValue | null): number | undefined {
  const t = s(v);
  if (t == null) return undefined;
  const n = Number(t.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}
/** Số thập phân (km...): chấp nhận cả dấu phẩy ("1,5" = 1.5). */
function fnum(v: FormDataEntryValue | null): number | undefined {
  const t = s(v);
  if (t == null) return undefined;
  const n = Number(t.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * TOẠ ĐỘ dịch vụ (popup "Xung quanh có gì?"): admin nhập tay "vĩ độ, kinh độ" ⇒ dùng luôn; để trống ⇒ tự lấy
 * từ link Google Maps. Sửa dịch vụ mà link không đổi, ô toạ độ không gửi ⇒ giữ toạ độ cũ (không gọi mạng).
 */
async function serviceGeo(
  mapUrl: string | null | undefined,
  latLngText: string | undefined,
  id?: string,
): Promise<{ lat: number | null; lng: number | null } | { error: string }> {
  const text = (latLngText ?? "").trim();
  let geo = parseLatLng(text);
  if (text && !geo) return { error: 'Toạ độ không hợp lệ — nhập dạng "21.2652, 104.5386" (vĩ độ, kinh độ) hoặc để trống để tự lấy từ link Google Maps.' };
  const url = (mapUrl ?? "").trim();
  if (id) {
    const prev = await prisma.service.findUnique({ where: { id }, select: { mapUrl: true, lat: true, lng: true } });
    const sameUrl = (prev?.mapUrl ?? "") === url;
    // Đổi link mà ô toạ độ vẫn là số cũ ⇒ lấy lại theo link mới.
    if (geo && prev && !sameUrl && prev.lat === geo.lat && prev.lng === geo.lng) geo = null;
    if (!geo && !text && latLngText === undefined && sameUrl && prev?.lat != null && prev.lng != null) return { lat: prev.lat, lng: prev.lng };
  }
  if (!geo && url) geo = await resolveMapLatLng(url).catch(() => null);
  return { lat: geo?.lat ?? null, lng: geo?.lng ?? null };
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "dich-vu";
  let slug = root;
  let i = 1;
  while (true) {
    const existing = await prisma.service.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${root}-${++i}`;
  }
}

export async function createService(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = serviceInputSchema.safeParse({
    category: formData.get("category"),
    title: formData.get("title"),
    slug: s(formData.get("slug")),
    summary: formData.get("summary"),
    description: formData.get("description"),
    area: s(formData.get("area")),
    distanceKm: fnum(formData.get("distanceKm")),
    mapUrl: s(formData.get("mapUrl")),
    policy: s(formData.get("policy")),
    basePrice: num(formData.get("basePrice")),
    originalPrice: num(formData.get("originalPrice")),
    priceUnit: s(formData.get("priceUnit")),
    contactName: s(formData.get("contactName")),
    contactPhone: s(formData.get("contactPhone")),
    contactZalo: s(formData.get("contactZalo")),
    featured: formData.get("featured") === "on",
    published: formData.get("published") === "on",
    easyRoad: formData.get("easyRoad") === "on",
    pool: formData.get("pool") === "on",
    contactOnly: formData.get("contactOnly") === "on",
    inquiryOnly: formData.get("inquiryOnly") === "on",
    soldOutDates: dateList(formData.get("soldOutDates")),
    ownerId: s(formData.get("ownerId")),
    ctvCommission: num(formData.get("ctvCommission")),
    roomCommission: num(formData.get("roomCommission")),
    busCommission: num(formData.get("busCommission")),
    weekendPolicy: s(formData.get("weekendPolicy")),
    priorityOrder: num(formData.get("priorityOrder")),
    childFreeUnderAge: num(formData.get("childFreeUnderAge")),
    extraPersonFee: num(formData.get("extraPersonFee")),
    earlyCheckinFee: num(formData.get("earlyCheckinFee")),
    lateCheckoutFee: num(formData.get("lateCheckoutFee")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const d = parsed.data;
  const geo = await serviceGeo(d.mapUrl, s(formData.get("latLng")));
  if ("error" in geo) return { error: geo.error };
  const slug = await uniqueSlug(d.slug || d.title);
  const created = await prisma.service.create({
    data: {
      category: d.category,
      title: d.title,
      slug,
      summary: d.summary,
      description: d.description,
      area: d.area ?? null,
      distanceKm: d.distanceKm ?? null,
      mapUrl: d.mapUrl ?? null,
      lat: geo.lat,
      lng: geo.lng,
      policy: d.policy ?? null,
      basePrice: d.basePrice ?? null,
      originalPrice: d.originalPrice ?? null,
      priceUnit: d.priceUnit ?? (CATEGORIES[d.category].priceUnit || null),
      contactName: d.contactName ?? null,
      contactPhone: d.contactPhone ?? null,
      contactZalo: d.contactZalo ?? null,
      featured: d.featured ?? false,
      published: d.published ?? true,
      easyRoad: d.easyRoad ?? false,
      pool: d.pool ?? false,
      contactOnly: d.contactOnly ?? false,
      // "Nhắn tin, theo tình trạng phòng" chỉ có nghĩa khi KHÔNG bật "không quản lý lịch".
      inquiryOnly: (d.inquiryOnly ?? false) && !d.contactOnly,
      // Chỉ ghi khi form có gửi ô "ngày hết phòng" (form khác không gửi → giữ nguyên).
      ...(d.soldOutDates ? { soldOutDates: d.soldOutDates } : {}),
      ownerId: d.ownerId ?? null,
      ctvCommission: d.ctvCommission ?? null,
      roomCommission: d.roomCommission ?? null,
      busCommission: d.busCommission ?? null,
      weekendPolicy: d.weekendPolicy ?? "NONE",
      priorityOrder: d.priorityOrder ?? 0,
      childFreeUnderAge: d.childFreeUnderAge ?? 6,
      extraPersonFee: d.extraPersonFee ?? null,
      earlyCheckinFee: d.earlyCheckinFee ?? null,
      lateCheckoutFee: d.lateCheckoutFee ?? null,
    },
  });
  if (d.category === "CABIN" && d.featured) await enforceSingleFeaturedCabin(created.id);
  revalidatePath("/admin/services");
  redirect(`/admin/services/${created.id}`);
}

/** Tạo bài đăng KÈM chi tiết bên trong (phòng / chuyến / xe / tuyến) trong một lần. */
export async function createServiceFull(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ed = await requireServiceManager();
  const parsed = serviceInputSchema.safeParse({
    category: formData.get("category"),
    title: formData.get("title"),
    slug: s(formData.get("slug")),
    summary: formData.get("summary"),
    description: formData.get("description"),
    area: s(formData.get("area")),
    distanceKm: fnum(formData.get("distanceKm")),
    mapUrl: s(formData.get("mapUrl")),
    policy: s(formData.get("policy")),
    basePrice: num(formData.get("basePrice")),
    originalPrice: num(formData.get("originalPrice")),
    priceUnit: s(formData.get("priceUnit")),
    contactName: s(formData.get("contactName")),
    contactPhone: s(formData.get("contactPhone")),
    contactZalo: s(formData.get("contactZalo")),
    featured: formData.get("featured") === "on",
    published: formData.get("published") === "on",
    easyRoad: formData.get("easyRoad") === "on",
    pool: formData.get("pool") === "on",
    contactOnly: formData.get("contactOnly") === "on",
    inquiryOnly: formData.get("inquiryOnly") === "on",
    soldOutDates: dateList(formData.get("soldOutDates")),
    ownerId: s(formData.get("ownerId")),
    ctvCommission: num(formData.get("ctvCommission")),
    roomCommission: num(formData.get("roomCommission")),
    busCommission: num(formData.get("busCommission")),
    weekendPolicy: s(formData.get("weekendPolicy")),
    priorityOrder: num(formData.get("priorityOrder")),
    childFreeUnderAge: num(formData.get("childFreeUnderAge")),
    extraPersonFee: num(formData.get("extraPersonFee")),
    earlyCheckinFee: num(formData.get("earlyCheckinFee")),
    lateCheckoutFee: num(formData.get("lateCheckoutFee")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const d = parsed.data;
  // Chủ tự đăng ký: chỉ tạo homestay của chính mình, ẩn khỏi website tới khi admin duyệt.
  if (!ed.isAdmin) {
    if (d.category !== "HOMESTAY") return { error: "Tài khoản dùng thử chỉ tạo được homestay." };
    Object.assign(d, {
      ownerId: ed.session.sub, published: false, featured: false, priorityOrder: 0,
      ctvCommission: undefined, roomCommission: undefined, busCommission: undefined,
    });
  }

  // Gom các dòng chi tiết theo cột (mỗi cột là mảng cùng độ dài).
  const col = (name: string) => formData.getAll(name).map((v) => String(v));
  const numAt = (arr: string[], i: number) => {
    const n = Number((arr[i] ?? "").replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  // Phòng (homestay/bungalow)
  const roomNames = col("roomName");
  const rooms = roomNames
    .map((name, i) => ({
      name: name.trim(),
      capacity: numAt(col("roomCapacity"), i) || 2,
      weekdayPrice: numAt(col("roomWeekday"), i),
      weekendPrice: numAt(col("roomWeekend"), i),
      totalRooms: numAt(col("roomTotal"), i) || 1,
    }))
    .filter((r) => r.name);

  // Chuyến (cabin)
  const tripDates = col("tripDate");
  const trips = tripDates
    .map((date, i) => ({
      date: date.trim(),
      time: (col("tripTime")[i] ?? "").trim(),
      price: numAt(col("tripPrice"), i),
      seats: numAt(col("tripSeats"), i) || 0,
    }))
    .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date));

  // Xe máy (rental)
  const vehTypes = col("vehType");
  const vehicles = vehTypes
    .map((type, i) => ({
      type: type.trim(),
      pricePerDay: numAt(col("vehPrice"), i),
      totalUnits: numAt(col("vehTotal"), i) || 1,
    }))
    .filter((v) => v.type);

  // Giá cơ bản tự suy nếu bỏ trống.
  let basePrice = d.basePrice ?? null;
  if (basePrice == null) {
    if (rooms.length) basePrice = Math.min(...rooms.map((r) => r.weekdayPrice || Infinity));
    else if (trips.length) basePrice = Math.min(...trips.map((t) => t.price || Infinity));
    else if (vehicles.length) basePrice = Math.min(...vehicles.map((v) => v.pricePerDay || Infinity));
    if (basePrice === Infinity) basePrice = null;
  }

  const slug = await uniqueSlug(d.slug || d.title);
  const geoFull = await serviceGeo(d.mapUrl, undefined);
  const geoOk = "error" in geoFull ? { lat: null, lng: null } : geoFull;

  const created = await prisma.service.create({
    data: {
      category: d.category,
      title: d.title,
      slug,
      summary: d.summary,
      description: d.description,
      area: d.area ?? null,
      distanceKm: d.distanceKm ?? null,
      mapUrl: d.mapUrl ?? null,
      lat: geoOk.lat,
      lng: geoOk.lng,
      policy: d.policy ?? null,
      basePrice,
      originalPrice: d.originalPrice ?? null,
      priceUnit: d.priceUnit ?? (CATEGORIES[d.category].priceUnit || null),
      contactName: d.contactName ?? null,
      contactPhone: d.contactPhone ?? null,
      contactZalo: d.contactZalo ?? null,
      featured: d.featured ?? false,
      published: d.published ?? true,
      easyRoad: d.easyRoad ?? false,
      pool: d.pool ?? false,
      contactOnly: d.contactOnly ?? false,
      // "Nhắn tin, theo tình trạng phòng" chỉ có nghĩa khi KHÔNG bật "không quản lý lịch".
      inquiryOnly: (d.inquiryOnly ?? false) && !d.contactOnly,
      // Chỉ ghi khi form có gửi ô "ngày hết phòng" (form khác không gửi → giữ nguyên).
      ...(d.soldOutDates ? { soldOutDates: d.soldOutDates } : {}),
      ownerId: d.ownerId ?? null,
      ctvCommission: d.ctvCommission ?? null,
      roomCommission: d.roomCommission ?? null,
      busCommission: d.busCommission ?? null,
      weekendPolicy: d.weekendPolicy ?? "NONE",
      priorityOrder: d.priorityOrder ?? 0,
      childFreeUnderAge: d.childFreeUnderAge ?? 6,
      roomTypes:
        rooms.length && d.category === "HOMESTAY"
          ? {
              create: rooms.map((r, i) => ({
                name: r.name,
                capacity: r.capacity,
                weekdayPrice: r.weekdayPrice,
                weekendPrice: r.weekendPrice,
                totalRooms: r.totalRooms,
                sortOrder: i,
              })),
            }
          : undefined,
      cabinTrips:
        trips.length && d.category === "CABIN"
          ? {
              create: trips.map((t) => ({
                operatorName: d.contactName || d.title,
                route: d.area || "",
                departureDate: parseDateOnly(t.date),
                departureTime: t.time,
                pickupPoint: s(formData.get("pickupPoint")) ?? "Đón nội thành",
                dropoffPoint: s(formData.get("dropoffPoint")) ?? "Trung tâm Tà Xùa",
                price: t.price,
                seatsTotal: t.seats,
                seatsAvailable: t.seats,
                status: "AVAILABLE" as const,
              })),
            }
          : undefined,
      rentalVehicles:
        vehicles.length && d.category === "MOTORBIKE"
          ? {
              create: vehicles.map((v, i) => ({
                vehicleType: v.type,
                pricePerDay: v.pricePerDay,
                totalUnits: v.totalUnits,
                sortOrder: i,
              })),
            }
          : undefined,
      transport:
        d.category === "XEOM" || d.category === "TAXI"
          ? {
              create: {
                fromPoint: s(formData.get("fromPoint")) ?? "",
                toArea: s(formData.get("toArea")) ?? "",
                vehicleType: s(formData.get("transportVehicle")) ?? null,
                fixedPrice: num(formData.get("fixedPrice")) ?? null,
                priceNote: s(formData.get("priceNote")) ?? null,
              },
            }
          : undefined,
    },
  });

  if (d.category === "CABIN" && d.featured) await enforceSingleFeaturedCabin(created.id);
  revalidatePath("/admin/services");
  redirect(`/admin/services/${created.id}`);
}

export async function updateService(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ed = await requireServiceEditor(s(formData.get("id")));
  const id = s(formData.get("id"));
  if (!id) return { error: "Thiếu id." };
  const parsed = serviceInputSchema.safeParse({
    category: formData.get("category"),
    title: formData.get("title"),
    slug: s(formData.get("slug")),
    summary: formData.get("summary"),
    description: formData.get("description"),
    area: s(formData.get("area")),
    distanceKm: fnum(formData.get("distanceKm")),
    mapUrl: s(formData.get("mapUrl")),
    policy: s(formData.get("policy")),
    basePrice: num(formData.get("basePrice")),
    originalPrice: num(formData.get("originalPrice")),
    priceUnit: s(formData.get("priceUnit")),
    contactName: s(formData.get("contactName")),
    contactPhone: s(formData.get("contactPhone")),
    contactZalo: s(formData.get("contactZalo")),
    featured: formData.get("featured") === "on",
    published: formData.get("published") === "on",
    easyRoad: formData.get("easyRoad") === "on",
    pool: formData.get("pool") === "on",
    contactOnly: formData.get("contactOnly") === "on",
    inquiryOnly: formData.get("inquiryOnly") === "on",
    soldOutDates: dateList(formData.get("soldOutDates")),
    ownerId: s(formData.get("ownerId")),
    ctvCommission: num(formData.get("ctvCommission")),
    roomCommission: num(formData.get("roomCommission")),
    busCommission: num(formData.get("busCommission")),
    weekendPolicy: s(formData.get("weekendPolicy")),
    priorityOrder: num(formData.get("priorityOrder")),
    childFreeUnderAge: num(formData.get("childFreeUnderAge")),
    extraPersonFee: num(formData.get("extraPersonFee")),
    earlyCheckinFee: num(formData.get("earlyCheckinFee")),
    lateCheckoutFee: num(formData.get("lateCheckoutFee")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const d = parsed.data;
  // Chủ tự đăng ký: giữ nguyên các trường do SÀN quyết định (hiển thị = admin duyệt, nổi bật, chủ, chiết khấu, ưu tiên, loại).
  if (!ed.isAdmin) {
    const cur = await prisma.service.findUnique({ where: { id } });
    if (!cur) return { error: "Không tìm thấy dịch vụ." };
    const n = (v: unknown) => (v == null ? undefined : Number(v));
    Object.assign(d, {
      category: cur.category, featured: cur.featured, published: cur.published, ownerId: cur.ownerId ?? undefined,
      ctvCommission: n(cur.ctvCommission), roomCommission: n(cur.roomCommission), busCommission: n(cur.busCommission),
      priorityOrder: cur.priorityOrder,
    });
  }
  const latLngRaw = formData.get("latLng");
  const geo = await serviceGeo(d.mapUrl, latLngRaw == null ? undefined : String(latLngRaw), id);
  if ("error" in geo) return { error: geo.error };
  const slug = await uniqueSlug(d.slug || d.title, id);
  await prisma.service.update({
    where: { id },
    data: {
      category: d.category,
      title: d.title,
      slug,
      summary: d.summary,
      description: d.description,
      area: d.area ?? null,
      distanceKm: d.distanceKm ?? null,
      mapUrl: d.mapUrl ?? null,
      lat: geo.lat,
      lng: geo.lng,
      policy: d.policy ?? null,
      basePrice: d.basePrice ?? null,
      originalPrice: d.originalPrice ?? null,
      priceUnit: d.priceUnit ?? null,
      contactName: d.contactName ?? null,
      contactPhone: d.contactPhone ?? null,
      contactZalo: d.contactZalo ?? null,
      featured: d.featured ?? false,
      published: d.published ?? true,
      easyRoad: d.easyRoad ?? false,
      pool: d.pool ?? false,
      contactOnly: d.contactOnly ?? false,
      // "Nhắn tin, theo tình trạng phòng" chỉ có nghĩa khi KHÔNG bật "không quản lý lịch".
      inquiryOnly: (d.inquiryOnly ?? false) && !d.contactOnly,
      // Chỉ ghi khi form có gửi ô "ngày hết phòng" (form khác không gửi → giữ nguyên).
      ...(d.soldOutDates ? { soldOutDates: d.soldOutDates } : {}),
      ownerId: d.ownerId ?? null,
      ctvCommission: d.ctvCommission ?? null,
      roomCommission: d.roomCommission ?? null,
      busCommission: d.busCommission ?? null,
      weekendPolicy: d.weekendPolicy ?? "NONE",
      priorityOrder: d.priorityOrder ?? 0,
      childFreeUnderAge: d.childFreeUnderAge ?? 6,
      extraPersonFee: d.extraPersonFee ?? null,
      earlyCheckinFee: d.earlyCheckinFee ?? null,
      lateCheckoutFee: d.lateCheckoutFee ?? null,
    },
  });
  if (d.category === "CABIN" && d.featured) await enforceSingleFeaturedCabin(id);
  // Xe máy: form không còn ô giá chung ⇒ giá "từ" + giá gạch chung tự suy từ các loại xe.
  if (d.category === "MOTORBIKE") await syncRentalServicePrice(id);
  revalidatePath("/admin/services");
  revalidatePath(`/admin/services/${id}`);
  return { ok: true, serviceId: id };
}

export async function deleteService(formData: FormData): Promise<void> {
  const ed = await requireServiceEditor(s(formData.get("id")));
  const id = s(formData.get("id"));
  if (id) {
    // Chủ tự đăng ký: không xoá homestay còn đơn chưa huỷ hoặc còn lượt ở sắp tới (xoá kéo theo phòng / lịch / lượt ở,
    // đơn mất liên kết phòng). Muốn ngừng bán thì liên hệ sàn ẩn bài.
    if (!ed.isAdmin) {
      const [orders, stays] = await Promise.all([
        prisma.bookingRequest.count({ where: { serviceId: id, status: { not: "CANCELLED" } } }),
        prisma.roomStay.count({ where: { serviceId: id, checkOut: { gte: today() }, OR: [{ state: null }, { state: { notIn: ["cancel", "noshow", "reject"] } }] } }),
      ]);
      if (orders || stays) throw new Error("Homestay đang có đơn hoặc lượt ở chưa xong — không xoá được. Huỷ các đơn đó trước, hoặc liên hệ Tà Xùa Booking để ẩn homestay.");
    }
    await prisma.service.delete({ where: { id } });
    revalidatePath("/admin/services");
  }
  redirect("/admin/services");
}

/** Chỉ cho phép MỘT nhà xe cabin được "nổi bật" tại một thời điểm (bỏ tick các xe khác). */
async function enforceSingleFeaturedCabin(keepId: string): Promise<void> {
  await prisma.service.updateMany({
    where: { category: "CABIN", featured: true, id: { not: keepId } },
    data: { featured: false },
  });
  revalidatePath("/");
}

export async function toggleField(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = s(formData.get("id"));
  const field = s(formData.get("field"));
  if (!id || (field !== "published" && field !== "featured")) return;
  const svc = await prisma.service.findUnique({ where: { id } });
  if (!svc) return;
  const nextVal = !svc[field];
  await prisma.service.update({
    where: { id },
    data: { [field]: nextVal },
  });
  // Tick nổi bật một nhà xe cabin ⇒ bỏ tick các nhà xe cabin khác.
  if (field === "featured" && nextVal && svc.category === "CABIN") {
    await enforceSingleFeaturedCabin(id);
  }
  revalidatePath("/admin/services");
  revalidatePath(`/admin/services/${id}`);
}

// ---------------- Ảnh ----------------
export async function addImage(formData: FormData): Promise<void> {
  await guard(s(formData.get("serviceId")));
  const serviceId = s(formData.get("serviceId"));
  const url = s(formData.get("url"));
  if (!serviceId || !url) return;
  const count = await prisma.serviceImage.count({ where: { serviceId } });
  await prisma.serviceImage.create({
    data: { serviceId, url, sortOrder: count, isCover: count === 0 },
  });
  revalidatePath(`/admin/services/${serviceId}`);
}

export async function deleteImage(formData: FormData): Promise<void> {
  await guard(await serviceIdOfServiceImage(s(formData.get("id"))));
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (!id) return;
  await prisma.serviceImage.delete({ where: { id } });
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

export async function setCover(formData: FormData): Promise<void> {
  await guard(s(formData.get("serviceId")), await serviceIdOfServiceImage(s(formData.get("id"))));
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (!id || !serviceId) return;
  await prisma.$transaction([
    prisma.serviceImage.updateMany({ where: { serviceId }, data: { isCover: false } }),
    prisma.serviceImage.update({ where: { id }, data: { isCover: true } }),
  ]);
  revalidatePath(`/admin/services/${serviceId}`);
}

// ---------------- Di chuyển vị trí ảnh (mũi tên ‹ ›) ----------------
/** Chuẩn hoá sortOrder theo vị trí hiển thị rồi hoán đổi ảnh với ô bên cạnh. */
async function swapOrder(
  rows: { id: string; sortOrder: number }[],
  id: string,
  dir: string | null | undefined,
  update: (id: string, sortOrder: number) => Promise<unknown>,
): Promise<void> {
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return;
  const j = dir === "left" ? idx - 1 : idx + 1;
  if (j < 0 || j >= rows.length) return;
  await Promise.all(
    rows.map((r, i) => {
      const target = i === idx ? j : i === j ? idx : i;
      return r.sortOrder === target
        ? Promise.resolve()
        : update(r.id, target);
    }),
  );
}

export async function moveServiceImage(formData: FormData): Promise<void> {
  await guard(s(formData.get("serviceId")), await serviceIdOfServiceImage(s(formData.get("id"))));
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (!id || !serviceId) return;
  const rows = await prisma.serviceImage.findMany({
    where: { serviceId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  await swapOrder(rows, id, s(formData.get("dir")), (iid, so) =>
    prisma.serviceImage.update({ where: { id: iid }, data: { sortOrder: so } }),
  );
  revalidatePath(`/admin/services/${serviceId}`);
}

export async function moveRoomTypeImage(formData: FormData): Promise<void> {
  await guard(await serviceIdOfRoomType(s(formData.get("roomTypeId"))), await serviceIdOfRoomTypeImage(s(formData.get("id"))));
  const id = s(formData.get("id"));
  const roomTypeId = s(formData.get("roomTypeId"));
  const serviceId = s(formData.get("serviceId"));
  if (!id || !roomTypeId) return;
  const rows = await prisma.roomTypeImage.findMany({
    where: { roomTypeId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  await swapOrder(rows, id, s(formData.get("dir")), (iid, so) =>
    prisma.roomTypeImage.update({ where: { id: iid }, data: { sortOrder: so } }),
  );
  await syncRoomThumbnail(roomTypeId);
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

export async function moveRoomImage(formData: FormData): Promise<void> {
  await guard(await serviceIdOfRoom(s(formData.get("roomId"))), await serviceIdOfRoomImage(s(formData.get("id"))));
  const id = s(formData.get("id"));
  const roomId = s(formData.get("roomId"));
  const serviceId = s(formData.get("serviceId"));
  if (!id || !roomId) return;
  const rows = await prisma.roomImage.findMany({
    where: { roomId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  await swapOrder(rows, id, s(formData.get("dir")), (iid, so) =>
    prisma.roomImage.update({ where: { id: iid }, data: { sortOrder: so } }),
  );
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

// ---------------- Sắp xếp lại toàn bộ thứ tự ảnh (kéo thả) ----------------
/** Đọc danh sách id theo thứ tự mới từ formData ("ids" = JSON array). */
function idList(formData: FormData): string[] {
  try {
    const arr = JSON.parse(s(formData.get("ids")) ?? "[]");
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function reorderServiceImages(formData: FormData): Promise<void> {
  await guard(s(formData.get("serviceId")));
  const serviceId = s(formData.get("serviceId"));
  const ids = idList(formData);
  if (!serviceId || ids.length === 0) return;
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.serviceImage.updateMany({ where: { id, serviceId }, data: { sortOrder: i } }),
    ),
  );
  revalidatePath(`/admin/services/${serviceId}`);
}

export async function reorderRoomTypeImages(formData: FormData): Promise<void> {
  await guard(await serviceIdOfRoomType(s(formData.get("roomTypeId"))));
  const roomTypeId = s(formData.get("roomTypeId"));
  const serviceId = s(formData.get("serviceId"));
  const ids = idList(formData);
  if (!roomTypeId || ids.length === 0) return;
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.roomTypeImage.updateMany({ where: { id, roomTypeId }, data: { sortOrder: i } }),
    ),
  );
  await syncRoomThumbnail(roomTypeId);
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

export async function reorderRoomImages(formData: FormData): Promise<void> {
  await guard(await serviceIdOfRoom(s(formData.get("roomId"))));
  const roomId = s(formData.get("roomId"));
  const serviceId = s(formData.get("serviceId"));
  const ids = idList(formData);
  if (!roomId || ids.length === 0) return;
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.roomImage.updateMany({ where: { id, roomId }, data: { sortOrder: i } }),
    ),
  );
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

/**
 * Sắp xếp lại THỨ TỰ HIỂN THỊ PHÒNG (chung mọi hạng) theo danh sách id kéo-thả.
 * Gán sortOrder = 0..n đúng theo thứ tự nhận được — ổn định, không "nhảy".
 */
export async function reorderRooms(formData: FormData): Promise<void> {
  await guard(s(formData.get("serviceId")));
  const serviceId = s(formData.get("serviceId"));
  const ids = idList(formData);
  if (!serviceId || ids.length === 0) return;
  const valid = new Set(
    (await prisma.room.findMany({ where: { roomType: { serviceId } }, select: { id: true } })).map((r) => r.id),
  );
  const ordered = ids.filter((id) => valid.has(id));
  if (ordered.length === 0) return;
  await prisma.$transaction(
    ordered.map((id, i) => prisma.room.update({ where: { id }, data: { sortOrder: i } })),
  );
  revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin/availability");
}

// ---------------- Thứ tự hạng phòng (nút ↑ ↓) ----------------
async function moveRoomTypeDir(formData: FormData, dir: "left" | "right"): Promise<void> {
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (!id || !serviceId) return;
  const rows = await prisma.roomType.findMany({
    where: { serviceId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  await swapOrder(rows, id, dir, (iid, so) =>
    prisma.roomType.update({ where: { id: iid }, data: { sortOrder: so } }),
  );
  revalidatePath(`/admin/services/${serviceId}`);
}

export async function moveRoomTypeUp(formData: FormData): Promise<void> {
  await guard(s(formData.get("serviceId")), await serviceIdOfRoomType(s(formData.get("id"))));
  await moveRoomTypeDir(formData, "left");
}

export async function moveRoomTypeDown(formData: FormData): Promise<void> {
  await guard(s(formData.get("serviceId")), await serviceIdOfRoomType(s(formData.get("id"))));
  await moveRoomTypeDir(formData, "right");
}

// ---------------- Loại phòng ----------------
export async function upsertRoomType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  { const rtId = s(formData.get("id")); await guard(s(formData.get("serviceId")), ...(rtId ? [await serviceIdOfRoomType(rtId)] : [])); }
  const serviceId = s(formData.get("serviceId"));
  const id = s(formData.get("id"));
  if (!serviceId) return { error: "Thiếu dịch vụ." };
  const data = {
    name: s(formData.get("name")) ?? "Phòng",
    capacity: num(formData.get("capacity")) ?? 2,
    weekdayPrice: num(formData.get("weekdayPrice")) ?? 0,
    weekendPrice: num(formData.get("weekendPrice")) ?? 0,
    holidayPrice: num(formData.get("holidayPrice")) ?? null,
    // Giá theo thứ (để trống = null = dùng weekday/weekend).
    priceMon: num(formData.get("priceMon")) ?? null,
    priceTue: num(formData.get("priceTue")) ?? null,
    priceWed: num(formData.get("priceWed")) ?? null,
    priceThu: num(formData.get("priceThu")) ?? null,
    priceFri: num(formData.get("priceFri")) ?? null,
    priceSat: num(formData.get("priceSat")) ?? null,
    priceSun: num(formData.get("priceSun")) ?? null,
    totalRooms: num(formData.get("totalRooms")) ?? 1,
    imageUrl: s(formData.get("imageUrl")) ?? null,
    // Tiện ích (lọc combo)
    hasBathtub: formData.get("hasBathtub") === "on",
    cloudView: formData.get("cloudView") === "on",
    breakfast: formData.get("breakfast") === "on",
    airCon: formData.get("airCon") === "on",
    heating: formData.get("heating") === "on",
  };
  try {
    if (id) await prisma.roomType.update({ where: { id }, data });
    else await prisma.roomType.create({ data: { serviceId, ...data } });
  } catch {
    return { error: "Lưu loại phòng thất bại." };
  }
  revalidatePath(`/admin/services/${serviceId}`);
  return { ok: true, message: id ? "Đã lưu loại phòng" : "Đã thêm loại phòng" };
}

/**
 * Áp GIÁ CHO CẢ HẠNG PHÒNG: ghi đè giá thường / giá chiết khấu / giá theo thứ
 * cho MỌI phòng con thuộc hạng (đỡ phải sửa từng phòng một).
 * Giá trị trong form được áp nguyên trạng: ô thứ bỏ trống = xoá ghi đè ngày đó.
 */
export async function applyRoomTypePrices(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await guard(await serviceIdOfRoomType(s(formData.get("roomTypeId"))));
  const roomTypeId = s(formData.get("roomTypeId"));
  const serviceId = s(formData.get("serviceId"));
  if (!roomTypeId) return { error: "Thiếu hạng phòng." };
  const data = {
    listPrice: num(formData.get("listPrice")) ?? 0,
    // 0/trống = không giảm giá → lưu null (giống upsertRoom).
    salePrice: (num(formData.get("salePrice")) || null) as number | null,
    priceMon: num(formData.get("priceMon")) ?? null,
    priceTue: num(formData.get("priceTue")) ?? null,
    priceWed: num(formData.get("priceWed")) ?? null,
    priceThu: num(formData.get("priceThu")) ?? null,
    priceFri: num(formData.get("priceFri")) ?? null,
    priceSat: num(formData.get("priceSat")) ?? null,
    priceSun: num(formData.get("priceSun")) ?? null,
    // Giá NGÀY LỄ (lịch lễ ở /admin/popup) — 0/trống = null (không có giá lễ).
    holidayPrice: num(formData.get("holidayPrice")) || null,
    // Giá gạch (niêm yết) theo thứ — 0/trống = null (dùng giá gốc chung / không gạch).
    listPriceMon: num(formData.get("listPriceMon")) || null,
    listPriceTue: num(formData.get("listPriceTue")) || null,
    listPriceWed: num(formData.get("listPriceWed")) || null,
    listPriceThu: num(formData.get("listPriceThu")) || null,
    listPriceFri: num(formData.get("listPriceFri")) || null,
    listPriceSat: num(formData.get("listPriceSat")) || null,
    listPriceSun: num(formData.get("listPriceSun")) || null,
  };
  try {
    const r = await prisma.room.updateMany({ where: { roomTypeId }, data });
    if (r.count === 0) return { error: "Hạng này chưa có phòng nào — thêm phòng trước." };
    if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
    revalidatePath("/admin/availability");
    return { ok: true, message: `Đã áp giá cho ${r.count} phòng trong hạng` };
  } catch {
    return { error: "Áp giá thất bại." };
  }
}

export async function deleteRoomType(formData: FormData): Promise<void> {
  await guard(await serviceIdOfRoomType(s(formData.get("id"))));
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (id) {
    // Không xoá khi còn đơn đang giữ phòng thuộc hạng này (từ hôm nay trở đi).
    const held = await prisma.roomDayStatus.count({
      where: { room: { roomTypeId: id }, bookingId: { not: null }, date: { gte: today() } },
    });
    if (held > 0) throw new Error("Hạng phòng đang có đơn giữ chỗ — huỷ các đơn đó trước khi xoá.");
    await prisma.roomType.delete({ where: { id } });
  }
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

// ---------------- Phòng riêng lẻ ----------------

/** Đánh số lại `sortOrder` cho TẤT CẢ phòng của một dịch vụ thành dãy 0..n duy nhất
 *  (thứ tự hiển thị "trên mọi hạng"). Nhờ đó số không bao giờ trùng giữa các hạng
 *  → thứ tự trên web ổn định, không "nhảy". Giữ nguyên trật tự theo số hiện có;
 *  khi trùng số, phòng vừa sửa (`preferId`) được ưu tiên để nhảy đúng về chỗ đã gõ,
 *  còn lại dồn theo thời điểm tạo cho ổn định. */
async function normalizeServiceRoomOrder(serviceId: string, preferId?: string): Promise<void> {
  const rooms = await prisma.room.findMany({
    where: { roomType: { serviceId } },
    select: { id: true, sortOrder: true, createdAt: true },
  });
  rooms.sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      (a.id === preferId ? -1 : b.id === preferId ? 1 : 0) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  await Promise.all(
    rooms.map((r, i) =>
      r.sortOrder === i
        ? Promise.resolve()
        : prisma.room.update({ where: { id: r.id }, data: { sortOrder: i } }),
    ),
  );
}

export async function upsertRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rmId = s(formData.get("id"));
  const ed = await guard(await serviceIdOfRoomType(s(formData.get("roomTypeId"))), ...(rmId ? [await serviceIdOfRoom(rmId)] : []));
  const serviceId = s(formData.get("serviceId"));
  const roomTypeId = s(formData.get("roomTypeId"));
  const id = s(formData.get("id"));
  const name = s(formData.get("name"));
  if (!roomTypeId || !name) return { error: "Vui lòng nhập tên phòng và chọn hạng phòng." };
  const data = {
    name,
    amenities: s(formData.get("amenities")) ?? null,
    description: s(formData.get("description")) ?? null,
    // Thứ tự hiển thị KHÔNG sửa ở form phòng nữa (quản lý ở khu "Thứ tự hiển thị phòng"
    // bằng kéo-thả) — lưu phòng giữ nguyên thứ tự cũ, tránh "nhảy".
    // Giá & sức chứa ở cấp phòng con.
    capacity: num(formData.get("capacity")) ?? 2,
    // Sức chứa tối đa (0/trống = không nhận thêm). Phụ thu người thêm/check-in sớm/
    // check-out muộn đã chuyển lên cấu hình CHUNG của homestay (Service).
    maxCapacity: num(formData.get("maxCapacity")) || null,
    // Tên khác trong Google Sheet lịch (sheet-sync khớp thêm theo các tên này).
    sheetAlias: s(formData.get("sheetAlias")) ?? null,
    // Phòng nổi bật: lên đầu trang tìm homestay.
    featured: formData.get("featured") === "on",
    // Không áp khuyến mãi combo (giảm / khách cấu hình ở /admin/popup) cho phòng này.
    noComboDiscount: formData.get("noComboDiscount") === "on",
    listPrice: num(formData.get("listPrice")) ?? 0,
    // 0 = không giảm giá → lưu null (0 thật sẽ làm giá hiệu lực = 0đ).
    salePrice: (num(formData.get("salePrice")) || null) as number | null,
    priceMon: num(formData.get("priceMon")) ?? null,
    priceTue: num(formData.get("priceTue")) ?? null,
    priceWed: num(formData.get("priceWed")) ?? null,
    priceThu: num(formData.get("priceThu")) ?? null,
    priceFri: num(formData.get("priceFri")) ?? null,
    priceSat: num(formData.get("priceSat")) ?? null,
    priceSun: num(formData.get("priceSun")) ?? null,
    // Giá NGÀY LỄ (lịch lễ ở /admin/popup) — 0/trống = null (không có giá lễ).
    holidayPrice: num(formData.get("holidayPrice")) || null,
    // Giá gạch (niêm yết) theo thứ — 0/trống = null (dùng giá gốc chung / không gạch).
    listPriceMon: num(formData.get("listPriceMon")) || null,
    listPriceTue: num(formData.get("listPriceTue")) || null,
    listPriceWed: num(formData.get("listPriceWed")) || null,
    listPriceThu: num(formData.get("listPriceThu")) || null,
    listPriceFri: num(formData.get("listPriceFri")) || null,
    listPriceSat: num(formData.get("listPriceSat")) || null,
    listPriceSun: num(formData.get("listPriceSun")) || null,
    // Chiết khấu CTV (đ/đêm): mức cơ bản + ghi đè theo thứ.
    commission: num(formData.get("commission")) ?? null,
    commissionMon: num(formData.get("commissionMon")) ?? null,
    commissionTue: num(formData.get("commissionTue")) ?? null,
    commissionWed: num(formData.get("commissionWed")) ?? null,
    commissionThu: num(formData.get("commissionThu")) ?? null,
    commissionFri: num(formData.get("commissionFri")) ?? null,
    commissionSat: num(formData.get("commissionSat")) ?? null,
    commissionSun: num(formData.get("commissionSun")) ?? null,
  };
  // Chủ tự đăng ký: không đổi chiết khấu sàn / phòng nổi bật / khuyến mãi combo (giữ giá trị cũ, phòng mới = mặc định).
  if (!ed.isAdmin) {
    for (const k of ["featured", "noComboDiscount", "commission", "commissionMon", "commissionTue", "commissionWed", "commissionThu", "commissionFri", "commissionSat", "commissionSun"]) {
      delete (data as Record<string, unknown>)[k];
    }
  }
  try {
    const svcId =
      serviceId ||
      (await prisma.roomType.findUnique({ where: { id: roomTypeId }, select: { serviceId: true } }))?.serviceId;
    let roomId = id;
    if (id) {
      const existing = await prisma.room.findUnique({ where: { id } });
      // KHÔNG đụng sortOrder khi sửa phòng (giữ nguyên thứ tự hiển thị).
      await prisma.room.update({ where: { id }, data: { ...data, roomTypeId } });
      if (existing && existing.roomTypeId !== roomTypeId) {
        await resyncRoomTypeWindow(existing.roomTypeId);
        await resyncRoomTypeWindow(roomTypeId);
      }
    } else {
      // Phòng mới xuống CUỐI danh sách hiển thị.
      const endOrder = svcId ? await prisma.room.count({ where: { roomType: { serviceId: svcId } } }) : 0;
      const created = await prisma.room.create({ data: { roomTypeId, ...data, sortOrder: endOrder } });
      roomId = created.id;
      await resyncRoomTypeWindow(roomTypeId);
    }
    // Dồn lại thứ tự hiển thị thành dãy 0..n duy nhất (ổn định; sửa phòng giữ nguyên trật tự).
    if (svcId) await normalizeServiceRoomOrder(svcId);
  } catch {
    return { error: "Lưu phòng thất bại." };
  }
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin/availability");
  return { ok: true, message: id ? "Đã lưu phòng" : "Đã thêm phòng" };
}

/** Sinh tên phòng mới từ tên gốc: tăng số cuối lên +1, bỏ qua tên đã có.
 *  "Phòng 1" → "Phòng 2"; "Phòng 101" → "Phòng 102"; "Phòng VIP" → "Phòng VIP 2". */
function nextRoomName(base: string, taken: string[]): string {
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  const m = base.match(/^(.*?)(\d+)(\D*)$/);
  const build = m
    ? (n: number) => `${m[1]}${n}${m[3]}`
    : (n: number) => `${base.trim()} ${n}`;
  let n = m ? parseInt(m[2], 10) + 1 : 2;
  let cand = build(n);
  while (used.has(cand.trim().toLowerCase())) cand = build(++n);
  return cand;
}

/** Nhân bản một phòng: copy toàn bộ giá/sức chứa/tiện ích + ảnh (dùng chung file). */
export async function duplicateRoom(formData: FormData): Promise<void> {
  await guard(await serviceIdOfRoom(s(formData.get("id"))));
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (!id) return;
  const src = await prisma.room.findUnique({ where: { id }, include: { images: true } });
  if (!src) return;
  const siblingRooms = await prisma.room.findMany({
    where: { roomTypeId: src.roomTypeId },
    select: { name: true },
  });
  const newName = nextRoomName(src.name, siblingRooms.map((r) => r.name));
  const created = await prisma.room.create({
    data: {
      roomTypeId: src.roomTypeId,
      name: newName,
      amenities: src.amenities,
      description: src.description,
      capacity: src.capacity,
      maxCapacity: src.maxCapacity,
      sheetAlias: src.sheetAlias,
      featured: src.featured,
      noComboDiscount: src.noComboDiscount,
      listPrice: src.listPrice,
      salePrice: src.salePrice,
      priceMon: src.priceMon,
      priceTue: src.priceTue,
      priceWed: src.priceWed,
      priceThu: src.priceThu,
      priceFri: src.priceFri,
      priceSat: src.priceSat,
      priceSun: src.priceSun,
      holidayPrice: src.holidayPrice,
      listPriceMon: src.listPriceMon,
      listPriceTue: src.listPriceTue,
      listPriceWed: src.listPriceWed,
      listPriceThu: src.listPriceThu,
      listPriceFri: src.listPriceFri,
      listPriceSat: src.listPriceSat,
      listPriceSun: src.listPriceSun,
      commission: src.commission,
      commissionMon: src.commissionMon,
      commissionTue: src.commissionTue,
      commissionWed: src.commissionWed,
      commissionThu: src.commissionThu,
      commissionFri: src.commissionFri,
      commissionSat: src.commissionSat,
      commissionSun: src.commissionSun,
      // Đặt sát ngay sau phòng gốc trong thứ tự chung; normalize sẽ dồn lại 0..n.
      sortOrder: src.sortOrder,
      images: {
        create: src.images.map((img) => ({
          url: img.url,
          alt: img.alt,
          sortOrder: img.sortOrder,
          isCover: img.isCover,
        })),
      },
    },
  });
  await resyncRoomTypeWindow(src.roomTypeId);
  const svcId =
    serviceId ||
    (await prisma.roomType.findUnique({ where: { id: src.roomTypeId }, select: { serviceId: true } }))?.serviceId;
  if (svcId) await normalizeServiceRoomOrder(svcId, created.id);
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin/availability");
}

/** Đổi vị trí phòng trong thứ tự hiển thị chung của cả dịch vụ (nút ↑ ↓ ở form phòng). */
async function moveRoomDir(formData: FormData, dir: "left" | "right"): Promise<void> {
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (!id) return;
  const room = await prisma.room.findUnique({
    where: { id },
    select: { roomType: { select: { serviceId: true } } },
  });
  if (!room) return;
  const svcId = serviceId || room.roomType.serviceId;
  const rows = await prisma.room.findMany({
    where: { roomType: { serviceId: svcId } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  await swapOrder(rows, id, dir, (iid, so) =>
    prisma.room.update({ where: { id: iid }, data: { sortOrder: so } }),
  );
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin/availability");
}

export async function moveRoomUp(formData: FormData): Promise<void> {
  await guard(await serviceIdOfRoom(s(formData.get("id"))));
  await moveRoomDir(formData, "left");
}

export async function moveRoomDown(formData: FormData): Promise<void> {
  await guard(await serviceIdOfRoom(s(formData.get("id"))));
  await moveRoomDir(formData, "right");
}

export async function deleteRoom(formData: FormData): Promise<void> {
  await guard(await serviceIdOfRoom(s(formData.get("id"))));
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  const roomTypeId = s(formData.get("roomTypeId"));
  if (!id) return;
  // Không xoá khi phòng còn đơn giữ chỗ (từ hôm nay trở đi).
  const held = await prisma.roomDayStatus.count({
    where: { roomId: id, bookingId: { not: null }, date: { gte: today() } },
  });
  if (held > 0) throw new Error("Phòng đang có đơn giữ chỗ — huỷ các đơn đó trước khi xoá phòng.");
  await prisma.room.delete({ where: { id } });
  // Resync không được chặn việc refresh UI (nếu lỗi vẫn phải revalidate để phòng biến mất).
  if (roomTypeId) {
    try {
      await resyncRoomTypeWindow(roomTypeId);
    } catch {}
  }
  // Dồn lại thứ tự chung để không để lại khoảng trống sau khi xoá.
  const svcId =
    serviceId ||
    (roomTypeId
      ? (await prisma.roomType.findUnique({ where: { id: roomTypeId }, select: { serviceId: true } }))?.serviceId
      : undefined);
  if (svcId) {
    try {
      await normalizeServiceRoomOrder(svcId);
    } catch {}
  }
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin/availability");
}

// ---------------- Ảnh / video hạng phòng ----------------
/** imageUrl (thumbnail) luôn = ảnh đầu tiên (bỏ qua video). */
async function syncRoomThumbnail(roomTypeId: string): Promise<void> {
  const firstImage = await prisma.roomTypeImage.findFirst({
    where: { roomTypeId, type: "image" },
    orderBy: { sortOrder: "asc" },
  });
  await prisma.roomType.update({
    where: { id: roomTypeId },
    data: { imageUrl: firstImage?.url ?? null },
  });
}

export async function deleteRoomImage(formData: FormData): Promise<void> {
  await guard(await serviceIdOfRoomTypeImage(s(formData.get("id"))));
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (!id) return;
  const img = await prisma.roomTypeImage.findUnique({ where: { id } });
  if (img) {
    await prisma.roomTypeImage.delete({ where: { id } });
    if (img.isCover) {
      const next = await prisma.roomTypeImage.findFirst({
        where: { roomTypeId: img.roomTypeId },
        orderBy: { sortOrder: "asc" },
      });
      if (next) {
        await prisma.roomTypeImage.update({ where: { id: next.id }, data: { isCover: true } });
      }
    }
    await syncRoomThumbnail(img.roomTypeId);
  }
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

export async function setRoomImageCover(formData: FormData): Promise<void> {
  await guard(await serviceIdOfRoomType(s(formData.get("roomTypeId"))), await serviceIdOfRoomTypeImage(s(formData.get("id"))));
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  const roomTypeId = s(formData.get("roomTypeId"));
  if (!id || !roomTypeId) return;
  await prisma.$transaction([
    prisma.roomTypeImage.updateMany({ where: { roomTypeId }, data: { isCover: false } }),
    prisma.roomTypeImage.update({ where: { id }, data: { isCover: true } }),
  ]);
  await syncRoomThumbnail(roomTypeId);
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

// ---------------- Ảnh phòng riêng lẻ ----------------
export async function deleteRoomPhoto(formData: FormData): Promise<void> {
  await guard(await serviceIdOfRoomImage(s(formData.get("id"))));
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (!id) return;
  const img = await prisma.roomImage.findUnique({ where: { id } });
  if (img) {
    await prisma.roomImage.delete({ where: { id } });
    if (img.isCover) {
      const next = await prisma.roomImage.findFirst({
        where: { roomId: img.roomId },
        orderBy: { sortOrder: "asc" },
      });
      if (next) await prisma.roomImage.update({ where: { id: next.id }, data: { isCover: true } });
    }
  }
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

export async function setRoomPhotoCover(formData: FormData): Promise<void> {
  await guard(await serviceIdOfRoom(s(formData.get("roomId"))), await serviceIdOfRoomImage(s(formData.get("id"))));
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  const roomId = s(formData.get("roomId"));
  if (!id || !roomId) return;
  await prisma.$transaction([
    prisma.roomImage.updateMany({ where: { roomId }, data: { isCover: false } }),
    prisma.roomImage.update({ where: { id }, data: { isCover: true } }),
  ]);
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

// ---------------- Xe cho thuê ----------------
export async function upsertVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const serviceId = s(formData.get("serviceId"));
  const id = s(formData.get("id"));
  if (!serviceId) return { error: "Thiếu dịch vụ." };
  const data = {
    vehicleType: s(formData.get("vehicleType")) ?? "Xe máy",
    pricePerDay: num(formData.get("pricePerDay")) ?? 0,
    // Giá gạch/ngày: để trống hoặc không cao hơn giá thuê ⇒ không giảm giá.
    listPrice: ((lp) => (lp != null && lp > (num(formData.get("pricePerDay")) ?? 0) ? lp : null))(num(formData.get("listPrice"))),
    totalUnits: num(formData.get("totalUnits")) ?? 1,
    deliveryFee: num(formData.get("deliveryFee")) ?? null,
    imageUrl: s(formData.get("imageUrl")) ?? null,
    // Màu xe: nhập cách nhau bằng dấu phẩy (hoặc xuống dòng / chấm phẩy); bỏ trùng, tối đa 12 màu.
    colors: [
      ...new Set(
        String(formData.get("colors") ?? "")
          .split(/[,;\n]/)
          .map((c) => c.trim().slice(0, 30))
          .filter(Boolean),
      ),
    ].slice(0, 12),
  };
  try {
    if (id) await prisma.rentalVehicle.update({ where: { id }, data });
    else await prisma.rentalVehicle.create({ data: { serviceId, ...data } });
    await syncRentalServicePrice(serviceId);
  } catch {
    return { error: "Lưu loại xe thất bại." };
  }
  revalidatePath(`/admin/services/${serviceId}`);
  return { ok: true, message: id ? "Đã lưu loại xe" : "Đã thêm loại xe" };
}

export async function deleteVehicle(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (id) {
    const active = await prisma.bookingRequest.count({
      where: { rentalVehicleId: id, status: { in: ["NEW", "CONTACTING", "CONFIRMED"] } },
    });
    if (active > 0) throw new Error("Loại xe đang có đơn chưa xử lý xong — huỷ/hoàn tất các đơn đó trước khi xoá.");
    await prisma.rentalVehicle.delete({ where: { id } });
    if (serviceId) await syncRentalServicePrice(serviceId);
  }
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

/**
 * Cửa hàng XE MÁY không nhập giá chung: giá "từ" của cửa hàng (`Service.basePrice`) = giá/ngày thấp nhất
 * trong các loại xe, giá gạch chung (`Service.originalPrice`) = giá gạch của chính loại xe rẻ nhất đó
 * (thẻ dịch vụ / "Giá từ" ở trang chi tiết dùng 2 số này). Gọi sau mỗi lần thêm / sửa / xoá loại xe.
 */
async function syncRentalServicePrice(serviceId: string): Promise<void> {
  const svc = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { category: true, rentalVehicles: { select: { pricePerDay: true, listPrice: true } } },
  });
  if (!svc || svc.category !== "MOTORBIKE") return;
  const list = svc.rentalVehicles
    .map((v) => ({ price: Number(v.pricePerDay), strike: v.listPrice == null ? null : Number(v.listPrice) }))
    .filter((v) => v.price > 0)
    .sort((a, b) => a.price - b.price || (b.strike ?? 0) - (a.strike ?? 0));
  const cheapest = list[0];
  if (!cheapest && svc.rentalVehicles.length === 0) {
    // Chưa có loại xe nào: giữ giá "từ" cũ, chỉ bỏ giá gạch chung.
    await prisma.service.update({ where: { id: serviceId }, data: { originalPrice: null } });
    return;
  }
  await prisma.service.update({
    where: { id: serviceId },
    data: {
      basePrice: cheapest ? cheapest.price : null,
      originalPrice: cheapest && cheapest.strike != null && cheapest.strike > cheapest.price ? cheapest.strike : null,
    },
  });
}

// ---------------- Chuyến cabin ----------------
/** Lỗi trùng unique của Prisma (CabinTrip: mỗi nhà xe 1 chuyến / ngày / chiều). */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}
const dupTripMsg = (dir: "OUTBOUND" | "RETURN") =>
  `Ngày này đã có chuyến ${dir === "RETURN" ? "chiều về" : "chiều đi"} — sửa chuyến hiện có.`;

export async function upsertTrip(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const serviceId = s(formData.get("serviceId"));
  const id = s(formData.get("id"));
  const dateKey = s(formData.get("departureDate"));
  if (!serviceId || !dateKey) return { error: "Thiếu ngày khởi hành." };
  const seatsTotal = num(formData.get("seatsTotal")) ?? 0;
  const seatsAvailable = num(formData.get("seatsAvailable")) ?? seatsTotal;
  const dir = s(formData.get("direction"));
  const seatsDoubleTotal = num(formData.get("seatsDoubleTotal")) ?? 0;
  const seatsDoubleAvailable = num(formData.get("seatsDoubleAvailable")) ?? seatsDoubleTotal;
  const priceDoubleVal = num(formData.get("priceDouble"));
  const data = {
    operatorName: s(formData.get("operatorName")) ?? "",
    route: s(formData.get("route")) ?? "",
    direction: (dir === "RETURN" ? "RETURN" : "OUTBOUND") as "OUTBOUND" | "RETURN",
    departureDate: parseDateOnly(dateKey),
    departureTime: s(formData.get("departureTime")) ?? "",
    pickupPoint: s(formData.get("pickupPoint")) ?? "",
    dropoffPoint: s(formData.get("dropoffPoint")) ?? "",
    price: num(formData.get("price")) ?? 0,
    seatsTotal,
    seatsAvailable,
    priceDouble: priceDoubleVal ?? null,
    seatsDoubleTotal,
    seatsDoubleAvailable,
    status: (s(formData.get("status")) as AvailabilityStatus) ?? "AVAILABLE",
  };
  try {
    if (id) await prisma.cabinTrip.update({ where: { id }, data });
    else await prisma.cabinTrip.create({ data: { serviceId, ...data } });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: dupTripMsg(data.direction) };
    return { error: "Lưu chuyến thất bại." };
  }
  revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin/availability");
  return { ok: true, message: id ? "Đã lưu chuyến" : "Đã thêm chuyến" };
}

export async function deleteTrip(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (id) {
    const active = await prisma.bookingRequest.count({
      where: {
        status: { in: ["NEW", "CONTACTING", "CONFIRMED"] },
        OR: [{ cabinTripId: id }, { cabinReturnTripId: id }],
      },
    });
    if (active > 0) throw new Error("Chuyến đang có vé chưa xử lý xong — huỷ/hoàn tất các vé đó trước khi xoá chuyến.");
    await prisma.cabinTrip.delete({ where: { id } });
  }
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin/availability");
}

// ---------------- Thông tin tuyến (xe ôm/taxi) ----------------
export async function upsertTransport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const serviceId = s(formData.get("serviceId"));
  if (!serviceId) return { error: "Thiếu dịch vụ." };
  const data = {
    fromPoint: s(formData.get("fromPoint")) ?? "",
    toArea: s(formData.get("toArea")) ?? "",
    vehicleType: s(formData.get("vehicleType")) ?? null,
    fixedPrice: num(formData.get("fixedPrice")) ?? null, // giá chạy nguyên ngày (xe ôm: chở 1 người · taxi: cả xe)
    dayPriceTwo: num(formData.get("dayPriceTwo")) ?? null, // xe ôm: nguyên ngày khi chở 2 người
    capacity: num(formData.get("capacity")) ?? null, // xe ôm: 1 | 2 người · taxi: số khách / xe
    priceNote: s(formData.get("priceNote")) ?? null,
    driverName: s(formData.get("driverName")) ?? null,
    driverPhone: s(formData.get("driverPhone")) ?? null,
    driverBirthYear: num(formData.get("driverBirthYear")) ?? null,
  };
  try {
    await prisma.transportInfo.upsert({
      where: { serviceId },
      create: { serviceId, ...data },
      update: data,
    });
  } catch {
    return { error: "Lưu thông tin tuyến thất bại." };
  }
  revalidatePath(`/admin/services/${serviceId}`);
  return { ok: true, message: "Đã lưu thông tin tuyến" };
}

// ---------------- Lộ trình cabin (đi / về) ----------------
export async function upsertCabinRoute(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const serviceId = s(formData.get("serviceId"));
  const direction = s(formData.get("direction")) as "OUTBOUND" | "RETURN" | undefined;
  if (!serviceId || (direction !== "OUTBOUND" && direction !== "RETURN")) {
    return { error: "Thiếu thông tin lộ trình." };
  }
  const data = {
    title: s(formData.get("title")) ?? null,
    totalTime: s(formData.get("totalTime")) ?? null,
    startLabel: s(formData.get("startLabel")) ?? null,
    startInfo: s(formData.get("startInfo")) ?? null,
    fromPoint: s(formData.get("fromPoint")) ?? null,
    toPoint: s(formData.get("toPoint")) ?? null,
  };
  try {
    await prisma.cabinRoute.upsert({
      where: { serviceId_direction: { serviceId, direction } },
      create: { serviceId, direction, ...data },
      update: data,
    });
  } catch {
    return { error: "Lưu lộ trình thất bại." };
  }
  revalidatePath(`/admin/services/${serviceId}`);
  return { ok: true, message: "Đã lưu lộ trình" };
}

export async function upsertCabinStop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const serviceId = s(formData.get("serviceId"));
  const direction = s(formData.get("direction")) as "OUTBOUND" | "RETURN" | undefined;
  const id = s(formData.get("id"));
  const time = s(formData.get("time"));
  const place = s(formData.get("place"));
  if (!serviceId || (direction !== "OUTBOUND" && direction !== "RETURN")) {
    return { error: "Thiếu thông tin." };
  }
  if (!time || !place) return { error: "Nhập giờ và địa điểm." };
  const data = {
    sortOrder: num(formData.get("sortOrder")) ?? 0,
    time,
    place,
    note: s(formData.get("note")) ?? null,
    tag: s(formData.get("tag")) ?? null,
  };
  try {
    if (id) {
      await prisma.cabinRouteStop.update({ where: { id }, data });
    } else {
      // đảm bảo lộ trình tồn tại rồi thêm điểm dừng
      const route = await prisma.cabinRoute.upsert({
        where: { serviceId_direction: { serviceId, direction } },
        create: { serviceId, direction },
        update: {},
      });
      await prisma.cabinRouteStop.create({ data: { routeId: route.id, ...data } });
    }
  } catch {
    return { error: "Lưu điểm dừng thất bại." };
  }
  revalidatePath(`/admin/services/${serviceId}`);
  return { ok: true, message: id ? "Đã lưu điểm dừng" : "Đã thêm điểm dừng" };
}

export async function deleteCabinStop(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (id) await prisma.cabinRouteStop.delete({ where: { id } });
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}

// ---------------- Lịch giá & tình trạng (room / rental) ----------------
export async function applyAvailability(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = availabilityBulkSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    serviceId: s(formData.get("serviceId")),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    status: s(formData.get("status")),
    availableUnits: num(formData.get("availableUnits")),
    priceOverride: num(formData.get("priceOverride")),
    weekdaysOnly: formData.get("weekdaysOnly") === "on",
    weekendsOnly: formData.get("weekendsOnly") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const d = parsed.data;

  // ADMIN toàn quyền; PROVIDER chỉ cập nhật lịch cho dịch vụ của chính mình.
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "PROVIDER")) {
    return { error: "Không có quyền." };
  }
  if (session.role === "PROVIDER") {
    let owningServiceId: string | null | undefined;
    if (d.targetId === "__ALL__") {
      owningServiceId = d.serviceId;
    } else if (d.targetType === "ROOM") {
      const rt = await prisma.roomType.findUnique({ where: { id: d.targetId }, select: { serviceId: true } });
      owningServiceId = rt?.serviceId;
    } else {
      const v = await prisma.rentalVehicle.findUnique({ where: { id: d.targetId }, select: { serviceId: true } });
      owningServiceId = v?.serviceId;
    }
    if (!owningServiceId) return { error: "Không xác định được dịch vụ." };
    const svc = await prisma.service.findUnique({ where: { id: owningServiceId }, select: { ownerId: true } });
    if (!svc || svc.ownerId !== session.sub) return { error: "Dịch vụ không thuộc quyền của bạn." };
  }

  const start = parseDateOnly(d.startDate);
  const end = parseDateOnly(d.endDate);
  if (end < start) return { error: "Ngày kết thúc phải sau ngày bắt đầu." };

  let days = enumerateDays(start, end);
  if (d.weekdaysOnly) days = days.filter((x) => !isWeekend(x));
  if (d.weekendsOnly) days = days.filter((x) => isWeekend(x));
  if (days.length === 0) return { error: "Không có ngày nào khớp bộ lọc." };

  const status = (d.status as AvailabilityStatus) ?? "AVAILABLE";

  // Giải quyết danh sách đối tượng: một phòng/xe cụ thể, hoặc TẤT CẢ của một homestay.
  let targetIds: string[] = [];
  if (d.targetId === "__ALL__") {
    if (!d.serviceId) return { error: "Thiếu homestay / nhà cung cấp." };
    if (d.targetType === "ROOM") {
      const rooms = await prisma.roomType.findMany({ where: { serviceId: d.serviceId }, select: { id: true } });
      targetIds = rooms.map((r) => r.id);
    } else {
      const vs = await prisma.rentalVehicle.findMany({ where: { serviceId: d.serviceId }, select: { id: true } });
      targetIds = vs.map((v) => v.id);
    }
  } else {
    targetIds = [d.targetId];
  }
  if (targetIds.length === 0) return { error: "Không có phòng/xe nào để cập nhật." };

  const ops = [];
  for (const tid of targetIds) {
    for (const date of days) {
      if (d.targetType === "ROOM") {
        ops.push(
          prisma.roomAvailability.upsert({
            where: { roomTypeId_date: { roomTypeId: tid, date } },
            create: {
              roomTypeId: tid, date, status,
              availableRooms: d.availableUnits ?? 0,
              priceOverride: d.priceOverride ?? null,
            },
            update: {
              status,
              ...(d.availableUnits != null ? { availableRooms: d.availableUnits } : {}),
              ...(d.priceOverride != null ? { priceOverride: d.priceOverride } : {}),
            },
          }),
        );
      } else {
        ops.push(
          prisma.rentalAvailability.upsert({
            where: { rentalVehicleId_date: { rentalVehicleId: tid, date } },
            create: {
              rentalVehicleId: tid, date, status,
              availableUnits: d.availableUnits ?? 0,
              priceOverride: d.priceOverride ?? null,
            },
            update: {
              status,
              ...(d.availableUnits != null ? { availableUnits: d.availableUnits } : {}),
              ...(d.priceOverride != null ? { priceOverride: d.priceOverride } : {}),
            },
          }),
        );
      }
    }
  }
  await prisma.$transaction(ops);

  revalidatePath("/admin/availability");
  return { ok: true };
}

// ---------------- Lịch giá & tình trạng (cabin: mở chuyến theo khoảng ngày) ----------------
export async function applyCabinSchedule(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const serviceId = s(formData.get("serviceId"));
  if (!serviceId) return { error: "Thiếu nhà xe." };
  const startKey = s(formData.get("startDate"));
  const endKey = s(formData.get("endDate"));
  if (!startKey || !endKey) return { error: "Chọn khoảng ngày." };

  const start = parseDateOnly(startKey);
  const end = parseDateOnly(endKey);
  if (end < start) return { error: "Ngày kết thúc phải sau ngày bắt đầu." };

  let days = enumerateDays(start, end);
  if (formData.get("weekdaysOnly") === "on") days = days.filter((x) => !isWeekend(x));
  if (formData.get("weekendsOnly") === "on") days = days.filter((x) => isWeekend(x));
  if (days.length === 0) return { error: "Không có ngày nào khớp bộ lọc." };

  const departureTime = s(formData.get("departureTime")) ?? "21:00";
  const dir = s(formData.get("direction"));
  const direction = (dir === "RETURN" ? "RETURN" : "OUTBOUND") as "OUTBOUND" | "RETURN";
  const seatsTotal = num(formData.get("seatsTotal")) ?? 0;
  const seatsAvailable = num(formData.get("seatsAvailable")) ?? seatsTotal;
  const price = num(formData.get("price")) ?? 0;
  const priceDouble = num(formData.get("priceDouble")) ?? null;
  const seatsDoubleTotal = num(formData.get("seatsDoubleTotal")) ?? 0;
  const seatsDoubleAvailable = num(formData.get("seatsDoubleAvailable")) ?? seatsDoubleTotal;
  const status = (s(formData.get("status")) as AvailabilityStatus) ?? "AVAILABLE";
  const overwrite = formData.get("overwrite") === "on";

  // Lấy mẫu thông tin tuyến từ chuyến gần nhất hoặc chính dịch vụ.
  const svc = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { title: true, area: true },
  });
  const last = await prisma.cabinTrip.findFirst({
    where: { serviceId },
    orderBy: { departureDate: "desc" },
  });
  const operatorName = s(formData.get("operatorName")) ?? last?.operatorName ?? svc?.title ?? "";
  const route = s(formData.get("route")) ?? last?.route ?? svc?.area ?? "";
  const pickupPoint = last?.pickupPoint ?? "Đón nội thành";
  const dropoffPoint = last?.dropoffPoint ?? "Trung tâm Tà Xùa";

  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const date of days) {
    // Khớp theo NGÀY + CHIỀU (bỏ qua giờ): mỗi ngày chỉ 1 chuyến/chiều. Nhờ vậy đổi giờ
    // vẫn GHI ĐÈ đúng chuyến cũ thay vì tạo trùng.
    const existing = await prisma.cabinTrip.findFirst({
      where: { serviceId, departureDate: date, direction },
    });
    if (existing) {
      if (!overwrite) {
        skipped++;
        continue;
      }
      await prisma.cabinTrip.update({
        where: { id: existing.id },
        data: {
          departureTime, seatsTotal, seatsAvailable, price, status, operatorName, route,
          priceDouble, seatsDoubleTotal, seatsDoubleAvailable,
        },
      });
      updated++;
    } else {
      try {
        await prisma.cabinTrip.create({
          data: {
            serviceId, operatorName, route, direction, departureDate: date, departureTime,
            pickupPoint, dropoffPoint, price, seatsTotal, seatsAvailable, status,
            priceDouble, seatsDoubleTotal, seatsDoubleAvailable,
          },
        });
        created++;
      } catch (err) {
        // Chuyến vừa được tạo song song (đặt vé / admin khác) ⇒ coi như đã có, không ghi đè.
        if (!isUniqueViolation(err)) throw err;
        skipped++;
      }
    }
  }

  revalidatePath("/admin/availability");
  revalidatePath(`/admin/services/${serviceId}`);
  return {
    ok: true,
    message: `Đã tạo ${created} chuyến mới, cập nhật ${updated}, bỏ qua ${skipped} (đã có).`,
  };
}

// ---------------- Chặng taxi / xe ôm (giá 1 chiều / 2 chiều giữa 2 điểm cố định) ----------------
export async function upsertTransportRoute(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const serviceId = s(formData.get("serviceId"));
  const id = s(formData.get("id"));
  const fromPointId = s(formData.get("fromPointId"));
  const toPointId = s(formData.get("toPointId"));
  if (!serviceId) return { error: "Thiếu dịch vụ." };
  if (!fromPointId || !toPointId) return { error: "Chọn điểm đón và điểm đến." };
  if (fromPointId === toPointId) return { error: "Điểm đón và điểm đến phải khác nhau." };
  const priceOneWay = num(formData.get("priceOneWay")) ?? null; // xe ôm: chở 1 người · taxi: cả xe
  const priceTwo = num(formData.get("priceTwo")) ?? null; // xe ôm: chở 2 người
  // Chặng dùng cho cả 2 hướng ⇒ không cho khai trùng (A → B và B → A) trong cùng một bác tài.
  const dup = await prisma.transportRoute.findFirst({
    where: {
      serviceId,
      ...(id ? { id: { not: id } } : {}),
      OR: [{ fromPointId, toPointId }, { fromPointId: toPointId, toPointId: fromPointId }],
    },
    select: { id: true },
  });
  if (dup) return { error: "Chặng này (hoặc chiều ngược lại) đã có — sửa ở dòng đã có." };
  const data = { fromPointId, toPointId, priceOneWay, priceTwo, note: s(formData.get("note"))?.slice(0, 200) ?? null, sortOrder: num(formData.get("sortOrder")) ?? 0 };
  try {
    if (id) await prisma.transportRoute.update({ where: { id }, data });
    else {
      const count = await prisma.transportRoute.count({ where: { serviceId } });
      await prisma.transportRoute.create({ data: { serviceId, ...data, sortOrder: data.sortOrder || count + 1 } });
    }
  } catch {
    return { error: "Lưu chặng thất bại." };
  }
  revalidatePath(`/admin/services/${serviceId}`);
  return { ok: true, message: id ? "Đã lưu chặng" : "Đã thêm chặng" };
}

export async function deleteTransportRoute(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = s(formData.get("id"));
  const serviceId = s(formData.get("serviceId"));
  if (id) await prisma.transportRoute.delete({ where: { id } }).catch(() => {});
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
}
