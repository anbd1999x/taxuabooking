import { findComboMatches, EMPTY_FILTERS } from "../src/lib/combo";
async function run(label: string, priceMax: number | null, priceMin: number | null) {
  const r = await findComboMatches({ fromKey: "2026-11-28", toKey: "2026-11-30", people: 2, budget: null, priceMax, priceMin, filters: EMPTY_FILTERS });
  if (!r) { console.log(label, "null"); return; }
  const prices = r.matches.map(m => m.pricePerPerson);
  console.log(`${label}: ${r.homes.length} homestay, ${r.roomCount} phòng, ${r.matches.length} match, giá/khách ${prices.length ? Math.min(...prices).toLocaleString() + " → " + Math.max(...prices).toLocaleString() : "-"}`);
}
async function main() {
  await run("Không lọc   ", null, null);
  await run("Dưới 800k   ", 800000, null);
  await run("Dưới 1200k  ", 1200000, null);
  await run("Trên 2tr    ", null, 2000000);
}
main();
// kiểm tra thêm sàn giá thấp hơn
run("Trên 1tr    ", null, 1000000);
