/**
 * Nhập ảnh + video Pàng Village từ Drive vào PROD qua /api/admin/drive-import.
 * - "Cảnh quan chung" (+ vài ảnh "Dịch vụ, ăn uống") → ServiceImage (chỉ ảnh).
 * - "Cảnh quan Achu"/"Cảnh quan Sapu" → hạng phòng tương ứng (ảnh + video).
 * - Thư mục từng phòng → RoomImage (video → hạng); thư mục chung nhiều phòng → nhập vào phòng đầu
 *   rồi chép bản ghi (cùng url) cho phòng còn lại.
 * Chạy: npx tsx scripts/tmp-import-pang-media.ts <cookie-file>
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const COOKIE = readFileSync(process.argv[2], "utf8").trim();
const API = "https://taxuabooking.com/api/admin/drive-import";
const SLUG = "pang-village-ta-xua";
const IMG = /\.(jpe?g|png|webp|heic|heif)$/i;
const VID = /\.(mp4|mov|m4v|webm)$/i;

type Target = { serviceId?: string; roomTypeId?: string; roomId?: string };
interface Job { label: string; folder: string; kind: "service" | "type" | "room"; name?: string; copyTo?: string[]; maxImg: number }

const JOBS: Job[] = [
  { label: "Cảnh quan chung", folder: "1pcl1bpbyyMM97y0jkut1WWib0lgDjc37", kind: "service", maxImg: 24 },
  { label: "Dịch vụ, ăn uống", folder: "1qb1iHHmIwgjk0rPlGcCYvpm4qm1FGUHZ", kind: "service", maxImg: 8 },
  { label: "Cảnh quan Achu", folder: "10VWNTpSn8SGWrZeQg7yPYQ5PBLoljeq4", kind: "type", name: "Achu phòng đôi", maxImg: 25 },
  { label: "Phòng 101", folder: "13IiEYZ65DRN8t0LsDRoFR77uWupLoVam", kind: "room", name: "Achu 101", maxImg: 25 },
  { label: "Phòng 102,103", folder: "1f73XzMLsF3ZZU1jc99-BjslY2eKASxDr", kind: "room", name: "Achu 102", copyTo: ["Achu 103"], maxImg: 25 },
  { label: "Phòng 201", folder: "1shatvJryMXHg8XTSjQCyebiuB2KaQLeX", kind: "room", name: "Achu 201", maxImg: 25 },
  { label: "Phòng 202,203", folder: "1fBiw3BoLntWvq4eU_WNcRMZTQgK3RaCC", kind: "room", name: "Achu 202", copyTo: ["Achu 203"], maxImg: 25 },
  { label: "Phòng 204", folder: "1hyGrpFQfwCkllApLH48_OAA0OqhcECr7", kind: "room", name: "Achu 204", maxImg: 25 },
  { label: "Phòng đơn 104", folder: "1C38OYGtbaPrKhnRQeQ3p3fbG80EbXzgs", kind: "room", name: "Achu 104", maxImg: 25 },
  { label: "Cảnh quan Sapu", folder: "1hY1zUi6DgqJxOz2lGmXHhqQJWr-iFjkK", kind: "type", name: "Sapu phòng đơn view mây", maxImg: 25 },
  { label: "Sapu1", folder: "1GkgkraS-lQAdh0esVapI-4iebU1iWxBH", kind: "room", name: "Sapu 1", maxImg: 25 },
  { label: "Sapu2;3;4", folder: "1dh40NgLD2ZKz3hL02pRM5PzS8N1rXYzV", kind: "room", name: "Sapu 2", copyTo: ["Sapu 3", "Sapu 4"], maxImg: 25 },
  { label: "Sapu5 (link trong sheet)", folder: "1dU7-eMJVx1anxGIG249Lvh-GNLkRS3sV", kind: "room", name: "Sapu 5", maxImg: 25 },
  { label: "Sapu6", folder: "1Ur1mv3VU9ZzqZFM626YsQZiN9LsIlC8L", kind: "room", name: "Sapu 6", maxImg: 25 },
  { label: "Sapu7;8;9", folder: "1H5PRV971yyY4ukV8gs2aWgq3tplSjCEi", kind: "room", name: "Sapu 7", copyTo: ["Sapu 8", "Sapu 9"], maxImg: 25 },
  { label: "Sapu10", folder: "1fCPVOf504djWQ32Qqit6MN_s51FVKc2F", kind: "room", name: "Sapu 10", maxImg: 25 },
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
    const vids = videoTarget ? files.filter((f) => VID.test(f.name)) : [];
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
