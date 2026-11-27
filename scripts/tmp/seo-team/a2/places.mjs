import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const pl = await p.place.findMany({ select: { id:true, kind: true, slug: true, name: true, area: true, lat: true, lng: true, price:true, hours:true, published:true, desc:true, coverImage:true, images:true, tags:true, booking:true, content:true, phone:true, address:true } });
for (const x of pl) console.log([x.kind, x.published?'':'(ẩn)', x.slug, x.name, x.area, x.lat?.toFixed(5), x.lng?.toFixed(5), x.price, x.hours, (x.content||'').length].join(" | "));
const xv = pl.filter(x=>/xím|mâm xôi|xim/i.test(x.name+x.slug));
console.log(JSON.stringify(xv,null,1));
await p.$disconnect();
