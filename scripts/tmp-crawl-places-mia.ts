/** Giai đoạn B: rút ảnh 6 quán từ bài viết mia.vn → gộp vào manifest-places.json */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const SCRATCH = process.argv[2]!;
const OUT = path.join(SCRATCH, "out-places");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0";

// Place slug → {url bài, tiền tố tên file ảnh trong bài}
const PAGES: Record<string, { url: string; prefix: string }> = {
  "nha-cua-an-homestay-coffee": { url: "https://mia.vn/cam-nang-du-lich/nha-cua-an-homestay-cafe-ta-xua-21841", prefix: "nha-cua-an" },
  "cafe-lang-van-hoa": { url: "https://mia.vn/cam-nang-du-lich/lang-van-hoa-cafe-ta-xua-21815", prefix: "lang-van-hoa" },
  "ca-phe-thang-10": { url: "https://mia.vn/cam-nang-du-lich/ca-phe-thang-10-ta-xua-21814", prefix: "ca-phe-thang-10" },
  "nha-h-mong": { url: "https://mia.vn/cam-nang-du-lich/nha-hmong-ca-phe-ta-xua-21797", prefix: "nha-hmong" },
  "hien": { url: "https://mia.vn/cam-nang-du-lich/hien-coffee-ta-xua-son-la-21753", prefix: "hien-coffee" },
  "cloud-coffee-cloud-forest-ta-xua": { url: "https://mia.vn/cam-nang-du-lich/cloud-forest-ta-xua-review-20968", prefix: "cloud-forest" },
};

async function main() {
  const mfPath = path.join(SCRATCH, "manifest-places.json");
  const manifest: Record<string, { file: string; src: string }[]> = JSON.parse(readFileSync(mfPath, "utf8"));
  for (const [slug, cfg] of Object.entries(PAGES)) {
    if ((manifest[slug] ?? []).length > 0) continue;
    manifest[slug] = [];
    const res = await fetch(cfg.url, { headers: { "User-Agent": UA } });
    if (!res.ok) { console.log(slug, "HTTP", res.status); continue; }
    const html = await res.text();
    const re = new RegExp(`https://mia\.vn/media/uploads/blog-du-lich/${cfg.prefix}[^"'\s)<>]+\.(?:jpe?g|png|webp)`, "gi");
    const urls = [...new Set(html.match(re) ?? [])].slice(0, 6);
    for (const u of urls) {
      try {
        const r = await fetch(u, { headers: { "User-Agent": UA } });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        let pipe = sharp(buf, { failOn: "none" }).rotate();
        const meta = await pipe.metadata();
        if (!meta.width || meta.width < 500) continue;
        if (meta.width > 2400) pipe = pipe.resize({ width: 2400, withoutEnlargement: true });
        const data = await pipe.jpeg({ quality: 82 }).toBuffer();
        const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;
        writeFileSync(path.join(OUT, name), data);
        manifest[slug].push({ file: name, src: u });
      } catch { /* bỏ */ }
    }
    console.log(`${slug}: ${manifest[slug].length} ảnh ← mia.vn`);
  }
  writeFileSync(mfPath, JSON.stringify(manifest, null, 2));
}
main();
