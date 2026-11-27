import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const ids = process.argv.slice(2);
for (const pid of ids) {
const rows = await p.roadDistance.findMany({ where: { placeId: pid }, orderBy:{km:"asc"} });
const svc = await p.service.findMany({ where: { id: { in: rows.map(r=>r.serviceId) } }, select: { id:true, title:true, slug:true, distanceKm:true, lat:true, lng:true, published:true } });
const m = Object.fromEntries(svc.map(s=>[s.id,s]));
console.log("PLACE", pid, rows.length);
for (const r of rows) { const s=m[r.serviceId]; console.log(r.km.toFixed(1), r.minutes, r.source, s?.title, s?.slug, s?.distanceKm, s?.published, s?.lat?.toFixed(5), s?.lng?.toFixed(5)); }
}
await p.$disconnect();
