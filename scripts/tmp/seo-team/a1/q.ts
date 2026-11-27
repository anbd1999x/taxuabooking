import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const rows = await p.place.findMany({ where: { kind: "CHECKIN" }, orderBy: { sortOrder: "asc" } });
  for (const r of rows) console.log(JSON.stringify({ id: r.id, slug: r.slug, name: r.name, area: r.area, address: r.address, price: r.price, hours: r.hours, hw: r.hoursWeekend, tags: r.tags, desc: r.desc, tip: r.tip, content: r.content?.slice(0, 300), contentLen: r.content?.length, cover: r.coverImage, images: r.images, mapUrl: r.mapUrl, lat: r.lat, lng: r.lng, pub: r.published }));
  const arts = await p.article.findMany({ where: { published: true }, select: { slug: true, title: true, topic: true } });
  console.log(arts.length); for (const a of arts) console.log(a.slug, "|", a.title, "|", a.topic);
  const rd = await p.roadDistance.count(); console.log("rd", rd);
  await p.$disconnect();
})();
