/**
 * Kiểm thử lịch ngày lễ + giá lễ của phòng (thuần, không đụng DB).
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/test-holidays.ts
 */
import { normalizeHolidays, isHolidayKey, holidayKeysBetween, type Holiday } from "../src/lib/holidays";
import { roomPricing, priceForDay, stayStrike } from "../src/lib/availability";

let ok = 0;
let bad = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) ok++;
  else {
    bad++;
    console.log(`✗ ${name}\n    nhận: ${g}\n    cần : ${w}`);
  }
}
const D = (k: string) => new Date(`${k}T00:00:00Z`);

const H: Holiday[] = normalizeHolidays([
  { name: "Tết 2027", from: "2027-02-05", to: "2027-02-10", yearly: false },
  { name: "30/4", from: "2026-04-29", to: "2026-05-02", yearly: true },
  { name: "Tết DL", from: "2026-12-31", to: "2027-01-01", yearly: true },
  { name: "ngược", from: "2027-03-05", to: "2027-03-03", yearly: false },
  { name: "hỏng", from: "abc" },
]);
eq("bỏ dòng hỏng", H.length, 4);
eq("đảo from/to ngược (không lặp)", H.find((h) => h.name === "ngược")!.from, "2027-03-03");
eq("khoảng cố định: trong", isHolidayKey(H, "2027-02-07"), true);
eq("khoảng cố định: biên", [isHolidayKey(H, "2027-02-05"), isHolidayKey(H, "2027-02-10")], [true, true]);
eq("khoảng cố định: ngoài / năm khác", [isHolidayKey(H, "2027-02-11"), isHolidayKey(H, "2028-02-07")], [false, false]);
eq("lặp hằng năm: năm sau", [isHolidayKey(H, "2027-04-30"), isHolidayKey(H, "2030-05-01")], [true, true]);
eq("lặp hằng năm: ngoài", isHolidayKey(H, "2027-05-03"), false);
eq("lặp vắt qua năm mới", [isHolidayKey(H, "2028-12-31"), isHolidayKey(H, "2029-01-01"), isHolidayKey(H, "2029-01-02")], [true, true, false]);
eq("holidayKeysBetween", holidayKeysBetween(H, "2027-04-28", "2027-05-03"), ["2027-04-29", "2027-04-30", "2027-05-01", "2027-05-02"]);

// Phòng: giá thường 500k, giảm còn 450k, T7 = 700k, giá lễ 900k.
const room = {
  listPrice: 500000, salePrice: 450000, holidayPrice: 900000,
  priceMon: null, priceTue: null, priceWed: null, priceThu: null, priceFri: null, priceSat: 700000, priceSun: null,
  listPriceMon: null, listPriceTue: null, listPriceWed: null, listPriceThu: null, listPriceFri: null, listPriceSat: null, listPriceSun: null,
};
const pr = roomPricing(room, H);
eq("đêm thường", priceForDay(D("2027-03-10"), pr, null), 450000); // T4
eq("đêm T7 thường", priceForDay(D("2027-03-13"), pr, null), 700000);
eq("đêm lễ (đè giá theo thứ T7)", priceForDay(D("2027-05-01"), pr, null), 900000); // T7 + lễ
eq("override vẫn đè giá lễ", priceForDay(D("2027-05-01"), pr, 333000), 333000);
eq("không truyền lịch ⇒ không giá lễ", priceForDay(D("2027-05-01"), roomPricing(room), null), 700000);
eq("phòng không có giá lễ ⇒ giá thường", priceForDay(D("2027-04-30"), roomPricing({ ...room, holidayPrice: null }, H), null), 450000);
eq("giá lễ 0 = không có", priceForDay(D("2027-04-30"), roomPricing({ ...room, holidayPrice: 0 }, H), null), 450000);
// Kỳ 28/4 → 2/5 (4 đêm: 28 thường, 29/30/1 lễ).
const nights = ["2027-04-28", "2027-04-29", "2027-04-30", "2027-05-01"].map(D);
const st = stayStrike(nights, room, H);
eq("tổng kỳ có đêm lễ", st.total, 450000 + 900000 * 3);
eq("gạch: chỉ đêm thường được gạch (lễ cao hơn giá gốc)", st.strikeTotal, 500000 + 900000 * 3);

console.log(`\n${bad ? "✗" : "✓"} ${ok} đạt, ${bad} lỗi`);
process.exit(bad ? 1 : 0);
