// Đăng nhập admin prod rồi tải ảnh (standalone) — in ra map tên → url
import fs from "node:fs";
const B = "https://taxuabooking.com";
const html = await (await fetch(B + "/admin/login")).text();
const fd = new FormData();
for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
  const n = m[0].match(/name="([^"]+)"/)?.[1]; const v = m[0].match(/value="([^"]*)"/)?.[1] ?? "";
  if (n) fd.append(n, v.replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
}
fd.append("username", process.env.ADMIN_USERNAME); fd.append("password", process.env.ADMIN_PASSWORD);
const r = await fetch(B + "/admin/login", { method: "POST", body: fd, redirect: "manual" });
const ck = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("taxua_admin="));
if (!ck) { console.error("đăng nhập lỗi", r.status); process.exit(1); }
const dir = process.argv[2]; const out = {};
for (const f of process.argv.slice(3)) {
  const buf = fs.readFileSync(`${dir}/${f}.jpg`);
  const u = new FormData(); u.append("standalone", "1"); u.append("file", new Blob([buf], { type: "image/jpeg" }), `${f}.jpg`);
  const res = await fetch(B + "/api/admin/upload", { method: "POST", body: u, headers: { cookie: ck } });
  const j = await res.json(); out[f] = j.url ?? j.error; console.log(f, res.status, out[f]);
}
fs.writeFileSync("scripts/tmp/so-sanh/uploaded.json", JSON.stringify(out, null, 1));
