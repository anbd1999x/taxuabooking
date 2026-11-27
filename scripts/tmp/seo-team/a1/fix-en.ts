import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const places = await p.place.findMany({ where: { kind: "CHECKIN", published: true }, select: { name: true, desc: true, tip: true, area: true, price: true } });
  const srcs = places.flatMap((x) => [x.name, x.desc, x.tip, x.area, x.price].filter(Boolean) as string[]).map((s) => s.trim());
  const rows = await p.translation.findMany({ where: { locale: "en", source: { in: srcs } }, select: { id: true, source: true, value: true } });
  for (const r of rows) if (/Tà Xùa|Cliff/.test(r.value)) console.log(r.id, "|", r.source, "|", r.value);
  await p.$disconnect();
})();
