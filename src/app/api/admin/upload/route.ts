import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { processAndSaveMedia, resolveMediaType } from "@/lib/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const result = await processAndSaveMedia({
    buf: Buffer.from(await file.arrayBuffer()),
    mime: resolveMediaType(file.type, file.name),
    filename: file.name,
    serviceId: typeof serviceId === "string" ? serviceId : null,
    roomTypeId: typeof roomTypeId === "string" ? roomTypeId : null,
    roomId: typeof roomId === "string" ? roomId : null,
    // standalone=1: chỉ lưu file & trả url (vd ảnh bìa bài viết), không gắn DB.
    standalone: form.get("standalone") === "1",
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url }, { status: 201 });
}
