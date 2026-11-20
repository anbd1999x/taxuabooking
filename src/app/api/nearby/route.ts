import { NextResponse } from "next/server";
import { getNearbyData } from "@/lib/nearby";

export const dynamic = "force-dynamic";

/** GET /api/nearby?ids=<serviceId,...> — dữ liệu popup "Xung quanh có gì?" (công khai, chỉ dữ liệu đã đăng). */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z0-9_-]{3,60}$/.test(s));
  const data = await getNearbyData(ids);
  return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=120, s-maxage=300" } });
}
