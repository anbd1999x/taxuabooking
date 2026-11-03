import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const si = await p.serviceImage.findMany({ select:{ url:true, alt:true, service:{select:{title:true,category:true,area:true}} } });
console.log("SERVICE IMAGES:", si.length);
console.log(si.map(i=>`${i.url} :: ${i.service.category} ${i.service.title} :: alt=${i.alt??""}`).join("\n"));
await p.$disconnect();
