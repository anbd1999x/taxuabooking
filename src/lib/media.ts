import "server-only";
import { writeFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { prisma } from "./prisma";

const execFileP = promisify(execFile);

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25MB (ảnh gốc; sẽ nén lại trước khi lưu)
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB
const MAX_IMAGE_WIDTH = 2400; // thu nhỏ ảnh quá lớn cho nhẹ web

// Suy MIME từ đuôi file khi không có content-type rõ (iPhone hay gửi rỗng cho HEIC). CHỈ dùng để phân
// loại ảnh/video — định dạng thật luôn xác định lại bằng magic bytes, đuôi lưu KHÔNG BAO GIỜ lấy từ tên tệp.
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  avif: "image/avif", gif: "image/gif", tif: "image/tiff", tiff: "image/tiff",
  heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", m4v: "video/x-m4v", webm: "video/webm", mov: "video/quicktime",
  mkv: "video/x-matroska", avi: "video/x-msvideo",
};

export function resolveMediaType(mime: string | null | undefined, filename: string): string {
  const t = (mime || "").toLowerCase();
  if (t.startsWith("image/") || t.startsWith("video/")) return t;
  const m = /\.([a-z0-9]+)$/i.exec(filename || "");
  return (m && EXT_TO_MIME[m[1].toLowerCase()]) || t || "";
}

type ImgKind = "jpeg" | "png" | "gif" | "webp" | "tiff" | "avif" | "heif";
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1", "heif"]);

/** Các brand trong hộp `ftyp` (ISO-BMFF: mp4/mov/heic/avif) — null nếu không phải. */
function ftypBrands(b: Buffer): string[] | null {
  if (b.length < 12 || b.toString("latin1", 4, 8) !== "ftyp") return null;
  const size = Math.min(b.readUInt32BE(0), b.length, 256);
  const out = [b.toString("latin1", 8, 12)];
  for (let i = 16; i + 4 <= size; i += 4) out.push(b.toString("latin1", i, i + 4));
  return out;
}

/**
 * Nhận diện ảnh RASTER theo magic bytes (không tin MIME/tên tệp client gửi — chống lưu SVG/HTML giả ảnh rồi
 * chạy script trên cùng origin). Không khớp ⇒ null ⇒ từ chối.
 */
export function sniffImage(b: Buffer): ImgKind | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  const g = b.toString("latin1", 0, 6);
  if (g === "GIF87a" || g === "GIF89a") return "gif";
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a)) return "tiff";
  const brands = ftypBrands(b);
  if (brands) {
    if (brands.some((x) => x === "avif" || x === "avis")) return "avif";
    if (brands.some((x) => HEIF_BRANDS.has(x))) return "heif";
  }
  return null;
}

/** Nhận diện video theo magic bytes → đuôi lưu CỐ ĐỊNH (mp4/mov/m4v/webm/mkv/avi); không khớp ⇒ null. */
export function sniffVideoExt(b: Buffer, mime: string): string | null {
  if (b.length < 12) return null;
  const box = b.toString("latin1", 4, 8);
  if (box === "ftyp" || (mime === "video/quicktime" && ["moov", "mdat", "wide", "free", "skip"].includes(box))) {
    if (box !== "ftyp" || mime === "video/quicktime" || ftypBrands(b)?.[0] === "qt  ") return "mov";
    return mime === "video/x-m4v" ? "m4v" : "mp4";
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return mime === "video/x-matroska" ? "mkv" : "webm";
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "AVI ") return "avi";
  return null;
}

const BAD_IMAGE = "Tệp không phải ảnh hợp lệ — chỉ nhận JPG, PNG, WebP, AVIF, HEIC hoặc GIF.";

export interface SaveMediaInput {
  buf: Buffer;
  mime: string; // đã resolve (image/* hoặc video/*)
  filename: string;
  serviceId?: string | null;
  roomTypeId?: string | null;
  roomId?: string | null;
  /** true = chỉ lưu file & trả url, không gắn bản ghi DB (vd ảnh bìa bài viết). */
  standalone?: boolean;
  /** Tiền tố tên tệp lưu (a-z0-9-) — để route kiểm được url do chính nó cấp (vd ảnh bill "dinebill-…"). */
  prefix?: string;
  /** true = ảnh tĩnh: GIF cũng chuyển thành JPG (không giữ ảnh động). */
  stillOnly?: boolean;
}

export type SaveMediaResult = { url: string } | { error: string; status: number };

/**
 * Xử lý (xoay/thu nhỏ/nén, HEIC→JPG) và lưu media vào public/uploads + tạo bản
 * ghi DB gắn vào service / hạng phòng / phòng. Dùng chung cho upload trực tiếp
 * và nhập từ Google Drive.
 */
