// Kiểm chất lượng bài viết trước khi đăng (độ dài, FAQ, bảng, ảnh/link trả 200, cụm sáo, trùng lặp với bài đang đăng).
//   node --env-file=.env scripts/seo/article-qa.mjs [--dir <thư mục>] [--date dd/mm/yyyy] <slug> [<slug>...]
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
// Thư mục bài nháp: --dir <thư mục> (mặc định scripts/tmp/articles), mỗi bài gồm <slug>.md + <slug>.meta.json {title, excerpt, coverImage}.
const di = process.argv.indexOf("--dir");
const DIR = di > 0 ? process.argv[di + 1] : "scripts/tmp/articles";
const BASE = "https://taxuabooking.com";
// Ngày ghi ở dòng nguồn cuối bài: --date dd/mm/yyyy (mặc định hôm nay).
const dti = process.argv.indexOf("--date");
const TODAY = dti > 0 ? process.argv[dti + 1] : new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" });
const AI = ["thiên đường","không thể bỏ lỡ","hãy cùng","tuyệt vời nhất","trải nghiệm tuyệt vời","chữa lành","đắm chìm","khám phá ngay","điểm đến lý tưởng","hành trình đáng nhớ","vẻ đẹp hoang sơ","kỳ vĩ","say đắm","tuyệt tác","nói tóm lại","tóm lại,","nhìn chung","trong bài viết này","không chỉ","mà còn","đặc biệt hơn","hơn thế nữa","bên cạnh đó","ngoài ra,","đừng quên"];
const plain = (c) => c.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#*|>_`]/g, " ").toLowerCase();
const shingles = (c, n = 6) => { const w = plain(c).split(/\s+/).filter(Boolean); const s = new Set(); for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(" ")); return s; };
const st = async (u) => { try { return (await fetch(BASE + u, { redirect: "manual" })).status; } catch { return 0; } };
const prisma = new PrismaClient();
const old = await prisma.article.findMany({ select: { slug: true, content: true } });
await prisma.$disconnect();
let fail = 0;
const slugs = process.argv.slice(2).filter((x, i, a) => !["--dir", "--date"].includes(x) && !["--dir", "--date"].includes(a[i - 1]));
for (const slug of slugs) {
  const c = fs.readFileSync(`${DIR}/${slug}.md`, "utf8").replace(/\r\n/g, "\n").trim();
  const m = JSON.parse(fs.readFileSync(`${DIR}/${slug}.meta.json`, "utf8"));
  const words = plain(c).split(/\s+/).filter(Boolean).length;
  const imgs = [...c.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map((x) => ({ alt: x[1], src: x[2] }));
  const links = [...new Set([...c.matchAll(/(?<!!)\[[^\]]+\]\((\/[^)]+)\)/g)].map((x) => x[1]))];
  const h2 = [...c.matchAll(/^## (.+)$/gm)].map((x) => x[1]);
  const faq = (c.split(/^## Câu hỏi thường gặp.*$/m)[1]?.split(/^## /m)[0].match(/^### /gm) ?? []).length;
  const tables = (c.match(/^\| ?-{3}/gm) ?? []).length;
  const mine = shingles(c);
  let best = { slug: "", r: 0 };
  for (const o of old) { if (o.slug === slug) continue; const sh = shingles(o.content); let hit = 0; for (const s of mine) if (sh.has(s)) hit++; const r = hit / mine.size; if (r > best.r) best = { slug: o.slug, r }; }
  const errs = [];
  const ai = AI.filter((p) => plain(c).includes(p));
  if (ai.length) errs.push("cụm văn mẫu: " + ai.join(", "));
  if (/—/.test(c)) errs.push("có dấu —");
  if (m.title.length > 60) errs.push(`tiêu đề ${m.title.length} > 60`);
  if (m.excerpt.length > 155) errs.push(`mô tả ${m.excerpt.length} > 155`);
  if (words < 1400 || words > 2400) errs.push(`độ dài ${words} chữ (cần 1.500–2.200)`);
  if (faq < 5) errs.push(`FAQ ${faq} < 5`);
  if (!tables) errs.push("thiếu bảng");
  if (!c.includes("**Tóm tắt nhanh:**")) errs.push('thiếu "**Tóm tắt nhanh:**"');
  if (!c.includes(TODAY)) errs.push("thiếu dòng nguồn + ngày " + TODAY);
  if (imgs.length < 3) errs.push(`ảnh ${imgs.length} < 3`);
  if (best.r > 0.08) errs.push(`trùng ${(best.r * 100).toFixed(1)}% với ${best.slug}`);
  for (const im of [{ alt: "cover", src: m.coverImage }, ...imgs]) { if (!/^\/uploads\//.test(im.src)) errs.push("ảnh không phải /uploads: " + im.src); else if ((await st(im.src)) !== 200) errs.push("ảnh lỗi " + im.src); if (!im.alt.trim()) errs.push("ảnh thiếu alt " + im.src); }
  for (const l of links) { const s = await st(l); if (s !== 200) errs.push(`link ${s} ${l}`); }
  console.log(`${errs.length ? "✗" : "✓"} ${slug}: tiêu đề ${m.title.length}, mô tả ${m.excerpt.length}, ${words} chữ, ${h2.length} H2, ${tables} bảng, FAQ ${faq}, ${imgs.length} ảnh, ${links.length} link, trùng max ${(best.r * 100).toFixed(1)}% (${best.slug})`);
  for (const e of errs) console.log("   - " + e);
  fail += errs.length;
}
process.exit(fail ? 1 : 0);
