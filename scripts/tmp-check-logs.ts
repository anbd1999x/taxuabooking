import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const logs = await p.sheetSyncLog.findMany({
    orderBy: { createdAt: "desc" }, take: 10,
    select: { ok: true, source: true, changes: true, summary: true, createdAt: true, service: { select: { title: true } } },
  });
  for (const l of logs)
    console.log(l.createdAt.toISOString(), l.source, l.ok ? "OK" : "ERR", `+${l.changes}`, l.service.title, "|", l.summary.slice(0, 60));
  console.log("tổng:", await p.sheetSyncLog.count());
}
main().finally(() => p.$disconnect());
