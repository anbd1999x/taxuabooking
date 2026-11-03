import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const list = await p.service.findMany({
    where: { category: { in: ["HOMESTAY", "BUNGALOW"] } },
    select: { title: true, sheetUrl: true, sheetSyncedAt: true, sheetSyncResult: true },
    orderBy: { title: "asc" },
  });
  for (const s of list)
    console.log((s.sheetUrl ? "[sheet] " : "[  -  ] ") + s.title + " | " + (s.sheetSyncResult ?? ""));
}
main().finally(() => p.$disconnect());
