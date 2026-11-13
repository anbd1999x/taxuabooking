import { findComboMatches, EMPTY_FILTERS } from "../../src/lib/combo";
(async () => {
  for (const people of [2, 4]) {
    const r = await findComboMatches({ fromKey: "2026-11-29", toKey: "2026-12-02", people, budget: null, filters: EMPTY_FILTERS });
    const h = r?.homes.find((x) => x.slug === "nha-ben-suoi");
    console.log(`-- ${people} khách, ${r?.nights} đêm`);
    for (const p of h?.plans ?? []) {
      console.log(p.label, p.roomCost, p.groups.map((g) => `[${g.options.map((o) => o.roomName).join(", ")}]×${g.count}`).join(" + "));
    }
  }
  process.exit(0);
})();
