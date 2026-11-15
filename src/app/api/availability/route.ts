import { NextResponse } from "next/server";
import { computeAvailability } from "@/lib/booking";
import { isValidDateKey, nightsBetween, parseDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("serviceId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const quantity = Number(searchParams.get("quantity") ?? "1");
  // Thuê xe máy: giờ nhận / giờ trả (HH:mm) để tính số ngày quy đổi.
  const pickup = searchParams.get("pickup");
  const ret = searchParams.get("ret");

  if (!serviceId || !from || !isValidDateKey(from)) {
    return NextResponse.json(
      { error: "Thiếu tham số hoặc ngày không hợp lệ." },
      { status: 400 },
    );
  }
  if (to && (!isValidDateKey(to) || to <= from)) {
    return NextResponse.json(
      { error: "Ngày trả phải sau ngày nhận." },
      { status: 400 },
    );
  }
  // Cùng giới hạn khi đặt (tối đa 60 đêm) — kỳ nhiều năm làm mỗi lần gọi duyệt hàng nghìn đêm × mọi phòng.
  if (to && nightsBetween(parseDateOnly(from), parseDateOnly(to)) > 60) {
    return NextResponse.json({ error: "Kỳ đặt tối đa 60 ngày." }, { status: 400 });
  }

  let result;
  try {
    result = await computeAvailability(
      serviceId,
      from,
      to,
      Number.isFinite(quantity) ? Math.min(50, Math.max(1, Math.floor(quantity))) : 1,
      { pickup, ret },
    );
  } catch (err) {
    // Lỗi nghiệp vụ có thông điệp rõ (vd giờ trả xe không sau giờ nhận).
    return NextResponse.json({ error: err instanceof Error ? err.message : "Không kiểm tra được tình trạng." }, { status: 400 });
  }
  if (!result) {
    return NextResponse.json({ error: "Không tìm thấy dịch vụ." }, { status: 404 });
  }
  return NextResponse.json(result);
}
