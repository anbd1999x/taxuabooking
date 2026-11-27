import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const pl = await p.place.findMany({ where:{published:true}, select:{kind:true,slug:true,name:true,area:true,coverImage:true,images:true,price:true} });
for (const x of pl) console.log("PLACE", x.kind, x.slug, "|", x.name, "|", x.area, "|", x.price, "|", x.coverImage, "|", (x.images||"").split("|").slice(0,6).join(" "));
const si = await p.serviceImage.findMany({ where:{ service:{ category:{in:["MOTORBIKE","TAXI","XEOM","CABIN"]}, published:true } }, include:{service:{select:{slug:true}}} });
for (const x of si) console.log("SIMG", x.service.slug, x.url, x.alt??"");
await p.$disconnect();
