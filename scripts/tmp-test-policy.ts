import { checkWeekendPolicy } from "../src/lib/weekend-policy";
const d = (s: string) => new Date(s + "T00:00:00Z");
const cases: [string, string[]][] = [
  ["T7 le", ["2026-11-07"]],
  ["T6+T7", ["2026-11-06", "2026-11-07"]],
  ["T7+CN", ["2026-11-07", "2026-11-08"]],
  ["T6+T7+CN", ["2026-11-06", "2026-11-07", "2026-11-08"]],
  ["T6 le", ["2026-11-06"]],
  ["CN le", ["2026-11-08"]],
  ["T5+T6", ["2026-11-05", "2026-11-06"]],
  ["CN+T2", ["2026-11-08", "2026-11-09"]],
  ["T6..T2 (2 cuoi tuan? 1 T7)", ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"]],
];
for (const [name, days] of cases) {
  const r = checkWeekendPolicy("SAT_PAIRED", days.map(d));
  console.log(name.padEnd(30), "→", r ? "CHẶN" : "OK");
}
