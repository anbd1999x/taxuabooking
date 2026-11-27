import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const s = await p.service.findMany({ where:{ published:true, category:{in:["HOMESTAY","BUNGALOW"]} }, select:{ slug:true, easyRoad:true, roomTypes:{ select:{ cloudView:true } } } });
console.log("total", s.length, "cloud", s.filter(x=>x.roomTypes.some(t=>t.cloudView)).length, "easy", s.filter(x=>x.easyRoad).length);
await p.$disconnect();
