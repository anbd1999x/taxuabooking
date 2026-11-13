import { PrismaClient } from "@prisma/client";
import { syncAllSheets } from "../../src/lib/sheet-sync";
const prisma = new PrismaClient();
(async () => {
  const res = await syncAllSheets("MANUAL");
  const names = new Map((await prisma.service.findMany({ where: { id: { in: res.map((r) => r.serviceId) } }, select: { id: true, title: true } })).map((s) => [s.id, s.title]));
  for (const r of res) {
    const w = [
      r.unmatchedRows.length ? `KHÔNG KHỚP: ${JSON.stringify(r.unmatchedRows)}` : "",
      r.missingRooms.length ? `THIẾU PHÒNG: ${JSON.stringify(r.missingRooms)}` : "",
      r.unknownValues?.length ? `Ô LẠ: ${JSON.stringify(r.unknownValues)}` : "",
    ].filter(Boolean).join(" | ");
    console.log(`${r.ok ? "OK " : "LỖI"} ${names.get(r.serviceId)} — ${r.ok ? r.summary : r.error} · thay đổi=${r.changes}${w ? "\n      ⚠ " + w : ""}`);
  }
  console.log(`\nTổng: ${res.length} home, lỗi ${res.filter((r) => !r.ok).length}, tổng thay đổi ${res.reduce((n, r) => n + r.changes, 0)}`);
  await prisma.$disconnect();
  process.exit(0);
})();
