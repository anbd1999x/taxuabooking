// Kiểu dữ liệu & bộ chuyển đổi cho quán (Place) — module thuần, KHÔNG "use server"
// (file server action chỉ được export hàm async; toDTO là hàm đồng bộ nên tách ra đây).

/** Dữ liệu một quán gửi lên từ form sửa (slide-over). */
export interface PlaceInput {
  id?: string;
  kind: string; // "RESTAURANT" | "CAFE" | "CHECKIN"
  name: string;
  slug?: string;
  area: string;
  address?: string;
  phone?: string;
  zalo?: string;
  price?: string;
  open?: string; // HH:MM
  close?: string; // HH:MM
  hoursWeekend?: string; // HH:MM mở sớm cuối tuần
  booking?: string; // "no" | "call" | "group"
  tags?: string[];
  desc?: string;
  tip?: string;
  content?: string;
  coverImage?: string;
  images?: string[];
  mapUrl?: string;
  latLng?: string; // toạ độ "vĩ độ, kinh độ" admin nhập tay; để trống = tự lấy từ link Google Maps
  sortOrder?: number;
  published?: boolean;
}

/** Bản ghi quán trả về client (mọi giá trị chuỗi/số thuần, dễ serialize). */
export interface PlaceDTO {
  id: string;
  kind: string;
  slug: string;
  name: string;
  area: string;
  address: string;
  phone: string;
  zalo: string;
  price: string;
  hours: string;
  hoursWeekend: string;
  booking: string;
  tags: string[];
  desc: string;
  tip: string;
  content: string;
  coverImage: string;
  images: string[];
  mapUrl: string;
  lat: number | null; // toạ độ thật (bản đồ check-in)
  lng: number | null;
  sortOrder: number;
  published: boolean;
  updatedAt: number;
}

export function toDTO(p: {
  id: string; kind: string; slug: string | null; name: string; area: string;
  address: string | null; phone: string | null; zalo: string | null; price: string | null;
  hours: string | null; hoursWeekend: string | null; booking: string | null; tags: string | null;
  desc: string | null; tip: string | null; content: string | null; coverImage: string | null; images: string | null;
  mapUrl: string | null; lat: number | null; lng: number | null; sortOrder: number; published: boolean; updatedAt: Date;
}): PlaceDTO {
  return {
    id: p.id,
    kind: p.kind,
    slug: p.slug ?? "",
    name: p.name,
    area: p.area,
    address: p.address ?? "",
    phone: p.phone ?? "",
    zalo: p.zalo ?? "",
    price: p.price ?? "",
    hours: p.hours ?? "",
    hoursWeekend: p.hoursWeekend ?? "",
    booking: p.booking ?? "",
    tags: (p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    desc: p.desc ?? "",
    tip: p.tip ?? "",
    content: p.content ?? "",
    coverImage: p.coverImage ?? "",
    images: (p.images ?? "").split("|").map((s) => s.trim()).filter(Boolean),
    mapUrl: p.mapUrl ?? "",
    lat: p.lat,
    lng: p.lng,
    sortOrder: p.sortOrder,
    published: p.published,
    updatedAt: p.updatedAt.getTime(),
  };
}
