/**
 * Gắn ảnh Bếp Nhà Táo (đã upload lên volume uploads) vào DB theo manifest-bnt.json:
 * - bnt-khuonvien → ServiceImage (ảnh đầu = cover), bnt-sodo (sơ đồ home) nối cuối.
 * - bnt-may<N> → RoomImage của "Phòng <N>"; đồng thời lấy 2 ảnh đầu mỗi phòng làm
 *   RoomTypeImage của hạng tương ứng (gallery nhóm — hạng không có folder riêng).
 * Chạy: npx tsx scripts/tmp-attach-bnt-images.ts <scratchpad-dir>
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SERVICE_ID = "cmvzgzju40000unj857mkzx27";
const SCRATCH = process.argv[2];
if (!SCRATCH) throw new Error("usage: tsx tmp-attach-bnt-images.ts <scratchpad-dir>");

type Manifest = Record<string, { file: string; orig: string }[]>;
const manifest: Manifest = JSON.parse(readFileSync(path.join(SCRATCH, "manifest-bnt.json"), "utf8"));
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
  const roomsByName = new Map(
    service.roomTypes.flatMap((rt) =>
      rt.rooms.map((r) => [r.name, { roomId: r.id, roomTypeId: rt.id }] as const),
    ),
  );

  // 1) Khuôn viên + sơ đồ → ServiceImage
  const svcUrls = [...urls("bnt-khuonvien"), ...urls("bnt-sodo")];
  await prisma.serviceImage.createMany({
    data: svcUrls.map((url, i) => ({ serviceId: SERVICE_ID, url, sortOrder: i, isCover: i === 0 })),
  });
  console.log(`ServiceImage: ${svcUrls.length}`);

  // 2) Ảnh từng phòng + 2 ảnh đầu mỗi phòng vào gallery hạng
  const rtGallerySort = new Map<string, number>();
  for (let n = 1; n <= 13; n++) {
    const list = urls(`bnt-may${n}`);
    const target = roomsByName.get(`Phòng ${n}`);
    if (!target) throw new Error(`Không thấy phòng Phòng ${n}`);
    await prisma.roomImage.createMany({
      data: list.map((url, i) => ({ roomId: target.roomId, url, sortOrder: i, isCover: i === 0 })),
    });
    console.log(`Phòng ${n}: ${list.length} ảnh`);
    for (const url of list.slice(0, 2)) {
      const sort = rtGallerySort.get(target.roomTypeId) ?? 0;
      await prisma.roomTypeImage.create({
        data: { roomTypeId: target.roomTypeId, url, sortOrder: sort, isCover: sort === 0 },
      });
      rtGallerySort.set(target.roomTypeId, sort + 1);
    }
  }
  console.log("Xong.");
}
main().finally(() => prisma.$disconnect());
