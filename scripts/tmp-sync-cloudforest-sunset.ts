// Đồng bộ lịch phòng Cloud Forest + Sunset Clouds từ sheet chung.
// Chạy: npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/tmp-sync-cloudforest-sunset.ts
import { syncServiceSheet } from "../src/lib/sheet-sync";
async function main() {
  for (const id of (process.argv[2] ? [process.argv[2]] : ["cmw90hn0a0000unvggg4l3qr6", "cmw90hnfm001bunvgov8afill"])) {
    const r = await syncServiceSheet(id);
    console.log(JSON.stringify({ ...r, syncedTabs: r.syncedTabs, skippedTabs: r.skippedTabs }, null, 2));
  }
}
main();
