import "server-only";
import { prisma } from "@/lib/prisma";
import { TARGET_LOCALES, type TargetLocale } from "./config";
import { hashSource } from "./server";

/**
 * Gom các trường nội dung CẦN DỊCH của 1 bản ghi (dịch vụ / bài viết / địa điểm) cho trang
 * /admin/translations. Khi hiển thị, web tra bản dịch theo CHUỖI GỐC (xem server.ts) nên một cụm đã dịch
 * ở bản ghi này (vd khu vực "Đỉnh Gió") tự áp dụng cho mọi nơi khác có đúng cụm đó.
 */
export interface TrField {
  entity: string;
  entityId: string;
  field: string;
  label: string;
  source: string;
  /** Bản dịch hiện có theo từng ngôn ngữ (đã lưu cho đúng trường này, hoặc gợi ý từ cụm trùng ở nơi khác). */
  values: Record<TargetLocale, string>;
  /** Nội dung gốc đã đổi sau lần dịch gần nhất ⇒ bản dịch cũ đang KHÔNG hiển thị, cần xem & lưu lại. */
  stale: boolean;
}
export interface TrGroup {
  title: string;
  fields: TrField[];
}

type Raw = { entity: string; entityId: string; field: string; label: string; source: string | null | undefined };

/** Cụm từ tự do / mục trong danh sách phân tách dấu phẩy: định danh theo hash của chính chuỗi gốc. */
export function phraseId(source: string): string {
  return hashSource(source.trim()).slice(0, 20);
}
function phrases(label: string, list: string | null | undefined, sep: RegExp = /,/): Raw[] {
  return (list ?? "")
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => ({ entity: "Phrase", entityId: phraseId(x), field: "text", label, source: x }));
}

