import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const svcs = await prisma.service.findMany({
    where: { category: "HOMESTAY", title: { contains: "suối", mode: "insensitive" } },
    include: { roomTypes: { include: { rooms: true } } },
  });
  for (const s of svcs) {
    console.log("==", s.title, s.slug, { published: s.published, contactOnly: s.contactOnly, weekendPolicy: s.weekendPolicy, extraPersonFee: String(s.extraPersonFee), childFree: s.childFreeUnderAge });
    for (const rt of s.roomTypes) {
      console.log(" RT", rt.name, { bathtub: rt.hasBathtub, cloud: rt.cloudView, bf: rt.breakfast, ac: rt.airCon, heat: rt.heating });
      for (const r of rt.rooms) {
        const st = await prisma.roomDayStatus.findMany({
          where: { roomId: r.id, date: { gte: new Date("2026-11-28"), lte: new Date("2026-12-03") } },
          orderBy: { date: "asc" },
        });
        console.log("   ", r.name, JSON.stringify({
          cap: r.capacity, max: r.maxCapacity, list: String(r.listPrice), sale: String(r.salePrice),
          dow: [r.priceMon, r.priceTue, r.priceWed, r.priceThu, r.priceFri, r.priceSat, r.priceSun].map(String),
          noDisc: r.noComboDiscount,
        }), st.map((x) => `${x.date.toISOString().slice(5, 10)}:${x.status}`).join(" "));
      }
    }
  }
  await prisma.$disconnect();
})();
