import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const s = await p.service.findMany({ where:{ published:true, category:"HOMESTAY", slug:{ in: process.argv.slice(2) } }, select:{ slug:true, title:true, easyRoad:true, roomTypes:{ select:{ name:true, cloudView:true, heating:true, hasBathtub:true, rooms:{ select:{ name:true, listPrice:true, salePrice:true, capacity:true } } } } } });
for (const x of s) { const pr = x.roomTypes.flatMap(t=>t.rooms.map(r=>+(r.salePrice??r.listPrice))).filter(Boolean); const n = x.roomTypes.flatMap(t=>t.rooms).length; console.log(x.slug, "|", x.title, "| rooms", n, "| ", Math.min(...pr), "-", Math.max(...pr), "| easyRoad", x.easyRoad, "| heat", x.roomTypes.filter(t=>t.heating).flatMap(t=>t.rooms).length, "bath", x.roomTypes.filter(t=>t.hasBathtub).flatMap(t=>t.rooms).length, "cloud", x.roomTypes.filter(t=>t.cloudView).flatMap(t=>t.rooms).length); }
await p.$disconnect();
