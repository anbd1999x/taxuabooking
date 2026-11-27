// Tính bảng khí hậu theo tháng cho trung tâm Tà Xùa từ Open-Meteo Historical Weather API (ERA5 / ERA5-Land,
// hiệu chỉnh theo độ cao), trung bình 10 năm 2015–2024. Chạy một lần, dán kết quả vào src/lib/ta-xua-climate.ts.
//   node scripts/seo/climate-ta-xua.mjs            (gọi API)
//   node scripts/seo/climate-ta-xua.mjs file.json  (đọc file đã tải)
import { readFileSync } from "node:fs";

const LAT = 21.275413, LNG = 104.434299; // MAP_CENTER (src/lib/checkin-map.ts)
const URL =
  `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LNG}&start_date=2015-01-01&end_date=2024-12-31` +
  "&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean,sunshine_duration&timezone=Asia%2FHo_Chi_Minh";

const d = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], "utf8")) : await (await fetch(URL)).json();
const D = d.daily;
const years = new Set(D.time.map((t) => t.slice(0, 4))).size;
const acc = Array.from({ length: 12 }, () => ({ n: 0, tmax: 0, tmin: 0, tmean: 0, rain: 0, wet: 0, rh: 0, sun: 0, coldest: Infinity }));
D.time.forEach((t, i) => {
  const m = +t.slice(5, 7) - 1;
  const a = acc[m];
  a.n++;
  a.tmax += D.temperature_2m_max[i];
  a.tmin += D.temperature_2m_min[i];
  a.tmean += D.temperature_2m_mean[i];
  a.rain += D.precipitation_sum[i];
  if (D.precipitation_sum[i] >= 1) a.wet++;
  a.rh += D.relative_humidity_2m_mean[i];
  a.sun += D.sunshine_duration[i] / 3600;
  a.coldest = Math.min(a.coldest, D.temperature_2m_min[i]);
});
const r1 = (x) => Math.round(x * 10) / 10;
console.log(`// grid ${d.latitude},${d.longitude} elevation ${d.elevation}m, ${years} năm`);
console.log(
  JSON.stringify(
    acc.map((a, m) => ({
      m: m + 1,
      tmax: r1(a.tmax / a.n),
      tmin: r1(a.tmin / a.n),
      tmean: r1(a.tmean / a.n),
      rain: Math.round(a.rain / years),
      wetDays: Math.round(a.wet / years),
      rh: Math.round(a.rh / a.n),
      sunH: r1(a.sun / a.n),
      coldest: r1(a.coldest),
    })),
  ),
);
