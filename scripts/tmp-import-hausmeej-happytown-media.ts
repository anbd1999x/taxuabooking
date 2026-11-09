/**
 * Nhập ảnh + video Haus Meej / Happy Town từ Drive vào PROD qua /api/admin/drive-import.
 * - Thư mục riêng 1 phòng (MV1..MV4) → RoomImage (ảnh "phòng đơn" trước, "extra" sau); video → hạng.
 * - Thư mục chung nhiều phòng (Sunset, Panorama, Lều Cam, Bungalow) → RoomType.
 * - Táo: thư mục theo nhóm (1-2-4, 3-6-7, 5) → nhập vào phòng đầu nhóm rồi chép bản ghi (cùng url) cho phòng còn lại.
 * - Ảnh chung homestay (ServiceImage) = 2 ảnh đầu mỗi hạng/phòng (chép url, không tải lại).
 * Chạy: npx tsx scripts/tmp-import-hausmeej-happytown-media.ts <cookie-file>
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const COOKIE = readFileSync(process.argv[2], "utf8").trim();
const API = "https://taxuabooking.com/api/admin/drive-import";
const HAUS = "haus-meej-ta-xua";
const HAPPY = "happy-town-ta-xua";
const IMG = /\.(jpe?g|png|webp|heic|heif)$/i;
const VID = /\.(mp4|mov|m4v|webm)$/i;
const MAX_IMG = 25;

type Target = { serviceId?: string; roomTypeId?: string; roomId?: string };
interface Job {
  slug: string;
  kind: "room" | "type";
  name: string; // tên phòng (room) hoặc hạng (type)
  folders: string[]; // theo thứ tự ưu tiên ảnh
  copyTo?: string[]; // phòng dùng chung ảnh (Táo theo nhóm)
}

const JOBS: Job[] = [
  { slug: HAUS, kind: "type", name: "Sunset", folders: ["115I9b_tQlgI4jNAFTirJu6QpZiPzbXxQ"] },
  { slug: HAUS, kind: "room", name: "MV1", folders: ["1c2lwpELvVS9slJafzlII3m-1T3qSbCUX", "1AEg5kdBxngPKKKlrOXISXogVnw4EVlYn"] },
  { slug: HAUS, kind: "room", name: "MV2", folders: ["1PjTaTKB3utfj4VfZyVulwV_A99A0Jt6o"] },
  { slug: HAUS, kind: "room", name: "MV3", folders: ["17S3ofrnqz9G19eQwbM-sKDG6nPmDIr0H", "1AjVAGw0JLP8s5Fve2nSZuS0pOF01RRqv"] },
  { slug: HAUS, kind: "room", name: "MV4", folders: ["1iYo6Up9tDzdpYYYd4JeaAmIexNW8QJ_B"] },
  { slug: HAUS, kind: "type", name: "Panorama", folders: ["1fWchRQ7o9PUeFolcd66xvMSZ6SRh2dn1"] },
  { slug: HAPPY, kind: "room", name: "Táo 1", folders: ["10GDqsVEhUQ3nVKSW8t9jaaT0TlEp_ORb", "1TB8-cPhPsb6sepvrMppVCUOXT39DGicK"], copyTo: ["Táo 2", "Táo 4"] },
  { slug: HAPPY, kind: "room", name: "Táo 3", folders: ["1A4qHwERZPYhTuRyRvZSMrBkH6LKJ6EbK", "1Qe5YC7Jds_cGKFAofm0a2lARl9sMFo1b"], copyTo: ["Táo 6", "Táo 7"] },
  { slug: HAPPY, kind: "room", name: "Táo 5", folders: ["1LZdqzMwS1dnkTnOZkfLoa8zvvscvLoq8"] },
  { slug: HAPPY, kind: "type", name: "Lều Cam", folders: ["1aORYuf_TdhpDBk59-ZMuuhuvAHVIVz0h"] },
  { slug: HAPPY, kind: "type", name: "Bungalow Happy", folders: ["1EiwSLaipyeupwsTBRb7l5_PH0fmGU6AH"] },
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
  for (let attempt = 0; attempt < 2; attempt++) {
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
  const services = await prisma.service.findMany({
    where: { slug: { in: [HAUS, HAPPY] } },
    select: { id: true, slug: true, roomTypes: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, rooms: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } } } } },
  });
  const svc = (slug: string) => services.find((s) => s.slug === slug)!;
  const roomOf = (slug: string, name: string) => {
    const rt = svc(slug).roomTypes.find((x) => x.rooms.some((r) => r.name === name));
    const room = rt?.rooms.find((r) => r.name === name);
    if (!rt || !room) throw new Error(`Không thấy phòng ${name}`);
    return { rt, room };
  };

  for (const job of JOBS) {
    let target: Target;
    let videoTarget: Target;
    if (job.kind === "type") {
      const rt = svc(job.slug).roomTypes.find((x) => x.name === job.name);
      if (!rt) throw new Error(`Không thấy hạng ${job.name}`);
      target = videoTarget = { roomTypeId: rt.id };
    } else {
      const { rt, room } = roomOf(job.slug, job.name);
      target = { roomId: room.id };
      videoTarget = { roomTypeId: rt.id };
    }
    const files = (await Promise.all(job.folders.map(listFolder))).flat();
    const imgs = files.filter((f) => IMG.test(f.name)).slice(0, MAX_IMG);
    const vids = files.filter((f) => VID.test(f.name));
    let okI = 0, okV = 0;
    for (const f of imgs) if (await importOne(f.id, f.name, target)) okI++;
    for (const f of vids) if (await importOne(f.id, f.name, videoTarget)) okV++;
    console.log(`${job.name}: ảnh ${okI}/${imgs.length}, video ${okV}/${vids.length}`);

    if (job.copyTo?.length && target.roomId) {
      const src = await prisma.roomImage.findMany({ where: { roomId: target.roomId }, orderBy: { sortOrder: "asc" } });
      for (const name of job.copyTo) {
        const { room } = roomOf(job.slug, name);
        await prisma.roomImage.createMany({
          data: src.map((x) => ({ roomId: room.id, url: x.url, sortOrder: x.sortOrder, isCover: x.isCover })),
        });
        console.log(`  ↳ chép ${src.length} ảnh sang ${name}`);
      }
    }
  }

  // Gallery hạng (hạng chỉ có ảnh ở phòng) + ảnh chung homestay = 2 ảnh đầu mỗi hạng/phòng.
  for (const s of services) {
    const rts = await prisma.roomType.findMany({
      where: { serviceId: s.id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true, name: true,
        images: { where: { type: "image" }, orderBy: { sortOrder: "asc" }, take: 2, select: { url: true } },
        rooms: { orderBy: { sortOrder: "asc" }, select: { images: { orderBy: { sortOrder: "asc" }, take: 2, select: { url: true } } } },
      },
    });
    const svcUrls: string[] = [];
    for (const rt of rts) {
      let urls = rt.images.map((i) => i.url);
      if (!urls.length) {
        urls = [...new Set(rt.rooms.flatMap((r) => r.images.map((i) => i.url)))];
        if (urls.length) {
          await prisma.roomTypeImage.createMany({ data: urls.map((url, i) => ({ roomTypeId: rt.id, url, sortOrder: 100 + i, isCover: i === 0 })) });
          await prisma.roomType.update({ where: { id: rt.id }, data: { imageUrl: urls[0] } });
          console.log(`RT ${rt.name}: gallery ${urls.length} ảnh`);
        }
      }
      for (const u of urls.slice(0, 4)) if (!svcUrls.includes(u)) svcUrls.push(u);
    }
    const has = await prisma.serviceImage.count({ where: { serviceId: s.id } });
    if (!has && svcUrls.length) {
      await prisma.serviceImage.createMany({ data: svcUrls.map((url, i) => ({ serviceId: s.id, url, sortOrder: i, isCover: i === 0 })) });
      console.log(`${s.slug}: ServiceImage ${svcUrls.length}`);
    }
  }
}
main().finally(() => prisma.$disconnect());
