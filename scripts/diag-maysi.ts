import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function dateOnly(s: string) { return new Date(s + "T00:00:00.000Z"); }

async function main() {
  const svcs = await prisma.service.findMany({
    where: { title: { contains: "ây", mode: "insensitive" }, category: "HOMESTAY" },
    select: { id: true, title: true, slug: true, published: true, contactOnly: true, category: true },
  });
  // Broader: find anything with "Mây" or "May Si"
  const all = await prisma.service.findMany({
    where: { category: "HOMESTAY" },
    select: { id: true, title: true, slug: true, published: true, contactOnly: true },
    orderBy: { title: "asc" },
  });
  console.log("=== All HOMESTAY services ===");
  for (const s of all) console.log(`${s.published ? "P" : "-"}${s.contactOnly ? "C" : "-"} ${s.title}  [${s.slug}]  ${s.id}`);
}
main().finally(() => prisma.$disconnect());
