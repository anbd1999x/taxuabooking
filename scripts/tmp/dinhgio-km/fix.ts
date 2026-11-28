// Sửa khoảng cách trung tâm → Đỉnh Gió thành 3km (RoadDistance center:ta-xua = 3,1km) ở mọi bài, cả 4 ngôn ngữ.
// npx tsx --env-file=.env scripts/tmp/dinhgio-km/fix.ts [--apply]
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const sha = (s: string) => createHash("sha1").update(s.replace(/\r\n/g, "\n").trim()).digest("hex");
const LOC = ["en", "zh", "ko"] as const;
// Dòng vi nhắc Đỉnh Gió + khoảng cách tới TRUNG TÂM (bỏ các câu "qua/cách Đỉnh Gió thêm 2km hướng Xím Vàng").
const viHit = (l: string) =>
  /Đỉnh Gió/i.test(l) && /(trung tâm|center)/i.test(l) && /(2 ?km|1,5 ?km|chừng 2km|2 đến 15km)/.test(l) && !/(thêm khoảng 2km|đi tiếp khoảng 2km|cách Đỉnh Gió khoảng 2km)/.test(l)
  || /^\| Đỉnh Gió \| (khoảng 2km|Cách trung tâm khoảng 2km)/.test(l)
  || /^### Đỉnh Gió \(1,5km từ trung tâm\)/.test(l);
const fixVi = (l: string) => l.replace(/khoảng 2 ?km|chừng 2km|khoảng 1,5 ?km|1,5 ?km|(?<![\d,.])2 ?km(?! hướng)/g, (m) => m.startsWith("khoảng") ? "khoảng 3km" : m.startsWith("chừng") ? "chừng 3km" : m.includes(" ") ? "3 km" : "3km").replace("2 đến 15km", "3 đến 15km");
const fixTr = (l: string) => l
  .replace(/(?<![\d.,])(1[.,]5|2)\s?(km|kilometers?|kilometres?)\b/gi, (_m, _n, u) => `3${/^km$/i.test(u) ? "km" : " " + u}`)
  .replace(/(?<![\d.,])(1\.5|2)\s?公里/g, "3公里")
  .replace(/(?<![\d.,])(1\.5|2)\s?킬로미터/g, "3킬로미터")
  .replace(/2 to 15 ?km/gi, "3 to 15km").replace(/2至15公里|2到15公里/g, "3至15公里").replace(/2到15 ?km/g, "3到15km").replace(/2~15 ?km|2-15 ?km/g, "3~15km");
(async () => {
  const arts = await p.article.findMany({ where: { published: true }, select: { id: true, slug: true, title: true, excerpt: true, content: true } });
  const rows: string[][] = [];
  for (const a of arts) {
    for (const field of ["title", "excerpt", "content"] as const) {
      const src = (a[field] ?? "").replace(/\r\n/g, "\n").trim();
      if (!src) continue;
      const lines = src.split("\n");
      const idx = lines.map((l, i) => (viHit(l) ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) continue;
      const trs = await p.translation.findMany({ where: { sourceHash: sha(src), locale: { in: [...LOC] } }, select: { id: true, locale: true, value: true } });
      const newVi = lines.map((l, i) => (idx.includes(i) ? fixVi(l) : l)).join("\n");
      const newTr: Record<string, string> = {};
      console.log(`\n## ${a.slug} · ${field} · ${idx.length} dòng · bản dịch: ${trs.map((t) => t.locale).join(",")}`);
      for (const t of trs) {
        const tl = t.value.replace(/\r\n/g, "\n").trim().split("\n");
        const aligned = tl.length === lines.length;
        const out = tl.map((l, i) => (aligned ? (idx.includes(i) ? fixTr(l) : l) : /(Dinh Gio|Đỉnh Gió|丁佐|顶风|딘조|딘저|Windy|风顶|정상)/i.test(l) ? fixTr(l) : l));
        newTr[t.locale] = out.join("\n");
        if (!aligned) console.log(`  ! ${t.locale} lệch dòng (${tl.length} vs ${lines.length})`);
        for (let i = 0; i < tl.length; i++) if (out[i] !== tl[i]) console.log(`  ${t.locale}: ${out[i].slice(0, 170)}`);
      }
      for (const i of idx) console.log(`  vi: ${fixVi(lines[i]).slice(0, 170)}`);
      rows.push([newVi, newTr.en ?? "", newTr.zh ?? "", newTr.ko ?? ""]);
      if (APPLY) {
        await p.article.update({ where: { id: a.id }, data: { [field]: newVi } });
        const h = sha(newVi);
        for (const loc of LOC) {
          if (!newTr[loc]) continue;
          await p.translation.deleteMany({ where: { locale: loc, sourceHash: h } });
          await p.translation.create({ data: { entity: "Phrase", entityId: h.slice(0, 20), field: "text", locale: loc, source: newVi, sourceHash: h, value: newTr[loc] } });
        }
      }
    }
  }
  console.log(`\n${rows.length} trường ${APPLY ? "ĐÃ SỬA" : "(chạy thử)"}`);
  await p.$disconnect();
})();
