import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const a = await prisma.article.findMany({ select: { topic: true, slug: true, coverImage: true } });
  console.log("TOPICS", [...new Set(a.map((x) => x.topic))].join(","));
  for (const x of a.filter((x) => /cabin|xe-|duong-di|combo|homestay|a-z/.test(x.slug))) console.log(x.slug, x.topic, x.coverImage);
  const imgs: any[] = await prisma.serviceImage.findMany({ where: { service: { category: "CABIN" } }, take: 12 });
  for (const i of imgs) console.log("CABINIMG", i.url, i.alt ?? "");
  const others = await prisma.service.findMany({ where: { category: { in: ["MOTORBIKE", "XEOM", "TAXI"] as any }, published: true } });
  for (const o of others as any[]) console.log("OTHER", o.category, o.title, Number(o.basePrice), o.priceUnit ?? "", (o.summary ?? o.description ?? "").slice(0, 160));
  const t: any[] = await prisma.cabinTrip.findMany({ orderBy: { departureDate: "desc" }, take: 8 });
  for (const x of t) console.log("TRIP", x.operatorName, x.direction, x.departureTime, x.pickupPoint, "→", x.dropoffPoint, Number(x.price), x.priceDouble && Number(x.priceDouble));
  const g = await prisma.article.findUnique({ where: { slug: "gia-ve-xe-cabin-ha-noi-ta-xua" } });
  console.log(g?.content.slice(0, 2600));
})().finally(() => prisma.$disconnect());
