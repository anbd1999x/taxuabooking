/**
 * Tính sẵn quãng đường xe chạy cho popup "Xung quanh có gì?" (homestay → check-in / cafe / nhà hàng / homestay khác).
 * Chạy: npx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env scripts/warm-road-cache.ts [số đường đi chi tiết, mặc định 0]
 * Production tự chạy 30 phút/lần trong instrumentation (150 đường đi / lần).
 */
import { warmRoadCache } from "../src/lib/road-distance";
import { prisma } from "../src/lib/prisma";
(async () => {
  const routes = Number(process.argv[2] ?? 0) || 0;
  const t0 = Date.now();
  const r = await warmRoadCache({ routes, log: (m) => console.log(m) });
  const [rows, shapes] = await Promise.all([prisma.roadDistance.count(), prisma.roadDistance.count({ where: { shape: { not: null } } })]);
  console.log(`Xong sau ${Math.round((Date.now() - t0) / 1000)} giây · ma trận mới ${r.matrices} · đường đi mới ${r.routes} · tổng ${rows} cặp, ${shapes} có đường vẽ`);
  await prisma.$disconnect();
})();
