/**
 * Dự báo thời tiết Tà Xùa — logic thuần (dùng ở client). Theo claude.ai/design
 * `Du bao Thoi tiet Ta Xua.dc.html`: dữ liệu Open-Meteo (`/api/weather`), "khả năng biển mây"
 * ước tính từ độ ẩm, mây tầng thấp, chênh nhiệt độ–điểm sương và gió lúc 5h–7h sáng.
 */

export interface WxData {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    dew_point_2m: number[];
    cloud_cover_low: number[];
    cloud_cover: number[];
    precipitation_probability: number[];
    wind_speed_10m: number[];
    weather_code: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    precipitation_probability_max: number[];
  };
}

export type WxKind = "sun" | "part" | "cloud" | "fog" | "rain";

export function wxKind(c: number): WxKind {
  return c === 0 ? "sun" : c <= 2 ? "part" : c === 3 ? "cloud" : c <= 48 ? "fog" : c >= 51 ? "rain" : "cloud";
}

/**
 * Tên tình trạng theo mã WMO của Open-Meteo (chuỗi tiếng Việt = khoá dịch).
 * 0 = quang · 1 = phần lớn quang (ít mây) · 2 = mây rải rác · 3 = u ám. Ban đêm không nói "nắng".
 */
export function wxCondName(c: number, night = false): string {
  const k = wxKind(c);
  if (k === "rain") return c >= 95 ? "Mưa giông" : "Có mưa";
  if (k === "fog") return "Sương mù · mây vờn";
  if (k === "cloud") return "Nhiều mây";
  if (c === 0) return night ? "Đêm quang" : "Trời quang";
  if (c === 1) return night ? "Đêm ít mây" : "Nắng, ít mây";
  return night ? "Có mây rải rác" : "Nắng xen mây";
}

export interface SeaScore {
  s: number; // 0–100
  rh: number;
  low: number;
  wind: number;
  spread: number;
  rain: number;
  fRh: number;
  fLow: number;
  fSp: number;
  fW: number;
}

/** Khả năng biển mây sáng `dayKey` (trung bình 5h, 6h, 7h). */
export function seaScore(H: WxData["hourly"], dayKey: string): SeaScore | null {
  const idx: number[] = [];
  H.time.forEach((t, i) => {
    if (t.startsWith(dayKey) && ["05", "06", "07"].includes(t.slice(11, 13))) idx.push(i);
  });
  if (!idx.length) return null;
  const av = (k: keyof WxData["hourly"]) => idx.reduce((a, i) => a + Number((H[k] as number[])[i] ?? 0), 0) / idx.length;
  const rh = av("relative_humidity_2m");
  const low = av("cloud_cover_low");
  const wind = av("wind_speed_10m");
  const spread = av("temperature_2m") - av("dew_point_2m");
  const rain = av("precipitation_probability");
  const fRh = Math.max(0, Math.min(1, (rh - 70) / 28));
  const fLow = low / 100;
  const fSp = spread < 1.5 ? 1 : spread < 3 ? 0.6 : spread < 5 ? 0.25 : 0;
  const fW = wind < 8 ? 1 : wind < 15 ? 0.6 : wind < 25 ? 0.25 : 0;
  const s = Math.round(Math.max(0, Math.min(100, fRh * 38 + fLow * 24 + fSp * 20 + fW * 18 - (rain > 50 ? 30 : rain > 30 ? 12 : 0))));
  return { s, rh, low, wind, spread, rain, fRh, fLow, fSp, fW };
}

export const seaWord = (v: number) => (v >= 80 ? "Rất cao" : v >= 65 ? "Cao" : v >= 45 ? "Trung bình" : v >= 25 ? "Thấp" : "Rất thấp");
export const seaVerdict = (v: number) =>
  v >= 80
    ? "Biển mây rất dày, dậy từ 5h ra Đỉnh Gió hoặc Cây cô đơn là chắc ăn."
    : v >= 65
      ? "Nhiều khả năng có mây, nên dậy sớm, đi trước 6h30."
      : v >= 45
        ? "Có thể có mây mỏng ở thung lũng. Đi sớm, đừng kỳ vọng quá."
        : v >= 25
          ? "Ít khả năng có biển mây. Hợp đi check-in, ngắm hoàng hôn."
          : "Trời khô, gần như không có mây. Bù lại nhìn rõ núi và Milky Way.";

