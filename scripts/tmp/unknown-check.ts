import { PrismaClient } from "@prisma/client";
import { syncServiceSheet } from "../../src/lib/sheet-sync";
const prisma = new PrismaClient();
async function main() {
  const s = await prisma.service.findFirst({ where: { title: { contains: "Bản Mây Tà Xùa Retreat" } }, select: { id: true } });
  const r = await syncServiceSheet(s!.id, "MANUAL");
  console.log(r.changes, r.unknownValues, r.summary);
}
main().finally(() => prisma.$disconnect());
