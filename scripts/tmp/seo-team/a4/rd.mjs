import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.roadDistance.findMany({ select: { serviceId: true, placeId: true, sig: true, km: true, minutes: true, source: true } });
console.log("rows", rows.length);
const places = await p.place.findMany({ where: { id: { in: [...new Set(rows.map(r=>r.placeId))] } }, select: { id: true, name: true, kind: true, published: true, lat: true, lng: true, slug: true } });
const pm = new Map(places.map(x=>[x.id,x]));
const svcIds = new Set(rows.map(r=>r.serviceId).concat(rows.map(r=>r.placeId)));
const svcs = await p.service.findMany({ where: { id: { in: [...svcIds] } }, select: { id: true, title: true, published: true, lat: true, lng: true, category: true, slug: true } });
const sm = new Map(svcs.map(x=>[x.id,x]));
const kinds = {}; let valid=0;
for (const r of rows) { const pl = pm.get(r.placeId); const k = pl ? pl.kind : (sm.get(r.placeId) ? "SERVICE" : "?"); kinds[k]=(kinds[k]||0)+1;
  const s = sm.get(r.serviceId); const tgt = pl ?? sm.get(r.placeId);
  if (s && tgt && r.sig === `${s.lat},${s.lng}>${tgt.lat},${tgt.lng}`) valid++; }
console.log(kinds, "valid sig", valid, "sources", [...new Set(rows.map(r=>r.source))]);
const chk = places.filter(x=>x.kind==="CHECKIN"); console.log(chk.map(x=>x.name+(x.published?"":"(unpub)")).join(" | "));
console.log("homes", new Set(rows.map(r=>r.serviceId)).size, svcs.filter(s=>s.published && (s.category==="HOMESTAY"||s.category==="BUNGALOW")).length);
const allChk = await p.place.findMany({ where: { kind: "CHECKIN" }, select: { name: true, published: true, lat: true } }); console.log("all checkin:", allChk.length, allChk.filter(x=>x.published).length, allChk.filter(x=>x.published && x.lat!=null).length);
await p.$disconnect();
