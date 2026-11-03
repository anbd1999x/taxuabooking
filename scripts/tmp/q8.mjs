import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.cabinPriceRow.findMany({ orderBy:[{sortOrder:"asc"}], select:{ pickupPoint:true, destination:true, ticketType:true, price:true, service:{select:{title:true}} } });
console.log("PRICE ROWS:", rows.length);
for (const r of rows) console.log(` ${r.service?.title??"CHUNG"} | ${r.pickupPoint} -> ${r.destination} | ${r.ticketType} | ${Number(r.price)}`);
const routes = await p.cabinRoute.findMany({ select:{ direction:true, service:{select:{title:true}}, stops:{ select:{ place:true, time:true, tag:true }, orderBy:{sortOrder:"asc"} } } });
console.log("\nROUTES:");
for (const r of routes) { console.log(` ${r.service.title} ${r.direction}`); for (const s of r.stops) console.log(`    - ${s.time??""} | ${s.place} | ${s.tag??""}`); }
const trips = await p.cabinTrip.findMany({ select:{ serviceId:true, departureDate:true, departureTime:true, direction:true, pickupPoint:true, dropoffPoint:true, price:true, priceDouble:true, seatsTotal:true, seatsDoubleTotal:true, service:{select:{title:true}} }, orderBy:{departureDate:"asc"}, take: 8 });
console.log("\nSAMPLE TRIPS:");
for (const t of trips) console.log(` ${t.service.title} | ${t.departureDate.toISOString().slice(0,10)+" "+(t.departureTime??"")} | ${t.direction} | đơn ${Number(t.price)} x${t.seatsTotal} | đôi ${t.priceDouble?Number(t.priceDouble):"-"} x${t.seatsDoubleTotal}`);
const agg = await p.cabinTrip.groupBy({ by:["serviceId"], _count:true });
console.log("\nTRIP COUNT:", JSON.stringify(agg));
await p.$disconnect();
