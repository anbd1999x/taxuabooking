/**
 * Gắn ảnh Mây Hạ (đã upload lên volume uploads) vào DB theo manifest-mh.json:
 * - mh-ngoaicanh → ServiceImage (ảnh đầu = cover)
 * - mh-tang1/tang2/vip12 → RoomTypeImage của hạng tương ứng
 * - mh-don201, mh-vip3..10 → RoomImage của phòng tương ứng; đồng thời lấy 2 ảnh
 *   đầu mỗi phòng VIP làm RoomTypeImage của hạng bungalow (gallery nhóm).
 * Chạy: npx tsx scripts/tmp-attach-mh-images.ts <scratchpad-dir>
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SERVICE_ID = "cmvzgr7wn0000unc0csd4xxzz";
const SCRATCH = process.argv[2];
if (!SCRATCH) throw new Error("usage: tsx tmp-attach-mh-images.ts <scratchpad-dir>");

type Manifest = Record<string, { file: string; orig: string }[]>;
const manifest: Manifest = JSON.parse(readFileSync(path.join(SCRATCH, "manifest-mh.json"), "utf8"));
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
  const rtByName = new Map(service.roomTypes.map((rt) => [rt.name, rt]));
  const roomByName = new Map(
    service.roomTypes.flatMap((rt) => rt.rooms.map((r) => [r.name, r.id] as const)),
  );
  const rt = (name: string) => {
    const x = rtByName.get(name);
    if (!x) throw new Error(`Không thấy RT ${name}`);
    return x.id;
  };
  const room = (name: string) => {
    const x = roomByName.get(name);
    if (!x) throw new Error(`Không thấy phòng ${name}`);
    return x;
  };

  // 1) Ảnh ngoại cảnh → ServiceImage
  await prisma.serviceImage.createMany({
    data: urls("mh-ngoaicanh").map((url, i) => ({
      serviceId: SERVICE_ID, url, sortOrder: i, isCover: i === 0,
    })),
  });
  console.log(`ServiceImage: ${urls("mh-ngoaicanh").length}`);

  // 2) Ảnh hạng phòng dùng chung
  const rtShared: [string, string][] = [
    ["mh-tang1", "Phòng đơn tầng 1"],
    ["mh-tang2", "Phòng đơn tầng 2"],
    ["mh-vip12", "Phòng đôi VIP"],
  ];
  for (const [key, rtName] of rtShared) {
    const list = urls(key);
    await prisma.roomTypeImage.createMany({
      data: list.map((url, i) => ({ roomTypeId: rt(rtName), url, sortOrder: i, isCover: i === 0 })),
    });
    console.log(`RT "${rtName}": ${list.length} ảnh`);
  }

  // 3) Ảnh riêng từng phòng + gallery nhóm bungalow (2 ảnh đầu mỗi phòng)
  const perRoom: [string, string, string | null][] = [
    ["mh-don201", "Phòng 201", null],
    ["mh-vip3", "VIP 3", "Bungalow VIP 2 mặt kính"],
    ["mh-vip5", "VIP 5", "Bungalow VIP 2 mặt kính"],
    ["mh-vip6", "VIP 6", "Bungalow VIP 2 mặt kính"],
    ["mh-vip7", "VIP 7", "Bungalow VIP 2 mặt kính"],
    ["mh-vip8", "VIP 8", "Bungalow VIP 2 mặt kính"],
    ["mh-vip9", "VIP 9", "Bungalow VIP 1 mặt kính"],
    ["mh-vip10", "VIP 10", "Bungalow VIP 1 mặt kính"],
  ];
  const rtGallerySort = new Map<string, number>();
  for (const [key, roomName, rtName] of perRoom) {
    const list = urls(key);
    await prisma.roomImage.createMany({
      data: list.map((url, i) => ({ roomId: room(roomName), url, sortOrder: i, isCover: i === 0 })),
    });
    console.log(`Phòng "${roomName}": ${list.length} ảnh`);
    if (rtName) {
      const rtId = rt(rtName);
      for (const url of list.slice(0, 2)) {
        const sort = rtGallerySort.get(rtId) ?? 0;
        await prisma.roomTypeImage.create({
          data: { roomTypeId: rtId, url, sortOrder: sort, isCover: sort === 0 },
        });
        rtGallerySort.set(rtId, sort + 1);
      }
    }
  }
  console.log("Xong.");
}
main().finally(() => prisma.$disconnect());
