/** Đăng bài "Lịch trình & chi phí Tà Xùa" (upsert theo slug). --check = chỉ kiểm link, không ghi. */
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
const prisma = new PrismaClient();
const dir = __dirname;
const rd = (f: string) => fs.readFileSync(path.join(dir, f), "utf8").replace(/\r\n/g, "\n").trim();
const slug = "lich-trinh-chi-phi-ta-xua";
(async () => {
  const title = rd("vi.title.txt"), excerpt = rd("vi.excerpt.txt"), content = rd("vi.md");
  const links = [...new Set([...content.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]))];
  let bad = 0;
  for (const l of links) {
    const [, a, b] = l.split("/");
    let ok = true;
    if (a === "kinh-nghiem" && b) ok = !!(await prisma.article.findFirst({ where: { slug: b, published: true } }));
    else if ((a === "cafe" || a === "nha-hang") && b) ok = !!(await prisma.place.findFirst({ where: { slug: b, published: true, kind: a === "cafe" ? "CAFE" : "RESTAURANT" } }));
    else if (a === "uploads") ok = (await fetch("https://taxuabooking.com" + l, { method: "HEAD" })).ok;
    else ok = ["lich-trinh", "combo", "xe-cabin", "xe-om", "taxi", "homestay", "thue-xe-may"].includes(a) && !b;
    if (!ok) { bad++; console.log("LINK HỎNG:", l); }
  }
  console.log(`${links.length} link, hỏng ${bad}; ${content.length} ký tự`);
  if (bad || process.argv.includes("--check")) return;
  const data = { title, excerpt, content, topic: "lich-trinh", coverImage: "/uploads/1794459847911-f44cfb075b23.jpg", published: true };
  const a = await prisma.article.upsert({ where: { slug }, create: { slug, ...data }, update: data });
  console.log("ĐÃ ĐĂNG", a.slug, a.id);
})().finally(() => prisma.$disconnect());
