// Tạo logo mới: hình tròn xanh (forest-600) chữ TX trắng — ghi đè icon.png / apple-icon.png / favicon.ico.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const GREEN = "#226e4b"; // forest-600

function svg(size: number) {
  const r = size / 2;
  // text đặt theo dominant-baseline để căn giữa; font hệ thống đậm
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <circle cx="${r}" cy="${r}" r="${r}" fill="${GREEN}"/>
  <text x="50%" y="50%" dy="0.06em" text-anchor="middle" dominant-baseline="central"
    font-family="Arial, Helvetica, sans-serif" font-weight="bold"
    font-size="${Math.round(size * 0.42)}" fill="#ffffff" letter-spacing="${Math.round(size * -0.01)}">TX</text>
</svg>`);
}

/** Gói 1 ảnh PNG vào định dạng ICO (ICO cho phép nhúng PNG). */
function pngToIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8); // size
  entry.writeUInt32LE(22, 12); // offset
  return Buffer.concat([header, entry, png]);
}

async function main() {
  const png256 = await sharp(svg(256)).png().toBuffer();
  const png180 = await sharp(svg(180)).png().toBuffer();
  const png64 = await sharp(svg(64)).png().toBuffer();
  writeFileSync("src/app/icon.png", png256);
  writeFileSync("src/app/apple-icon.png", png180);
  writeFileSync("src/app/favicon.ico", pngToIco(png64, 64));
  console.log("OK: icon.png(256), apple-icon.png(180), favicon.ico(64)");
}
main();
