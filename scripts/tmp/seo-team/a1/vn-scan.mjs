// In các đoạn chữ còn dấu tiếng Việt trong <main> + title/description/JSON-LD của trang (bản dịch).
const base = process.argv[2];
const VI = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
for (const p of process.argv.slice(3)) {
  const h = await (await fetch(base + p, { headers: { "user-agent": "Googlebot/2.1" } })).text();
  const main = (h.match(/<main[\s\S]*?<\/main>/) || [h])[0];
  const head = (h.match(/<title>[^<]*<\/title>/) || [""])[0] + " " + (h.match(/<meta name="description" content="[^"]*"/) || [""])[0];
  const lds = [...h.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join(" ");
  const text = (head + "\n" + main.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, "\n") + "\n" + lds.replace(/[{}\[\]]/g, "\n").replace(/","/g, "\n"))
    .replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
  const hits = [...new Set(text.split("\n").map((s) => s.trim()).filter((s) => s && VI.test(s)))];
  console.log(`\n=== ${p}: ${hits.length} dòng có dấu`);
  for (const s of hits) console.log("  ·", s.slice(0, 140));
}
