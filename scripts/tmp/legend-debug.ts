import { PrismaClient } from "@prisma/client";
import { syncServiceSheet } from "../../src/lib/sheet-sync";
const prisma = new PrismaClient();
async function main() {
  const names = process.argv.slice(2);
  const svcs = await prisma.service.findMany({ where: { OR: names.map((n) => ({ title: { contains: n } })) }, select: { id: true, title: true, sheetUrl: true } });
  for (const s of svcs) {
    console.log("==", s.title, s.sheetUrl);
    const r = await syncServiceSheet(s.id, "MANUAL");
    console.log("  changes", r.changes, r.summary);
  }
}
main().finally(() => prisma.$disconnect());
