import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const d = "scripts/tmp/lich-trinh-chi-phi/";
const rd = (f) => fs.readFileSync(d + f, "utf8").replace(/\r\n/g, "\n").trim();
const p = new PrismaClient();
const a = await p.article.findUnique({ where: { slug: "lich-trinh-chi-phi-ta-xua" } });
const rows = [
  [a.title, ...["en", "zh", "ko"].map((l) => rd(l + ".title.txt"))],
  [a.excerpt, ...["en", "zh", "ko"].map((l) => rd(l + ".excerpt.txt"))],
  [a.content, ...["en", "zh", "ko"].map((l) => rd(l + ".md"))],
];
fs.writeFileSync(d + "i18n.json", JSON.stringify(rows));
console.log(rows.map((r) => r.map((x) => x.length).join("/")).join("  "));
await p.$disconnect();
