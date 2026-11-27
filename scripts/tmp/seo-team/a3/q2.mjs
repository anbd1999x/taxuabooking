import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
const slugs = process.argv.slice(2);
fs.mkdirSync("scripts/tmp/seo-team/a3/ref",{recursive:true});
for (const s of slugs) { const a = await p.article.findUnique({where:{slug:s}}); if(!a){console.log("no",s);continue;} fs.writeFileSync(`scripts/tmp/seo-team/a3/ref/${s}.md`, `# ${a.title}\n${a.excerpt}\ncover:${a.coverImage}\n\n${a.content}`); console.log(s, a.content.length); }
await p.$disconnect();
