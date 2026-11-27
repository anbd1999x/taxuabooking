// Gửi URL lên IndexNow (Bing ⇒ Yahoo, DuckDuckGo; Yandex…) bằng tay.
//   node scripts/seo/indexnow.mjs                 → gửi TOÀN BỘ <loc> trong sitemap đang chạy trên web
//   node scripts/seo/indexnow.mjs <url> [<url>…]  → chỉ gửi các URL này
// Khoá = src/lib/indexnow.ts (INDEXNOW_KEY), file xác minh public/<khoá>.txt phải đã lên web.
// App tự gửi trang vừa đổi 15 phút/lần (instrumentation) — script này dùng cho lần đầu / khi cần đẩy lại hàng loạt.
import fs from "node:fs";

const BASE = "https://taxuabooking.com";
const KEY = fs.readFileSync("src/lib/indexnow.ts", "utf8").match(/INDEXNOW_KEY = "([0-9a-f]+)"/)[1];
const kf = await fetch(`${BASE}/${KEY}.txt`);
if (!kf.ok || (await kf.text()).trim() !== KEY) { console.error(`file khoá ${BASE}/${KEY}.txt chưa lên web (${kf.status}) — deploy trước`); process.exit(1); }
let urls = process.argv.slice(2);
if (!urls.length) urls = [...(await (await fetch(`${BASE}/sitemap.xml`)).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (let i = 0; i < urls.length; i += 10000) {
  const urlList = urls.slice(i, i + 10000);
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(BASE).host, key: KEY, keyLocation: `${BASE}/${KEY}.txt`, urlList }),
  });
  console.log(`gửi ${urlList.length} URL → ${r.status} ${r.status === 200 || r.status === 202 ? "OK" : (await r.text()).slice(0, 200)}`);
}
