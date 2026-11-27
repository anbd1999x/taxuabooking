import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
(async () => {
  const rows = await p.place.findMany({ where: { OR: [{ kind: "CHECKIN" }, { name: { contains: "Panorama" } }, { name: { contains: "Khèn" } }] }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
  fs.writeFileSync("scripts/tmp/seo-team/a1/places.json", JSON.stringify(rows, null, 1));
  for (const r of rows) console.log(r.kind, r.id, r.slug, "|", r.name, "|", r.area, "|", r.address, "|", r.hours, "|", r.lat, r.lng);
  await p.$disconnect();
})();
