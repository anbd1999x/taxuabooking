import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const s = await p.siteSetting.findMany();
  for (const r of s) console.log(r.key, "=", r.value);
}
main().finally(() => p.$disconnect());
