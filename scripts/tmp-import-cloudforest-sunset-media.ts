/**
 * Nhập ảnh + video Cloud Forest / Sunset Clouds từ Google Drive vào PROD qua API
 * /api/admin/drive-import (server tự tải & lưu vào volume uploads, gắn DB).
 * - Thư mục riêng từng căn → Room (ảnh + video).
 * - Thư mục dùng chung nhiều phòng (Panorama, VIP 360, Mị & A Phủ, các hạng Sunset) → RoomType.
 * - Khuôn viên / ảnh chung → ServiceImage (chỉ ảnh — video không gắn được vào homestay).
 * Sau đó chép 2 ảnh đầu mỗi căn vào gallery hạng (RoomTypeImage) cho hạng gồm phòng riêng.
 * Chạy: npx tsx scripts/tmp-import-cloudforest-sunset-media.ts <drive-html-dir> <cookie-file>
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const [DIR, COOKIE_FILE] = process.argv.slice(2);
if (!DIR || !COOKIE_FILE) throw new Error("usage: <drive-html-dir> <cookie-file>");
const COOKIE = readFileSync(COOKIE_FILE, "utf8").trim();
const API = "https://taxuabooking.com/api/admin/drive-import";
const CF = "cloud-forest-ta-xua";
const SS = "sunset-clouds-ta-xua";

const IMG = /\.(jpe?g|png|webp|heic|heif)$/i;
const VID = /\.(mp4|mov|m4v|webm)$/i;

type Target = { serviceId?: string; roomTypeId?: string; roomId?: string };
interface Job { key: string; slug: string; kind: "room" | "type" | "service"; name?: string; maxImg: number }

const JOBS: Job[] = [
  { key: "cf-khuonvien", slug: CF, kind: "service", maxImg: 30 },
  { key: "cf-lu", slug: CF, kind: "room", name: "Lù House", maxImg: 20 },
  { key: "cf-lau", slug: CF, kind: "room", name: "Lầu House", maxImg: 20 },
  { key: "cf-mua", slug: CF, kind: "room", name: "Mùa House", maxImg: 20 },
  { key: "cf-vu", slug: CF, kind: "room", name: "Vừ House", maxImg: 20 },
  { key: "cf-giang", slug: CF, kind: "room", name: "Giàng House", maxImg: 20 },
  { key: "cf-thao", slug: CF, kind: "room", name: "Thào House", maxImg: 20 },
  { key: "cf-forest", slug: CF, kind: "room", name: "Forest House", maxImg: 20 },
  { key: "cf-wind", slug: CF, kind: "room", name: "Wind House", maxImg: 20 },
  { key: "cf-mountain", slug: CF, kind: "room", name: "Mountain View House", maxImg: 20 },
  { key: "cf-viptree", slug: CF, kind: "room", name: "VIP Tree House", maxImg: 20 },
  { key: "cf-panorama", slug: CF, kind: "type", name: "Panorama VIP", maxImg: 20 },
  { key: "cf-vip360", slug: CF, kind: "type", name: "VIP View 360°", maxImg: 20 },
  { key: "cf-miaphu", slug: CF, kind: "type", name: "Phòng đôi view núi (WC chung)", maxImg: 20 },
  { key: "ss-root", slug: SS, kind: "service", maxImg: 30 },
  { key: "ss-vipfamily", slug: SS, kind: "type", name: "Family VIP", maxImg: 25 },
  { key: "ss-blue", slug: SS, kind: "type", name: "Blue (Phòng đôi)", maxImg: 25 },
  { key: "ss-family", slug: SS, kind: "type", name: "Sunset Family", maxImg: 25 },
];

function listFolder(key: string): { id: string; name: string }[] {
  const html = readFileSync(path.join(DIR, `${key}.html`), "utf8");
  const out: { id: string; name: string }[] = [];
  const re = /id="entry-([a-zA-Z0-9_-]{10,})"[\s\S]*?flip-entry-title">([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) if (!out.some((x) => x.id === m![1])) out.push({ id: m[1], name: m[2].trim() });
  return out;
}

async function importOne(fileId: string, name: string, target: Target): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: COOKIE },
        body: JSON.stringify({ op: "import", fileId, name, ...target }),
      });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && j.url) return j.url;
      console.log(`    ✗ ${name}: ${res.status} ${j.error ?? ""}`);
      if (res.status < 500) return null;
    } catch (e) {
      console.log(`    ✗ ${name}: ${(e as Error).message}`);
    }
  }
  return null;
}

async function main() {
  const services = await prisma.service.findMany({
    where: { slug: { in: [CF, SS] } },
    select: { id: true, slug: true, roomTypes: { select: { id: true, name: true, rooms: { select: { id: true, name: true } } } } },
  });
  const svc = (slug: string) => services.find((s) => s.slug === slug)!;

  for (const job of JOBS) {
    const s = svc(job.slug);
    let target: Target;
    let videoTarget: Target | null = null; // video chỉ gắn được vào hạng (RoomTypeImage.type)
    if (job.kind === "service") target = { serviceId: s.id };
    else if (job.kind === "type") {
      const rt = s.roomTypes.find((x) => x.name === job.name);
      if (!rt) throw new Error(`Không thấy hạng ${job.name}`);
      target = videoTarget = { roomTypeId: rt.id };
    } else {
      const rt = s.roomTypes.find((x) => x.rooms.some((r) => r.name === job.name));
      const room = rt?.rooms.find((x) => x.name === job.name);
      if (!rt || !room) throw new Error(`Không thấy phòng ${job.name}`);
      target = { roomId: room.id };
      videoTarget = { roomTypeId: rt.id };
    }
    const files = listFolder(job.key);
    const imgs = files.filter((f) => IMG.test(f.name)).slice(0, job.maxImg);
    const vids = videoTarget ? files.filter((f) => VID.test(f.name)) : [];
    let okI = 0, okV = 0;
    for (const f of imgs) if (await importOne(f.id, f.name, target)) okI++;
    for (const f of vids) if (await importOne(f.id, f.name, videoTarget!)) okV++;
    console.log(`${job.key} → ${job.name ?? "homestay"}: ảnh ${okI}/${imgs.length}, video ${okV}/${vids.length}`);
  }

  // Gallery hạng cho hạng gồm phòng có ảnh riêng: 2 ảnh đầu mỗi căn.
  const fresh = await prisma.roomType.findMany({
    where: { service: { slug: CF } },
    select: {
      id: true, name: true,
      images: { select: { id: true, type: true } },
      rooms: { orderBy: { sortOrder: "asc" }, select: { images: { orderBy: { sortOrder: "asc" }, take: 2, select: { url: true } } } },
    },
  });
  for (const rt of fresh) {
    if (rt.images.some((i) => i.type === "image")) continue; // hạng đã có ảnh riêng (thư mục chung)
    const urls = [...new Set(rt.rooms.flatMap((r) => r.images.map((i) => i.url)))];
    if (!urls.length) continue;
    await prisma.roomTypeImage.createMany({
      data: urls.map((url, i) => ({ roomTypeId: rt.id, url, sortOrder: i, isCover: i === 0 })),
    });
    await prisma.roomType.update({ where: { id: rt.id }, data: { imageUrl: urls[0] } });
    console.log(`RT ${rt.name}: gallery ${urls.length} ảnh`);
  }
}
main().finally(() => prisma.$disconnect());
