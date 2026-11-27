import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
(async () => {
  const homes = await p.service.findMany({ where: { published: true, category: { in: ["HOMESTAY", "BUNGALOW"] } }, select: { area: true } });
  const areas = [...new Set(homes.map((h) => (h.area ?? "").trim()).filter(Boolean))];
  const tr = await p.translation.findMany({ where: { locale: "en", source: { in: areas } }, select: { id: true, source: true, value: true } });
  const en = JSON.parse(fs.readFileSync("src/lib/i18n/dict/en.json", "utf8"));
  for (const a of areas) {
    const t = tr.find((x) => x.source === a);
    const v = en[a] ?? t?.value;
    if (v && /Tà Xùa/.test(v)) console.log(en[a] ? "DICT" : "TR " + t!.id, "|", a, "|", v);
  }
  await p.$disconnect();
})();
