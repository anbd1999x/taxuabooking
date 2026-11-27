/**
 * KHÍ HẬU TÀ XÙA THEO THÁNG (trang /thoi-tiet-ta-xua). File thuần, không gọi mạng.
 *
 * Nguồn: Open-Meteo Historical Weather API (archive-api.open-meteo.com, dữ liệu tái phân tích ERA5 / ERA5-Land
 * của ECMWF Copernicus, Open-Meteo hiệu chỉnh theo độ cao), toạ độ trung tâm xã Tà Xùa 21.275413, 104.434299
 * (MAP_CENTER) ⇒ ô lưới 21.3357, 104.4037, độ cao 1.550 m. Trung bình 10 năm 01/01/2015 – 31/12/2024.
 * Tính một lần bằng `node scripts/seo/climate-ta-xua.mjs` (27/11/2026), số dưới đây chép nguyên kết quả.
 *
 * Là số liệu MÔ HÌNH cho một ô lưới ~9–25 km, không phải trạm đo tại xã: dùng để so sánh các tháng,
 * không dùng như số đo chính xác một điểm.
 *  tmax / tmin = trung bình nhiệt độ cao nhất / thấp nhất trong ngày (°C)
 *  rain = tổng lượng mưa trung bình của tháng (mm) · wetDays = số ngày mưa ≥ 1 mm trung bình
 *  rh = độ ẩm trung bình (%) · coldest = nhiệt độ thấp nhất trong 10 năm (°C)
 */
export interface ClimateMonth {
  m: number;
  tmax: number;
  tmin: number;
  rain: number;
  wetDays: number;
  rh: number;
  coldest: number;
}

export const CLIMATE_SOURCE = {
  name: "Open-Meteo Historical Weather API (ERA5)",
  url: "https://open-meteo.com/en/docs/historical-weather-api",
  years: "2015–2024",
  elevation: 1550,
} as const;

export const TA_XUA_CLIMATE: readonly ClimateMonth[] = [
  { m: 1, tmax: 14.7, tmin: 7.5, rain: 85, wetDays: 11, rh: 85, coldest: -2.6 },
  { m: 2, tmax: 16.4, tmin: 8.6, rain: 58, wetDays: 10, rh: 81, coldest: -1 },
  { m: 3, tmax: 20.5, tmin: 12.4, rain: 81, wetDays: 15, rh: 81, coldest: 5 },
  { m: 4, tmax: 22.8, tmin: 14.7, rain: 111, wetDays: 17, rh: 78, coldest: 4.2 },
  { m: 5, tmax: 24.1, tmin: 16.8, rain: 226, wetDays: 22, rh: 82, coldest: 9 },
  { m: 6, tmax: 23.8, tmin: 17.9, rain: 215, wetDays: 24, rh: 86, coldest: 15.5 },
  { m: 7, tmax: 23.6, tmin: 17.6, rain: 301, wetDays: 26, rh: 87, coldest: 14.7 },
  { m: 8, tmax: 23.1, tmin: 17.2, rain: 463, wetDays: 27, rh: 90, coldest: 14.2 },
  { m: 9, tmax: 22.4, tmin: 16.1, rain: 265, wetDays: 25, rh: 89, coldest: 12 },
  { m: 10, tmax: 20.2, tmin: 13.6, rain: 136, wetDays: 18, rh: 86, coldest: 6 },
  { m: 11, tmax: 18.4, tmin: 11.3, rain: 47, wetDays: 10, rh: 85, coldest: 4.1 },
  { m: 12, tmax: 14.8, tmin: 7.5, rain: 42, wetDays: 7, rh: 83, coldest: -0.6 },
];
