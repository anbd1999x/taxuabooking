/**
 * Gắn ảnh bìa cho các quán (Place) đang thiếu ảnh, lấy từ trang danh bạ tham khảo
 * (homestaytaxua.com) đã parse sẵn vào cover-map.json. Tải ảnh .webp → convert JPG
 * (giống src/lib/media.ts: rotate + resize 2400 + jpeg q82) → lưu public/uploads →
 * cập nhật Place.coverImage. Chạy: npx tsx scripts/tmp-place-covers.ts <scratchpad> [--apply]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const SCRATCH = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!SCRATCH) throw new Error("usage: tsx tmp-place-covers.ts <scratchpad-dir> [--apply]");

const prisma = new PrismaClient();
const UPLOADS = path.join(process.cwd(), "public", "uploads");

// Vài slug của ta khác slug trang tham khảo → bảng quy đổi (our-slug -> ref-slug)
const OVERRIDES: Record<string, string> = {
  "may-bay-coffee": "may-bay-coffee-ta-xua",
  "an-s-coffee-ta-xua": "ans-coffee-ta-xua",
  "nha-cua-an-homestay-coffee": "nha-cua-an-homestay-coffee-ta-xua",
  "khe-cai-coffee-ngay-nao-do": "ngay-nao-do-cafe",
  "ca-phe-thang-10": "ca-phe-thang-10-ta-xua",
  "nha-h-mong": "nha-hmong",
  "man-the-cocktail-bar": "man-the-cocktail-bar-man-pub",
  "tram-may-ta-xua-2": "tram-may-ta-xua", // cafe Khe Cải
};

async function download(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

async function processImg(buf: Buffer): Promise<Buffer> {
  let pipe = sharp(buf, { failOn: "none" }).rotate();
  const meta = await pipe.metadata();
  if (meta.width && meta.width > 2400) pipe = pipe.resize({ width: 2400, withoutEnlargement: true });
  return pipe.jpeg({ quality: 82 }).toBuffer();
}

async function main() {
  const map = JSON.parse(readFileSync(path.join(SCRATCH, "cover-map.json"), "utf8")) as {
    cafe: Record<string, string>;
    nha_hang: Record<string, string>;
  };

  const places = await prisma.place.findMany({
    select: { id: true, kind: true, slug: true, name: true, coverImage: true },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
  });

  const report: { name: string; status: string }[] = [];
  let done = 0;

  for (const p of places) {
    if (p.coverImage) { report.push({ name: p.name, status: "BỎ QUA (đã có ảnh bìa)" }); continue; }
    const slug = p.slug ?? "";
    const dict = p.kind === "CAFE" ? map.cafe : map.nha_hang;
    const refSlug = OVERRIDES[slug] ?? slug;
    const url = dict[refSlug];
    if (!url) { report.push({ name: p.name, status: `KHÔNG CÓ ảnh tham khảo (slug=${slug})` }); continue; }

    if (!APPLY) { report.push({ name: p.name, status: `SẼ GẮN ← ${url.split("/_v/")[1]}` }); continue; }

    const raw = await download(url);
    if (!raw) { report.push({ name: p.name, status: `LỖI TẢI ${url}` }); continue; }
    let data: Buffer;
    try { data = await processImg(raw); }
    catch (e) { report.push({ name: p.name, status: `LỖI XỬ LÝ ${(e as Error).message}` }); continue; }
    const fname = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;
    writeFileSync(path.join(UPLOADS, fname), data);
    const rel = `/uploads/${fname}`;
    await prisma.place.update({ where: { id: p.id }, data: { coverImage: rel } });
    report.push({ name: p.name, status: `ĐÃ GẮN ${rel}` });
    done++;
  }

  for (const r of report) console.log(`${r.status.padEnd(20)} | ${r.name}`);
  console.log(`\n${APPLY ? "Đã gắn" : "Sẽ gắn"} tổng: ${APPLY ? done : report.filter((r) => r.status.startsWith("SẼ")).length}`);
  writeFileSync(path.join(SCRATCH, "cover-report.json"), JSON.stringify(report, null, 2));
}

main().finally(() => prisma.$disconnect());
