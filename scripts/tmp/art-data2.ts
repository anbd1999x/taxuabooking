import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const s = await prisma.service.findMany({ where: { category: "HOMESTAY", published: true }, select: { title: true, slug: true, area: true, earlyCheckinFee: true, lateCheckoutFee: true, policy: true, extraPersonFee: true } });
  for (const x of s) console.log(x.title, "| early", x.earlyCheckinFee?.toString(), "| late", x.lateCheckoutFee?.toString(), "| extra", x.extraPersonFee?.toString(), "|", (x.policy ?? "").replace(/\s+/g, " ").slice(0, 300));
  const m = await prisma.service.findMany({ where: { category: { in: ["MOTORBIKE", "XEOM", "TAXI"] }, published: true }, select: { title: true, category: true, basePrice: true, priceUnit: true, summary: true } });
  for (const x of m) console.log("M", x.category, x.title, x.basePrice?.toString(), x.priceUnit, (x.summary ?? "").slice(0, 150));
  const c = await prisma.service.findMany({ where: { category: "CABIN", published: true }, select: { title: true, basePrice: true, cabinPriceRows: { where: { pickupPoint: "Hà Nội" }, select: { ticketType: true, price: true } } } });
  for (const x of c) console.log("C", x.title, x.basePrice?.toString(), x.cabinPriceRows.map((r) => r.ticketType + ":" + r.price).join(","));
  const g = await prisma.cabinPriceRow.findMany({ where: { serviceId: null }, select: { pickupPoint: true, ticketType: true, price: true } });
  console.log("G", g.map((r) => `${r.pickupPoint} ${r.ticketType} ${r.price}`).join("; "));
  await prisma.$disconnect();
})();
