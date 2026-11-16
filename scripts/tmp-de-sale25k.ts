// Dê Homestay: giá gạch = giá hiện tại, giá bán = giá hiện tại − 25k (cả giá theo thứ); chiết khấu 75k (T7 vẫn 0).
// Idempotent: lấy giá gốc từ listPrice/listPriceX nếu đã chạy rồi.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const OFF = 25_000;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const n = (v: unknown) => (v == null ? null : Number(v));
async function main() {
  const rooms = await prisma.room.findMany({ where: { roomType: { service: { slug: "de-homestay-ta-xua" } } }, orderBy: { sortOrder: "asc" } });
  for (const r of rooms) {
    const rr = r as unknown as Record<string, unknown>;
    const base = n(r.listPrice)!; // giá thường hiện tại (CN–T5)
    const data: Record<string, number | null> = { listPrice: base, salePrice: base - OFF, commission: 75_000, commissionSat: 0 };
    const log: string[] = [`thường ${base}→${base - OFF}`];
    for (const d of DAYS) {
      const cur = n(rr[`listPrice${d}`]) ?? n(rr[`price${d}`]);
      if (cur == null) continue;
      data[`listPrice${d}`] = cur;
      data[`price${d}`] = cur - OFF;
      log.push(`${d} ${cur}→${cur - OFF}`);
    }
    await prisma.room.update({ where: { id: r.id }, data });
    console.log(`${r.name}: ${log.join(" · ")} · CK 75k (T7 0)`);
  }
}
main().finally(() => prisma.$disconnect());
