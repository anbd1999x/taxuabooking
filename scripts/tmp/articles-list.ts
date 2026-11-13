import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.article.findMany({ orderBy: { createdAt: "desc" } });
  console.log("fields:", Object.keys(rows[0] ?? {}).join(","));
  for (const r of rows as any[]) console.log(`${r.published ? "PUB" : "---"} | ${r.slug} | ${r.title} | ${String(r.content ?? r.body ?? "").length} ký tự | cover=${r.coverImage ? "có" : "không"}`);
  const combo = await prisma.siteSetting.findMany({ where: { key: { in: ["contactPhone", "autoCancelHours"] } } });
  console.log(combo.map((c) => `${c.key}=${c.value}`).join(" "));
})().finally(() => prisma.$disconnect());
