import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "./prisma";
import { sniffImage } from "./media";

/**
 * TÌM HOMESTAY THEO ẢNH (CLIP). Mỗi ảnh được đổi thành một vector 512 chiều (đã chuẩn hoá) bởi dịch vụ nội bộ
 * `embedder/` (container riêng, mô hình thường trực trong RAM). Hai ảnh càng giống nhau về khung cảnh / kiểu phòng
 * / màu sắc thì tích vô hướng (cosine) càng gần 1.
 *
 * - Ảnh đã đăng (ServiceImage / RoomTypeImage / RoomImage của homestay đang hiện) được tính SẴN bằng
 *   `indexImageEmbeddings` (tác vụ nền trong instrumentation) → bảng `ImageEmbedding`.
 * - Khách tải ảnh lên → `searchByImage`: tính vector ảnh khách rồi so với toàn bộ vector trong bộ nhớ
 *   (vài nghìn ảnh ⇒ < 10ms), gom điểm theo homestay và theo phòng.
 */

const EMBEDDER_URL = (process.env.EMBEDDER_URL || "http://127.0.0.1:8790").replace(/\/$/, "");
const DIM = 512;
/** Ảnh gửi sang embedder được thu nhỏ về cạnh dài này (CLIP chỉ nhìn 224px). */
const PREP_SIDE = 384;
const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogg|mkv|avi)(\?|$)/i;

export class ImageSearchUnavailable extends Error {}
export class BadImage extends Error {}

