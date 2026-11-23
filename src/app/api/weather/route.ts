import { NextResponse } from "next/server";

/**
 * Dự báo thời tiết Tà Xùa (Open-Meteo, miễn phí, không cần khoá) — dùng cho nút thời tiết ở
 * banner trang chủ (`WeatherBadge`) + popup dự báo. Server cache 30 phút ⇒ mọi khách dùng chung
 * một lần gọi ra ngoài; Open-Meteo lỗi ⇒ 502, client tự dùng dữ liệu mẫu.
 */
const LAT = 21.32;
const LNG = 104.43;
const URL_OM =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&elevation=1600&timezone=Asia%2FHo_Chi_Minh&forecast_days=7` +
  "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day" +
  "&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,cloud_cover_low,cloud_cover,precipitation_probability,wind_speed_10m,weather_code" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max";

export const revalidate = 1800;

export async function GET() {
  try {
    const r = await fetch(URL_OM, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    if (!d?.current || !d?.hourly || !d?.daily) throw new Error("bad");
    return NextResponse.json(
      { current: d.current, hourly: d.hourly, daily: d.daily, at: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
  }
}
