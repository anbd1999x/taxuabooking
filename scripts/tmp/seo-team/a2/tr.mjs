import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const pts = await p.transportPoint.findMany();
console.log(pts.map(x=>x.name).join(" | "));
const r = await p.transportRoute.findMany({ include: { fromPoint: true, toPoint: true, service: { select: { title: true, slug: true, category: true, published: true } } } });
for (const x of r) if (x.service.published && /khèn|bắc yên|đỉnh gió/i.test(x.fromPoint.name + x.toPoint.name)) console.log(x.service.category, x.service.slug, x.fromPoint.name, "→", x.toPoint.name, x.priceOneWay?.toString(), x.priceTwo?.toString(), x.priceRoundTrip?.toString(), x.note);
const rv = await p.rentalVehicle.findMany({ include: { service: { select: { slug: true, published: true } } } });
for (const v of rv) if (v.service.published) console.log("RENT", v.service.slug, v.name, v.vehicleType, v.pricePerDay?.toString());
await p.$disconnect();
