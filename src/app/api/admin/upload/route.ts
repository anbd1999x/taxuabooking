import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25MB (ảnh gốc; sẽ nén lại trước khi lưu)
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_WIDTH = 2400; // thu nhỏ ảnh quá lớn cho nhẹ web
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};
// HEIC/HEIF (ảnh iPhone) được nhận và tự chuyển sang JPEG để web hiển thị được.
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

// Suy ra MIME từ phần mở rộng tên file khi trình duyệt không gửi file.type
// (một số máy iPhone gửi type rỗng cho ảnh HEIC).
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  avif: "image/avif", heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
};
function resolveType(file: File): string {
  if (file.type && (IMAGE_TYPES.includes(file.type) || VIDEO_TYPES.includes(file.type))) return file.type;
  const m = /\.([a-z0-9]+)$/i.exec(file.name || "");
  return (m && EXT_TO_MIME[m[1].toLowerCase()]) || file.type || "";
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  const form = await request.formData();
  const serviceId = form.get("serviceId");
  const roomTypeId = form.get("roomTypeId");
  const roomId = form.get("roomId");
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu tệp." }, { status: 400 });
  }
  if (typeof serviceId !== "string" && typeof roomTypeId !== "string" && typeof roomId !== "string") {
    return NextResponse.json({ error: "Thiếu đối tượng gắn media." }, { status: 400 });
  }
  const effType = resolveType(file);
  const isVideo = VIDEO_TYPES.includes(effType);
  const isImage = IMAGE_TYPES.includes(effType);
  // Video chỉ cho phép ở hạng phòng.
  if (isVideo && typeof roomTypeId !== "string") {
    return NextResponse.json({ error: "Video chỉ hỗ trợ cho hạng phòng." }, { status: 400 });
  }
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "Chỉ nhận ảnh (JPG/PNG/WEBP/AVIF/HEIC) hoặc video (MP4/WEBM/MOV)." }, { status: 400 });
  }
  if (isImage && file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Ảnh vượt quá 25MB." }, { status: 400 });
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "Video vượt quá 50MB." }, { status: 400 });
  }
  const mediaType = isVideo ? "video" : "image";

  // Xác minh đối tượng tồn tại.
  if (typeof roomId === "string") {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return NextResponse.json({ error: "Phòng không tồn tại." }, { status: 404 });
  } else if (typeof roomTypeId === "string") {
    const room = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
    if (!room) return NextResponse.json({ error: "Hạng phòng không tồn tại." }, { status: 404 });
  } else if (typeof serviceId === "string") {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return NextResponse.json({ error: "Dịch vụ không tồn tại." }, { status: 404 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const inputBuf = Buffer.from(await file.arrayBuffer());
  let data: Buffer = inputBuf;
  let ext = EXT[effType] ?? "bin";

  if (isImage) {
    try {
      // Tự xoay theo EXIF, thu nhỏ ảnh quá lớn, và nén lại cho nhẹ.
      // HEIC/HEIF (ảnh iPhone) → JPEG để mọi trình duyệt hiển thị được.
      let pipe = sharp(inputBuf, { failOn: "none" }).rotate();
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
        // jpeg, heic, heif, hoặc không rõ → JPEG
        data = await pipe.jpeg({ quality: 82 }).toBuffer();
        ext = "jpg";
      }
    } catch {
      // sharp không đọc được: nếu là định dạng web thông dụng thì lưu nguyên gốc.
      if (effType === "image/jpeg" || effType === "image/png" || effType === "image/webp" || effType === "image/avif") {
        data = inputBuf;
        ext = EXT[effType];
      } else {
        return NextResponse.json(
          { error: "Không đọc được ảnh (định dạng không hỗ trợ). Hãy thử ảnh JPG/PNG." },
          { status: 400 },
        );
      }
    }
  }

  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(uploadDir, name), data);
  const url = `/uploads/${name}`;

  if (typeof roomId === "string") {
    const count = await prisma.roomImage.count({ where: { roomId } });
    await prisma.roomImage.create({
      data: { roomId, url, sortOrder: count, isCover: count === 0 },
    });
  } else if (typeof roomTypeId === "string") {
    const count = await prisma.roomTypeImage.count({ where: { roomTypeId } });
    await prisma.roomTypeImage.create({
      data: { roomTypeId, url, type: mediaType, sortOrder: count, isCover: count === 0 },
    });
    // Ảnh bìa (imageUrl) luôn là ảnh đầu tiên (không dùng video làm thumbnail).
    if (mediaType === "image") {
      const room = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
      if (room && !room.imageUrl) {
        await prisma.roomType.update({ where: { id: roomTypeId }, data: { imageUrl: url } });
      }
    }
  } else {
    const sid = serviceId as string;
    const count = await prisma.serviceImage.count({ where: { serviceId: sid } });
    await prisma.serviceImage.create({
      data: { serviceId: sid, url, sortOrder: count, isCover: count === 0 },
    });
  }

  return NextResponse.json({ url }, { status: 201 });
}
