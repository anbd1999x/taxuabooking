import { syncServiceSheet } from "../src/lib/sheet-sync";
async function main() {
  const r = await syncServiceSheet("cmvzflcu20001nl28knlbkfov");
  console.log(JSON.stringify(r, null, 2));
}
main();
