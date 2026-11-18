import sharp from "sharp";
import fs from "node:fs";
const dir = process.argv[2];
const list = `1793632958144-eb1a739fd0b7.jpg 1793700468765-f09b4b716519.jpg 1794218731236-8db19f0f1378.jpg 1794225726293-ee1ead1b7af4.jpg
1794215570016-83c691bdfceb.jpg 1793634556990-82ca59ed46de.png 1793855540301-d3c403997f37.jpg 1794214411492-765a1b6e9ea4.jpg
1794223293012-73fdc8ae0e9e.jpg 1793632879838-3b1576a6056c.jpg 1794840111401-34812b059608.jpg 1794731874814-8323452483db.jpg
1793518117109-ded66e6af4c8.jpg 1794933508736-09ede3d90f57.jpg 1794763118286-b609ba0a302b.jpg 1794640303453-d94a3adb1f48.jpg
1794213959093-62d564b3149f.jpg 1794840110545-fc926f9b9ab6.jpg 1794731874589-84be0fb21a35.jpg 1793632961207-b00f171f2218.jpg`.split(/\s+/);
const W = 480, H = 320, cols = 4;
const tiles = [];
for (let i = 0; i < list.length; i++) {
  const f = list[i];
  const res = await fetch("https://taxuabooking.com/uploads/" + f);
  if (!res.ok) { console.log("FAIL", f, res.status); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();
  console.log(i + 1, f, meta.width + "x" + meta.height);
  const img = await sharp(buf).resize(W, H, { fit: "cover" }).composite([{ input: Buffer.from(`<svg width="${W}" height="40"><rect width="70" height="40" fill="black"/><text x="8" y="29" font-size="26" fill="yellow" font-family="Arial">${i + 1}</text></svg>`), top: 0, left: 0 }]).jpeg({ quality: 70 }).toBuffer();
  tiles.push({ input: img, left: (i % cols) * W, top: Math.floor(i / cols) * H });
}
await sharp({ create: { width: W * cols, height: H * Math.ceil(list.length / cols), channels: 3, background: "#fff" } }).composite(tiles).jpeg({ quality: 75 }).toFile(dir + "/sheet.jpg");
