import { findComboMatches, EMPTY_FILTERS } from "../../src/lib/combo";
(async () => {
  for (const people of [1, 2, 3, 4, 6, 10]) {
    const r = await findComboMatches({ fromKey: "2026-11-29", toKey: "2026-12-02", people, budget: null, filters: EMPTY_FILTERS });
    let miss = 0, maxPlans = 0;
    for (const h of r?.homes ?? []) {
      const cov = new Set(h.plans.flatMap((p) => p.groups.flatMap((g) => g.options.map((o) => o.roomId))));
      const m = h.rooms.filter((x) => !cov.has(x.roomId));
      miss += m.length; maxPlans = Math.max(maxPlans, h.plans.length);
      if (m.length) console.log("  thiếu:", h.title, m.map((x) => x.roomName).join(", "));
    }
    console.log(`${people} khách: ${r?.homes.length} home, căn chưa hiện=${miss}, nhiều thẻ nhất/home=${maxPlans}`);
  }
  process.exit(0);
})();
