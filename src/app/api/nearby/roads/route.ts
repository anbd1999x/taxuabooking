import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { roadDistances } from "@/lib/road-distance";
import { nearbyTargets } from "@/lib/nearby";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID = /^[A-Za-z0-9_-]{3,60}$/;

/**
 * GET /api/nearby/roads?home=<serviceId> — quãng đường xe chạy (km, phút) từ home tới mọi điểm xung quanh
 * (check-in / cafe / nhà hàng / homestay khác). Thường đã được tính sẵn (warmRoadCache) ⇒ chỉ đọc DB.
 */
export async function GET(request: Request) {
  const homeId = new URL(request.url).searchParams.get("home") ?? "";
  if (!ID.test(homeId)) return NextResponse.json({ error: "Thiếu home." }, { status: 400 });
  const home = await prisma.service.findUnique({ where: { id: homeId }, select: { id: true, lat: true, lng: true } });
  if (!home || home.lat == null || home.lng == null) return NextResponse.json({ roads: {} });
  const targets = (await nearbyTargets()).filter((t) => t.id !== home.id);
  const roads = await roadDistances({ id: home.id, lat: home.lat, lng: home.lng }, targets);
  return NextResponse.json({ roads }, { headers: { "Cache-Control": "public, max-age=300" } });
}
