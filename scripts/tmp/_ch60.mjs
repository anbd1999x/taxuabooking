import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const OFF = 50000, SID = "cmwlsv2li0000unncr6citxcn";
const svc = await p.service.findUniqueOrThrow({ where: { id: SID }, select: { policy: true, roomTypes: { include: { rooms: true } } } });
let min = Infinity;
for (const t of svc.roomTypes) {
  for (const r of t.rooms) {
    if (r.salePrice != null || r.listPriceFri != null) { console.log("bỏ qua (đã có giá bán):", r.name); continue; }
    const list = Number(r.listPrice), fri = Number(r.priceFri), sat = Number(r.priceSat);
    await p.room.update({ where: { id: r.id }, data: { salePrice: list - OFF, listPriceFri: fri, listPriceSat: sat, priceFri: fri - OFF, priceSat: sat - OFF } });
    min = Math.min(min, list - OFF);
    console.log(r.name, `CN–T5 ${list}→${list - OFF} · T6 ${fri}→${fri - OFF} · T7 ${sat}→${sat - OFF}`);
  }
  const r0 = t.rooms[0];
  await p.roomType.update({ where: { id: t.id }, data: { weekdayPrice: Number(r0.listPrice) - OFF, priceSun: Number(r0.listPrice) - OFF, weekendPrice: Number(r0.priceFri) - OFF, priceFri: Number(r0.priceFri) - OFF, priceSat: Number(r0.priceSat) - OFF } });
}
if (min < Infinity) await p.service.update({ where: { id: SID }, data: { basePrice: min, policy: svc.policy.replace("Giá phòng (2 khách/phòng, đã gồm ăn sáng):", "Giá niêm yết (2 khách/phòng, đã gồm ăn sáng):") } });
await p.$disconnect();
