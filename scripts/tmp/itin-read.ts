import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const row = await prisma.siteSetting.findUnique({ where: { key: "itinerary" } });
  if (!row) { console.log("no itinerary"); return; }
  const cfg = JSON.parse(row.value);
  const places = await prisma.place.findMany({ select: { id: true, name: true, kind: true, desc: true, tip: true, hours: true } });
  const byId = new Map(places.map((p) => [p.id, p]));
  console.log("keys", Object.keys(cfg));
  cfg.plans.forEach((p: any, pi: number) => {
    console.log(`\n== PLAN ${pi} id=${p.id} name=${p.name} sub=${p.sub} published=${p.published}`);
    p.days.forEach((d: any, di: number) => {
      console.log(`  -- day ${di}: ${d.title}`);
      d.stops.forEach((s: any, si: number) => {
        const pl = s.placeId ? byId.get(s.placeId) : null;
        console.log(`    [${si}] ${s.time} | ${pl ? `<${pl.kind}> ${pl.name}` : s.name} | note=${JSON.stringify(s.note)} | keys=${Object.keys(s).join(",")}`);
      });
    });
  });
})().finally(() => prisma.$disconnect());
