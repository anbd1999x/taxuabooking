import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const rows = await p.place.findMany({ where: { published: true }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }], select: { kind: true, slug: true, name: true, area: true, price: true, hours: true, tags: true, coverImage: true, mapUrl: true, desc: true } });
  for (const r of rows) console.log([r.kind, r.slug, r.name, r.area, r.price, r.hours, r.tags, r.coverImage ? "img" : "-", r.mapUrl ? "map" : "-", (r.desc ?? "").slice(0, 60)].join(" | "));
  await p.$disconnect();
})();