export async function processAndSaveMedia(input: SaveMediaInput): Promise<SaveMediaResult> {
  const { buf } = input;
  const serviceId = input.serviceId ?? null;
  const roomTypeId = input.roomTypeId ?? null;
  const roomId = input.roomId ?? null;
  const effType = input.mime;
  const isVideo = effType.startsWith("video/");
  const isImage = effType.startsWith("image/");

  if (!input.standalone && !serviceId && !roomTypeId && !roomId)
    return { error: "Thiếu đối tượng gắn media.", status: 400 };
  if (!isImage && !isVideo) return { error: "Chỉ nhận tệp ảnh hoặc video.", status: 400 };
  if (isVideo && !input.standalone && !roomTypeId && !roomId) {
    return { error: "Video cần gắn vào một hạng phòng hoặc phòng.", status: 400 };
  }
  if (isImage && buf.length > MAX_IMAGE_BYTES) return { error: "Ảnh vượt quá 25MB.", status: 400 };
  if (isVideo && buf.length > MAX_VIDEO_BYTES) {
    return { error: `Video vượt quá ${Math.round(MAX_VIDEO_BYTES / 1048576)}MB.`, status: 400 };
  }
  const mediaType = isVideo ? "video" : "image";

  // Xác minh đối tượng tồn tại.
  if (input.standalone) {
    // không gắn DB — bỏ qua kiểm tra đối tượng
  } else if (roomId) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return { error: "Phòng không tồn tại.", status: 404 };
  } else if (roomTypeId) {
    const rt = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
    if (!rt) return { error: "Hạng phòng không tồn tại.", status: 404 };
  } else if (serviceId) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return { error: "Dịch vụ không tồn tại.", status: 404 };
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  let data: Buffer = buf;
  let ext: string;

  if (isVideo) {
    // Video không chuyển mã — bắt buộc đúng magic bytes container, đuôi cố định theo bảng (không lấy từ tên tệp).
    const vext = sniffVideoExt(buf, effType);
    if (!vext) return { error: "Tệp không phải video hợp lệ (MP4, MOV, WebM).", status: 400 };
    ext = vext;
  } else {
    // Ảnh: luôn giải mã + mã hoá lại (sharp) ⇒ tệp lưu chắc chắn là ảnh thật, đuôi theo định dạng ĐẦU RA.
    // Không lưu nguyên bản bất kỳ tệp nào (SVG/HTML giả ảnh từng chạy được script trên domain chính).
    const kind = sniffImage(buf);
    if (!kind) return { error: BAD_IMAGE, status: 400 };
    if (kind === "heif") {
      const base = path.join(os.tmpdir(), crypto.randomBytes(8).toString("hex"));
      const tmpIn = `${base}.heic`;
      const tmpOut = `${base}.jpg`;
      await writeFile(tmpIn, buf);
      try {
        // sharp không giải mã được HEVC-HEIC → dùng heif-convert (libde265).
        await execFileP("heif-convert", ["-q", "92", tmpIn, tmpOut], { timeout: 120000 });
        let jpg: Buffer;
        try {
          jpg = await readFile(tmpOut);
        } catch {
          jpg = await readFile(`${base}-1.jpg`); // HEIC chứa nhiều ảnh
        }
        let pipe = sharp(jpg);
        const meta = await pipe.metadata();
        if (meta.width && meta.width > MAX_IMAGE_WIDTH) {
          pipe = pipe.resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true });
        }
        data = await pipe.jpeg({ quality: 82 }).toBuffer();
        ext = "jpg";
      } catch {
        return { error: "Không chuyển được ảnh HEIC. Vui lòng thử lại hoặc dùng ảnh JPG.", status: 400 };
      } finally {
        await rm(tmpIn, { force: true }).catch(() => {});
        await rm(tmpOut, { force: true }).catch(() => {});
        await rm(`${base}-1.jpg`, { force: true }).catch(() => {});
      }
    } else {
      const animated = kind === "gif" && !input.stillOnly;
      try {
        let pipe = sharp(buf, { failOn: "none", animated }).rotate();
        const meta = await pipe.metadata();
        // sharp tự nhận diện lại định dạng — phải là ảnh raster (chặn SVG/PDF… lọt qua).
        if (!meta.format || !["jpeg", "png", "gif", "webp", "tiff", "heif"].includes(meta.format)) {
          return { error: BAD_IMAGE, status: 400 };
        }
        if (meta.width && meta.width > MAX_IMAGE_WIDTH) {
          pipe = pipe.resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true });
        }
        if (animated) {
          data = await pipe.gif().toBuffer();
          ext = "gif";
        } else if (kind === "png") {
          data = await pipe.png({ compressionLevel: 9 }).toBuffer();
          ext = "png";
        } else if (kind === "webp") {
          data = await pipe.webp({ quality: 82 }).toBuffer();
          ext = "webp";
        } else if (kind === "avif") {
          data = await pipe.avif({ quality: 60 }).toBuffer();
          ext = "avif";
        } else {
          // jpeg, tiff, gif tĩnh → JPEG
          data = await pipe.jpeg({ quality: 82 }).toBuffer();
          ext = "jpg";
        }
      } catch {
        // sharp không đọc được ⇒ TỪ CHỐI (trước đây lưu nguyên gốc kèm đuôi lấy từ tên tệp ⇒ lỗ XSS).
        return { error: BAD_IMAGE, status: 400 };
      }
    }
  }

  const prefix = input.prefix && /^[a-z0-9-]{1,40}$/.test(input.prefix) ? `${input.prefix}-` : "";
  const name = `${prefix}${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(uploadDir, name), data);
  const url = `/uploads/${name}`;

  if (input.standalone) {
    return { url };
  }
  if (roomId) {
    const count = await prisma.roomImage.count({ where: { roomId } });
    await prisma.roomImage.create({ data: { roomId, url, sortOrder: count, isCover: count === 0 } });
  } else if (roomTypeId) {
    const count = await prisma.roomTypeImage.count({ where: { roomTypeId } });
    await prisma.roomTypeImage.create({
      data: { roomTypeId, url, type: mediaType, sortOrder: count, isCover: count === 0 },
    });
    // Ảnh bìa (imageUrl) luôn là ảnh đầu tiên (không dùng video làm thumbnail).
    if (mediaType === "image") {
      const rt = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
      if (rt && !rt.imageUrl) {
        await prisma.roomType.update({ where: { id: roomTypeId }, data: { imageUrl: url } });
      }
    }
  } else if (serviceId) {
    const count = await prisma.serviceImage.count({ where: { serviceId } });
    await prisma.serviceImage.create({ data: { serviceId, url, sortOrder: count, isCover: count === 0 } });
  }

  return { url };
}
