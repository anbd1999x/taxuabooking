/**
 * Gắn ảnh Thác Mây Tà Xùa (đã upload lên volume uploads) vào DB theo manifest-thacmay.json:
 * - tm-home → ServiceImage (ảnh đầu = cover).
 * - tm-lux1..3 / tm-vip1..10 → RoomImage của "Lux N"/"VIP N"; đồng thời 2 ảnh đầu mỗi
 *   phòng vào RoomTypeImage của hạng (bỏ url trùng — các căn Lux dùng chung bộ ảnh).
 * Chạy: npx tsx scripts/tmp-attach-thacmay-images.ts <scratch-dir-thacmay>
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SERVICE_ID = "cmw0ipudt0000unys7uonetxb";
const SCRATCH = process.argv[2];
if (!SCRATCH) throw new Error("usage: tsx tmp-attach-thacmay-images.ts <scratch-dir>");

type Manifest = Record<string, { file: string; orig: string }[]>;
const manifest: Manifest = JSON.parse(readFileSync(path.join(SCRATCH, "manifest-thacmay.json"), "utf8"));
const urls = (key: string) => (manifest[key] ?? []).map((f) => `/uploads/${f.file}`);

async function main() {
  const service = await prisma.service.findUniqueOrThrow({
    where: { id: SERVICE_ID },
    select: {
      roomTypes: {
        select: { id: true, name: true, rooms: { select: { id: true, name: true } } },
      },
    },
  });
  const roomsByKey = new Map(
    service.roomTypes.flatMap((rt) =>
      rt.rooms.map((r) => [
        "tm-" + r.name.toLowerCase().replace(/\s+/g, ""), // "Lux 1" → tm-lux1
        { roomId: r.id, roomTypeId: rt.id, name: r.name },
      ] as const),
    ),
  );

  // 1) Ảnh khuôn viên → ServiceImage
  const svcUrls = urls("tm-home");
  await prisma.serviceImage.createMany({
    data: svcUrls.map((url, i) => ({ serviceId: SERVICE_ID, url, sortOrder: i, isCover: i === 0 })),
  });
  console.log(`ServiceImage: ${svcUrls.length}`);

  // 2) Ảnh từng phòng + 2 ảnh đầu mỗi phòng vào gallery hạng (bỏ trùng url trong hạng)
  const rtGallery = new Map<string, Set<string>>();
  for (const [key, target] of roomsByKey) {
    const list = urls(key);
    if (!list.length) { console.log(`${target.name}: KHÔNG có ảnh trong manifest (${key})`); continue; }
    await prisma.roomImage.createMany({
      data: list.map((url, i) => ({ roomId: target.roomId, url, sortOrder: i, isCover: i === 0 })),
    });
    console.log(`${target.name}: ${list.length} ảnh`);
    const seen = rtGallery.get(target.roomTypeId) ?? new Set<string>();
    rtGallery.set(target.roomTypeId, seen);
    for (const url of list.slice(0, 2)) {
      if (seen.has(url)) continue;
      await prisma.roomTypeImage.create({
        data: { roomTypeId: target.roomTypeId, url, sortOrder: seen.size, isCover: seen.size === 0 },
      });
      seen.add(url);
    }
  }
  console.log("Xong.");
}
main().finally(() => prisma.$disconnect());
