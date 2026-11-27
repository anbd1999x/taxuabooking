// node --env-file=… xpatch.mjs ops.json [--apply]
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import fs from "node:fs";
const APPLY = process.argv.includes("--apply");
const ops = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const p = new PrismaClient();
const sha = (s) => createHash("sha1").update(s.replace(/\r\n/g, "\n").trim()).digest("hex");
const L = ["vi", "en", "zh", "ko"];
const rows = [];
for (const [slug, list] of Object.entries(ops)) {
  const mine = fs.existsSync(`${slug}.md`);
  const path = (l) => mine ? (l === "vi" ? `${slug}.md` : `tr/${slug}.${l}.md`) : `old/${slug}.${l}.md`;
  const txt = Object.fromEntries(L.map((l) => [l, fs.readFileSync(path(l), "utf8").replace(/\r\n/g, "\n").trim()]));
  const oldVi = txt.vi;
  for (const op of list) {
    if (op.para) {
      const paras = Object.fromEntries(L.map((l) => [l, txt[l].split(/\n\n/)]));
      const idx = paras.vi.findIndex((x) => x.includes(op.para));
      if (idx < 0 || paras.vi.filter((x) => x.includes(op.para)).length !== 1) throw new Error(`${slug}: para not unique ${op.para}`);
      for (const l of L) {
        if (paras[l].length !== paras.vi.length) throw new Error(`${slug}.${l}: số đoạn lệch ${paras[l].length}/${paras.vi.length}`);
        console.log(`[${slug}.${l}#${idx}] …${paras[l][idx].slice(-90)}`);
        paras[l][idx] = paras[l][idx] + " " + op.add[l];
        txt[l] = paras[l].join("\n\n");
      }
    } else {
      for (const l of L) {
        for (const [a, b] of op[l]) {
          const n = txt[l].split(a).length - 1;
          if (n !== 1) throw new Error(`${slug}.${l}: "${a.slice(0, 40)}" xuất hiện ${n} lần`);
          txt[l] = txt[l].replace(a, b);
        }
      }
    }
  }
  if (!APPLY) continue;
  for (const l of L) fs.writeFileSync(path(l), txt[l] + "\n");
  const a = await p.article.findUnique({ where: { slug } });
  if (a.content.replace(/\r\n/g, "\n").trim() !== oldVi) throw new Error(`${slug}: DB content khác file`);
  await p.article.update({ where: { slug }, data: { content: txt.vi } });
  rows.push([txt.vi, txt.en, txt.zh, txt.ko]);
  if (mine) console.log(slug, "dòng dịch cũ cần xoá: sourceHash", sha(oldVi));
  console.log(slug, "updated");
}
if (APPLY) fs.writeFileSync("tr/xpatch-import.json", JSON.stringify(rows));
await p.$disconnect();
