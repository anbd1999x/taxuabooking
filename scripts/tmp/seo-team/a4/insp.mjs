const u = process.argv[2];
const h = await (await fetch(u)).text();
const g = (re) => (h.match(re) || [])[1];
console.log("URL", u);
console.log(" title:", g(/<title>([^<]*)<\/title>/), "| len", [...(g(/<title>([^<]*)<\/title>/) || "")].length);
const d = g(/<meta name="description" content="([^"]*)"/); console.log(" desc:", d, "| len", [...(d || "")].length);
console.log(" canonical:", g(/<link rel="canonical" href="([^"]*)"/));
console.log(" hreflang:", [...h.matchAll(/hrefLang="([^"]+)" href="([^"]+)"/g)].map((m) => m[1] + "=" + m[2]).join(" "));
console.log(" h1:", [...h.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].replace(/<[^>]+>/g, "")).join(" || "));
for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { const j = JSON.parse(m[1]); const t = j["@type"] || (j["@graph"] || []).map((x) => x["@type"]).join(","); console.log(" LD:", t, t === "ItemList" ? `n=${j.numberOfItems} first=${j.itemListElement[0].name} ${j.itemListElement[0].url}` : t === "BreadcrumbList" ? j.itemListElement.map((x) => x.name + "→" + x.item).join(" > ") : ""); } catch {} }
const intro = h.match(/<h1[\s\S]*?<\/h1>\s*<div[^>]*>([\s\S]*?)<\/div>/); if (intro) console.log(" intro:", intro[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/<!-- -->/g,""));
console.log(" og:url", g(/<meta property="og:url" content="([^"]*)"/), "og:image", g(/<meta property="og:image" content="([^"]*)"/));
console.log(" hub links:", (h.match(/href="[^"]*\/kinh-nghiem\/chu-de\/[a-z-]+"/g) || []).length, " ?topic links:", (h.match(/\?topic=/g) || []).length);
