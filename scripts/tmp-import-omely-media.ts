/**
 * Nhập ảnh + video Omely Homestay từ Drive vào PROD qua /api/admin/drive-import.
 * "Sân home" → ServiceImage; thư mục từng phòng → RoomImage (video → hạng phòng, tối đa 2/phòng).
 * Chạy: npx tsx --env-file=.env scripts/tmp-import-omely-media.ts <cookie-file>
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const COOKIE = readFileSync(process.argv[2], "utf8").trim();
const API = "https://taxuabooking.com/api/admin/drive-import";
const SLUG = "omely-homestay-ta-xua";
const IMG = /\.(jpe?g|png|webp|heic|heif)$/i;
const VID = /\.(mp4|mov|m4v|webm)$/i;

type Target = { serviceId?: string; roomTypeId?: string; roomId?: string };
interface Job { label: string; folder: string; kind: "service" | "type" | "room"; name?: string; copyTo?: string[]; maxImg: number }

const JOBS: Job[] = [
  { label: "Sân home", folder: "1pI8ZwLdxcidxS-Ef1htTKf0lV7B49OCY", kind: "service", maxImg: 24 },
  { label: "VIP 201", folder: "1sTUtv8ARJKUspENUX7fWUnAXilnfdUDd", kind: "room", name: "VIP 201", maxImg: 25 },
  { label: "VIP 206", folder: "1sb4a4Jp8pA-Se75nwWUPEa_jktVjWzC6", kind: "room", name: "VIP 206", maxImg: 25 },
  { label: "VIP 301", folder: "1mqk6nuM_2EVjNcINCslUJq0NH5MCb95E", kind: "room", name: "VIP 301", maxImg: 25 },
  { label: "VIP 306", folder: "1Om0U27HTUDMnck5EeaSoSvVL2yzX2w5y", kind: "room", name: "VIP 306", maxImg: 25 },
  { label: "Luxury 202", folder: "1XZbQeKP5q6ghEcixRm2hzV9vDzJtXwpk", kind: "room", name: "Luxury 202", maxImg: 25 },
  { label: "Luxury 203", folder: "1iogz6zUeHgWhkA6jBU9aNfjKgyAqWKoT", kind: "room", name: "Luxury 203", maxImg: 25 },
  { label: "Luxury 204", folder: "16A8iIOzhFcu77Byp5ctZaZa4zX-zZnZK", kind: "room", name: "Luxury 204", maxImg: 25 },
  { label: "Luxury 205", folder: "1yWhcnd5y4vDrA8ZlsUF-rvdIFg4GhbAY", kind: "room", name: "Luxury 205", maxImg: 25 },
  { label: "Luxury 302", folder: "1u5UYRv57zI7kuKmML-HkTn4qxviGA-XX", kind: "room", name: "Luxury 302", maxImg: 25 },
  { label: "Luxury 305", folder: "1TNC5JaKL74Ye7JSng9x_EaEgzZNYgP-B", kind: "room", name: "Luxury 305", maxImg: 25 },
  { label: "Đôi 303", folder: "1NVBcVnrrSECoFCn1mDJ-h7Q54-cxD_JR", kind: "room", name: "Đôi 303", maxImg: 25 },
  { label: "Đôi 304", folder: "1Hgr4B88CHd7FsbUj-MA_wktsiUDkPKyT", kind: "room", name: "Đôi 304", maxImg: 25 },
];

async function listFolder(id: string): Promise<{ id: string; name: string }[]> {
  const html = await (await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`)).text();
  const out: { id: string; name: string }[] = [];
  const re = /<a href="https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})[^"]*"[\s\S]*?flip-entry-title">([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) if (!out.some((x) => x.id === m![1])) out.push({ id: m[1], name: m[2].trim() });
  return out;
}

async function importOne(fileId: string, name: string, target: Target): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: COOKIE },
        body: JSON.stringify({ op: "import", fileId, name, ...target }),
      });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && j.url) return true;
      console.log(`    ✗ ${name}: ${res.status} ${j.error ?? ""}`);
      if (res.status < 500) return false;
    } catch (e) {
      console.log(`    ✗ ${name}: ${(e as Error).message}`);
    }
  }
  return false;
}

async function main() {
  const s = await prisma.service.findUniqueOrThrow({
    where: { slug: SLUG },
    select: { id: true, roomTypes: { select: { id: true, name: true, rooms: { select: { id: true, name: true } } } } },
  });
  const roomOf = (name: string) => {
    const rt = s.roomTypes.find((x) => x.rooms.some((r) => r.name === name));
    const room = rt?.rooms.find((r) => r.name === name);
    if (!rt || !room) throw new Error(`Không thấy phòng ${name}`);
    return { rt, room };
  };

  for (const job of JOBS) {
    let target: Target;
    let videoTarget: Target | null = null;
    if (job.kind === "service") target = { serviceId: s.id };
    else if (job.kind === "type") {
      const rt = s.roomTypes.find((x) => x.name === job.name);
      if (!rt) throw new Error(`Không thấy hạng ${job.name}`);
      target = videoTarget = { roomTypeId: rt.id };
    } else {
      const { rt, room } = roomOf(job.name!);
      target = { roomId: room.id };
      videoTarget = { roomTypeId: rt.id };
    }
    const files = await listFolder(job.folder);
    const imgs = files.filter((f) => IMG.test(f.name)).slice(0, job.maxImg);
    const vids = videoTarget ? files.filter((f) => VID.test(f.name)).slice(0, 2) : [];
    let okI = 0, okV = 0;
    for (const f of imgs) if (await importOne(f.id, f.name, target)) okI++;
    for (const f of vids) if (await importOne(f.id, f.name, videoTarget!)) okV++;
    console.log(`${job.label} → ${job.name ?? "homestay"}: ảnh ${okI}/${imgs.length}, video ${okV}/${vids.length}`);
    if (job.copyTo?.length && target.roomId) {
      const src = await prisma.roomImage.findMany({ where: { roomId: target.roomId }, orderBy: { sortOrder: "asc" } });
      for (const name of job.copyTo) {
        await prisma.roomImage.createMany({
          data: src.map((x) => ({ roomId: roomOf(name).room.id, url: x.url, sortOrder: x.sortOrder, isCover: x.isCover })),
        });
        console.log(`  ↳ chép ${src.length} ảnh sang ${name}`);
      }
    }
  }

  // Hạng chỉ có ảnh ở phòng (Achu 204, Achu phòng đơn, Sapu 10) → gallery hạng = 2 ảnh đầu mỗi phòng.
  const rts = await prisma.roomType.findMany({
    where: { serviceId: s.id },
    select: {
      id: true, name: true,
      images: { where: { type: "image" }, select: { id: true } },
      rooms: { orderBy: { sortOrder: "asc" }, select: { images: { orderBy: { sortOrder: "asc" }, take: 2, select: { url: true } } } },
    },
  });
  for (const rt of rts) {
    if (rt.images.length) continue;
    const urls = [...new Set(rt.rooms.flatMap((r) => r.images.map((i) => i.url)))];
    if (!urls.length) continue;
    await prisma.roomTypeImage.createMany({ data: urls.map((url, i) => ({ roomTypeId: rt.id, url, sortOrder: 100 + i, isCover: i === 0 })) });
    await prisma.roomType.update({ where: { id: rt.id }, data: { imageUrl: urls[0] } });
    console.log(`RT ${rt.name}: gallery ${urls.length} ảnh`);
  }
}
main().finally(() => prisma.$disconnect());