/** Giờ Việt Nam hiện tại (0–23) — đoán ngày / đêm trước khi có dữ liệu. */
export function vnHour(): number {
  return new Date(Date.now() + 7 * 3_600_000).getUTCHours();
}

const isoKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

/** Dữ liệu mẫu khi Open-Meteo lỗi (giống bản thiết kế). */
export function wxMock(): WxData {
  const base = new Date(Date.now() + 7 * 3_600_000);
  const H: WxData["hourly"] = { time: [], temperature_2m: [], relative_humidity_2m: [], dew_point_2m: [], cloud_cover_low: [], cloud_cover: [], precipitation_probability: [], wind_speed_10m: [], weather_code: [] };
  const D: WxData["daily"] = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], sunrise: [], sunset: [], precipitation_probability_max: [] };
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i));
    const k = isoKey(d);
    const seed = Math.sin(i * 3.1) * 0.5 + 0.5;
    D.time.push(k);
    D.weather_code.push([1, 2, 45, 3, 1, 61, 2][i]);
    D.temperature_2m_max.push(Math.round(18 + seed * 4));
    D.temperature_2m_min.push(Math.round(9 + seed * 3));
    D.sunrise.push(`${k}T06:12`);
    D.sunset.push(`${k}T17:18`);
    D.precipitation_probability_max.push([5, 10, 20, 35, 10, 70, 15][i]);
    for (let h = 0; h < 24; h++) {
      const tt = 11 + seed * 3 + 7 * Math.max(0, Math.sin(((h - 7) / 24) * 2 * Math.PI));
      const rh = h < 9 ? 92 + seed * 6 : 70 - seed * 10;
      H.time.push(`${k}T${String(h).padStart(2, "0")}:00`);
      H.temperature_2m.push(+tt.toFixed(1));
      H.relative_humidity_2m.push(Math.round(rh));
      H.dew_point_2m.push(+(tt - (100 - rh) / 5).toFixed(1));
      H.cloud_cover_low.push(h < 9 ? Math.round(60 + seed * 35) : 25);
      H.cloud_cover.push(h < 9 ? 65 : 40);
      H.precipitation_probability.push(i === 5 && h > 12 ? 70 : 5);
      H.wind_speed_10m.push(h < 9 ? 5 + seed * 6 : 12);
      H.weather_code.push(h < 9 ? 45 : D.weather_code[i]);
    }
  }
  const hr = vnHour();
  return {
    current: { temperature_2m: 12.4, apparent_temperature: 10.1, relative_humidity_2m: 93, weather_code: 45, wind_speed_10m: 6, is_day: hr >= 6 && hr < 18 ? 1 : 0 },
    hourly: H,
    daily: D,
  };
}

/** Nạp dự báo một lần cho cả trang (nút + popup dùng chung). */
let cache: Promise<{ data: WxData; live: boolean; at: number }> | null = null;
export function loadWeather() {
  if (!cache) {
    cache = fetch("/api/weather")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: WxData & { at: number }) => ({ data: d, live: true, at: d.at || Date.now() }))
      .catch(() => {
        cache = null; // lần sau thử lại
        return { data: wxMock(), live: false, at: Date.now() };
      });
  }
  return cache;
}

/** Link đặt combo để kịp ngắm mây sáng ngày `dayKey`: xe đêm hôm trước, về hôm sau. */
export function comboHrefFor(dayKey: string, todayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const day = (n: number) => isoKey(new Date(Date.UTC(y, m - 1, d + n)));
  let from = day(-1);
  let to = day(1);
  if (from < todayKey) from = todayKey;
  if (to <= from) {
    const [a, b, c] = from.split("-").map(Number);
    to = isoKey(new Date(Date.UTC(a, b - 1, c + 2)));
  }
  return `/combo?from=${from}&to=${to}`;
}
