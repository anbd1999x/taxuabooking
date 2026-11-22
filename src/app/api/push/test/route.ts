import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pushTest } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Gửi thông báo thử tới chính thiết bị đang bấm (kiểm tra iPhone có nhận push không). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "PROVIDER")) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }
  if (!rateLimit(`push-test:${session.sub}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Thử lại sau ít phút." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "Thiếu endpoint." }, { status: 400 });
  const r = await pushTest(body.endpoint, session.sub);
  return NextResponse.json(r);
}
