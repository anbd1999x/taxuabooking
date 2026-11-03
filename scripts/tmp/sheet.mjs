import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
const HOST = "http://160.187.240.245";
const rows = fs.readFileSync("scripts/tmp/images.txt","utf8").split("\n").filter(Boolean)
  .map(l => { const m = l.match(/^(?:OK|--) (\S+) :: (.*)$/); return { url: m[1], ctx: m[2] }; });

const groups = JSON.parse(fs.readFileSync(process.argv[2],"utf8")); // [{name, match, limit, skip}]
const cacheDir = "scripts/tmp/cache";
fs.mkdirSync(cacheDir, { recursive: true });

async function get(url) {
  const f = path.join(cacheDir, url.split("/").pop());
  if (fs.existsSync(f)) return f;
  const r = await fetch(HOST + url);
  if (!r.ok) throw new Error(url + " " + r.status);
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  return f;
}

const CW = 280, CH = 190, COLS = 4;
for (const g of groups) {
  const re = new RegExp(g.match, "i");
  let list = rows.filter(r => re.test(r.ctx));
  const step = g.every ?? 1;
  list = list.filter((_, i) => i % step === 0).slice(g.skip ?? 0, (g.skip ?? 0) + (g.limit ?? 16));
  const tiles = [];
  const map = [];
  for (let i = 0; i < list.length; i++) {
    try {
      const f = await get(list[i].url);
      const buf = await sharp(f).resize(CW, CH, { fit: "cover" }).jpeg({ quality: 70 }).toBuffer();
      const label = Buffer.from(`<svg width="${CW}" height="24"><rect width="${CW}" height="24" fill="black" opacity="0.65"/><text x="6" y="17" font-size="15" fill="white" font-family="sans-serif">${i + 1}</text></svg>`);
      tiles.push(await sharp(buf).composite([{ input: label, top: CH - 24, left: 0 }]).toBuffer());
      map.push(`${i + 1} ${list[i].url} :: ${list[i].ctx}`);
    } catch (e) { map.push(`${i + 1} ERR ${list[i].url} ${e.message}`); }
  }
  const rowsN = Math.ceil(tiles.length / COLS);
  const canvas = sharp({ create: { width: CW * COLS, height: CH * rowsN, channels: 3, background: "#222" } });
  await canvas.composite(tiles.map((t, i) => ({ input: t, left: (i % COLS) * CW, top: Math.floor(i / COLS) * CH })))
    .jpeg({ quality: 72 }).toFile(`scripts/tmp/sheets/${g.name}.jpg`);
  fs.writeFileSync(`scripts/tmp/sheets/${g.name}.txt`, map.join("\n"));
  console.log(g.name, tiles.length, "tiles");
}
