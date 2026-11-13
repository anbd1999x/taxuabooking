import { listSheetTabs } from "../../src/lib/sheet-sync";
(async () => {
  const id = "10eKzwfKG0jbyNZeVABqS9cTrfmPSK1DWP2AlVXAGtqU";
  for (const t of await listSheetTabs(id)) {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${t.gid}`);
    const text = await res.text();
    console.log(`== ${t.name} (gid ${t.gid}) http ${res.status}`);
    if (/Thông tin/.test(t.name)) continue;
    for (const line of text.split(/\r?\n/).slice(0, 40)) console.log("  " + line.split(",").slice(0, 7).join(" | "));
  }
  process.exit(0);
})();
