import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const r = await p.transportRoute.findMany({ include:{ service:{select:{slug:true,category:true,published:true}}, fromPoint:true, toPoint:true } });
for (const x of r) if (x.service.published) console.log(x.service.category, x.service.slug, "|", x.fromPoint.name, "->", x.toPoint.name, "|", x.priceOneWay?+x.priceOneWay:null, x.priceTwo?+x.priceTwo:null, x.priceRoundTrip?+x.priceRoundTrip:null, x.note??"");
const rv = await p.rentalVehicle.findMany({ include:{service:{select:{slug:true,published:true}}}});
for (const v of rv) if(v.service.published) console.log("RENT", v.service.slug, "|", v.name, +v.pricePerDay, v.listPrice?+v.listPrice:null);
await p.$disconnect();
