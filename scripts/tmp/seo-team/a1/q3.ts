import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const svc = await p.service.findMany({ where: { lat: { not: null }, category: { in: ["HOMESTAY", "BUNGALOW"] } }, select: { slug: true, title: true, area: true, lat: true, lng: true } });
  const K = { lat: 21.293684, lng: 104.402347 };
  const d = (a: any) => Math.hypot((a.lat - K.lat) * 110.57, (a.lng - K.lng) * 103.7);
  for (const s of svc.sort((a, b) => d(a) - d(b)).slice(0, 10)) console.log(d(s).toFixed(2), s.slug, "|", s.area);
  const ids = ["checkin_dinh_gio", "cmwd3ykal00vqod28u4eivn0o", "checkin_mom_ca_heo", "checkin_cay_co_don", "cmwd3r92v00vmod28a8ttu0ii", "checkin_thao_nguyen", "cmwd3imtn00knp728ulxjoh88"];
  const rd = await p.roadDistance.findMany({ where: { serviceId: { in: ids }, placeId: { in: ids } } });
  for (const r of rd) console.log(r.serviceId, "->", r.placeId, r.km, r.minutes);
  await p.$disconnect();
})();
