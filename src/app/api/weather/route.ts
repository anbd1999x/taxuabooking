import { NextResponse } from "next/server";
import { FORECAST_REVALIDATE, getForecast, toBoardData } from "@/lib/weather-forecast";

/**
 * Dự báo thời tiết Tà Xùa cho nút thời tiết ở banner trang chủ (`WeatherBadge`) + popup dự báo.
 * Cùng nguồn với trang /thoi-tiet-ta-xua (`getForecast`, cache 30 phút) ⇒ hai nơi ra cùng con số.
 * Open-Meteo lỗi ⇒ 502, client tự dùng dữ liệu mẫu (popup) hoặc báo chưa tải được (trang).
 */
export const revalidate = 1800;

export async function GET() {
  const f = await getForecast();
  if (!f) return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
  return NextResponse.json(
    { ...toBoardData(f), at: f.at },
    { headers: { "Cache-Control": `public, s-maxage=${FORECAST_REVALIDATE}, stale-while-revalidate=3600` } },
  );
}
