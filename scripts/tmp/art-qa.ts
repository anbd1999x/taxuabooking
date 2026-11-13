// Kiểm tra chất lượng bài viết trước khi đăng: link nội bộ, ảnh, độ dài, cụm từ "văn AI", SEO.
import { ARTICLES } from "../tmp-articles-traveler2";

const AI_PHRASES = [
  "thiên đường", "không thể bỏ lỡ", "hãy cùng", "tuyệt vời nhất", "trải nghiệm tuyệt vời", "chữa lành",
  "đắm chìm", "khám phá ngay", "điểm đến lý tưởng", "hành trình đáng nhớ", "vẻ đẹp hoang sơ",
  "kỳ vĩ", "say đắm", "tuyệt tác", "nói tóm lại", "tóm lại,", "nhìn chung", "trong bài viết này",
  "không chỉ", "mà còn", "đặc biệt hơn", "hơn thế nữa", "bên cạnh đó", "ngoài ra,", "đừng quên",
];
const BASE = "https://taxuabooking.com";

async function status(u: string) {
  try { const r = await fetch(BASE + u, { method: "GET", redirect: "manual" }); return r.status; } catch { return 0; }
}

(async () => {
  let fail = 0;
  for (const a of ARTICLES) {
    const c = a.content;
    const words = c.replace(/!\[[^\]]*\]\([^)]*\)|\[([^\]]*)\]\([^)]*\)/g, "$1").split(/\s+/).filter(Boolean).length;
    const imgs = [...c.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map((m) => ({ alt: m[1], src: m[2] }));
    const links = [...c.matchAll(/(?<!!)\[[^\]]+\]\((\/[^)]+)\)/g)].map((m) => m[1]);
    const h2 = (c.match(/^## /gm) ?? []).length;
    const dash = (c.match(/—/g) ?? []).length;
    const low = c.toLowerCase();
    const ai = AI_PHRASES.filter((p) => low.includes(p));
    const sentences = c.replace(/\n/g, " ").split(/[.!?]\s/).map((s) => s.split(/\s+/).length);
    const longS = sentences.filter((n) => n > 45).length;
    console.log(`\n=== ${a.slug}`);
    console.log(`tiêu đề ${a.title.length} ký tự | mô tả ${a.excerpt.length} ký tự | ${words} chữ | ${h2} mục H2 | ${imgs.length} ảnh | ${links.length} link | dấu — : ${dash} | câu >45 chữ: ${longS}`);
    if (ai.length) { console.log("  ⚠ cụm từ dễ lộ văn AI:", ai.join(", ")); }
    if (a.title.length > 90) console.log("  ⚠ tiêu đề dài");
    if (a.excerpt.length > 260) console.log("  ⚠ mô tả dài");
    for (const im of [{ alt: "cover", src: a.coverImage }, ...imgs]) {
      const s = await status(im.src);
      if (s !== 200) fail++;
      if (!im.alt.trim()) { console.log("  ✗ ảnh thiếu alt", im.src); fail++; }
      console.log(`  ảnh ${s === 200 ? "✓" : "✗ " + s} ${im.src}`);
    }
    for (const l of [...new Set(links)]) {
      const s = await status(l);
      if (s !== 200) fail++;
      console.log(`  link ${s === 200 ? "✓" : "✗ " + s} ${l}`);
    }
  }
  console.log(fail ? `\n${fail} lỗi` : "\nKhông có lỗi link/ảnh");
})();
