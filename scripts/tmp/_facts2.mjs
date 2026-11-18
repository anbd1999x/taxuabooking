import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const n = (d) => (d == null ? null : Number(d));
const slugs = ["la-cheu-homestay","thac-may-ta-xua","khen-coffee-house-ta-xua","pang-village-ta-xua","cloud-forest-ta-xua","cham-hoang-hon","phong-lai-homstay","lao-xan","ban-may-ta-xua-retreat","doc-mo-homestay","mong-vang-retreat","sunset-clouds-ta-xua","chung-chinh-homestay"];
for (const slug of slugs) {
  const s = await p.service.findUnique({ where: { slug }, include: { roomTypes: { include: { rooms: true }, orderBy: { sortOrder: "asc" } }, images: { take: 6, orderBy: { sortOrder: "asc" } }, reviews: true } });
  console.log(`\n### ${s.title} (${slug}) area=${s.area} km=${s.distanceKm} easy=${s.easyRoad} reviews=${s.reviews.length}`);
  console.log("DESC:", s.description.slice(0, 900).replace(/\n+/g, " ⏎ "));
  for (const t of s.roomTypes) {
    const ps = t.rooms.flatMap((r) => [r.salePrice ?? r.listPrice, r.priceMon, r.priceTue, r.priceWed, r.priceThu, r.priceFri, r.priceSat, r.priceSun].map(n).filter((x) => x > 0));
    console.log(`  [${t.cloudView ? "MÂY" : "   "}${t.hasBathtub ? " BỒN" : ""}${t.breakfast ? " SÁNG" : ""}${t.heating ? " SƯỞI" : ""}] ${t.name} · ${t.rooms.length} phòng · cap ${[...new Set(t.rooms.map((r) => r.capacity))].join("/")} · ${ps.length ? Math.min(...ps) + "–" + Math.max(...ps) : "?"}`);
  }
  console.log("  IMG:", s.images.map((i) => i.url + (i.alt ? `(${i.alt})` : "")).join(" "));
}
await p.$disconnect();
