import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
const read = (f) => fs.readFileSync(`scripts/tmp/${f}`, "utf8").trim();
const items = [
  { slug: "ta-xua-o-dau-cach-ha-noi-bao-nhieu-km", file: "a1.md", topic: "cam-nang",
    title: "Tà Xùa ở đâu? Cách Hà Nội bao nhiêu km, đi mất mấy tiếng",
    excerpt: "Tà Xùa thuộc tỉnh Sơn La, cách Hà Nội khoảng 215km. Cung đường từng chặng, thời gian đi thực tế, 15km đèo cuối và cách tránh nhầm với Tà Xùa bên Trạm Tấu.",
    coverImage: "/uploads/1793637277119-eb07e6f4e68c.jpg" },
  { slug: "o-ta-xua-nen-chon-khu-nao", file: "a2.md", topic: "cam-nang",
    title: "Ở Tà Xùa nên chọn khu nào? Trung tâm, Đỉnh Gió hay Khe Cải",
    excerpt: "Trung tâm tiện, Đỉnh Gió đón mây sớm, Khe Cải yên tĩnh — so sánh ưu nhược từng khu ở Tà Xùa kèm giá phòng thật và gợi ý homestay cho từng kiểu chuyến đi.",
    coverImage: "/uploads/1793637279036-a67de27133c1.jpg" },
  { slug: "trai-nghiem-xe-cabin-di-ta-xua", file: "a3.md", topic: "di-chuyen",
    title: "Một đêm trên xe cabin đi Tà Xùa: chọn cabin đơn hay đôi, nằm tầng nào?",
    excerpt: "Khoang cabin có gì, lịch trình 21h – 5h sáng từng chặng, khác biệt giữa cabin đơn và cabin đôi, nên nằm tầng trên hay tầng dưới và 8 thứ nên cầm sẵn trong tay.",
    coverImage: "/uploads/1793442945574-3636c341eef1.jpg" },
  { slug: "mua-hoa-ta-xua", file: "a4.md", topic: "diem-den",
    title: "Mùa hoa Tà Xùa: tớ dày, mận, đào nở tháng mấy?",
    excerpt: "Lịch hoa Tà Xùa theo tháng: tớ dày tháng 12 – 1, mận trắng giáp Tết, hoa dại mùa hè, dã quỳ tháng 11 — ngắm ở đâu, chụp giờ nào và những điều nên tránh.",
    coverImage: "/uploads/1793637290536-9e17d5c4b55b.jpg" },
  { slug: "ta-xua-mua-he-thang-5-8", file: "a5.md", topic: "cam-nang",
    title: "Tà Xùa mùa hè tháng 5 – 8: mát 20°C, vắng khách, có còn mây không?",
    excerpt: "Đi Tà Xùa mùa thấp điểm thực tế ra sao: nhiệt độ, mưa chiều, cơ hội gặp mây luồn, 5 cái lợi và những cái dở nói thẳng, mang gì và lịch 2 ngày 1 đêm gợi ý.",
    coverImage: "/uploads/1793641200116-6d2d7274b1a6.jpg" },
];

// 1) Kiểm tra link nội bộ /kinh-nghiem/<slug> có tồn tại không
const all = new Set((await p.article.findMany({ select: { slug: true } })).map((a) => a.slug));
for (const it of items) all.add(it.slug);
let bad = 0;
const HOST = "http://160.187.240.245";
for (const it of items) {
  const c = read(it.file);
  for (const m of c.matchAll(/\/kinh-nghiem\/([a-z0-9-]+)/g)) if (!all.has(m[1])) { console.log("LINK HỎNG:", it.slug, "->", m[1]); bad++; }
  // 2) Kiểm tra ảnh tồn tại trên server
  const imgs = [...c.matchAll(/!\[[^\]]*\]\((\/uploads\/[^)]+)\)/g)].map((m) => m[1]);
  for (const u of [it.coverImage, ...imgs]) {
    const r = await fetch(HOST + u, { method: "HEAD" });
    if (!r.ok) { console.log("ẢNH HỎNG:", it.slug, u, r.status); bad++; }
  }
  console.log(`${it.slug}: ${imgs.length} ảnh trong bài, ${c.length} ký tự`);
}
if (bad) { console.log("\n>>> CÓ", bad, "LỖI — dừng, không ghi DB."); process.exit(1); }

if (process.argv[2] === "--write") {
  for (const it of items) {
    const { file, ...data } = it;
    const r = await p.article.upsert({ where: { slug: it.slug }, create: { ...data, content: read(file), published: true }, update: { ...data, content: read(file), published: true } });
    console.log("OK:", r.slug);
  }
} else console.log("\n(chạy lại với --write để ghi DB)");
await p.$disconnect();