async function hydrate(groups: { title: string; raws: Raw[] }[]): Promise<TrGroup[]> {
  const all = groups.flatMap((g) => g.raws).filter((r) => r.source && r.source.trim());
  const sources = [...new Set(all.map((r) => r.source!.trim()))];
  const [own, bySource] = await Promise.all([
    prisma.translation.findMany({ where: { OR: all.map((r) => ({ entity: r.entity, entityId: r.entityId, field: r.field })) } }),
    prisma.translation.findMany({ where: { sourceHash: { in: sources.map(hashSource) } } }),
  ]);
  const seen = new Set<string>();
  return groups
    .map((g) => ({
      title: g.title,
      fields: g.raws
        .filter((r) => r.source && r.source.trim())
        .filter((r) => {
          // cùng 1 cụm (Phrase) lặp lại trong trang → chỉ hiện 1 lần
          const k = `${r.entity}|${r.entityId}|${r.field}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((r) => {
          const source = r.source!.trim();
          const mine = own.filter((t) => t.entity === r.entity && t.entityId === r.entityId && t.field === r.field);
          const values = Object.fromEntries(
            TARGET_LOCALES.map((l) => [
              l,
              mine.find((t) => t.locale === l)?.value ?? bySource.find((t) => t.locale === l && t.source === source)?.value ?? "",
            ]),
          ) as Record<TargetLocale, string>;
          return { entity: r.entity, entityId: r.entityId, field: r.field, label: r.label, source, values, stale: mine.some((t) => t.source !== source) };
        }),
    }))
    .filter((g) => g.fields.length > 0);
}

export async function collectService(id: string): Promise<TrGroup[] | null> {
  const s = await prisma.service.findUnique({
    where: { id },
    include: {
      roomTypes: { orderBy: { sortOrder: "asc" }, include: { rooms: { orderBy: { sortOrder: "asc" } } } },
      rentalVehicles: true,
      transport: true,
      cabinRoutes: { include: { stops: { orderBy: { sortOrder: "asc" } } } },
      cabinPriceRows: true,
    },
  });
  if (!s) return null;
  const f = (entity: string, entityId: string, field: string, label: string, source: string | null | undefined): Raw => ({ entity, entityId, field, label, source });
  const groups: { title: string; raws: Raw[] }[] = [
    {
      title: "Thông tin dịch vụ",
      raws: [
        f("Service", s.id, "title", "Tên", s.title),
        f("Service", s.id, "summary", "Mô tả ngắn", s.summary),
        f("Service", s.id, "description", "Mô tả chi tiết", s.description),
        f("Service", s.id, "area", "Khu vực / tuyến", s.area),
        f("Service", s.id, "policy", "Chính sách", s.policy),
      ],
    },
  ];
  for (const rt of s.roomTypes) {
    groups.push({
      title: `Hạng phòng: ${rt.name}`,
      raws: [
        f("RoomType", rt.id, "name", "Tên hạng phòng", rt.name),
        ...rt.rooms.flatMap((r) => [
          f("Room", r.id, "name", "Tên phòng", r.name),
          f("Room", r.id, "description", `Mô tả phòng ${r.name}`, r.description),
          ...phrases("Tiện ích", r.amenities),
        ]),
      ],
    });
  }
  if (s.rentalVehicles.length) {
    groups.push({ title: "Xe cho thuê", raws: s.rentalVehicles.flatMap((v) => [f("RentalVehicle", v.id, "vehicleType", "Loại xe", v.vehicleType), ...v.colors.flatMap((c) => phrases("Màu xe", c))]) });
  }
  if (s.transport) {
    const tp = s.transport;
    groups.push({
      title: "Tuyến xe ôm / taxi",
      raws: [
        f("TransportInfo", tp.id, "fromPoint", "Điểm đón", tp.fromPoint),
        f("TransportInfo", tp.id, "toArea", "Điểm đến / khu vực", tp.toArea),
        f("TransportInfo", tp.id, "vehicleType", "Loại xe", tp.vehicleType),
        f("TransportInfo", tp.id, "priceNote", "Ghi chú giá", tp.priceNote),
      ],
    });
  }
  for (const r of s.cabinRoutes) {
    groups.push({
      title: `Lộ trình cabin (${r.direction === "RETURN" ? "chiều về" : "chiều đi"})`,
      raws: [
        f("CabinRoute", r.id, "title", "Tagline", r.title),
        f("CabinRoute", r.id, "totalTime", "Tổng thời gian", r.totalTime),
        f("CabinRoute", r.id, "startLabel", "Nhãn khởi hành", r.startLabel),
        f("CabinRoute", r.id, "startInfo", "Thông tin khởi hành", r.startInfo),
        f("CabinRoute", r.id, "fromPoint", "Điểm đón", r.fromPoint),
        f("CabinRoute", r.id, "toPoint", "Điểm trả", r.toPoint),
        ...r.stops.flatMap((st) => [
          f("CabinRouteStop", st.id, "place", `Điểm dừng ${st.time}`, st.place),
          f("CabinRouteStop", st.id, "note", `Ghi chú ${st.time}`, st.note),
          f("CabinRouteStop", st.id, "tag", `Nhãn ${st.time}`, st.tag),
        ]),
      ],
    });
  }
  if (s.cabinPriceRows.length) {
    groups.push({
      title: "Bảng giá chặng",
      raws: s.cabinPriceRows.flatMap((p) => [
        f("CabinPriceRow", p.id, "pickupPoint", "Điểm đón", p.pickupPoint),
        f("CabinPriceRow", p.id, "destination", "Điểm đến", p.destination),
        f("CabinPriceRow", p.id, "note", "Ghi chú", p.note),
      ]),
    });
  }
  return hydrate(groups);
}

export async function collectArticle(id: string): Promise<TrGroup[] | null> {
  const a = await prisma.article.findUnique({ where: { id } });
  if (!a) return null;
  return hydrate([
    {
      title: "Bài viết",
      raws: [
        { entity: "Article", entityId: a.id, field: "title", label: "Tiêu đề", source: a.title },
        { entity: "Article", entityId: a.id, field: "excerpt", label: "Tóm tắt", source: a.excerpt },
        { entity: "Article", entityId: a.id, field: "content", label: "Nội dung (markdown)", source: a.content },
      ],
    },
  ]);
}

export async function collectPlace(id: string): Promise<TrGroup[] | null> {
  const p = await prisma.place.findUnique({ where: { id } });
  if (!p) return null;
  const f = (field: string, label: string, source: string | null | undefined): Raw => ({ entity: "Place", entityId: p.id, field, label, source });
  return hydrate([
    {
      title: "Địa điểm",
      raws: [
        f("name", "Tên", p.name),
        f("area", "Khu vực", p.area),
        f("address", "Địa chỉ", p.address),
        f("price", "Giá", p.price),
        f("desc", "Mô tả ngắn", p.desc),
        f("tip", "Mẹo", p.tip),
        f("content", "Mô tả chi tiết (markdown)", p.content?.trim()),
        ...phrases("Đặc điểm", p.tags),
      ],
    },
  ]);
}

/** Cụm từ tự do admin đã thêm (không gắn bản ghi nào) — vd chữ trong lịch trình mẫu, popup uy tín, điểm đón. */
export async function collectPhrases(): Promise<TrGroup[]> {
  const rows = await prisma.translation.findMany({ where: { entity: "Phrase" }, orderBy: { source: "asc" } });
  const sources = [...new Set(rows.map((r) => r.source))];
  return hydrate([{ title: "Cụm từ đã dịch", raws: sources.map((x) => ({ entity: "Phrase", entityId: phraseId(x), field: "text", label: "Cụm từ", source: x })) }]);
}

/** Số trường đã có bản dịch còn hiệu lực / tổng số trường — để hiện tiến độ. */
export function progress(groups: TrGroup[]): { done: number; total: number } {
  const fields = groups.flatMap((g) => g.fields);
  return { done: fields.filter((x) => !x.stale && TARGET_LOCALES.every((l) => x.values[l].trim())).length, total: fields.length };
}
