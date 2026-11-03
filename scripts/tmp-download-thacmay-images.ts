/**
 * Tải ảnh Thác Mây Tà Xùa: ảnh từng phòng từ cột "Link ảnh" trong rooms.csv
 * (tab THONG_TIN_PHONG) + ảnh khuôn viên từ list-home.html (embeddedfolderview
 * của folder Drive "ảnh home"). Xử lý như src/lib/media.ts (rotate + resize 2400
 * + jpeg q82). File id trùng (các căn Lux dùng chung bộ ảnh) chỉ tải/xử lý 1 lần.
 * Xuất <scratch>/out-thacmay/ + manifest-thacmay.json.
 * Chạy: npx tsx scripts/tmp-download-thacmay-images.ts <scratch-dir-thacmay>
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const SCRATCH = process.argv[2];
if (!SCRATCH) throw new Error("usage: tsx tmp-download-thacmay-images.ts <scratch-dir>");
const OUT = path.join(SCRATCH, "out-thacmay");
mkdirSync(OUT, { recursive: true });

/** Tách dòng CSV (hỗ trợ ô nhiều dòng trong ngoặc kép). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); field = ""; rows.push(row); row = []; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const driveIds = (s: string) => [...s.matchAll(/\/file\/d\/([a-zA-Z0-9_-]{10,})/g)].map((m) => m[1]);

function parseFolderList(html: string): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  const re = /id="entry-([a-zA-Z0-9_-]{10,})"[\s\S]*?flip-entry-title">([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (!seen.has(m[1])) { seen.add(m[1]); out.push({ id: m[1], name: m[2].trim() }); }
  }
  return out;
}

async function download(id: string): Promise<Buffer | null> {
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
      if (buf.length > 0) return buf;
    } catch { /* thử url sau */ }
  }
  return null;
}

/** HEIC/định dạng lạ → JPG qua ffmpeg (sharp local thiếu libde265). */
function toJpgViaFfmpeg(buf: Buffer): Buffer {
  const base = path.join(os.tmpdir(), crypto.randomBytes(8).toString("hex"));
  writeFileSync(`${base}.bin`, buf);
  try {
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", `${base}.bin`, "-frames:v", "1", "-q:v", "2", `${base}.jpg`]);
    return readFileSync(`${base}.jpg`);
  } finally {
    rmSync(`${base}.bin`, { force: true });
    rmSync(`${base}.jpg`, { force: true });
  }
}

async function processImg(buf: Buffer): Promise<Buffer> {
  let src = buf;
  // sharp có thể đọc metadata HEIC nhưng không decode được HEVC → thử decode thật.
  try {
    await sharp(src, { failOn: "none" }).rotate().raw().toBuffer({ resolveWithObject: false });
  } catch {
    src = toJpgViaFfmpeg(buf);
  }
  let pipe = sharp(src, { failOn: "none" }).rotate();
  const meta = await pipe.metadata();
  if (meta.width && meta.width > 2400) pipe = pipe.resize({ width: 2400, withoutEnlargement: true });
  return pipe.jpeg({ quality: 82 }).toBuffer();
}

async function main() {
  // key → danh sách file id theo thứ tự trong sheet
  const wanted = new Map<string, string[]>();

  const csv = parseCsv(readFileSync(path.join(SCRATCH, "rooms.csv"), "utf8"));
  const header = csv[0];
  const colCode = header.findIndex((h) => /mã phòng/i.test(h));
  const colImg = header.findIndex((h) => /link ảnh/i.test(h));
  for (const row of csv.slice(1)) {
    const code = (row[colCode] ?? "").trim(); // "Lux 1", "VIP 10"
    if (!code) continue;
    const key = "tm-" + code.toLowerCase().replace(/\s+/g, "");
    const ids = driveIds(row[colImg] ?? "");
    if (ids.length) wanted.set(key, ids);
  }
  const home = parseFolderList(readFileSync(path.join(SCRATCH, "list-home.html"), "utf8"))
    .filter((f) => !/\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(f.name));
  wanted.set("tm-home", home.map((f) => f.id));

  // Tải mỗi file id đúng 1 lần.
  const fileById = new Map<string, string>();
  let fail = 0;
  for (const [key, ids] of wanted) {
    for (const id of ids) {
      if (fileById.has(id)) continue;
      const raw = await download(id);
      if (!raw) { console.log(`  LỖI tải ${key}/${id}`); fail++; continue; }
      try {
        const data = await processImg(raw);
        const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;
        writeFileSync(path.join(OUT, name), data);
        fileById.set(id, name);
      } catch (e) {
        console.log(`  LỖI xử lý ${key}/${id}: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`);
        fail++;
      }
    }
  }

  const manifest: Record<string, { file: string; orig: string }[]> = {};
  for (const [key, ids] of wanted) {
    manifest[key] = ids.filter((id) => fileById.has(id)).map((id) => ({ file: fileById.get(id)!, orig: id }));
    console.log(`${key}: ${manifest[key].length}/${ids.length} ảnh`);
  }
  writeFileSync(path.join(SCRATCH, "manifest-thacmay.json"), JSON.stringify(manifest, null, 2));
  console.log(`Đã ghi manifest-thacmay.json (${fileById.size} file, ${fail} lỗi)`);
}
main();
