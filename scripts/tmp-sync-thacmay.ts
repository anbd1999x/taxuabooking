import { syncServiceSheet } from "../src/lib/sheet-sync";
async function main() {
  const r = await syncServiceSheet("cmw0ipudt0000unys7uonetxb");
  console.log(JSON.stringify(r, null, 2));
}
main();
