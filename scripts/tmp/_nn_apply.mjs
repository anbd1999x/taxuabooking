import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
const rooms = await p.room.findMany({ where: { roomType: { service: { slug: "nhat-nang-house-ta-xua" } } }, orderBy: [{ roomType: { sortOrder: "asc" } }, { sortOrder: "asc" }], include: { roomType: { select: { name: true } } } });
fs.writeFileSync(process.argv[2], JSON.stringify(rooms, null, 1));
const N = (v) => (v == null ? null : Number(v));
// Chỉ áp khi phòng còn ở trạng thái gốc (chưa có giá bán riêng / giá gạch thứ 7) ⇒ chạy lại không cộng dồn.
const bad = rooms.filter((r) => r.salePrice != null || r.listPriceSat != null || N(r.priceSat) == null || !(N(r.listPrice) > 0));
if (bad.length) { console.log("DỪNG — phòng không ở trạng thái gốc:", bad.map((r) => r.name)); process.exit(1); }
const k = (v) => v / 1000;
await p.$transaction(rooms.map((r) => {
  const wd = N(r.listPrice), sat = N(r.priceSat);
  const d = { listPrice: wd + 100000, salePrice: wd + 55000, priceSat: sat + 100000, listPriceSat: sat + 150000, commission: 55000, commissionSat: 100000 };
  console.log(`${r.roomType.name} / ${r.name}: ngày thường ${k(wd)} → bán ${k(d.salePrice)}, gạch ${k(d.listPrice)} | T7 ${k(sat)} → bán ${k(d.priceSat)}, gạch ${k(d.listPriceSat)} | CK cũ ${N(r.commission) ?? "-"}/${N(r.commissionSat) ?? "-"}`);
  return p.room.update({ where: { id: r.id }, data: d });
}));
console.log("Đã cập nhật", rooms.length, "phòng");
await p.$disconnect();
