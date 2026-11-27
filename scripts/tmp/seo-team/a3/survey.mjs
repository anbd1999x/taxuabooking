import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const a = await p.article.findMany({ where:{ published:true }, select:{slug:true,content:true,excerpt:true,title:true} });
let n=0;
for (const x of a) {
  const t = [x.title,x.excerpt,x.content].join("\n");
  const hits = [];
  for (const m of t.matchAll(/[^.\n]{0,50}(\b215 ?km|\b15 ?km)[^.\n]{0,40}/g)) {
    const s = m[0];
    if (/\b15 ?km/.test(m[1]) && /(đến|–|-|~|tới) ?15 ?km/.test(s)) continue;
    hits.push(s.trim());
  }
  if (hits.length) { n++; console.log("##", x.slug); hits.forEach(h=>console.log("   ", h)); }
}
console.log("articles", n);
await p.$disconnect();
