import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const b = await p.bookingRequest.findMany({ orderBy: { createdAt: "desc" }, take: 3, select: { code: true, phone: true, category: true, status: true } });
  console.log(b);
}
main().finally(() => p.$disconnect());
