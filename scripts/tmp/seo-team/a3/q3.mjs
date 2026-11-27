import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.cabinPriceRow.findMany({ include:{service:{select:{title:true,slug:true,published:true}}}, orderBy:[{serviceId:"asc"},{sortOrder:"asc"}] });
for (const r of rows) console.log(r.service?.slug ?? "CHUNG", "|", r.pickupPoint, r.destination, r.ticketType, +r.price, r.note??"");
const svc = await p.service.findMany({ where:{published:true}, select:{slug:true,title:true,category:true,basePrice:true,lat:true,lng:true,area:true}, orderBy:{category:"asc"} });
for (const s of svc) console.log(s.category, s.slug, "|", s.title, "|", +s.basePrice, s.lat, s.lng, s.area);
await p.$disconnect();
