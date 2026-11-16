import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const s = await p.service.findMany({ where: { published: true, category: "HOMESTAY" }, select: { slug: true, title: true, area: true, distanceKm: true, easyRoad: true }, orderBy: { distanceKm: "desc" } });
for (const x of s) console.log(x.distanceKm, x.easyRoad ? "easy" : "----", x.slug, "|", x.area);
await p.$disconnect();
