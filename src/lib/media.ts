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

// Đuôi file theo MIME (đặt tên file lưu).
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif",
  "image/gif": "gif", "image/svg+xml": "svg", "image/bmp": "bmp", "image/tiff": "tiff",
  "image/heic": "heic", "image/heif": "heif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
  "video/x-m4v": "m4v", "video/x-matroska": "mkv", "video/x-msvideo": "avi",
};
// Suy MIME từ đuôi file khi không có content-type rõ (iPhone hay gửi rỗng cho HEIC).
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  avif: "image/avif", gif: "image/gif", svg: "image/svg+xml", bmp: "image/bmp",
  tif: "image/tiff", tiff: "image/tiff", heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", m4v: "video/x-m4v", webm: "video/webm", mov: "video/quicktime",
  mkv: "video/x-matroska", avi: "video/x-msvideo",
};

export function resolveMediaType(mime: string | null | undefined, filename: string): string {
  const t = (mime || "").toLowerCase();
  if (t.startsWith("image/") || t.startsWith("video/")) return t;
  const m = /\.([a-z0-9]+)$/i.exec(filename || "");
  return (m && EXT_TO_MIME[m[1].toLowerCase()]) || t || "";
}

function extFor(effType: string, name: string): string {
  if (EXT[effType]) return EXT[effType];
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  if (m) return m[1].toLowerCase();
  const sub = effType.split("/")[1];
  return sub ? sub.replace(/[^a-z0-9]/g, "") || "bin" : "bin";
}

export interface SaveMediaInput {
  buf: Buffer;
  mime: string; // đã resolve (image/* hoặc video/*)
  filename: string;
  serviceId?: string | null;
  roomTypeId?: string | null;
  roomId?: string | null;
}

export type SaveMediaResult = { url: string } | { error: string; status: number };

/**
 * Xử lý (xoay/thu nhỏ/nén, HEIC→JPG) và lưu media vào public/uploads + tạo bản
 * ghi DB gắn vào service / hạng phòng / phòng. Dùng chung cho upload trực tiếp
 * và nhập từ Google Drive.
 */
export async function processAndSaveMedia(input: SaveMediaInput): Promise<SaveMediaResult> {
  const { buf, filename } = input;
  const serviceId = input.serviceId ?? null;
  const roomTypeId = input.roomTypeId ?? null;
  const roomId = input.roomId ?? null;
  const effType = input.mime;
  const isVideo = effType.startsWith("video/");
  const isImage = effType.startsWith("image/");

  if (!serviceId && !roomTypeId && !roomId) return { error: "Thiếu đối tượng gắn media.", status: 400 };
  if (!isImage && !isVideo) return { error: "Chỉ nhận tệp ảnh hoặc video.", status: 400 };
  if (isVideo && !roomTypeId && !roomId) {
    return { error: "Video cần gắn vào một hạng phòng hoặc phòng.", status: 400 };
  }
  if (isImage && buf.length > MAX_IMAGE_BYTES) return { error: "Ảnh vượt quá 25MB.", status: 400 };
  if (isVideo && buf.length > MAX_VIDEO_BYTES) {
    return { error: `Video vượt quá ${Math.round(MAX_VIDEO_BYTES / 1048576)}MB.`, status: 400 };
  }
  const mediaType = isVideo ? "video" : "image";

  // Xác minh đối tượng tồn tại.
  if (roomId) {
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
  let ext = extFor(effType, filename);

  // Ảnh: gif (giữ động) & svg (vector) lưu nguyên; HEIC/HEIF chuyển qua heif-convert;
  // còn lại xử lý bằng sharp (xoay/thu nhỏ/nén).
  if (isImage && effType !== "image/gif" && effType !== "image/svg+xml") {
    if (effType === "image/heic" || effType === "image/heif") {
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
      try {
        let pipe = sharp(buf, { failOn: "none" }).rotate();
        const meta = await pipe.metadata();
        if (meta.width && meta.width > MAX_IMAGE_WIDTH) {
          pipe = pipe.resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true });
        }
        if (effType === "image/png") {
          data = await pipe.png({ compressionLevel: 9 }).toBuffer();
          ext = "png";
        } else if (effType === "image/webp") {
          data = await pipe.webp({ quality: 82 }).toBuffer();
          ext = "webp";
        } else if (effType === "image/avif") {
          data = await pipe.avif({ quality: 60 }).toBuffer();
          ext = "avif";
        } else {
          // jpeg, bmp, tiff, hoặc không rõ → JPEG
          data = await pipe.jpeg({ quality: 82 }).toBuffer();
          ext = "jpg";
        }
      } catch {
        // sharp không đọc được → lưu nguyên gốc.
        data = buf;
        ext = extFor(effType, filename);
      }
    }
  }

  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(uploadDir, name), data);
  const url = `/uploads/${name}`;

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
