import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { cabinBookingSchema } from "@/lib/validation";
import { createCabinBooking } from "@/lib/cabin";
import { getSession } from "@/lib/auth";
import { attachPhoneIfMissing } from "@/lib/customer";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { notifyNewBooking } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!rateLimit(`book:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Bạn gửi yêu cầu quá nhanh, vui lòng thử lại sau 1 phút." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  try {
    const input = cabinBookingSchema.parse(body);
    const session = await getSession();
    const ctvId = session?.role === "CTV" ? session.sub : null;
    const result = await createCabinBooking(input, ctvId);
    await attachPhoneIfMissing(input.phone).catch(() => {});
    void notifyNewBooking({ code: result.code, customerName: input.customerName, phone: input.phone, summary: "Vé xe cabin" });
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
    const message = err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
