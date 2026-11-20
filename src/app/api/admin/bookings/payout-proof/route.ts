import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_IMAGE_BYTES, processAndSaveMedia, resolveMediaType } from "@/lib/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tải ẢNH UỶ NHIỆM CHI khi sàn trả tiền cho nhà cung cấp của một đơn (side room | bus) → lưu SupplierPayoutProof.
 * Mỗi lần gọi 1 ảnh; tải nhiều lần được (nhiều lần chuyển khoản). Chỉ ADMIN.
 */
export async function POST(request: Request) {
  const session = await getSession();
  // Kiểm phiên + kích thước TRƯỚC khi đọc formData.
  if (session?.role !== "ADMIN") return NextResponse.json({ error: "Chỉ admin tải chứng từ thanh toán." }, { status: 403 });
  if (!Number(request.headers.get("content-length") || "")) return NextResponse.json({ error: "Thiếu kích thước tệp — tải lại." }, { status: 411 });
  if (Number(request.headers.get("content-length")) > MAX_IMAGE_BYTES + 1024 * 1024) return NextResponse.json({ error: "Ảnh vượt quá 25MB." }, { status: 413 });
  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return NextResponse.json({ error: "Tệp quá lớn hoặc tải lên bị gián đoạn." }, { status: 400 });
  }
  const bookingId = String(fd.get("bookingId") ?? "");
  const side = String(fd.get("side") ?? "");
  if (!bookingId || (side !== "room" && side !== "bus")) return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  const b = await prisma.bookingRequest.findUnique({ where: { id: bookingId }, select: { id: true } });
  if (!b) return NextResponse.json({ error: "Không tìm thấy đơn." }, { status: 404 });
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Chưa chọn tệp." }, { status: 400 });
  const mime = resolveMediaType(file.type, file.name);
  if (!mime.startsWith("image/")) return NextResponse.json({ error: "Chỉ nhận ảnh (chụp / ảnh màn hình uỷ nhiệm chi)." }, { status: 400 });
  const res = await processAndSaveMedia({ buf: Buffer.from(await file.arrayBuffer()), mime, filename: file.name, standalone: true });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });

  const by = session.name || session.username || "Admin";
  const proof = await prisma.$transaction(async (tx) => {
    const p = await tx.supplierPayoutProof.create({ data: { bookingId, side, url: res.url, createdBy: by } });
    await tx.bookingLog.create({
      data: { bookingId, kind: "SUPPLIER", title: `Tải ảnh uỷ nhiệm chi (${side === "bus" ? "nhà xe" : "nhà cung cấp"})`, body: null, by },
    });
    return p;
  });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return NextResponse.json({ ok: true, proof: { id: proof.id, url: proof.url, createdAt: proof.createdAt.toISOString(), createdBy: proof.createdBy } });
}
