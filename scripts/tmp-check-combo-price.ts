import { findComboMatches, EMPTY_FILTERS, planPricePerPerson } from "../src/lib/combo";

async function run(label: string, people: number, priceMax: number | null = null, priceMin: number | null = null) {
  const r = await findComboMatches({ fromKey: "2026-11-28", toKey: "2026-11-30", people, budget: null, priceMax, priceMin, filters: EMPTY_FILTERS });
  if (!r) { console.log(label, "null"); return; }
  const fare = r.buses.length ? Math.min(...r.buses.map((b) => b.farePerPerson)) : 0;
  console.log(`\n${label}: ${r.homes.length} homestay, ${r.roomCount} phòng, ${r.planCount} phương án, ${r.busCount} nhà xe`);
  for (const h of r.homes) {
    for (const p of h.plans) {
      const pp = planPricePerPerson(p.roomCost, p.communal, people, fare);
      console.log(`  - ${h.title}: [${p.label}] ${p.roomCount} phòng, đủ ${p.capacity} chỗ, tiền phòng ${p.roomCost.toLocaleString()}, ${pp.toLocaleString()}/khách, amen=${p.amenityScore.toFixed(2)}`);
    }
  }
}

async function main() {
  await run("2 người      ", 2);
  await run("10 người     ", 10);
  await run("10 ng <1200k ", 10, 1200000);
}
main();
