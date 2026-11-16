// Liệt kê mọi chuỗi nội dung trong DB đang hiển thị ở trang khách (để dịch sẵn).
//   node --env-file=<env> scripts/i18n/db-strings.mjs [out.json]
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const prisma = new PrismaClient();
const VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const out = new Set();
const add = (v) => { if (typeof v === "string") { const s = v.trim(); if (s && VI.test(s)) out.add(s); } };
const list = (v, sep = /,/) => (v ?? "").split(sep).forEach(add);
const svcs = await prisma.service.findMany({ where: { published: true }, include: { roomTypes: { include: { rooms: true } }, rentalVehicles: true, transport: true, cabinRoutes: { include: { stops: true } }, cabinPriceRows: true, cabinTrips: { take: 5, orderBy: { departureDate: "desc" } } } });
for (const s of svcs) {
  [s.title, s.summary, s.description, s.area, s.policy, s.priceUnit].forEach(add);
  for (const rt of s.roomTypes) { add(rt.name); for (const r of rt.rooms) { add(r.name); add(r.description); list(r.amenities); } }
  for (const v of s.rentalVehicles) { add(v.vehicleType); v.colors.forEach(add); }
  if (s.transport) [s.transport.fromPoint, s.transport.toArea, s.transport.vehicleType, s.transport.priceNote].forEach(add);
  for (const r of s.cabinRoutes) { [r.title, r.totalTime, r.startLabel, r.startInfo, r.fromPoint, r.toPoint].forEach(add); for (const st of r.stops) [st.place, st.note, st.tag].forEach(add); }
  for (const p of s.cabinPriceRows) [p.pickupPoint, p.destination, p.note].forEach(add);
  for (const t of s.cabinTrips) [t.route, t.pickupPoint, t.dropoffPoint, t.note].forEach(add);
}
for (const p of await prisma.cabinPriceRow.findMany({ where: { serviceId: null } })) [p.pickupPoint, p.destination, p.note].forEach(add);
for (const a of await prisma.article.findMany({ where: { published: true } })) [a.title, a.excerpt, a.content].forEach(add);
for (const p of await prisma.place.findMany({ where: { published: true } })) { [p.name, p.area, p.address, p.price, p.desc, p.tip, p.content, p.hours].forEach(add); list(p.tags); }
const settings = Object.fromEntries((await prisma.siteSetting.findMany()).map((r) => [r.key, r.value]));
for (const k of ["heroTitle", "cabinComboTitle", "cabinComboSub", "cabinFareSubtitle", "cabinComboNote", "cabinFareFootnote", "cabinTagline", "contactAddress", "legalName", "legalAddress"]) add(settings[k]);
// lịch trình mẫu + popup uy tín (JSON trong SiteSetting): lấy mọi chuỗi lá
const walk = (v) => { if (typeof v === "string") add(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
for (const k of ["itinerary", "trustPopup"]) { try { walk(JSON.parse(settings[k] ?? "null")); } catch {} }
// bỏ chuỗi đã có trong từ điển giao diện
const dict = JSON.parse(fs.readFileSync("src/lib/i18n/dict/en.json", "utf8"));
const done = new Set((await prisma.translation.findMany({ where: { locale: "en" }, select: { source: true } })).map((r) => r.source));
// So khớp sau khi bỏ CR như lúc lưu/tra bản dịch (normSource) — trước đây chuỗi có CR luôn bị báo "cần dịch".
const norm = (s) => s.replace(/\r\n?/g, "\n").trim();
const doneN = new Set([...done].map(norm));
const todo = [...out].filter((s) => !(s in dict) && !doneN.has(norm(s)));
const file = process.argv[2] ?? "scripts/i18n/out/db-strings.json";
fs.mkdirSync("scripts/i18n/out", { recursive: true });
fs.writeFileSync(file, JSON.stringify(todo, null, 1));
console.log(`db strings: ${out.size}, cần dịch: ${todo.length}, ký tự: ${todo.join("").length} → ${file}`);
await prisma.$disconnect();
