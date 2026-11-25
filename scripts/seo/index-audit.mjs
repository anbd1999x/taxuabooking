// Kiểm trạng thái lập chỉ mục hàng loạt bằng URL Inspection API (hạn mức Google: 2.000 URL/ngày/tài sản).
//   node scripts/seo/index-audit.mjs [--sitemap] [--file urls.txt] [--limit 900] [--out ket-qua.csv]
//   --sitemap : mọi URL trong sitemap + các bản ngôn ngữ (hreflang) khai trong sitemap
//   --file    : thêm danh sách URL (mỗi dòng 1 URL tuyệt đối)
// In bảng tổng hợp theo nhóm trang × trạng thái; ghi chi tiết ra CSV.
import crypto from "node:crypto";
import fs from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const key = JSON.parse(fs.readFileSync(process.env.GSC_KEY_FILE || "secrets/gsc-service-account.json", "utf8"));
const SITE = "https://taxuabooking.com/";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const head = b64({ alg: "RS256", typ: "JWT" });
const body = b64({ iss: key.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(key.private_key).toString("base64url");
const tk = (await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) })).json()).access_token;

const urls = new Set();
if (process.argv.includes("--sitemap")) {
  const xml = await (await fetch(SITE + "sitemap.xml")).text();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(m[1].replace(/&amp;/g, "&"));
  for (const m of xml.matchAll(/hreflang="[^"]+"\s+href="([^"]+)"/g)) urls.add(m[1].replace(/&amp;/g, "&"));
}
const file = arg("file");
if (file) for (const l of fs.readFileSync(file, "utf8").split(/\r?\n/)) if (l.trim()) urls.add(l.trim());
const list = [...urls].slice(0, Number(arg("limit", "1900")));

const group = (u) => {
  const p = u.replace(/^https:\/\/taxuabooking\.com/, "");
  const lang = /^\/(en|zh|ko)(\/|$)/.test(p) ? p.split("/")[1] : "vi";
  const q = p.replace(/^\/(en|zh|ko)/, "") || "/";
  const sec = q.includes("/phong/") ? "trang-phong" : q.startsWith("/kinh-nghiem/review-") ? "review" : q.split("?")[0].split("/").slice(0, q.split("/").length > 2 ? 2 : 2).join("/") || "/";
  const kind = q === "/" ? "/" : q.split("/").length > 2 && sec !== "trang-phong" && sec !== "review" ? sec + "/*" : sec;
  return { lang, kind };
};

const rows = [];
let i = 0, err = 0;
async function worker() {
  while (i < list.length) {
    const u = list[i++];
    try {
      const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { method: "POST", headers: { authorization: `Bearer ${tk}`, "content-type": "application/json" }, body: JSON.stringify({ inspectionUrl: u, siteUrl: SITE }) });
      const j = await r.json();
      if (!r.ok) { err++; if (err < 4) console.error("lỗi", r.status, j.error?.message); if (r.status === 429) await new Promise((s) => setTimeout(s, 5000)); continue; }
      const x = j.inspectionResult?.indexStatusResult ?? {};
      rows.push({ u, ...group(u), verdict: x.verdict, state: x.coverageState ?? "", robots: x.robotsTxtState ?? "", indexing: x.indexingState ?? "", canon: x.googleCanonical ?? "", userCanon: x.userCanonical ?? "", crawl: x.lastCrawlTime ?? "" });
    } catch { err++; }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

const out = arg("out", "backups/index-audit.csv");
fs.mkdirSync(out.replace(/[^/]+$/, "") || ".", { recursive: true });
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
fs.writeFileSync(out, ["url,lang,kind,verdict,state,indexing,googleCanonical,userCanonical,lastCrawl", ...rows.map((r) => [r.u, r.lang, r.kind, r.verdict, r.state, r.indexing, r.canon, r.userCanon, r.crawl].map(esc).join(","))].join("\n"));

const byState = {};
for (const r of rows) (byState[r.state] ??= []).push(r);
console.log(`Đã kiểm ${rows.length}/${list.length} URL (${err} lỗi) → ${out}\n`);
for (const [s, rs] of Object.entries(byState).sort((a, b) => b[1].length - a[1].length)) {
  const by = {};
  for (const r of rs) { const k = `${r.lang} ${r.kind}`; by[k] = (by[k] ?? 0) + 1; }
  console.log(`${s}: ${rs.length}`);
  console.log("   " + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join("  "));
}
