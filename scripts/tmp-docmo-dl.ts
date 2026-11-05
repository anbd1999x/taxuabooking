/**
 * Tải ảnh Dốc Mơ Homestay từ Drive (list-*.html đã lưu ở scratchpad/docmo-folders),
 * xử lý giống src/lib/media.ts (rotate + resize 2400 + jpeg q82). Bỏ qua video.
 * Xuất ra <scratch>/docmo-out + manifest-docmo.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const SCRATCH = process.argv[2];
if (!SCRATCH) throw new Error("usage: tsx tmp-docmo-dl.ts <scratchpad-dir>");
const LISTDIR = path.join(SCRATCH, "docmo-folders");
const OUT = path.join(SCRATCH, "docmo-out");
mkdirSync(OUT, { recursive: true });

const KEYS = ["cozy1", "cozy2", "cozy3", "cozy4", "cozy5", "docmo", "nhasan", "sweet1", "sweet2", "sweet3"];
const IMG_EXT = /\.(jpe?g|png|webp|avif|bmp|tiff?)$/i;

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

async function processImg(buf: Buffer): Promise<Buffer> {
  let pipe = sharp(buf, { failOn: "none" }).rotate();
  const meta = await pipe.metadata();
  if (meta.width && meta.width > 2400) pipe = pipe.resize({ width: 2400, withoutEnlargement: true });
  return pipe.jpeg({ quality: 82 }).toBuffer();
}

async function main() {
  const manifest: Record<string, { file: string; orig: string }[]> = {};
  for (const key of KEYS) {
    const html = readFileSync(path.join(LISTDIR, `list-${key}.html`), "utf8");
    const files = parseList(html).filter((f) => IMG_EXT.test(f.name)); // chỉ ảnh
    manifest[key] = [];
    for (const f of files) {
      const dl = await download(f.id);
      if (!dl) { console.log(`  LỖI tải: ${key}/${f.name}`); continue; }
      try {
        const data = await processImg(dl.buf);
        const name = `docmo-${key}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.jpg`;
        writeFileSync(path.join(OUT, name), data);
        manifest[key].push({ file: name, orig: f.name });
      } catch (e) {
        console.log(`  LỖI xử lý: ${key}/${f.name}: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`);
      }
    }
    console.log(`${key}: ${manifest[key].length}/${files.length} ảnh OK`);
  }
  writeFileSync(path.join(SCRATCH, "manifest-docmo.json"), JSON.stringify(manifest, null, 2));
  console.log("Đã ghi manifest-docmo.json");
}
main();
