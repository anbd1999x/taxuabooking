const base = "https://taxuabooking.com";
const slugs = ["dat-phong-ta-xua-o-dau", "nha-xe-nao-di-ta-xua", "homestay-ta-xua-view-may-dep", "thue-xe-may-ta-xua", "du-lich-ta-xua-nen-dat-dich-vu-o-dau"];
const seen = new Map();
const head = async (u) => { if (!seen.has(u)) seen.set(u, fetch(u, { redirect: "manual" }).then((r) => r.status).catch(() => 0)); return seen.get(u); };
let bad = 0;
for (const loc of ["", "/en", "/zh", "/ko"]) for (const s of slugs) {
  const url = `${base}${loc}/kinh-nghiem/${s}`;
  const res = await fetch(url); const html = await res.text();
  const art = html.split("<h1")[1] ?? "";
  const body = art.split(/<footer/)[0];
  const links = [...new Set([...body.matchAll(/<a href="(\/[^"#]*)"/g)].map((m) => m[1]))];
  const imgs = [...new Set([...body.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")))];
  const tables = (body.match(/<table/g) ?? []).length, faq = /FAQPage/.test(html), vi = loc && /Trả lời nhanh|Câu hỏi thường gặp/.test(body);
  const canon = (html.match(/rel="canonical" href="([^"]+)"/) ?? [])[1], og = (html.match(/property="og:image" content="([^"]+)"/) ?? [])[1];
  const probs = [];
  if (res.status !== 200) probs.push("status " + res.status);
  if (!faq) probs.push("no FAQPage"); if (vi) probs.push("còn tiếng Việt"); if (!tables) probs.push("no table");
  if (canon !== url) probs.push("canonical=" + canon);
  for (const l of links) { const st = await head(base + l); if (st !== 200) probs.push(`link ${l} → ${st}`); }
  for (const i of imgs) { const st = await head(i.startsWith("http") ? i : base + i); if (st !== 200) probs.push(`img ${i.slice(0, 80)} → ${st}`); }
  if (og) { const st = await head(og.replace(/&amp;/g, "&")); if (st !== 200) probs.push(`og:image → ${st}`); } else probs.push("no og:image");
  console.log(`${loc || "/vi"} ${s}: ${links.length} link, ${imgs.length} ảnh, ${tables} bảng`, probs.length ? "✗ " + probs.join("; ") : "✓");
  bad += probs.length;
}
for (const u of ["/", "/kinh-nghiem", "/thue-xe-may", "/homestay", "/xe-cabin", "/combo", "/xe-om", "/taxi", "/sitemap.xml", "/llms.txt", "/en", "/zh/kinh-nghiem", "/thue-xe-may/de-homestay", "/demo/quan-ly-xe"]) { const st = await head(base + u); console.log(u, st); }
const sm = await (await fetch(base + "/sitemap.xml")).text(); const ll = await (await fetch(base + "/llms.txt")).text();
for (const s of slugs) console.log(s, "sitemap:", sm.includes(s), "llms:", ll.includes(s));
console.log("tổng lỗi:", bad);
