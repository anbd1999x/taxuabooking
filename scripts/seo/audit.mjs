// Rà nhanh SEO trang thật: tiêu đề, mô tả, H1, canonical, robots, JSON-LD, số chữ nội dung, ảnh thiếu alt, link nội bộ.
//   node scripts/seo/audit.mjs [/duong-dan ...]   (mặc định: danh sách trang chính)
const BASE = process.env.SEO_BASE || "https://taxuabooking.com";
const PAGES = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/homestay", "/homestay/nha-ben-suoi", "/homestay/ta-xua-hill", "/xe-cabin", "/xe-cabin/nha-xe-tien-thanh", "/combo", "/thue-xe-may", "/thue-xe-may/g-bike", "/taxi", "/taxi/lu-bun", "/xe-om", "/xe-om/alu-chay-xe-om-ta-xua", "/ban-do", "/lich-trinh", "/nha-hang", "/cafe", "/kinh-nghiem", "/ve", "/huong-dan", "/lien-he", "/gioi-thieu", "/cam-ket", "/en/homestay"];
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();
for (const p of PAGES) {
  const r = await fetch(BASE + p, { redirect: "manual" });
  const h = await r.text();
  const g = (re) => (h.match(re) ?? [])[1] ?? "";
  const title = g(/<title>([^<]*)<\/title>/).replace(/&amp;/g, "&");
  const desc = g(/<meta name="description" content="([^"]*)"/);
  const h1s = [...h.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => strip(m[1]));
  const canon = g(/<link rel="canonical" href="([^"]*)"/).replace(BASE, "");
  const robots = g(/<meta name="robots" content="([^"]*)"/);
  const types = [...new Set([...h.matchAll(/"@type":"([A-Za-z]+)"/g)].map((m) => m[1]))].filter((t) => !["ListItem", "ImageObject", "PostalAddress", "ContactPoint", "OpeningHoursSpecification", "Answer", "Question", "Offer", "GeoCoordinates"].includes(t));
  const body = strip(h.split(/<main[^>]*>/)[1]?.split("</main>")[0] ?? h);
  const words = body.split(/\s+/).length;
  const imgs = [...h.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const noAlt = imgs.filter((i) => !/\balt="[^"]+"/.test(i)).length;
  const links = new Set([...h.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1])).size;
  const h2 = (h.match(/<h2\b/g) ?? []).length;
  console.log(`\n${r.status} ${p}\n  T(${title.length}): ${title}\n  D(${desc.length}): ${desc.slice(0, 170)}\n  H1(${h1s.length}): ${h1s.join(" | ").slice(0, 120)} · H2: ${h2} · chữ: ${words} · ảnh: ${imgs.length} (thiếu alt ${noAlt}) · link nội bộ: ${links}\n  canonical: ${canon} · robots: ${robots} · JSON-LD: ${types.join(", ")}`);
}
