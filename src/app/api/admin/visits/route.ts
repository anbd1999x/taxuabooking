import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getVisitStats } from "@/lib/visits";

export const dynamic = "force-dynamic";

/** Thống kê truy cập cho dashboard admin (poll mỗi 30s để cập nhật số đang online). */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getVisitStats());
}
