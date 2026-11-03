import { syncServiceSheet } from "../src/lib/sheet-sync";
async function main() {
  const r = await syncServiceSheet("cmvzgr7wn0000unc0csd4xxzz");
  console.log(JSON.stringify(r, null, 2));
}
main();
