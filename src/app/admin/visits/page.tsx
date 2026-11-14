import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getVisitStats, geoForIps, type GeoInfo } from "@/lib/visits";
import { describePath, deviceLabel, regionLabel } from "@/lib/track-labels";
import { VisitStatsCards } from "@/components/admin/VisitStatsCards";

export const dynamic = "force-dynamic";

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const RANGES: Record<string, { label: string; ms: number | null }> = {
  "24h": { label: "24 giờ", ms: 24 * 3600_000 },
  "7d": { label: "7 ngày", ms: 7 * 24 * 3600_000 },
  "30d": { label: "30 ngày", ms: 30 * 24 * 3600_000 },
  all: { label: "Tất cả", ms: null },
};

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

function ago(d: Date, now: number): string {
  const m = Math.max(0, Math.round((now - d.getTime()) / 60000));
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  if (m < 1440) return `${Math.round(m / 60)} giờ trước`;
  return `${Math.round(m / 1440)} ngày trước`;
}

/** Bản đồ nhúng OpenStreetMap có ghim tại toạ độ (không cần API key). */
function osmEmbed(lat: number, lng: number): string {
  const d = 0.006;
  const bbox = [lng - d, lat - d * 0.6, lng + d, lat + d * 0.6].map((n) => n.toFixed(5)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Địa chỉ Nominatim rất dài — lấy 3 phần đầu cho dòng tóm tắt. */
function shortAddr(a: string): string {
  return a.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3).join(", ");
}

interface VisitRow {
  path: string;
  createdAt: Date;
}
interface Group {
  visitorId: string;
  first: Date;
  last: Date;
  ip: string | null;
  ua: string | null;
  customerName: string | null;
  referrer: string | null;
  items: VisitRow[];
}

export default async function AdminVisitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rangeKey = str(sp.range) && RANGES[str(sp.range)!] ? str(sp.range)! : "7d";
  const q = (str(sp.q) ?? "").trim();
  const whoRaw = str(sp.who);
  const who: "all" | "user" | "gps" = whoRaw === "user" ? "user" : whoRaw === "gps" ? "gps" : "all";
  const now = Date.now();
  const rangeMs = RANGES[rangeKey].ms;
  const since = rangeMs ? new Date(now - rangeMs) : undefined;

  // Lọc "Có vị trí GPS": khách đã cho phép chia sẻ vị trí.
  const gpsIds =
    who === "gps"
      ? (await prisma.visitor.findMany({ where: { lat: { not: null } }, select: { id: true }, take: 5000 })).map((v) => v.id)
      : null;

  const where: Prisma.PageViewWhereInput = {
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(q ? { path: { contains: q, mode: "insensitive" } } : {}),
    ...(who === "user" ? { customerId: { not: null } } : {}),
    ...(gpsIds ? { visitorId: { in: gpsIds } } : {}),
  };

  const [stats, views, viewsRange, visitorsGrouped] = await Promise.all([
    getVisitStats(),
    prisma.pageView.findMany({ where, orderBy: { createdAt: "desc" }, take: 2000 }),
    prisma.pageView.count({ where }),
    prisma.pageView.groupBy({ by: ["visitorId"], where }),
  ]);

  // Gom theo khách (visitorId) — views đã sắp mới→cũ nên lần gặp đầu là mới nhất.
  const groups = new Map<string, Group>();
  for (const v of views) {
    let g = groups.get(v.visitorId);
    if (!g) {
      g = {
        visitorId: v.visitorId,
        first: v.createdAt,
        last: v.createdAt,
        ip: v.ip,
        ua: v.userAgent,
        customerName: v.customerName,
        referrer: v.referrer,
        items: [],
      };
      groups.set(v.visitorId, g);
    }
    g.items.push({ path: v.path, createdAt: v.createdAt });
    if (v.createdAt < g.first) g.first = v.createdAt;
    if (!g.customerName && v.customerName) g.customerName = v.customerName;
    if (!g.ip && v.ip) g.ip = v.ip;
    if (!g.referrer && v.referrer) g.referrer = v.referrer;
  }
  const list = [...groups.values()].slice(0, 120);

  const [geo, locRows] = await Promise.all([
    geoForIps(list.map((g) => g.ip).filter((x): x is string => Boolean(x))),
    prisma.visitor.findMany({
      where: { id: { in: list.map((g) => g.visitorId) }, lat: { not: null } },
      select: { id: true, lat: true, lng: true, locAccuracy: true, locAddress: true, locAt: true },
    }),
  ]);
  const locs = new Map(locRows.map((l) => [l.id, l]));

  const rangeTabs = Object.entries(RANGES);

  function buildHref(next: { range?: string; who?: string }): string {
    const p = new URLSearchParams();
    p.set("range", next.range ?? rangeKey);
    const w = next.who ?? who;
    if (w !== "all") p.set("who", w);
    if (q) p.set("q", q);
    return `/admin/visits?${p.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Lượt truy cập</h1>
        <p className="mt-1 text-sm text-gray-500">
          Lịch sử khách vào website: trang nào, lúc nào, từ IP &amp; khu vực nào. Số liệu cập nhật khi tải lại trang.
          Khu vực là nơi đăng ký của nhà mạng (thường ghi Hà Nội / TP.HCM), không phải vị trí thật của khách.
        </p>
      </header>

      <VisitStatsCards initial={stats} />

      {/* Bộ lọc */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">Khoảng thời gian:</span>
          {rangeTabs.map(([key, r]) => {
            const on = rangeKey === key;
            return (
              <a
                key={key}
                href={buildHref({ range: key })}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${on ? "bg-forest-600 text-white ring-forest-600" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"}`}
              >
                {r.label}
              </a>
            );
          })}
          <span className="mx-1 h-4 w-px bg-gray-200" />
          <a
            href={buildHref({ who: "all" })}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${who === "all" ? "bg-forest-600 text-white ring-forest-600" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"}`}
          >
            Tất cả khách
          </a>
          <a
            href={buildHref({ who: "user" })}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${who === "user" ? "bg-forest-600 text-white ring-forest-600" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"}`}
          >
            Đã đăng nhập
          </a>
          <a
            href={buildHref({ who: "gps" })}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${who === "gps" ? "bg-forest-600 text-white ring-forest-600" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"}`}
          >
            📍 Có vị trí GPS
          </a>
        </div>
        <form method="get" className="flex flex-wrap gap-2">
          <input type="hidden" name="range" value={rangeKey} />
          {who !== "all" && <input type="hidden" name="who" value={who} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Lọc theo đường dẫn (VD: homestay, xe-cabin)…"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <button className="rounded-xl bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">Lọc</button>
          {q && (
            <a href={buildHref({})} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Xoá lọc
            </a>
          )}
        </form>
      </div>

      <p className="text-sm text-gray-500">
        <b className="text-ink">{viewsRange.toLocaleString("vi-VN")}</b> lượt xem từ{" "}
        <b className="text-ink">{visitorsGrouped.length.toLocaleString("vi-VN")}</b> khách trong khoảng đã chọn
        {list.length < visitorsGrouped.length ? ` · hiển thị ${list.length} khách gần nhất` : ""}.
      </p>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center text-gray-500">
          Chưa có lượt truy cập nào trong khoảng này.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((g) => {
            const gi: GeoInfo | undefined = g.ip ? geo.get(g.ip) : undefined;
            const loc = locs.get(g.visitorId);
            return (
              <details key={g.visitorId} className="group rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-forest-100 text-sm font-bold text-forest-700">
                    {(g.customerName ?? "K").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <b className="text-ink">{g.customerName ?? "Khách ẩn danh"}</b>
                      <span className="text-xs text-gray-400">#{g.visitorId.slice(0, 8)}</span>
                      <span className="rounded-full bg-forest-50 px-2 py-0.5 text-xs font-semibold text-forest-700">
                        {g.items.length} trang
                      </span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-gray-500">
                      {loc ? (
                        <span className="rounded-full bg-forest-50 px-2 py-0.5 font-semibold text-forest-700">
                          📍 GPS: {loc.locAddress ? shortAddr(loc.locAddress) : `${loc.lat!.toFixed(5)}, ${loc.lng!.toFixed(5)}`}
                        </span>
                      ) : (
                        <span title="Theo IP — chỉ là nơi đăng ký của nhà mạng">🌐 {regionLabel(gi)}</span>
                      )}
                      {g.ip && <span className="font-mono text-gray-400">{g.ip}</span>}
                      {g.ip && (
                        <a href={`/admin/ip-block?ip=${encodeURIComponent(g.ip)}`} className="font-semibold text-red-600 hover:underline">
                          Chặn IP
                        </a>
                      )}
                      <span>· {deviceLabel(g.ua)}</span>
                    </span>
                  </span>
                  <span className="flex-none text-right text-xs text-gray-400">
                    <span className="block font-semibold text-gray-600">{ago(g.last, now)}</span>
                    <span className="block">{gi?.isp ?? ""}</span>
                  </span>
                </summary>

                <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                  {loc && (
                    <div className="mb-3 overflow-hidden rounded-xl ring-1 ring-gray-200">
                      <iframe
                        title={`Vị trí khách ${g.visitorId.slice(0, 8)}`}
                        src={osmEmbed(loc.lat!, loc.lng!)}
                        loading="lazy"
                        className="h-64 w-full border-0"
                      />
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        <span className="min-w-0 flex-1">
                          <b className="text-ink">Vị trí thật (khách cho phép):</b> {loc.locAddress ?? "—"}
                          {loc.locAccuracy != null && <> · sai số ±{Math.round(loc.locAccuracy)} m</>}
                          {loc.locAt && <> · {fmtTime(loc.locAt)}</>}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-forest-700 underline"
                        >
                          Mở Google Maps
                        </a>
                      </div>
                    </div>
                  )}
                  {g.referrer && (
                    <div className="mb-2 text-xs text-gray-500">
                      Nguồn vào: <span className="break-all text-gray-700">{g.referrer}</span>
                    </div>
                  )}
                  <ol className="flex flex-col gap-1.5">
                    {[...g.items].reverse().map((it, i) => (
                      <li key={i} className="flex items-baseline gap-3 text-sm">
                        <span className="w-24 flex-none whitespace-nowrap font-mono text-xs text-gray-400">
                          {fmtTime(it.createdAt)}
                        </span>
                        <span className="min-w-0">
                          <span className="font-semibold text-ink">{describePath(it.path)}</span>
                          <span className="ml-2 break-all text-xs text-gray-400">{it.path}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
