import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const UP = 55000, STRIKE = 100000, SID = "cmwluj9cl0000un6o3iocxm7q";
const fmt = (n) => n.toLocaleString("vi-VN") + "đ";
const svc = await p.service.findUniqueOrThrow({ where: { id: SID }, select: { policy: true, summary: true, roomTypes: { orderBy: { sortOrder: "asc" }, include: { rooms: true } } } });
let { policy, summary } = svc, min = Infinity;
for (const t of svc.roomTypes) {
  const wd = Number(t.weekdayPrice), sat = Number(t.priceSat), hol = Number(t.holidayPrice);
  for (const r of t.rooms) {
    if (r.salePrice != null) { console.log("bỏ qua (đã có giá bán):", r.name); continue; }
    const cur = Number(r.listPrice), cs = Number(r.priceSat);
    await p.room.update({ where: { id: r.id }, data: { listPrice: cur + STRIKE, salePrice: cur + UP, listPriceSat: cs + STRIKE, priceSat: cs + UP, description: (r.description ?? "").replace(`Ngày lễ ${fmt(hol)}`, `Ngày lễ ${fmt(hol + UP)}`) } });
    min = Math.min(min, cur + UP);
  }
  if (t.rooms.every((r) => r.salePrice != null)) continue;
  await p.roomType.update({ where: { id: t.id }, data: { weekdayPrice: wd + UP, priceSun: wd + UP, weekendPrice: sat + UP, priceSat: sat + UP, holidayPrice: hol + UP } });
  const oldLine = `CN–Thứ 6 ${fmt(wd)} · Thứ 7 ${fmt(sat)} · Ngày lễ ${fmt(hol)}`;
  const newLine = `CN–Thứ 6 ${fmt(wd + UP)} · Thứ 7 ${fmt(sat + UP)} · Ngày lễ ${fmt(hol + UP)}`;
  // hai hạng trùng giá (nhà sàn, bungalow) ⇒ thay theo từng dòng có tên hạng
  policy = policy.replace(`- ${t.name} (` , `- ${t.name} (`).split("\n").map((l) => (l.startsWith(`- ${t.name} (`) ? l.replace(oldLine, newLine) : l)).join("\n");
  console.log(t.name, `CN–T6 ${wd}→ bán ${wd + UP}, gạch ${wd + STRIKE} · T7 ${sat}→ bán ${sat + UP}, gạch ${sat + STRIKE} · lễ ${hol + UP}`);
}
if (min < Infinity) {
  await p.service.update({ where: { id: SID }, data: { basePrice: min, policy, summary: summary.replace("giá từ 300.000đ/đêm", `giá từ ${fmt(min)}/đêm`) } });
  console.log(policy.split("\n").slice(0, 5).join("\n"));
}
await p.$disconnect();
