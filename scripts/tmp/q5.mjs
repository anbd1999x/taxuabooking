import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
const rows = [];
for (const i of await p.serviceImage.findMany({ select:{url:true, service:{select:{title:true,category:true,area:true}}} }))
  rows.push([i.url, `SVC ${i.service.category} ${i.service.title} (${i.service.area??"-"})`]);
for (const i of await p.roomTypeImage.findMany({ select:{url:true, roomType:{select:{name:true, service:{select:{title:true}}}}} }))
  rows.push([i.url, `RT ${i.roomType.service.title} / ${i.roomType.name}`]);
for (const i of await p.roomImage.findMany({ select:{url:true, room:{select:{name:true, roomType:{select:{name:true, service:{select:{title:true}}}}}}} }))
  rows.push([i.url, `ROOM ${i.room.roomType.service.title} / ${i.room.name}`]);
for (const pl of await p.place.findMany({ select:{name:true,kind:true,coverImage:true,images:true} })) {
  if (pl.coverImage) rows.push([pl.coverImage, `PLACE ${pl.kind} ${pl.name}`]);
  for (const u of (pl.images??"").split("|").filter(Boolean)) rows.push([u, `PLACE ${pl.kind} ${pl.name}`]);
}
const local = new Set(fs.readdirSync("public/uploads"));
let yes=0,no=0;
const lines = rows.map(([u,ctx]) => { const f=u.split("/").pop(); const ex=local.has(f); ex?yes++:no++; return `${ex?"OK":"--"} ${u} :: ${ctx}`; });
fs.writeFileSync("scripts/tmp/images.txt", lines.join("\n"));
console.log("total", rows.length, "localOK", yes, "missing", no);
const byCtx = {};
for (const [u,ctx] of rows) { const k=ctx.split(" /")[0]; byCtx[k]=(byCtx[k]||0)+1; }
console.log(Object.entries(byCtx).map(([k,v])=>`${v} ${k}`).sort().join("\n"));
await p.$disconnect();
