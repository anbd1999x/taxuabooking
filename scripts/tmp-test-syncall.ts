import { syncAllSheets } from "../src/lib/sheet-sync";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const results = await syncAllSheets("MANUAL");
  const names = new Map(
    (await p.service.findMany({ where: { id: { in: results.map(r => r.serviceId) } }, select: { id: true, title: true } }))
      .map(s => [s.id, s.title]),
  );
  for (const r of results) {
    const warn =
      (r.unmatchedRows.length ? ` ⚠ không khớp: ${r.unmatchedRows.join("; ")}` : "") +
      (r.missingRooms.length ? ` ⚠ thiếu: ${r.missingRooms.join("; ")}` : "") +
      (r.error ? ` ✖ ${r.error}` : "");
    console.log(`${r.ok ? "OK " : "ERR"} ${names.get(r.serviceId)} | ${r.summary} | đổi ${r.changes}${warn}`);
  }
}
main().finally(() => p.$disconnect());
