import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { dineCustomerState, tableForQrGuarded } from "@/lib/dine";
import { processAndSaveMedia, resolveMediaType } from "@/lib/media";
import { dineBillPrefix } from "@/lib/dine-proof";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Khách tải ẢNH BILL CHUYỂN KHOẢN từ điện thoại tại bàn → { url } (rồi gửi kèm op `claim` của /api/qr).
 * Bắt buộc đúng khoá của mã QR dán ở bàn; chỉ nhận khi bàn ĐANG có hoá đơn và quán đã khai tài khoản nhận CK;
 * chỉ nhận ảnh raster (≤5MB, luôn mã hoá lại, GIF ⇒ JPG); 6 lần / 10 phút / IP + bàn.
 * Tên tệp mang tiền tố riêng của bàn (`dineBillPrefix`) ⇒ op claim chỉ nhận đúng ảnh do route này cấp cho bàn đó.
 */
export async function POST(request: Request) {
  // Chặn body lớn TRƯỚC khi đọc formData (Node đệm cả body vào RAM); +64KB cho các trường khác của form.
  const len = Number(request.headers.get("content-length") || "");
  if (!len) return bad("Thiếu kích thước tệp — tải lại ảnh.", 411);
  if (len > MAX_BYTES + 64 * 1024) return bad("Ảnh tối đa 5MB.", 413);
  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return bad("Ảnh quá lớn hoặc tải lên bị gián đoạn.");
  }
  const ip = clientIp(request);
  const q = await tableForQrGuarded(ip, String(fd.get("v") ?? "").slice(0, 120), String(fd.get("t") ?? "").slice(0, 20), String(fd.get("k") ?? "").slice(0, 16));
  if (!q) return bad("Mã QR không hợp lệ. Quét lại mã dán trên bàn.", 404);
  if (!rateLimit(`qr-proof:${ip}:${q.table.id}`, 6, 10 * 60_000)) return bad("Bạn tải ảnh hơi nhiều. Chờ vài phút rồi thử lại.", 429);
  // Chỉ nhận khi thật sự có thể chuyển khoản (bàn có hoá đơn > 0 + quán có tài khoản) — không để route thành kho ảnh miễn phí.
  const st = await dineCustomerState(q);
  if (!st.bank) return bad(st.bill > 0 ? "Quán chưa nhận chuyển khoản — chọn trả tiền mặt." : "Bàn chưa có món nào cần thanh toán.", 409);
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return bad("Chưa chọn ảnh.");
  if (file.size > MAX_BYTES) return bad("Ảnh tối đa 5MB.");
  const mime = resolveMediaType(file.type, file.name);
  if (!mime.startsWith("image/")) return bad("Chỉ nhận ảnh chụp bill chuyển khoản.");
  const res = await processAndSaveMedia({
    buf: Buffer.from(await file.arrayBuffer()),
    mime,
    filename: file.name,
    standalone: true,
    stillOnly: true,
    prefix: dineBillPrefix(q.table.id),
  });
  if ("error" in res) return bad(res.error, res.status);
  return NextResponse.json({ url: res.url });
}
