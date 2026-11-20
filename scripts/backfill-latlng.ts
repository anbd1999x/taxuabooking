/**
 * Bổ sung TOẠ ĐỘ còn thiếu từ link Google Maps cho homestay (Service) và địa điểm (Place) — chỉ ghi ô đang trống.
 * Chạy: npx tsx --env-file=.env scripts/backfill-latlng.ts
 */
import { PrismaClient } from "@prisma/client";
import { resolveMapLatLng } from "../src/lib/map-link";
const p = new PrismaClient();
(async () => {
  const svcs = await p.service.findMany({ where: { category: { in: ["HOMESTAY", "BUNGALOW"] }, lat: null, mapUrl: { not: null } }, select: { id: true, title: true, mapUrl: true } });
  const places = await p.place.findMany({ where: { lat: null, mapUrl: { not: null } }, select: { id: true, name: true, mapUrl: true } });
  let ok = 0;
  const miss: string[] = [];
  for (const s of svcs) {
    const g = await resolveMapLatLng(s.mapUrl).catch(() => null);
    if (g) { await p.service.update({ where: { id: s.id }, data: { lat: g.lat, lng: g.lng } }); ok++; } else miss.push("home: " + s.title);
  }
  for (const s of places) {
    const g = await resolveMapLatLng(s.mapUrl).catch(() => null);
    if (g) { await p.place.update({ where: { id: s.id }, data: { lat: g.lat, lng: g.lng } }); ok++; } else miss.push("place: " + s.name);
  }
  console.log(`Đã thêm toạ độ: ${ok}/${svcs.length + places.length}`);
  if (miss.length) console.log("Chưa lấy được:\n  " + miss.join("\n  "));
  await p.$disconnect();
})();
