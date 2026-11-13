import { PrismaClient } from "@prisma/client";
import { syncAllSheets } from "../../src/lib/sheet-sync";

const prisma = new PrismaClient();
async function main() {
  const res = await syncAllSheets("MANUAL");
  const titles = new Map((await prisma.service.findMany({ select: { id: true, title: true } })).map((s) => [s.id, s.title]));
  for (const r of res) console.log(`${r.ok ? "ok " : "ERR"} changes=${String(r.changes ?? "-").padStart(3)} unknown=${r.unknownValues?.length ?? 0} | ${titles.get(r.serviceId)} | ${r.summary.slice(0, 110)}`);
}
main().finally(() => prisma.$disconnect());
