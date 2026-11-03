import { findComboMatches, EMPTY_FILTERS } from "../src/lib/combo";
async function main() {
  const r = await findComboMatches({ fromKey: "2026-11-06", toKey: "2026-11-08", people: 2, budget: null, filters: EMPTY_FILTERS });
  if (!r) { console.log("null"); return; }
  console.log(`check-in ${r.checkIn} -> ${r.checkOut}, xe: ${r.busCount}, phòng khả dụng: ${r.roomCount}`);
  for (const h of r.homes) console.log(` ${h.title}: ${h.rooms.map(x => x.roomName).join(" | ")}`);
}
main();
