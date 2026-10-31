import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

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
  const isVideo = VIDEO_TYPES.includes(file.type);
  const isImage = IMAGE_TYPES.includes(file.type);
  // Video chỉ cho phép ở hạng phòng.
  if (isVideo && typeof roomTypeId !== "string") {
    return NextResponse.json({ error: "Video chỉ hỗ trợ cho hạng phòng." }, { status: 400 });
  }
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "Chỉ nhận ảnh (JPG/PNG/WEBP/AVIF) hoặc video (MP4/WEBM/MOV)." }, { status: 400 });
  }
  if (isImage && file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Ảnh vượt quá 5MB." }, { status: 400 });
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

  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${EXT[file.type]}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, name), bytes);
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
