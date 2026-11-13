import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.place.findMany({ where: { kind: "CHECKIN" }, select: { slug: true, name: true, address: true, mapUrl: true, mapX: true, mapY: true, published: true }, orderBy: { sortOrder: "asc" } }).then((r) => { for (const p of r) console.log(p.published ? "✓" : "✗", p.slug, "|", p.name, "|", p.address, "|", p.mapX, p.mapY, "|", p.mapUrl); }).finally(() => prisma.$disconnect());
