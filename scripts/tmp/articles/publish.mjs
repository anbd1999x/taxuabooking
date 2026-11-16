// Đăng 3 bài (homestay bungalow / nhà xe Quang Nghĩa / trả tận homestay) + bản dịch en/zh/ko.
//   node --env-file=.env scripts/tmp/articles/publish.mjs [--dry]
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const DIR = "scripts/tmp/articles";
const dry = process.argv.includes("--dry");
const read = (f) => fs.readFileSync(`${DIR}/${f}`, "utf8").replace(/\r\n/g, "\n").trim();

const ARTICLES = [
  {
    key: "a", slug: "bungalow-ta-xua", topic: "cam-nang", coverImage: "/uploads/1794215570016-83c691bdfceb.jpg",
    title: ["Bungalow Tà Xùa 2026: 11 nơi view mây, có bồn tắm, từ 200.000đ/đêm",
      "Tà Xùa bungalows 2026: 11 cloud-view stays with bathtubs, from 200.000đ/night",
      "塔萨小木屋2026：11处云海景观住宿，带浴缸，每晚200.000đ起",
      "따쑤아 방갈로 2026: 운해 전망·욕조 있는 11곳, 1박 200.000đ부터"],
    excerpt: ["Review 11 cụm bungalow Tà Xùa đang mở bán: giá ngày thường và thứ 7, căn nào có bồn tắm, gồm ăn sáng, hợp cặp đôi, gia đình hay nhóm bạn.",
      "Review of 11 bungalow clusters on sale in Tà Xùa: weekday and Saturday prices, which have bathtubs or breakfast, and which suit couples, families or groups.",
      "评测塔萨11处在售小木屋：平日与周六价格，哪些有浴缸、含早餐，适合情侣、家庭还是朋友团。",
      "판매 중인 따쑤아 방갈로 11곳 리뷰: 평일·토요일 가격, 욕조·조식 여부, 커플·가족·친구 모임별 추천."],
  },
  {
    key: "b", slug: "review-nha-xe-quang-nghia-ta-xua", topic: "di-chuyen", coverImage: "/uploads/1794213958980-af8f04d9ba8b.jpg",
    title: ["Review nhà xe Quang Nghĩa đi Tà Xùa: giá vé, giờ chạy, trả tận homestay",
      "Quang Nghĩa bus to Tà Xùa review: fares, timetable, homestay drop-off",
      "Quang Nghĩa 车行去塔萨评测：票价、时刻、送到民宿",
      "Quang Nghĩa 따쑤아행 버스 리뷰: 요금, 시간표, 홈스테이 드롭"],
    excerpt: ["Nhà xe Quang Nghĩa đi Tà Xùa: vé khứ hồi 650.000đ, đi 22h từ Mỹ Đình, nhiều cabin đôi, trả khách tận homestay và có chỗ ngủ chờ nhận phòng.",
      "Quang Nghĩa bus to Tà Xùa: 650.000đ return, leaves 10pm from Mỹ Đình, plenty of double cabins, drops you at your homestay and has a rest area before check-in.",
      "Quang Nghĩa 车行去塔萨：往返650.000đ，22点从美亭发车，双人包厢多，送到民宿，并有等待入住的休息区。",
      "Quang Nghĩa 따쑤아행 버스: 왕복 650.000đ, 22시 미딘 출발, 2인 캐빈 다수, 홈스테이까지 드롭, 체크인 전 휴게 공간 제공."],
  },
  {
    key: "c", slug: "xe-cabin-tra-khach-tan-homestay-ta-xua", topic: "di-chuyen", coverImage: "/uploads/1794225726293-ee1ead1b7af4.jpg",
    title: ["Xe cabin có trả tận homestay ở Tà Xùa không? Cách về home xa trung tâm",
      "Does the cabin bus drop you at your Tà Xùa homestay? Reaching far-out stays",
      "塔萨的卧铺大巴会送到民宿吗？如何前往远离中心的民宿",
      "따쑤아 캐빈 버스는 홈스테이까지 갈까? 외곽 숙소 가는 법"],
    excerpt: ["Xuống xe cabin ở Tà Xùa lúc 6h: nhà xe nào trả tận homestay, đi Đỉnh Gió, Khe Cải, Chung Trinh bằng gì, giá xe ôm và phụ thu nhận phòng sớm.",
      "Arriving by cabin bus in Tà Xùa at 6am: which companies drop you at your homestay, how to reach Đỉnh Gió, Khe Cải, Chung Trinh, motorbike taxi fares and early check-in fees.",
      "早上6点乘卧铺大巴到塔萨：哪些车行送到民宿，怎么去 Đỉnh Gió、Khe Cải、Chung Trinh，摩的价格和提前入住附加费。",
      "아침 6시 캐빈 버스로 따쑤아 도착: 홈스테이까지 내려 주는 회사, Đỉnh Gió·Khe Cải·Chung Trinh 가는 법, 오토바이 택시 요금과 얼리 체크인 요금."],
  },
];

// Bản dịch phải giữ nguyên mọi link nội bộ và ảnh của bản gốc.
const refs = (t) => [...t.matchAll(/\]\((\/[^)]+)\)/g)].map((m) => m[1]).sort().join("\n");
const rows = [];
let bad = 0;
for (const a of ARTICLES) {
  const vi = read(`${a.key}.md`);
  const tr = ["en", "zh", "ko"].map((l) => read(`${a.key}.${l}.md`));
  tr.forEach((t, i) => {
    if (refs(t) !== refs(vi)) { bad++; console.log(`✗ ${a.key}.${["en", "zh", "ko"][i]}: link/ảnh lệch bản gốc`); }
    if (/Tà Xùa/.test(t.replace(/Tà Xùa (Booking|Hill|Retreat)|Thác Mây Tà Xùa|Happy Town Tà Xùa|Cloud Forest Tà Xùa|Mây Bản Tà Xùa|\/[^)]*/g, "")) && i > 0)
      console.log(`! ${a.key}.${["en", "zh", "ko"][i]}: còn "Tà Xùa" trơn (nên là 塔萨/따쑤아)`);
  });
  a.content = vi;
  rows.push([a.title[0], ...a.title.slice(1)], [a.excerpt[0], ...a.excerpt.slice(1)], [vi, ...tr]);
}
if (bad) { console.log("Dừng: sửa bản dịch trước."); process.exit(1); }
fs.writeFileSync(`${DIR}/translations.json`, JSON.stringify(rows, null, 1));
console.log(`OK: ${rows.length} chuỗi cần dịch → ${DIR}/translations.json`);
if (dry) process.exit(0);

const prisma = new PrismaClient();
for (const a of ARTICLES) {
  const ex = await prisma.article.findUnique({ where: { slug: a.slug }, select: { id: true } });
  if (ex) { console.log(`= đã có bài ${a.slug}, bỏ qua (không ghi đè)`); continue; }
  await prisma.article.create({ data: { slug: a.slug, title: a.title[0], excerpt: a.excerpt[0], content: a.content, coverImage: a.coverImage, topic: a.topic, published: true } });
  console.log(`+ tạo bài /kinh-nghiem/${a.slug}`);
}
await prisma.$disconnect();
execFileSync("node", ["--env-file=.env", "scripts/i18n/import-content.mjs", `${DIR}/translations.json`], { stdio: "inherit" });