/** Giải mã + thu nhỏ ảnh (chỉ ảnh raster — nhận diện bằng magic bytes, không tin MIME). */
export async function prepImage(buf: Buffer): Promise<Buffer> {
  const kind = sniffImage(buf);
  if (!kind) throw new BadImage("not an image");
  try {
    const pipe = sharp(buf, { failOn: "none" }).rotate();
    const meta = await pipe.metadata();
    if (!meta.format || !["jpeg", "png", "gif", "webp", "tiff", "heif", "avif"].includes(meta.format)) throw new BadImage("format");
    return await pipe.resize(PREP_SIDE, PREP_SIDE, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer();
  } catch (e) {
    if (e instanceof BadImage) throw e;
    throw new BadImage("decode");
  }
}

/** Gọi embedder: ảnh (đã prep) → vector chuẩn hoá. Embedder không chạy ⇒ ImageSearchUnavailable. */
async function embed(jpeg: Buffer): Promise<{ vec: Float32Array; model: string; relevant: number; kind: string }> {
  let res: Response;
  try {
    res = await fetch(`${EMBEDDER_URL}/embed`, {
      method: "POST",
      body: new Uint8Array(jpeg),
      headers: { "content-type": "application/octet-stream" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ImageSearchUnavailable("embedder unreachable");
  }
  if (res.status === 422 || res.status === 400) throw new BadImage("embedder rejected");
  if (!res.ok) throw new ImageSearchUnavailable(`embedder ${res.status}`);
  const j = (await res.json()) as { vec?: number[]; model?: string; relevant?: number; kind?: string };
  if (!Array.isArray(j.vec) || j.vec.length !== DIM) throw new ImageSearchUnavailable("bad vector");
  // Embedder cũ chưa phân loại ⇒ coi như liên quan (không chặn nhầm).
  return { vec: Float32Array.from(j.vec), model: String(j.model ?? ""), relevant: typeof j.relevant === "number" ? j.relevant : 1, kind: String(j.kind ?? "room") };
}

async function embedderModel(): Promise<string | null> {
  try {
    const r = await fetch(`${EMBEDDER_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { model?: string };
    return j.model || null;
  } catch {
    return null;
  }
}

const toBytes = (v: Float32Array): Uint8Array<ArrayBuffer> => new Uint8Array(v.slice().buffer);
function fromBytes(b: Uint8Array): Float32Array | null {
  if (b.byteLength !== DIM * 4) return null;
  const copy = new Uint8Array(b); // căn lề 4 byte cho Float32Array
  return new Float32Array(copy.buffer);
}
function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < DIM; i++) s += a[i] * b[i];
  return s;
}

// ---------------------------------------------------------------------------------------------
// Chỉ mục trong bộ nhớ (mỗi tiến trình app một bản) — nạp lại khi bảng đổi, kiểm tối đa 60 giây/lần.
// ---------------------------------------------------------------------------------------------

type Row = { serviceId: string; roomTypeId: string | null; roomId: string | null; source: string; url: string; vec: Float32Array };
type Index = {
  sig: string;
  rows: Row[];
  /** homestay đang hiện: id → slug + danh sách phòng (roomId → roomTypeId) */
  homes: Map<string, { slug: string; rooms: { id: string; roomTypeId: string }[] }>;
};
let cache: { at: number; built: number; idx: Index } | null = null;
let loadingIdx: Promise<Index> | null = null;

async function currentSig(): Promise<string> {
  const [agg, svc] = await Promise.all([
    prisma.imageEmbedding.aggregate({ _count: { _all: true }, _max: { createdAt: true } }),
    prisma.service.aggregate({ where: { category: "HOMESTAY", published: true }, _count: { _all: true }, _max: { updatedAt: true } }),
  ]);
  return [agg._count._all, agg._max.createdAt?.getTime() ?? 0, svc._count._all, svc._max.updatedAt?.getTime() ?? 0].join(":");
}

async function buildIndex(sig: string): Promise<Index> {
  const [emb, services] = await Promise.all([
    prisma.imageEmbedding.findMany({ select: { serviceId: true, roomTypeId: true, roomId: true, source: true, url: true, vec: true } }),
    prisma.service.findMany({
      where: { category: "HOMESTAY", published: true },
      select: { id: true, slug: true, roomTypes: { select: { id: true, rooms: { select: { id: true } } } } },
    }),
  ]);
  const homes = new Map<string, { slug: string; rooms: { id: string; roomTypeId: string }[] }>();
  for (const s of services) homes.set(s.id, { slug: s.slug, rooms: s.roomTypes.flatMap((rt) => rt.rooms.map((r) => ({ id: r.id, roomTypeId: rt.id }))) });
  const rows: Row[] = [];
  for (const e of emb) {
    if (!homes.has(e.serviceId)) continue;
    const vec = fromBytes(e.vec);
    if (vec) rows.push({ serviceId: e.serviceId, roomTypeId: e.roomTypeId, roomId: e.roomId, source: e.source, url: e.url, vec });
  }
  return { sig, rows, homes };
}

async function getIndex(): Promise<Index> {
  if (cache && Date.now() - cache.at < 60_000) return cache.idx;
  if (!loadingIdx) {
    loadingIdx = (async () => {
      const sig = await currentSig();
      // Dựng lại khi bảng đổi, hoặc 10 phút/lần (danh sách phòng của nhà có thể đổi mà không chạm Service.updatedAt).
      const reuse = cache && cache.idx.sig === sig && Date.now() - cache.built < 10 * 60_000;
      const idx = reuse ? cache!.idx : await buildIndex(sig);
      cache = { at: Date.now(), built: reuse ? cache!.built : Date.now(), idx };
      return idx;
    })().finally(() => {
      loadingIdx = null;
    });
  }
  return loadingIdx;
}

export type ImageHit = { s: number; url: string };
export type ImageSearchResult = {
  /** theo slug homestay: ảnh giống nhất của cả nhà */
  homes: Record<string, ImageHit>;
  /** theo roomId: ảnh giống nhất của phòng (ảnh riêng phòng / ảnh hạng phòng; thiếu thì ảnh của nhà, hạ điểm nhẹ) */
  rooms: Record<string, ImageHit>;
  indexed: number;
  /** Ảnh khách được nhận ra là gì: room | scenery | food | vehicle | person | screen | other */
  kind: string;
  /** Không có kết quả vì: ảnh không phải phòng / nhà / phong cảnh (unrelated) hoặc không nhà nào đủ giống (nomatch). */
  reason?: "unrelated" | "nomatch";
};

/** Xác suất "ảnh lưu trú / phong cảnh" tối thiểu (đo thật: ảnh home ≥ 0,75; xe / món ăn / chữ ≤ 0,3). */
const MIN_RELEVANT = 0.5;
/** Điểm giống tối thiểu để coi là "giống" (cosine ảnh–ảnh; ảnh không liên quan thường 0,55–0,7). */
const MIN_SIM = 0.72;
/** Chỉ giữ kết quả cách ảnh giống nhất không quá khoảng này — tránh kéo theo cả danh sách na ná. */
const MAX_GAP = 0.07;

/** Ảnh nhà không chắc chụp đúng phòng này ⇒ phòng chỉ có ảnh chung của nhà được hạ điểm nhẹ. */
const HOME_ONLY_FACTOR = 0.97;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export async function searchByImage(buf: Buffer): Promise<ImageSearchResult> {
  const jpeg = await prepImage(buf);
  const [{ vec: q, relevant, kind }, idx] = await Promise.all([embed(jpeg), getIndex()]);
  if (relevant < MIN_RELEVANT) return { homes: {}, rooms: {}, indexed: idx.rows.length, kind, reason: "unrelated" };

  const bestHome = new Map<string, ImageHit>();
  const bestRoomType = new Map<string, ImageHit>();
  const bestRoom = new Map<string, ImageHit>();
  const better = (m: Map<string, ImageHit>, k: string, hit: ImageHit) => {
    const cur = m.get(k);
    if (!cur || hit.s > cur.s) m.set(k, hit);
  };
  for (const r of idx.rows) {
    const hit = { s: dot(q, r.vec), url: r.url };
    better(bestHome, r.serviceId, hit);
    if (r.roomId) better(bestRoom, r.roomId, hit);
    else if (r.roomTypeId) better(bestRoomType, r.roomTypeId, hit);
  }

  const homes: Record<string, ImageHit> = {};
  const rooms: Record<string, ImageHit> = {};
  const roomHome: Record<string, string> = {}; // roomId → slug nhà
  for (const [sid, h] of idx.homes) {
    const hb = bestHome.get(sid);
    if (!hb) continue;
    homes[h.slug] = { s: round3(hb.s), url: hb.url };
    for (const room of h.rooms) {
      roomHome[room.id] = h.slug;
      const own = bestRoom.get(room.id);
      const typ = bestRoomType.get(room.roomTypeId);
      const pick = own && typ ? (own.s >= typ.s ? own : typ) : (own ?? typ);
      rooms[room.id] = pick ? { s: round3(pick.s), url: pick.url } : { s: round3(hb.s * HOME_ONLY_FACTOR), url: hb.url };
    }
  }
  // Chỉ giữ kết quả đủ giống: ≥ MIN_SIM và không kém ảnh giống nhất quá MAX_GAP (tính riêng cho nhà / phòng).
  const keep = (m: Record<string, ImageHit>) => {
    const top = Math.max(0, ...Object.values(m).map((x) => x.s));
    const cut = Math.max(MIN_SIM, top - MAX_GAP);
    return Object.fromEntries(Object.entries(m).filter(([, x]) => x.s >= cut));
  };
  const keptHomes = keep(homes);
  // Phòng chỉ xét trong các nhà đã giữ (không để phòng của nhà kém giống lọt vào chế độ "Theo phòng").
  const keptRooms = keep(Object.fromEntries(Object.entries(rooms).filter(([id]) => keptHomes[roomHome[id]])));
  const none = !Object.keys(keptHomes).length;
  return { homes: keptHomes, rooms: none ? {} : keptRooms, indexed: idx.rows.length, kind, ...(none ? { reason: "nomatch" as const } : {}) };
}

// ---------------------------------------------------------------------------------------------
// Tác vụ nền: tính vector cho ảnh homestay chưa có (hoặc tính bằng mô hình cũ), dọn dòng mồ côi.
// ---------------------------------------------------------------------------------------------

type Src = { imageId: string; source: "service" | "roomType" | "room"; serviceId: string; roomTypeId: string | null; roomId: string | null; url: string };

async function listSources(): Promise<Src[]> {
  const svcWhere = { category: { in: ["HOMESTAY" as const, "BUNGALOW" as const] }, published: true };
  const [si, rti, ri] = await Promise.all([
    prisma.serviceImage.findMany({ where: { service: svcWhere }, select: { id: true, url: true, serviceId: true } }),
    prisma.roomTypeImage.findMany({ where: { type: "image", roomType: { service: svcWhere } }, select: { id: true, url: true, roomTypeId: true, roomType: { select: { serviceId: true } } } }),
    prisma.roomImage.findMany({ where: { room: { roomType: { service: svcWhere } } }, select: { id: true, url: true, roomId: true, room: { select: { roomTypeId: true, roomType: { select: { serviceId: true } } } } } }),
  ]);
  const out: Src[] = [
    ...si.map((x) => ({ imageId: x.id, source: "service" as const, serviceId: x.serviceId, roomTypeId: null, roomId: null, url: x.url })),
    ...rti.map((x) => ({ imageId: x.id, source: "roomType" as const, serviceId: x.roomType.serviceId, roomTypeId: x.roomTypeId, roomId: null, url: x.url })),
    ...ri.map((x) => ({ imageId: x.id, source: "room" as const, serviceId: x.room.roomType.serviceId, roomTypeId: x.room.roomTypeId, roomId: x.roomId, url: x.url })),
  ];
  return out.filter((x) => x.url && !VIDEO_RE.test(x.url));
}

async function fetchCapped(url: string, max = 15 * 1024 * 1024): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length > max ? null : b;
  } catch {
    return null;
  }
}

/** Đọc bytes ảnh: /uploads/* đọc thẳng từ ổ đĩa (thiếu — vd máy dev — thì lấy bản thu nhỏ từ website); http(s) thì tải về. */
async function loadImageBytes(url: string): Promise<Buffer | null> {
  if (url.startsWith("/uploads/")) {
    const rel = url.split(/[?#]/)[0];
    const root = path.join(process.cwd(), "public", "uploads");
    const file = path.normalize(path.join(process.cwd(), "public", decodeURIComponent(rel)));
    if (file.startsWith(root + path.sep)) {
      const b = await readFile(file).catch(() => null);
      if (b) return b;
    }
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://taxuabooking.com").replace(/\/$/, "");
    if (/localhost|127\.0\.0\.1/.test(site)) return null;
    // /uploads do nginx phục vụ thẳng (không qua bộ tối ưu ảnh của Next) ⇒ tải bản gốc.
    return fetchCapped(`${site}${rel}`);
  }
  if (/^https?:\/\//i.test(url)) return fetchCapped(url);
  return null;
}

/**
 * Tính vector cho tối đa `limit` ảnh còn thiếu (ảnh lỗi được thử lại sau 7 ngày). Ảnh hỏng / không tải được ⇒ lưu vector rỗng (không thử lại mãi;
 * ảnh nguồn đổi id khi upload lại). Embedder không chạy ⇒ dừng êm, lần sau làm tiếp.
 */
export async function indexImageEmbeddings(opts: { limit?: number; log?: (m: string) => void } = {}): Promise<{ done: number; failed: number; left: number; removed: number; skipped?: string }> {
  const log = opts.log ?? (() => {});
  const model = await embedderModel();
  if (!model) return { done: 0, failed: 0, left: 0, removed: 0, skipped: "embedder không chạy" };

  const [sources, existing, staleFailed] = await Promise.all([
    listSources(),
    prisma.imageEmbedding.findMany({ select: { imageId: true, model: true, url: true } }),
    prisma.$queryRaw<{ imageId: string }[]>`SELECT "imageId" FROM "ImageEmbedding" WHERE length(vec) = 0 AND "createdAt" < now() - interval '7 days'`,
  ]);
  const retry = new Set(staleFailed.map((r) => r.imageId));
  const have = new Map(existing.map((e) => [e.imageId, e]));
  const wanted = new Set(sources.map((s) => s.imageId));
  const orphans = existing.filter((e) => !wanted.has(e.imageId)).map((e) => e.imageId);
  if (orphans.length) await prisma.imageEmbedding.deleteMany({ where: { imageId: { in: orphans } } });

  const todo = sources.filter((s) => {
    const e = have.get(s.imageId);
    return !e || e.model !== model || e.url !== s.url || retry.has(s.imageId);
  });
  const batch = todo.slice(0, opts.limit ?? 300);
  let done = 0;
  let failed = 0;
  for (const s of batch) {
    let vec: Float32Array | null = null;
    try {
      const raw = await loadImageBytes(s.url);
      if (raw) vec = (await embed(await prepImage(raw))).vec;
    } catch (e) {
      if (e instanceof ImageSearchUnavailable) {
        log(`[img-index] embedder lỗi, dừng: ${e.message}`);
        break;
      }
    }
    const data = { source: s.source, serviceId: s.serviceId, roomTypeId: s.roomTypeId, roomId: s.roomId, url: s.url, vec: vec ? toBytes(vec) : new Uint8Array(0), model };
    await prisma.imageEmbedding.upsert({ where: { imageId: s.imageId }, create: { imageId: s.imageId, ...data }, update: { ...data, createdAt: new Date() } });
    if (vec) done++;
    else failed++;
  }
  const res = { done, failed, left: Math.max(0, todo.length - done - failed), removed: orphans.length };
  if (done || failed || orphans.length) log(`[img-index] +${done} ảnh, lỗi ${failed}, còn ${res.left}, xoá ${orphans.length}`);
  return res;
}
