import { NextResponse } from "next/server";
import { getCustomer } from "@/lib/customer";
import { processAndSaveMedia, resolveMediaType } from "@/lib/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB (ảnh chụp màn hình)

// Khách đã đăng nhập tải ảnh chụp màn hình kèm góp ý (chỉ ảnh, không gắn DB).
export async function POST(request: Request) {
  const customer = await getCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu tệp." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Ảnh vượt quá 10MB." }, { status: 400 });
  }
  const mime = resolveMediaType(file.type, file.name);
  if (!mime.startsWith("image/")) {
    return NextResponse.json({ error: "Chỉ nhận tệp ảnh." }, { status: 400 });
  }

  const result = await processAndSaveMedia({
    buf: Buffer.from(await file.arrayBuffer()),
    mime,
    filename: file.name,
    standalone: true,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url }, { status: 201 });
}
