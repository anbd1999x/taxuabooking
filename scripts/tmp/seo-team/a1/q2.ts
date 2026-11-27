import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const rows = await p.place.findMany({ where: { kind: "CHECKIN" }, orderBy: { sortOrder: "asc" }, select: { slug: true, content: true, hours: true, price: true, tip: true } });
  for (const r of rows.slice(0, 3)) console.log("=====", r.slug, "\n", r.content);
  for (const r of rows) console.log(r.slug, "|", r.hours, "|", r.price, "|", r.tip, "| FAQ:", /câu hỏi/i.test(r.content ?? ""), "| H2:", (r.content ?? "").match(/^## .*/gm)?.join(" / "));
  const cnt = await p.roadDistance.groupBy({ by: ["placeId"], _count: { _all: true }, where: { placeId: { in: (await p.place.findMany({ where: { kind: "CHECKIN" }, select: { id: true } })).map((x) => x.id) } } });
  console.log(cnt.map((c) => c.placeId + ":" + c._count._all).join(" "));
  await p.$disconnect();
})();
