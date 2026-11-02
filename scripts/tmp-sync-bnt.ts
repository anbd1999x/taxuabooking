import { syncServiceSheet } from "../src/lib/sheet-sync";
async function main() {
  const r = await syncServiceSheet("cmvzgzju40000unj857mkzx27");
  console.log(JSON.stringify(r, null, 2));
}
main();
