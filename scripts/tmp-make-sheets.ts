/**
 * Dựng contact sheet từ manifest-places.json: mỗi hàng = 1 quán (nhãn + tối đa 6 thumb),
 * 6 quán/sheet → sheets/sheet-N.jpg để duyệt mắt trước khi gắn vào DB.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SCRATCH = process.argv[2];
if (!SCRATCH) throw new Error("usage: tsx tmp-make-sheets.ts <scratchpad-dir>");
const OUT = path.join(SCRATCH, "sheets");
mkdirSync(OUT, { recursive: true });

const TH_W = 240, TH_H = 180, LABEL_H = 28, PER_SHEET = 6, COLS = 6;
const ROW_H = LABEL_H + TH_H + 8;

async function main() {
  const manifest: Record<string, { file: string; src: string }[]> = JSON.parse(
    readFileSync(path.join(SCRATCH, "manifest-places.json"), "utf8"),
  );
  const slugs = Object.keys(manifest);
  for (let s = 0; s * PER_SHEET < slugs.length; s++) {
    const batch = slugs.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
    const width = COLS * (TH_W + 4) + 4;
    const height = batch.length * ROW_H + 4;
    const composites: sharp.OverlayOptions[] = [];
    for (let r = 0; r < batch.length; r++) {
      const slug = batch[r];
      const y0 = 4 + r * ROW_H;
      const label = Buffer.from(
        `<svg width="${width}" height="${LABEL_H}"><rect width="100%" height="100%" fill="#10301f"/><text x="8" y="20" font-size="16" font-family="Arial" fill="#ffffff">${s * PER_SHEET + r + 1}. ${slug}</text></svg>`,
      );
      composites.push({ input: label, left: 0, top: y0 });
      const files = manifest[slug].slice(0, COLS);
      for (let c = 0; c < files.length; c++) {
        const thumb = await sharp(path.join(SCRATCH, "out-places", files[c].file))
          .resize(TH_W, TH_H, { fit: "cover" })
          .jpeg({ quality: 70 })
          .toBuffer();
        // đánh số ảnh trong ô
        const idx = Buffer.from(
          `<svg width="26" height="22"><rect width="100%" height="100%" fill="#000000" opacity="0.65"/><text x="6" y="16" font-size="14" font-family="Arial" fill="#fff">${c + 1}</text></svg>`,
        );
        const withIdx = await sharp(thumb).composite([{ input: idx, left: 2, top: 2 }]).toBuffer();
        composites.push({ input: withIdx, left: 4 + c * (TH_W + 4), top: y0 + LABEL_H });
      }
    }
    const sheet = await sharp({
      create: { width, height, channels: 3, background: { r: 230, g: 230, b: 230 } },
    })
      .composite(composites)
      .jpeg({ quality: 80 })
      .toBuffer();
    const f = path.join(OUT, `sheet-${s + 1}.jpg`);
    writeFileSync(f, sheet);
    console.log(f, batch.join(", "));
  }
}
main();
