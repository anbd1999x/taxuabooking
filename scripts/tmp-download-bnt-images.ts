/**
 * Tải ảnh Bếp Nhà Táo từ Drive (list-bnt-*.html trong scratchpad), xử lý như
 * src/lib/media.ts (rotate + resize 2400 + jpeg q82); HEIC sharp không đọc được
 * → chuyển bằng ffmpeg local. Xuất out-bnt/ + manifest-bnt.json.
 * Chạy: npx tsx scripts/tmp-download-bnt-images.ts <scratchpad-dir>
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const SCRATCH = process.argv[2];
if (!SCRATCH) throw new Error("usage: tsx tmp-download-bnt-images.ts <scratchpad-dir>");
const OUT = path.join(SCRATCH, "out-bnt");
mkdirSync(OUT, { recursive: true });

const KEYS = [
  "bnt-khuonvien", "bnt-sodo",
  "bnt-may1", "bnt-may2", "bnt-may3", "bnt-may4", "bnt-may5", "bnt-may6",
  "bnt-may7", "bnt-may8", "bnt-may9", "bnt-may10", "bnt-may11", "bnt-may12", "bnt-may13",
];
const IMG_EXT = /\.(jpe?g|png|webp|avif|heic|heif|bmp|tiff?)$/i;
const VID_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;

function parseList(html: string): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  const re = /id="entry-([a-zA-Z0-9_-]{10,})"[\s\S]*?flip-entry-title">([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (!seen.has(m[1])) { seen.add(m[1]); out.push({ id: m[1], name: m[2].trim() }); }
  }
  return out;
}

async function download(id: string): Promise<{ buf: Buffer; ct: string } | null> {
  for (const u of [
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${id}`,
  ]) {
    try {
      const res = await fetch(u, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("text/html")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 0) return { buf, ct };
    } catch { /* thử url sau */ }
  }
  return null;
}

/** HEIC → JPG buffer qua ffmpeg (sharp local thiếu libde265). */
function heicToJpg(buf: Buffer): Buffer {
  const base = path.join(os.tmpdir(), crypto.randomBytes(8).toString("hex"));
  writeFileSync(`${base}.heic`, buf);
  try {
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", `${base}.heic`, "-frames:v", "1", "-q:v", "2", `${base}.jpg`]);
    return readFileSync(`${base}.jpg`);
  } finally {
    rmSync(`${base}.heic`, { force: true });
    rmSync(`${base}.jpg`, { force: true });
  }
}

async function processImg(buf: Buffer): Promise<Buffer> {
  let pipe = sharp(buf, { failOn: "none" }).rotate();
  const meta = await pipe.metadata();
  if (meta.width && meta.width > 2400) pipe = pipe.resize({ width: 2400, withoutEnlargement: true });
  return pipe.jpeg({ quality: 82 }).toBuffer();
}

async function main() {
  const manifest: Record<string, { file: string; orig: string }[]> = {};
  for (const key of KEYS) {
    const html = readFileSync(path.join(SCRATCH, `list-${key}.html`), "utf8");
    const files = parseList(html);
    manifest[key] = [];
    for (const f of files) {
      if (VID_EXT.test(f.name)) { console.log(`  bỏ qua video: ${key}/${f.name}`); continue; }
      const known = IMG_EXT.test(f.name);
      const dl = await download(f.id);
      if (!dl) { console.log(`  LỖI tải: ${key}/${f.name || f.id}`); continue; }
      if (!known && !dl.ct.startsWith("image/")) {
        console.log(`  bỏ qua (${dl.ct}): ${key}/${f.name || f.id}`);
        continue;
      }
      try {
        let src = dl.buf;
        if (/\.hei[cf]$/i.test(f.name) || dl.ct.includes("heic") || dl.ct.includes("heif")) {
          try { await sharp(src).metadata(); } catch { src = heicToJpg(dl.buf); }
          try { await sharp(src, { failOn: "none" }).rotate().raw().toBuffer({ resolveWithObject: false }); }
          catch { src = heicToJpg(dl.buf); }
        }
        const data = await processImg(src);
        const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;
        writeFileSync(path.join(OUT, name), data);
        manifest[key].push({ file: name, orig: f.name || f.id });
      } catch (e) {
        console.log(`  LỖI xử lý: ${key}/${f.name || f.id}: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`);
      }
    }
    console.log(`${key}: ${manifest[key].length} ảnh OK / ${files.length} file`);
  }
  writeFileSync(path.join(SCRATCH, "manifest-bnt.json"), JSON.stringify(manifest, null, 2));
  console.log("Đã ghi manifest-bnt.json");
}
main();
