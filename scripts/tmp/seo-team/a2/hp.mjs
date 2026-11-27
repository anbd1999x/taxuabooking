import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
for (const slug of process.argv.slice(2)) {
  const s = await p.service.findUnique({ where: { slug }, select: { title: true, published: true, easyRoad: true, roomTypes: { select: { name: true, cloudView: true, rooms: { select: { name: true, listPrice: true, salePrice: true, capacity: true } } } } } });
  const rooms = s.roomTypes.flatMap(rt => rt.rooms.map(r => ({ ...r, rt: rt.name, cv: rt.cloudView })));
  const pr = rooms.map(r => Number(r.salePrice ?? r.listPrice)).filter(x => x > 0);
  console.log(slug, s.title, s.published, "easyRoad", s.easyRoad, "rooms", rooms.length, "cloudView", rooms.filter(r=>r.cv).length, "min", Math.min(...pr), "max", Math.max(...pr));
}
await p.$disconnect();
