import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import fs from "node:fs";
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const p = new PrismaClient();
const ps = (await p.place.findMany({ where: { kind: { in: ["RESTAURANT","CAFE"] }, published: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] })).filter(x => !(x.content||"").trim());
await p.$disconnect();
const W = 300, H = 225;
const thumb = async (u) => {
  try { const r = await fetch("http://160.187.240.245" + u, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw 0; return await sharp(Buffer.from(await r.arrayBuffer())).resize(W, H, { fit: "cover" }).jpeg().toBuffer(); }
  catch { return await sharp({ create: { width: W, height: H, channels: 3, background: "#888" } }).jpeg().toBuffer(); }
};
const rows = [];
for (const x of ps) {
  const imgs = [x.coverImage, ...(x.images||"").split("|")].filter(Boolean).slice(0, 5);
  const ts = await Promise.all(imgs.map(thumb));
  rows.push({ label: `${x.slug}`, ts });
}
for (let i = 0; i < rows.length; i += 3) {
  const grp = rows.slice(i, i + 3);
  const RH = H + 30;
  const comp = [];
  grp.forEach((r, k) => {
    const y = k * RH;
    comp.push({ input: Buffer.from(`<svg width="${W*5}" height="30"><rect width="100%" height="100%" fill="#000"/><text x="8" y="22" font-size="20" fill="#ff0" font-family="Arial">${r.label}</text></svg>`), left: 0, top: y });
    r.ts.forEach((t, j) => comp.push({ input: t, left: j * W, top: y + 30 }));
  });
  await sharp({ create: { width: W * 5, height: RH * grp.length, channels: 3, background: "#fff" } }).composite(comp).jpeg({ quality: 60 }).toFile(`${OUT}/sheet${String(i/3).padStart(2,"0")}.jpg`);
}
console.log(rows.map(r => r.label).join("\n"), "\nsheets:", Math.ceil(rows.length/3));
