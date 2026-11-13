import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const ps = await prisma.place.findMany({ where: { kind: "CHECKIN", published: true }, orderBy: { sortOrder: "asc" } });
  for (const p of ps) console.log(`\n# ${p.name} | ${p.address} | giờ: ${p.hours} | giá: ${p.price} | tags: ${p.tags}\n  desc: ${p.desc}\n  tip: ${p.tip}\n  cover: ${p.coverImage}`);
  const hs = await prisma.service.findMany({ where: { category: "HOMESTAY", published: true } as any, select: { title: true, area: true, distanceKm: true, basePrice: true } as any, take: 60 });
  console.log("\nHOMESTAY", hs.length, JSON.stringify(hs.map((h: any) => [h.title, h.area, h.distanceKm, Number(h.basePrice)])));
  const rooms = await prisma.room.findMany({ select: { listPrice: true, salePrice: true, capacity: true } });
  const pr = rooms.map((r) => Number(r.salePrice ?? r.listPrice)).filter((x) => x > 0).sort((a, b) => a - b);
  console.log("\nROOM PRICES n=", pr.length, "min", pr[0], "p25", pr[Math.floor(pr.length * 0.25)], "median", pr[Math.floor(pr.length / 2)], "p75", pr[Math.floor(pr.length * 0.75)], "max", pr[pr.length - 1]);
  const rows = await prisma.cabinPriceRow.findMany({ where: { serviceId: null }, take: 30 });
  console.log("\nCABIN", JSON.stringify(rows.map((r: any) => [r.origin ?? r.label ?? r.name, r.ticketType, Number(r.price)])));
  const s = await prisma.siteSetting.findMany({ where: { key: { in: ["trustPopup", "autoCancelHours", "contactPhone"] } } });
  for (const x of s) console.log("\n", x.key, x.value.slice(0, 600));
})().finally(() => prisma.$disconnect());
