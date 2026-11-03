import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const svcs = await p.service.findMany({ where:{ category:"HOMESTAY", published:true }, select:{ title:true, slug:true, area:true, distanceKm:true, easyRoad:true, pool:true, summary:true,
  roomTypes:{ select:{ name:true, hasBathtub:true, cloudView:true, breakfast:true, airCon:true, heating:true, rooms:{ select:{ name:true, capacity:true, listPrice:true, salePrice:true, maxCapacity:true } } } } } });
for (const s of svcs) {
  const prices = s.roomTypes.flatMap(rt=>rt.rooms.map(r=>Number(r.salePrice??r.listPrice??0))).filter(Boolean);
  const am = new Set(); for (const rt of s.roomTypes) { if(rt.hasBathtub)am.add("bồn tắm"); if(rt.cloudView)am.add("view mây"); if(rt.breakfast)am.add("ăn sáng"); if(rt.airCon)am.add("điều hòa"); if(rt.heating)am.add("sưởi"); }
  console.log(`${s.title} | /homestay/${s.slug} | area=${s.area??"-"} | km=${s.distanceKm??"-"} | easyRoad=${s.easyRoad} | pool=${s.pool} | phòng=${s.roomTypes.reduce((a,b)=>a+b.rooms.length,0)} | giá=${prices.length?Math.min(...prices)+"–"+Math.max(...prices):"-"} | ${[...am].join(", ")}`);
  console.log(`    summary: ${(s.summary??"").slice(0,160)}`);
}
await p.$disconnect();
