/**
 * Tìm ảnh thật của các quán (Place) chưa có ảnh: DuckDuckGo Images theo tên quán,
 * lọc theo TIÊU ĐỀ chứa đúng tên quán (tránh ảnh quán khác), tải + xử lý (resize
 * 1600, jpeg q82), xuất ra <scratch>/out-places/ + manifest-places.json.
 * KHÔNG ghi DB — bước gắn ảnh chạy riêng sau khi duyệt.
 * Chạy: npx tsx scripts/tmp-harvest-places.ts <scratchpad-dir>
 */
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SCRATCH = process.argv[2];
if (!SCRATCH) throw new Error("usage: tsx tmp-harvest-places.ts <scratchpad-dir>");
const OUT = path.join(SCRATCH, "out-places");
mkdirSync(OUT, { recursive: true });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAX_PER_PLACE = 6;

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Tên "lõi" để so khớp tiêu đề: bỏ từ chung (nhà hàng, tiệm, cafe...) và "tà xùa".
const GENERIC = new Set([
  "nha", "hang", "tiem", "quan", "cafe", "caffe", "coffee", "ca", "phe", "house",
  "ta", "xua", "homestay", "retreat", "bar", "the", "restaurant", "va", "and",
]);
function coreName(name: string): string {
  const words = norm(name).split(" ").filter((w) => w && !GENERIC.has(w));
  return words.join(" ");
}

interface DdgImage { title: string; image: string; width: number; height: number; url: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ddgImagesOnce(q: string): Promise<DdgImage[]> {
  const r1 = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`, {
    headers: { "User-Agent": UA },
  });
  const html = await r1.text();
  const m = html.match(/vqd=([\d-]+)/) || html.match(/vqd="([^"]+)"/);
  if (!m) return [];
  const r2 = await fetch(
    `https://duckduckgo.com/i.js?l=vi-vn&o=json&q=${encodeURIComponent(q)}&vqd=${m[1]}&p=1`,
    { headers: { "User-Agent": UA, Referer: "https://duckduckgo.com/" } },
  );
  if (!r2.ok) return [];
  const j = (await r2.json()) as { results?: DdgImage[] };
  return j.results ?? [];
}

/** DDG hay chặn tạm khi truy vấn dày — thử lại tối đa 4 lần, nghỉ tăng dần. */
async function ddgImages(q: string): Promise<DdgImage[]> {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await ddgImagesOnce(q);
      if (r.length > 0) return r;
    } catch { /* thử lại */ }
    await sleep(12000 + i * 10000);
  }
  return [];
}

async function download(url: string): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("text/html")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 5000 ? buf : null;
  } catch {
    return null;
  }
}

async function main() {
  const places = await prisma.place.findMany({
    where: { OR: [{ coverImage: null }, { coverImage: "" }] },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    select: { id: true, kind: true, name: true },
  });
  console.log(`${places.length} quán chưa có ảnh.`);

  type Manifest = Record<string, { name: string; files: { file: string; title: string; src: string; menu: boolean }[] }>;
  // Chạy tiếp từ manifest cũ (nếu có): quán đã đủ ảnh thì bỏ qua, không hỏi lại DDG.
  let manifest: Manifest = {};
  try {
    manifest = JSON.parse(readFileSync(path.join(SCRATCH, "manifest-places.json"), "utf8"));
  } catch { /* lần đầu */ }

  for (const pl of places) {
    if ((manifest[pl.id]?.files.length ?? 0) > 0) continue; // đã có từ lượt trước
    const core = coreName(pl.name);
    const q = `${pl.name.replace(/tà xùa/gi, "").trim()} Tà Xùa`;
    let results: DdgImage[] = [];
    try {
      results = await ddgImages(q);
    } catch { /* bỏ qua */ }

    // Lọc: tiêu đề phải chứa tên lõi; tên lõi quá ngắn thì bắt buộc thêm "ta xua".
    const shortCore = core.length < 5;
    const good = results.filter((r) => {
      if (/lookaside\.fbsbx|fbcdn/.test(r.image)) return false; // Facebook chặn tải trực tiếp
      const t = ` ${norm(r.title)} `;
      if (!core || !t.includes(` ${core} `)) return false;
      if (shortCore && !t.includes("ta xua")) return false;
      return Math.min(r.width, r.height) >= 400;
    });
    // Ưu tiên nguồn bài viết địa phương.
    good.sort((a, b) => {
      const rank = (u: string) => (u.includes("taxua.vn") ? 0 : 1);
      return rank(a.image) - rank(b.image);
    });

    manifest[pl.id] = { name: pl.name, files: [] };
    const seen = new Set<string>();
    for (const r of good) {
      if (manifest[pl.id].files.length >= MAX_PER_PLACE) break;
      if (seen.has(r.image)) continue;
      seen.add(r.image);
      const buf = await download(r.image);
      if (!buf) continue;
      try {
        let pipe = sharp(buf, { failOn: "none" }).rotate();
        const meta = await pipe.metadata();
        if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < 480) continue;
        if (meta.width > 1600) pipe = pipe.resize({ width: 1600, withoutEnlargement: true });
        const data = await pipe.jpeg({ quality: 82 }).toBuffer();
        const file = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;
        writeFileSync(path.join(OUT, file), data);
        const tn = norm(r.title) + " " + norm(r.image);
        const menu = /\b(thuc don|menu|bang gia)\b/.test(tn);
        manifest[pl.id].files.push({ file, title: r.title, src: r.image, menu });
      } catch { /* ảnh hỏng → bỏ */ }
    }
    console.log(`${pl.kind} | ${pl.name} → ${manifest[pl.id].files.length} ảnh (${good.length} ứng viên)`);
    writeFileSync(path.join(SCRATCH, "manifest-places.json"), JSON.stringify(manifest, null, 2)); // lưu dần
    await sleep(10000); // lịch sự với DDG — tránh bị chặn hàng loạt
  }

  writeFileSync(path.join(SCRATCH, "manifest-places.json"), JSON.stringify(manifest, null, 2));
  console.log("Đã ghi manifest-places.json");
}
main().finally(() => prisma.$disconnect());
