/**
 * Gắn ảnh Dốc Mơ (đã xử lý ở scratchpad/docmo-out, sẽ upload lên volume uploads)
 * vào DB theo manifest-docmo.json:
 * - docmo  → ServiceImage (cover homestay) + RoomImage "Dốc Mơ" + RoomTypeImage "Dốc Mơ"
 * - cozy1  → RoomImage "Cozy 1" + RoomTypeImage "Cozy" (để Cozy 3/4/5 không có ảnh dùng chung)
 * - cozy2  → RoomImage "Cozy 2"
 * - sweet1 → RoomImage "Sweet 1" + RoomTypeImage "Sweet"
 * - sweet2 → RoomImage "Sweet 2" ; sweet3 → "Sweet 3"
 * - nhasan → RoomImage "Nhà sàn H'mong" + RoomTypeImage "Nhà sàn H'mong"
 * Chạy: npx tsx scripts/tmp-attach-docmo.ts <scratchpad-dir>
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "doc-mo-homestay";
const SCRATCH = process.argv[2];
if (!SCRATCH) throw new Error("usage: tsx tmp-attach-docmo.ts <scratchpad-dir>");

type Manifest = Record<string, { file: string; orig: string }[]>;
const manifest: Manifest = JSON.parse(readFileSync(path.join(SCRATCH, "manifest-docmo.json"), "utf8"));
const urls = (key: string) => (manifest[key] ?? []).map((f) => `/uploads/${f.file}`);

async function main() {
  const service = await prisma.service.findUniqueOrThrow({
    where: { slug: SLUG },
    select: { id: true, roomTypes: { select: { id: true, name: true, rooms: { select: { id: true, name: true } } } } },
  });
  const rtByName = new Map(service.roomTypes.map((rt) => [rt.name, rt.id]));
  const roomByName = new Map(service.roomTypes.flatMap((rt) => rt.rooms.map((r) => [r.name, r.id] as const)));
  const rt = (n: string) => { const x = rtByName.get(n); if (!x) throw new Error(`Không thấy RT ${n}`); return x; };
  const room = (n: string) => { const x = roomByName.get(n); if (!x) throw new Error(`Không thấy phòng ${n}`); return x; };

  // Dọn ảnh cũ (chạy lại idempotent)
  await prisma.serviceImage.deleteMany({ where: { serviceId: service.id } });
  const allRoomIds = [...roomByName.values()];
  const allRtIds = [...rtByName.values()];
  await prisma.roomImage.deleteMany({ where: { roomId: { in: allRoomIds } } });
  await prisma.roomTypeImage.deleteMany({ where: { roomTypeId: { in: allRtIds } } });

  // 1) ServiceImage = ảnh "Dốc Mơ" (ngoại cảnh / mây)
  const svcImgs = urls("docmo");
  if (svcImgs.length) {
    await prisma.serviceImage.createMany({
      data: svcImgs.map((url, i) => ({ serviceId: service.id, url, sortOrder: i, isCover: i === 0 })),
    });
  }
  console.log(`ServiceImage: ${svcImgs.length}`);

  // 2) RoomImage theo từng phòng
  const perRoom: [string, string][] = [
    ["docmo", "Dốc Mơ"],
    ["cozy1", "Cozy 1"],
    ["cozy2", "Cozy 2"],
    ["sweet1", "Sweet 1"],
    ["sweet2", "Sweet 2"],
    ["sweet3", "Sweet 3"],
    ["nhasan", "Nhà sàn H'mong"],
  ];
  for (const [key, roomName] of perRoom) {
    const list = urls(key);
    if (!list.length) { console.log(`  (bỏ) ${roomName}: 0 ảnh`); continue; }
    await prisma.roomImage.createMany({
      data: list.map((url, i) => ({ roomId: room(roomName), url, sortOrder: i, isCover: i === 0 })),
    });
    console.log(`  RoomImage "${roomName}": ${list.length}`);
  }

  // 3) RoomTypeImage (gallery/cover hạng) — để phòng không có ảnh riêng (Cozy 3/4/5) dùng chung
  const perType: [string, string][] = [
    ["docmo", "Dốc Mơ"],
    ["cozy1", "Cozy"],
    ["sweet1", "Sweet"],
    ["nhasan", "Nhà sàn H'mong"],
  ];
  for (const [key, rtName] of perType) {
    const list = urls(key);
    if (!list.length) { console.log(`  (bỏ) RT ${rtName}: 0 ảnh`); continue; }
    await prisma.roomTypeImage.createMany({
      data: list.map((url, i) => ({ roomTypeId: rt(rtName), url, sortOrder: i, isCover: i === 0 })),
    });
    console.log(`  RoomTypeImage "${rtName}": ${list.length}`);
  }

  console.log("Xong gắn ảnh.");
}
main().finally(() => prisma.$disconnect());
