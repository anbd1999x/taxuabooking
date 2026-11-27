import { PrismaClient } from "@prisma/client"; import fs from "node:fs";
const plain = (c) => c.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#*|>_`]/g, " ").toLowerCase();
const sh = (c) => { const w = plain(c).split(/\s+/).filter(Boolean); const s = []; for (let i = 0; i + 6 <= w.length; i++) s.push(w.slice(i, i + 6).join(" ")); return s; };
const p = new PrismaClient(); const o = await p.article.findUnique({ where: { slug: process.argv[3] } }); await p.$disconnect();
const os = new Set(sh(o.content)); const mine = sh(fs.readFileSync(process.argv[2], "utf8"));
console.log(mine.filter((x) => os.has(x)).join("\n"));
