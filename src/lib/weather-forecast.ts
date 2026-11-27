import "server-only";
import { MAP_CENTER } from "./checkin-map";
import { seaScore, type WxData } from "./weather";

/**
 * Dự báo 7 ngày cho trang /thoi-tiet-ta-xua (Open-Meteo, miễn phí, không khoá), dựng PHÍA SERVER.
 * Data cache của Next 2 giờ ⇒ mọi khách dùng chung một lần gọi ra ngoài. Lỗi / quá 8 giây ⇒ null (trang ẩn khối dự báo).
 * Toạ độ = trung tâm xã Tà Xùa (MAP_CENTER); độ cao để Open-Meteo tự lấy theo bản đồ địa hình.
 */
export const FORECAST_REVALIDATE = 7200;

export interface Forecast extends WxData {
  daily: WxData["daily"] & { precipitation_sum: number[]; wind_speed_10m_max: number[] };
  elevation: number;
  /** Mốc lấy dữ liệu (ms) — hiển thị "cập nhật lúc". */
  at: number;
}

const URL_OM =
  `https://api.open-meteo.com/v1/forecast?latitude=${MAP_CENTER.lat}&longitude=${MAP_CENTER.lng}&timezone=Asia%2FHo_Chi_Minh&forecast_days=7&past_days=1` +
  "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day" +
  "&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,cloud_cover_low,cloud_cover,precipitation_probability,wind_speed_10m,weather_code" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,precipitation_sum,wind_speed_10m_max";

export async function getForecast(): Promise<Forecast | null> {
  try {
    const r = await fetch(URL_OM, { next: { revalidate: FORECAST_REVALIDATE }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d?.current || !d?.hourly?.time?.length || !d?.daily?.time?.length) return null;
    return { current: d.current, hourly: d.hourly, daily: d.daily, elevation: Number(d.elevation) || 0, at: Date.parse(r.headers.get("date") ?? "") || Date.now() };
  } catch {
    return null;
  }
}

export interface MorningOutlook {
  day: string; // yyyy-mm-dd
  score: number; // 0–100, đã cộng yếu tố mưa hôm trước
  rh: number;
  low: number;
  spread: number;
  wind: number;
  rain: number; // % khả năng mưa lúc 5h–7h
  rainBefore: number | null; // mm mưa cả ngày hôm trước
}

/**
 * Khả năng có biển mây sáng `day` (ƯỚC TÍNH, không cam kết): dùng `seaScore` (độ ẩm, mây tầng thấp,
 * chênh nhiệt độ – điểm sương, gió lúc 5h–7h, trừ điểm khi khả năng mưa cao) như popup thời tiết trang chủ,
 * cộng thêm 8 điểm khi hôm trước có mưa ≥ 1 mm mà sáng đó khả năng mưa ≤ 30% (đất ẩm, đêm quang dễ sinh sương mây thung lũng).
 */
export function morningOutlook(f: Forecast, day: string): MorningOutlook | null {
  const s = seaScore(f.hourly, day);
  if (!s) return null;
  const i = f.daily.time.indexOf(day);
  const rainBefore = i > 0 ? (f.daily.precipitation_sum[i - 1] ?? null) : null;
  const bonus = rainBefore != null && rainBefore >= 1 && s.rain <= 30 ? 8 : 0;
  return { day, score: Math.min(100, s.s + bonus), rh: s.rh, low: s.low, spread: s.spread, wind: s.wind, rain: s.rain, rainBefore };
}

/** Ngày hôm nay theo giờ Việt Nam (yyyy-mm-dd). */
export function vnToday(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

export const outlookWord = (v: number) => (v >= 65 ? "Khá cao" : v >= 45 ? "Trung bình" : v >= 25 ? "Thấp" : "Rất thấp");
export const outlookNote = (v: number) =>
  v >= 65
    ? "Điều kiện dự báo khá thuận cho biển mây sáng sớm. Nếu đi, nên có mặt ở điểm ngắm trước 6h."
    : v >= 45
      ? "Có thể có mây mỏng ở thung lũng, chưa chắc chắn. Nên xem lại dự báo tối hôm trước."
      : v >= 25
        ? "Ít khả năng có biển mây. Trời thường nhìn rõ núi, hợp đi check-in."
        : "Rất ít khả năng có biển mây theo dự báo hiện tại.";
