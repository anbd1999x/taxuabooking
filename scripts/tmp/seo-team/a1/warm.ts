import { warmCheckinRoads, cachedRoads, centerPt } from "../../../../src/lib/road-distance";
import { prisma } from "../../../../src/lib/prisma";
(async () => {
  await warmCheckinRoads((m) => console.log(m));
  const spots = (await prisma.place.findMany({ where: { kind: "CHECKIN", published: true }, select: { id: true, name: true, lat: true, lng: true } })).map((p) => ({ id: p.id, name: p.name, lat: p.lat!, lng: p.lng! }));
  const c = await cachedRoads(centerPt(), spots);
  for (const s of spots) console.log(s.name, c[s.id]);
  await prisma.$disconnect();
})();
