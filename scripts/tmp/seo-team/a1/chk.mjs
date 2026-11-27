const base = process.argv[2] || "http://localhost:3000";
const paths = process.argv.slice(3);
for (const p of paths) {
  const r = await fetch(base + p, { headers: { "user-agent": "Googlebot/2.1" }, redirect: "manual" });
  const h = await r.text();
  const g = (re) => (h.match(re) || [])[1];
  const title = g(/<title>([^<]*)<\/title>/);
  const desc = g(/<meta name="description" content="([^"]*)"/);
  const h1s = [...h.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
  const lds = [...h.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => { try { const j = JSON.parse(m[1]); return j["@type"]; } catch { return "BAD"; } });
  const canon = g(/<link rel="canonical" href="([^"]*)"/);
  const dec = (s) => s && s.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
  console.log(`${r.status} ${p}\n  title(${dec(title)?.length}): ${dec(title)}\n  desc(${dec(desc)?.length}): ${dec(desc)}\n  h1(${h1s.length}): ${h1s.map(dec).join(" | ")}\n  canonical: ${canon}\n  ld: ${lds.join(", ")}\n  —: ${(h.replace(/<script[\s\S]*?<\/script>/g,"").match(/—/g)||[]).length}`);
}
