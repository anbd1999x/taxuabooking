// Đọc số liệu Google Search Console bằng service account (không cần thư viện ngoài).
//   node scripts/seo/gsc.mjs [--days 90] [--dims query|page|query,page|date] [--limit 25000] [--out file.csv]
//   node scripts/seo/gsc.mjs --sites                    (quyền của service account)
//   node scripts/seo/gsc.mjs --inspect <url>            (trạng thái lập chỉ mục 1 URL)
//   node scripts/seo/gsc.mjs --sitemaps                 (liệt kê sitemap đã gửi)
//   node scripts/seo/gsc.mjs --submit-sitemap <url>     (gửi lại sitemap — cần quyền Toàn quyền/Chủ sở hữu)
// Khoá mặc định: secrets/gsc-service-account.json (thư mục secrets/ bị .gitignore — repo public, KHÔNG commit khoá).
// Đổi khoá: --key <file.json> hoặc biến môi trường GSC_KEY_FILE. KHÔNG in nội dung khoá.
import crypto from "node:crypto";
import fs from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const keyPath = arg("key", process.env.GSC_KEY_FILE || "secrets/gsc-service-account.json");
if (!fs.existsSync(keyPath)) { console.error("không thấy file khoá: " + keyPath); process.exit(1); }
const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
const SITE = arg("site", "https://taxuabooking.com/");

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" });
  const body = b64({ iss: key.client_email, scope: process.argv.includes("--submit-sitemap") ? "https://www.googleapis.com/auth/webmasters" : "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(key.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("lấy token lỗi: " + JSON.stringify(j));
  return j.access_token;
}
const tk = await token();
const api = async (url, body) => {
  const r = await fetch(url, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${tk}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok) { const e = new Error(`${r.status} ${j.error?.status ?? ""}: ${j.error?.message ?? JSON.stringify(j)}`); e.detail = j; throw e; }
  return j;
};

if (process.argv.includes("--sites")) {
  const j = await api("https://searchconsole.googleapis.com/webmasters/v3/sites");
  for (const s of j.siteEntry ?? []) console.log(s.siteUrl, s.permissionLevel);
  process.exit(0);
}
const SM = "https://searchconsole.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(SITE) + "/sitemaps";
if (process.argv.includes("--sitemaps")) {
  const j = await api(SM);
  for (const s of j.sitemap ?? []) console.log(s.path, "| gửi", s.lastSubmitted ?? "-", "| đọc", s.lastDownloaded ?? "-", "| lỗi", s.errors ?? 0, "| cảnh báo", s.warnings ?? 0, "|", (s.contents ?? []).map((x) => x.type + ":" + x.submitted).join(" "));
  process.exit(0);
}
const sub = arg("submit-sitemap");
if (sub) {
  const r = await fetch(SM + "/" + encodeURIComponent(sub), { method: "PUT", headers: { authorization: "Bearer " + tk } });
  console.log(r.ok ? "đã gửi sitemap " + sub : "gửi lỗi " + r.status + ": " + (await r.text()).slice(0, 300));
  process.exit(r.ok ? 0 : 1);
}
const inspect = arg("inspect");
if (inspect) {
  const j = await api("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { inspectionUrl: inspect, siteUrl: SITE });
  const r = j.inspectionResult?.indexStatusResult ?? {};
  console.log([inspect, r.verdict, r.coverageState, r.lastCrawlTime ?? "", r.googleCanonical ?? ""].join(" | "));
  process.exit(0);
}

const days = Number(arg("days", "90"));
const dims = arg("dims", "query").split(",");
const limit = Number(arg("limit", "25000"));
const end = new Date(Date.now() - 2 * 86400000); // số liệu GSC trễ ~2 ngày
const start = new Date(end.getTime() - (days - 1) * 86400000);
const d = (x) => x.toISOString().slice(0, 10);
const rows = [];
for (let startRow = 0; startRow < limit; startRow += 25000) {
  const j = await api(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, { startDate: d(start), endDate: d(end), dimensions: dims, rowLimit: Math.min(25000, limit - startRow), startRow, dataState: "all" });
  rows.push(...(j.rows ?? []));
  if (!j.rows || j.rows.length < 25000) break;
}
const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv = [[...dims, "clicks", "impressions", "ctr", "position"].join(","), ...rows.map((r) => [...r.keys.map(esc), r.clicks, r.impressions, r.ctr.toFixed(4), r.position.toFixed(1)].join(","))].join("\n");
const out = arg("out");
if (out) fs.writeFileSync(out, csv);
const tot = rows.reduce((a, r) => ({ c: a.c + r.clicks, i: a.i + r.impressions }), { c: 0, i: 0 });
console.log(`${SITE} ${d(start)}→${d(end)} dims=${dims} : ${rows.length} dòng, ${tot.c} lượt nhấp, ${tot.i} lượt hiển thị${out ? " → " + out : ""}`);
