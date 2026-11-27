// Kiểm mọi trang mới × 4 ngôn ngữ: mã HTTP, độ dài title / description, số H1, loại JSON-LD.
const base = process.argv[2] || "http://localhost:3000";
const slugs = (await (await fetch(base + "/sitemap.xml")).text()).match(/<loc>[^<]*\/diem-den\/[^<]*<\/loc>/g)?.map((l) => l.replace(/<\/?loc>/g, "").replace(/^https?:\/\/[^/]+/, "")) ?? [];
const paths = [...new Set([...slugs, "/diem-den", "/en/diem-den", "/zh/diem-den", "/ko/diem-den", "/thoi-tiet-ta-xua", "/en/thoi-tiet-ta-xua", "/zh/thoi-tiet-ta-xua", "/ko/thoi-tiet-ta-xua"])];
const dec = (s) => (s ?? "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
let bad = 0;
for (const p of paths) {
  const r = await fetch(base + p, { headers: { "user-agent": "Googlebot/2.1" } });
  const h = await r.text();
  const title = dec((h.match(/<title>([^<]*)<\/title>/) || [])[1]);
  const desc = dec((h.match(/<meta name="description" content="([^"]*)"/) || [])[1]);
  const h1 = (h.match(/<h1[\s>]/g) || []).length;
  const ld = [...h.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1])["@type"] ?? "graph"; } catch { return "BAD"; } });
  const warn = r.status !== 200 || title.length > 60 || desc.length > 155 || desc.length < 60 || h1 !== 1 || ld.includes("BAD");
  if (warn) bad++;
  console.log(`${warn ? "!!" : "ok"} ${r.status} t${title.length} d${desc.length} h1=${h1} [${ld.join(",")}] ${p}${warn ? `\n   ${title}\n   ${desc}` : ""}`);
}
console.log(`${paths.length} trang, ${bad} cảnh báo; sitemap /diem-den/: ${slugs.length} URL`);
