import { NextResponse } from "next/server";
import { recordServerAction } from "@/lib/visits";
import { ZodError } from "zod";
import { bookingInputSchema } from "@/lib/validation";
import { createBooking } from "@/lib/booking";
import { getSession } from "@/lib/auth";
import { attachPhoneIfMissing } from "@/lib/customer";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { notifyNewBooking } from "@/lib/push";
import { onBookingCreated } from "@/lib/booking-email";
import { isIpBlocked, recordBookingSource, requestIp } from "@/lib/ip-block";
import { ensureGeo } from "@/lib/visits";
import { isInternalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/** Loại dịch vụ theo tiền tố mã đơn (generateBookingCode). */
const CODE_WORD: Record<string, string> = { HT: "phòng homestay", XC: "vé xe cabin", XM: "thuê xe máy", XO: "xe ôm", TX: "taxi", CB: "combo" };

export async function POST(request: Request) {
  if (!rateLimit(`book:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Bạn gửi yêu cầu quá nhanh, vui lòng thử lại sau 1 phút." }, { status: 429 });
  }
  // IP trong danh sách chặn (spam) → từ chối (proxy đã chặn, đây là lớp bảo vệ thứ 2).
  if (await isIpBlocked(requestIp(request.headers))) {
    return NextResponse.json({ error: "Không thể gửi yêu cầu. Vui lòng liên hệ hotline." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  try {
    const input = bookingInputSchema.parse(body);
    const session = await getSession();
    const ctvId = session?.role === "CTV" ? session.sub : null;
    const result = await createBooking(input, ctvId);
    await recordBookingSource(result.code, request.headers);
    void onBookingCreated(result.code, input.email); // có email ⇒ lưu + gửi thư "đã nhận yêu cầu"
    void ensureGeo(requestIp(request.headers)); // tra khu vực/nhà mạng cho trang Chặn IP
    await attachPhoneIfMissing(input.phone).catch(() => {});
    void notifyNewBooking({ code: result.code, customerName: input.customerName, phone: input.phone });
    // Trang "Lượt truy cập": ghi khách này đã gửi đơn (kể hành trình đầy đủ).
    void recordServerAction(request, "/", `Gửi yêu cầu đặt ${CODE_WORD[result.code.split("-")[1] ?? ""] ?? "dịch vụ"} thành công — mã ${result.code}`);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "form";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return NextResponse.json(
        { error: "Vui lòng kiểm tra lại thông tin.", fieldErrors },
        { status: 400 },
      );
    }
    // Lỗi nghiệp vụ có thông điệp rõ (vd chính sách bán cuối tuần) → trả cho khách.
    if (err instanceof Error && err.message && !isInternalError(err)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("createBooking error", err);
    return NextResponse.json(
      { error: "Có lỗi xảy ra, vui lòng thử lại." },
      { status: 500 },
    );
  }
}
