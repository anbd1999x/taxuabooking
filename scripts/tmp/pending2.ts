import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  console.log("bây giờ (UTC):", new Date().toISOString(), "| mốc bật: 2026-11-12T09:00Z");
  const h = await prisma.siteSetting.findUnique({ where: { key: "autoCancelHours" } });
  console.log("autoCancelHours đã lưu:", h?.value ?? "(chưa lưu → 6)");
  const p = await prisma.bookingRequest.findMany({ where: { status: { in: ["NEW", "CONTACTING"] } }, select: { code: true, status: true, paymentStatus: true, category: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 8 });
  for (const b of p) console.log(b.code, b.status, b.paymentStatus, b.category, b.createdAt.toISOString().slice(0, 16), b.createdAt >= new Date("2026-11-12T09:00:00Z") ? "SAU mốc" : "trước mốc");
}
main().finally(() => prisma.$disconnect());
