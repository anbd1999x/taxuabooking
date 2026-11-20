import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { roadRoute } from "@/lib/road-distance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID = /^[A-Za-z0-9_-]{3,60}$/;

/** GET /api/nearby/route?home=<serviceId>&place=<placeId | serviceId homestay> — đường xe chạy để vẽ trên bản đồ. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const homeId = sp.get("home") ?? "";
  const placeId = sp.get("place") ?? "";
  if (!ID.test(homeId) || !ID.test(placeId)) return NextResponse.json({ error: "Thiếu tham số." }, { status: 400 });
  const [home, place, stay] = await Promise.all([
    prisma.service.findUnique({ where: { id: homeId }, select: { id: true, lat: true, lng: true } }),
    prisma.place.findFirst({ where: { id: placeId, published: true }, select: { id: true, lat: true, lng: true } }),
    prisma.service.findFirst({ where: { id: placeId, published: true }, select: { id: true, lat: true, lng: true } }),
  ]);
  const dst = place ?? stay;
  if (!home?.lat || !home.lng || !dst?.lat || !dst.lng) return NextResponse.json({ route: null });
  const route = await roadRoute({ id: home.id, lat: home.lat, lng: home.lng }, { id: dst.id, lat: dst.lat, lng: dst.lng });
  return NextResponse.json({ route }, { headers: { "Cache-Control": "public, max-age=600" } });
}
