import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import fs from "node:fs";
const p = new PrismaClient();
const sha = (s) => createHash("sha1").update(s.replace(/\r\n/g, "\n").trim()).digest("hex");
const c = fs.readFileSync("scripts/tmp/seo-team/a2/orig/ta-xua-hay-sapa-y-ty.md", "utf8");
for (const l of ["en","zh","ko"]) { const t = await p.translation.findFirst({ where: { sourceHash: sha(c), locale: l } }); fs.writeFileSync(`scripts/tmp/seo-team/a2/tr/old-sapa.${l}.md`, t?.value ?? ""); console.log(l, t?.value.length); }
await p.$disconnect();
