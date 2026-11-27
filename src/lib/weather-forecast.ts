import "server-only";
import { MAP_CENTER } from "./checkin-map";
import type { WxData } from "./weather";

/**
 * Dự báo 7 ngày Tà Xùa (Open-Meteo, miễn phí, không khoá), lấy PHÍA SERVER — MỘT NGUỒN cho trang
 * /thoi-tiet-ta-xua (dựng sẵn `WeatherBoard`) và `/api/weather` (nút + popup thời tiết trang chủ), để hai nơi
 * luôn ra cùng một con số. Data cache của Next 30 phút ⇒ mọi khách dùng chung một lần gọi ra ngoài.
 * Lỗi / quá 8 giây ⇒ null. Toạ độ = trung tâm xã Tà Xùa (MAP_CENTER), độ cao ép 1.600 m (độ cao khu săn mây,
 * ô lưới mô hình thấp hơn thực tế ⇒ nhiệt độ cao hơn thật).
 * `past_days=1` để biết mưa hôm trước (bảng khí hậu / mô tả), `toBoardData` cắt lại từ hôm nay.
 */
export const FORECAST_REVALIDATE = 1800;

export interface Forecast extends WxData {
  daily: WxData["daily"] & { precipitation_sum: number[]; wind_speed_10m_max: number[] };
  elevation: number;
  /** Mốc lấy dữ liệu (ms) — hiển thị "cập nhật lúc". */
  at: number;
}

const URL_OM =
  `https://api.open-meteo.com/v1/forecast?latitude=${MAP_CENTER.lat}&longitude=${MAP_CENTER.lng}&elevation=1600&timezone=Asia%2FHo_Chi_Minh&forecast_days=7&past_days=1` +
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

/** Ngày hôm nay theo giờ Việt Nam (yyyy-mm-dd). */
export function vnToday(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

/** Dữ liệu cho `WeatherBoard`: bỏ ngày hôm qua (past_days), chỉ giữ từ hôm nay (theo giờ VN), tối đa 7 ngày. */
export function toBoardData(f: Forecast): WxData {
  const today = vnToday();
  const di = f.daily.time.map((d, i) => [d, i] as const).filter(([d]) => d >= today).slice(0, 7).map(([, i]) => i);
  const hi = f.hourly.time.map((t, i) => [t, i] as const).filter(([t]) => t.slice(0, 10) >= today).map(([, i]) => i);
  const pick = <T,>(arr: T[], idx: number[]) => idx.map((i) => arr[i]);
  const D = f.daily;
  const H = f.hourly;
  return {
    current: f.current,
    daily: {
      time: pick(D.time, di),
      weather_code: pick(D.weather_code, di),
      temperature_2m_max: pick(D.temperature_2m_max, di),
      temperature_2m_min: pick(D.temperature_2m_min, di),
      sunrise: pick(D.sunrise, di),
      sunset: pick(D.sunset, di),
      precipitation_probability_max: pick(D.precipitation_probability_max, di),
    },
    hourly: {
      time: pick(H.time, hi),
      temperature_2m: pick(H.temperature_2m, hi),
      relative_humidity_2m: pick(H.relative_humidity_2m, hi),
      dew_point_2m: pick(H.dew_point_2m, hi),
      cloud_cover_low: pick(H.cloud_cover_low, hi),
      cloud_cover: pick(H.cloud_cover, hi),
      precipitation_probability: pick(H.precipitation_probability, hi),
      wind_speed_10m: pick(H.wind_speed_10m, hi),
      weather_code: pick(H.weather_code, hi),
    },
  };
}
