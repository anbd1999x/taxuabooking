/**
 * Tìm ảnh thật cho các Place (nhà hàng/cafe Tà Xùa) chưa có ảnh, qua DuckDuckGo
 * image search. Mỗi quán lấy tối đa 6 ảnh đạt chuẩn (≥500px ngang, tỉ lệ hợp lý),
 * xử lý như media.ts (rotate+resize 2400+jpeg q82) → out-places/ + manifest-places.json
 * (kèm nguồn ảnh để đối chiếu).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const SCRATCH = process.argv[2];
if (!SCRATCH) throw new Error("usage: tsx tmp-crawl-place-images.ts <scratchpad-dir>");
const OUT = path.join(SCRATCH, "out-places");
mkdirSync(OUT, { recursive: true });

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAX_PER = 6;

// slug → câu truy vấn (đã kèm "Tà Xùa" để đúng quán)
const QUERIES: Record<string, string> = {
  // CAFE
  "ca-phe-ban-song-lung-khung-long": "Cà phê Bản Sống Lưng Khủng Long Tà Xùa",
  "sunset-clouds-coffee": "Sunset Clouds Coffee Tà Xùa",
  "cloud-coffee-cloud-forest-ta-xua": "Cloud Forest Tà Xùa coffee",
  "may-bay-coffee": "Mây Bay Coffee Tà Xùa",
  "an-s-coffee-ta-xua": "An's Coffee Tà Xùa",
  "cafe-lang-van-hoa": "Cafe Làng Văn Hóa Tà Xùa",
  "hien": "Hiên cafe Tà Xùa",
  "nha-cua-an-homestay-coffee": "Nhà Của An Homestay Coffee Tà Xùa",
  "moong-homestay-coffee": "Moong Homestay Coffee Tà Xùa",
  "mi-ami-mountain-retreat-cafe-nha-hang": "Mi Ami Mountain Retreat Tà Xùa",
  "chillout-village-nha-hang-cafe": "Chillout Village Tà Xùa cafe",
  "lili-mountain-tiem-ca-phe-tu-te": "Lili Mountain Tà Xùa cà phê",
  "khe-cai-coffee-ngay-nao-do": "Khe Cải Coffee Ngày Nào Đó Tà Xùa",
  "noong-oi-homestay-coffee": "Noong Ơi Homestay Tà Xùa coffee",
  "ca-phe-thang-10": "Cà phê Tháng 10 Tà Xùa",
  "nha-h-mong": "Nhà H'Mông cafe Tà Xùa",
  "man-the-cocktail-bar": "Mận cocktail bar Tà Xùa",
  "hien-nha-tren-thao-nguyen": "Hiên Nhà trên Thảo Nguyên Tà Xùa",
  "khen-coffee-house": "Khèn Coffee House Tà Xùa",
  "tram-may-ta-xua-2": "Trạm Mây Tà Xùa cafe",
  // RESTAURANT
  "nha-hang-a-phu-tinh-hoa-am-thuc-ta-xua": "Nhà hàng A Phủ Tà Xùa",
  "bep-an-xuan-thi-ta-xua": "Bếp ăn Xuân Thì Tà Xùa",
  "nha-hang-doi-may": "Nhà hàng Đồi Mây Tà Xùa",
  "tiem-lau-nuong-tram-may": "Trạm Mây Tà Xùa lẩu nướng",
  "nha-hang-hang-chu-ta-xua": "Nhà hàng Hang Chú Tà Xùa",
  "tiem-mi-cay-ta-xua": "Tiệm mì cay Tà Xùa",
  "vua-lau-nuong-ta-xua": "Vua Lẩu Nướng Tà Xùa",
  "com-nha-namiya-dinh-gio": "Cơm nhà Namiya Tà Xùa",
  "nha-hang-coffee-gio-ban-ta-xua": "Gió Bản Tà Xùa nhà hàng",
  "nha-hang-bep-viet": "Nhà hàng Bếp Việt Tà Xùa",
  "mua-quan-ta-xua": "Mùa Quán Tà Xùa",
  "tram-may-ta-xua": "Trạm Mây Tà Xùa nhà hàng",
  "nha-hang-pho-nui": "Nhà hàng Phố Núi Tà Xùa",
  "nha-hang-sammu-ta-xua": "Nhà hàng Sammu Tà Xùa",
  "tiem-nuong-canh-cam": "Tiệm nướng Cánh Cam Tà Xùa",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ddgImages(q: string): Promise<{ image: string; width: number; height: number; url: string }[]> {
  const r1 = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`, { headers: { "User-Agent": UA } });
  const h = await r1.text();
  const m = h.match(/vqd=([\d-]+)/) || h.match(/vqd="([^"]+)"/) || h.match(/vqd='([^']+)'/);
  if (!m) return [];
  const r2 = await fetch(
    `https://duckduckgo.com/i.js?l=vi-vn&o=json&q=${encodeURIComponent(q)}&vqd=${m[1]}&f=,,,&p=1`,
    { headers: { "User-Agent": UA, Referer: "https://duckduckgo.com/" } },
  );
  if (!r2.ok) return [];
  const j = (await r2.json()) as { results?: { image: string; width: number; height: number; url: string }[] };
  return j.results ?? [];
}

async function downloadImg(url: string): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.startsWith("image/") || ct.includes("svg")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15_000 || buf.length > 12_000_000) return null;
    return buf;
  } catch {
    return null;
  }
}

async function main() {
  const manifest: Record<string, { file: string; src: string }[]> = {};
  for (const [slug, q] of Object.entries(QUERIES)) {
    manifest[slug] = [];
    const results = await ddgImages(q);
    const seen = new Set<string>();
    for (const r of results) {
      if (manifest[slug].length >= MAX_PER) break;
      if (!r.image || r.width < 500 || r.height < 400) continue;
      const ratio = r.width / r.height;
      if (ratio < 0.45 || ratio > 2.8) continue;
      const buf = await downloadImg(r.image);
      if (!buf) continue;
      try {
        let pipe = sharp(buf, { failOn: "none" }).rotate();
        const meta = await pipe.metadata();
        if (!meta.width || meta.width < 500) continue;
        const hash = crypto.createHash("md5").update(buf).digest("hex");
        if (seen.has(hash)) continue;
        seen.add(hash);
        if (meta.width > 2400) pipe = pipe.resize({ width: 2400, withoutEnlargement: true });
        const data = await pipe.jpeg({ quality: 82 }).toBuffer();
        const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;
        writeFileSync(path.join(OUT, name), data);
        manifest[slug].push({ file: name, src: r.image });
      } catch {
        // ảnh hỏng → bỏ
      }
    }
    console.log(`${slug}: ${manifest[slug].length} ảnh (query: ${q})`);
    await sleep(500);
  }
  writeFileSync(path.join(SCRATCH, "manifest-places.json"), JSON.stringify(manifest, null, 2));
  console.log("Đã ghi manifest-places.json");
}
main();
