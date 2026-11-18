import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const SID = "cmwlsv2li0000unncr6citxcn";
const svc = await p.service.findUniqueOrThrow({ where: { id: SID }, select: { policy: true, roomTypes: { include: { rooms: true } } } });
let min = Infinity;
for (const t of svc.roomTypes) {
  for (const r of t.rooms) {
    if (r.salePrice == null || r.listPriceFri == null) { console.log("bỏ qua:", r.name); continue; }
    const list = Number(r.listPrice), fri = Number(r.listPriceFri), sat = Number(r.listPriceSat);
    await p.room.update({ where: { id: r.id }, data: { salePrice: null, listPriceFri: null, listPriceSat: null, priceFri: fri, priceSat: sat } });
    min = Math.min(min, list);
    console.log(r.name, `CN–T5 ${list} · T6 ${fri} · T7 ${sat}`);
  }
  const r0 = t.rooms[0], wd = Number(r0.listPrice), we = Number(r0.listPriceFri ?? r0.priceFri);
  await p.roomType.update({ where: { id: t.id }, data: { weekdayPrice: wd, priceSun: wd, weekendPrice: we, priceFri: we, priceSat: we } });
}
if (min < Infinity) await p.service.update({ where: { id: SID }, data: { basePrice: min, policy: svc.policy.replace("Giá niêm yết (2 khách/phòng, đã gồm ăn sáng):", "Giá phòng (2 khách/phòng, đã gồm ăn sáng):") } });
await p.$disconnect();
