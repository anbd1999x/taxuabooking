import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
const n = (d) => (d == null ? null : Number(d));
const out = [];
const hs = await p.service.findMany({ where: { category: { in: ["HOMESTAY", "BUNGALOW"] }, published: true },
  include: { roomTypes: { include: { rooms: true } }, images: { take: 3, orderBy: { sortOrder: "asc" } }, _count: { select: { reviews: true } } }, orderBy: [{ featured: "desc" }, { priorityOrder: "desc" }] });
out.push("## HOMESTAY " + hs.length);
for (const s of hs) {
  const rooms = s.roomTypes.flatMap((t) => t.rooms.filter(r => r.active !== false).map((r) => ({ t, r })));
  const prices = rooms.map(({ r }) => n(r.salePrice) ?? n(r.listPrice)).filter((x) => x > 0);
  const f = (k) => s.roomTypes.filter((t) => t[k]).length;
  const cv = rooms.filter(({ t }) => t.cloudView).map(({ r }) => n(r.salePrice) ?? n(r.listPrice)).filter(x => x > 0);
  out.push(`- ${s.title} | /${s.category === "BUNGALOW" ? "homestay" : "homestay"}/${s.slug} | cat=${s.category} area=${s.area} km=${s.distanceKm} feat=${s.featured} pool=${s.pool} easy=${s.easyRoad} contactOnly=${s.contactOnly} inquiry=${s.inquiryOnly} | rooms=${rooms.length} types=${s.roomTypes.length} price=${Math.min(...prices)}..${Math.max(...prices)} | cloudTypes=${f("cloudView")} cloudMin=${cv.length ? Math.min(...cv) : "-"} bath=${f("hasBathtub")} bf=${f("breakfast")} heat=${f("heating")} ac=${f("airCon")} | img=${s.images.map((i) => i.url).join(",")} | ${s.summary.slice(0, 160)}`);
}
for (const cat of ["CABIN", "MOTORBIKE", "XEOM", "TAXI", "COMBO"]) {
  const ss = await p.service.findMany({ where: { category: cat, published: true }, include: { rentalVehicles: true, cabinPriceRows: { orderBy: { sortOrder: "asc" } }, transportRoutes: true, transport: true, images: { take: 4, orderBy: { sortOrder: "asc" } }, fleetConfig: true, _count: { select: { fleetVehicles: true } } } });
  out.push(`\n## ${cat} ${ss.length}`);
  for (const s of ss) {
    out.push(`- ${s.title} | slug=${s.slug} area=${s.area} km=${s.distanceKm} base=${n(s.basePrice)}${s.priceUnit ?? ""} feat=${s.featured} phone=${s.contactPhone ? "có" : "-"} | img=${s.images.map((i) => i.url).join(",")}`);
    out.push(`  summary: ${s.summary}`);
    if (cat !== "CABIN") out.push(`  desc: ${s.description.slice(0, 1500).replace(/\n+/g, " ⏎ ")}`);
    for (const v of s.rentalVehicles) out.push(`  xe: ${v.vehicleType} ${n(v.pricePerDay)}/ngày x${v.totalUnits} giao=${n(v.deliveryFee)} màu=${v.colors.join("/")} img=${v.imageUrl}`);
    if (cat === "MOTORBIKE") out.push(`  fleet=${s._count.fleetVehicles} cfg=${JSON.stringify(s.fleetConfig?.data ?? s.fleetConfig ?? null).slice(0, 700)}`);
    for (const r of s.cabinPriceRows) out.push(`  giá: ${r.pickupPoint} → ${r.destination} ${r.ticketType} ${n(r.price)} ${r.note ?? ""}`);
    for (const r of s.transportRoutes) out.push(`  tuyến: ${JSON.stringify(r, (k, v) => (typeof v === "object" && v && v.constructor?.name === "Decimal" ? Number(v) : v)).slice(0, 300)}`);
    if (s.transport) out.push(`  transport: ${JSON.stringify(s.transport).slice(0, 400)}`);
  }
}
const set = await p.siteSetting.findMany({ where: { key: { in: ["phone", "zalo", "hotline", "address", "sitePhone", "contactPhone"] } } });
out.push("\n## SETTINGS " + JSON.stringify(set));
for (const slug of ["homestay-ta-xua-view-may-dep", "thue-xe-may-ta-xua", "kinh-nghiem-dat-phong-homestay-ta-xua", "so-sanh-nha-xe-di-ta-xua"]) {
  const a = await p.article.findUnique({ where: { slug } });
  out.push(`\n\n######## ARTICLE ${slug} | ${a.title} | cover=${a.coverImage} | created=${a.createdAt.toISOString()}\nEXCERPT: ${a.excerpt}\n${a.content}`);
}
fs.writeFileSync(process.argv[2], out.join("\n"));
console.log("ok", out.length);
await p.$disconnect();
