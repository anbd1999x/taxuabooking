/**
 * Giai đoạn C: DuckDuckGo images cho các quán còn thiếu — chạy CHẬM (25–35s/query),
 * dính bot-challenge thì ngủ 3 phút thử lại (tối đa 10 lần toàn phiên).
 * Ưu tiên kết quả có tiêu đề khớp tên quán. Gộp vào manifest-places.json sau mỗi quán.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const SCRATCH = process.argv[2]!;
const OUT = path.join(SCRATCH, "out-places");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAX_PER = 6;

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const QUERIES: Record<string, { q: string; must: string[] }> = {
  "ca-phe-ban-song-lung-khung-long": { q: "Bản Coffee Tà Xùa sống lưng khủng long", must: ["ban coffee", "ca phe ban"] },
  "sunset-clouds-coffee": { q: "Sunset Clouds Coffee Tà Xùa", must: ["sunset"] },
  "may-bay-coffee": { q: "Mây Bay Coffee Tà Xùa", must: ["may bay"] },
  "an-s-coffee-ta-xua": { q: "An's Coffee Tà Xùa", must: ["an s coffee", "ans coffee"] },
  "moong-homestay-coffee": { q: "Moong Homestay Tà Xùa coffee", must: ["moong"] },
  "mi-ami-mountain-retreat-cafe-nha-hang": { q: "Mi Ami Mountain Retreat Tà Xùa", must: ["mi ami"] },
  "lili-mountain-tiem-ca-phe-tu-te": { q: "Lili Mountain Tà Xùa cà phê Tử Tế", must: ["lili", "tu te"] },
  "khe-cai-coffee-ngay-nao-do": { q: "Ngày Nào Đó coffee Tà Xùa Khe Cải", must: ["ngay nao do"] },
  "man-the-cocktail-bar": { q: "Mận cocktail bar Tà Xùa", must: ["man", "cocktail"] },
  "hien-nha-tren-thao-nguyen": { q: "Hiên Nhà trên Thảo Nguyên Tà Xùa", must: ["hien nha"] },
  "khen-coffee-house": { q: "Khèn Coffee Tà Xùa Làng Chếu", must: ["khen"] },
  "tram-may-ta-xua-2": { q: "Trạm Mây Tà Xùa", must: ["tram may"] },
  "bep-an-xuan-thi-ta-xua": { q: "Xuân Thì Tà Xùa bếp", must: ["xuan thi"] },
  "nha-hang-doi-may": { q: "nhà hàng Đồi Mây Tà Xùa", must: ["doi may"] },
  "tiem-lau-nuong-tram-may": { q: "Trạm Mây Tà Xùa lẩu nướng", must: ["tram may"] },
  "nha-hang-hang-chu-ta-xua": { q: "nhà hàng Hang Chú Tà Xùa", must: ["hang chu"] },
  "tiem-mi-cay-ta-xua": { q: "tiệm mì cay Tà Xùa", must: ["mi cay"] },
  "vua-lau-nuong-ta-xua": { q: "Vua Lẩu Nướng Tà Xùa", must: ["vua lau"] },
  "com-nha-namiya-dinh-gio": { q: "cơm nhà Namiya Tà Xùa Đỉnh Gió", must: ["namiya"] },
  "nha-hang-coffee-gio-ban-ta-xua": { q: "Gió Bản Tà Xùa nhà hàng coffee", must: ["gio ban"] },
  "nha-hang-bep-viet": { q: "nhà hàng Bếp Việt Tà Xùa", must: ["bep viet"] },
  "mua-quan-ta-xua": { q: "Mùa Quán Tà Xùa", must: ["mua quan"] },
  "tram-may-ta-xua": { q: "Trạm Mây Tà Xùa nhà hàng Khe Cải", must: ["tram may"] },
  "nha-hang-pho-nui": { q: "nhà hàng Phố Núi Tà Xùa", must: ["pho nui"] },
  "nha-hang-sammu-ta-xua": { q: "nhà hàng Sammu Tà Xùa", must: ["sammu", "samu"] },
  "tiem-nuong-canh-cam": { q: "tiệm nướng Cánh Cam Tà Xùa", must: ["canh cam"] },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let challengeBudget = 10;

type DdgResult = { image: string; width: number; height: number; url: string; title?: string };

/** null = challenge (để thử lại), [] = không có kết quả */
async function ddgImages(q: string): Promise<DdgResult[] | null> {
  const r1 = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`, { headers: { "User-Agent": UA } });
  const h = await r1.text();
  const m = h.match(/vqd=([\d-]+)/) || h.match(/vqd="([^"]+)"/);
  if (!m) return null;
  const r2 = await fetch(
    `https://duckduckgo.com/i.js?l=vi-vn&o=json&q=${encodeURIComponent(q)}&vqd=${m[1]}&f=,,,&p=1`,
    { headers: { "User-Agent": UA, Referer: "https://duckduckgo.com/" } },
  );
  const t = await r2.text();
  if (r2.status !== 200 || t.includes('"challenge"')) return null;
  try {
    const j = JSON.parse(t) as { results?: DdgResult[] };
    return j.results ?? [];
  } catch {
    return null;
  }
}

async function downloadImg(url: string): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("svg") || ct.includes("text/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15_000 || buf.length > 12_000_000) return null;
    return buf;
  } catch {
    return null;
  }
}

async function main() {
  const mfPath = path.join(SCRATCH, "manifest-places.json");
  const manifest: Record<string, { file: string; src: string }[]> = JSON.parse(readFileSync(mfPath, "utf8"));

  for (const [slug, cfg] of Object.entries(QUERIES)) {
    if ((manifest[slug] ?? []).length > 0) { console.log(`${slug}: đã có, bỏ qua`); continue; }
    let results: DdgResult[] | null = null;
    while (results === null) {
      results = await ddgImages(cfg.q);
      if (results === null) {
        if (--challengeBudget <= 0) { console.log("HẾT budget challenge — dừng."); writeFileSync(mfPath, JSON.stringify(manifest, null, 2)); return; }
        console.log(`${slug}: challenge → nghỉ 180s (còn ${challengeBudget})`);
        await sleep(180_000);
      }
    }
    // Ưu tiên kết quả có tiêu đề/nguồn khớp tên quán
    const scored = results
      .filter((r) => r.image && r.width >= 500 && r.height >= 400 && r.width / r.height >= 0.45 && r.width / r.height <= 2.8)
      .map((r) => {
        const t = ` ${norm((r.title ?? "") + " " + r.url)} `;
        const hit = cfg.must.some((mu) => t.includes(` ${mu} `));
        return { r, hit };
      })
      .sort((a, b) => Number(b.hit) - Number(a.hit));
    manifest[slug] = [];
    const seen = new Set<string>();
    for (const { r } of scored) {
      if (manifest[slug].length >= MAX_PER) break;
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
      } catch { /* bỏ */ }
    }
    console.log(`${slug}: ${manifest[slug].length} ảnh`);
    writeFileSync(mfPath, JSON.stringify(manifest, null, 2));
    await sleep(25_000 + Math.random() * 10_000);
  }
  const missing = Object.keys(QUERIES).filter((k) => (manifest[k] ?? []).length === 0);
  console.log("XONG. Thiếu:", missing.join(", ") || "(không)");
}
main();
