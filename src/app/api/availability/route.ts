import { NextResponse } from "next/server";
import { computeAvailability } from "@/lib/booking";
import { isValidDateKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("serviceId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const quantity = Number(searchParams.get("quantity") ?? "1");

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

  const result = await computeAvailability(
    serviceId,
    from,
    to,
    Number.isFinite(quantity) ? quantity : 1,
  );
  if (!result) {
    return NextResponse.json({ error: "Không tìm thấy dịch vụ." }, { status: 404 });
  }
  return NextResponse.json(result);
}
