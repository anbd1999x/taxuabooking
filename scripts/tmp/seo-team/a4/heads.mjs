const pages = ["/en", "/en/homestay", "/en/xe-cabin", "/en/combo", "/en/taxi", "/en/xe-om", "/en/thue-xe-may", "/en/kinh-nghiem", "/en/ban-do", "/en/diem-den", "/en/thoi-tiet-ta-xua", ...["diem-den","lich-trinh","di-chuyen","an-uong","cam-nang","review-homestay"].map(t=>"/en/kinh-nghiem/chu-de/"+t)];
const out = new Set();
for (const p of pages) {
  const h = await (await fetch("http://localhost:3000" + p)).text();
  const items = [...h.matchAll(/<(h1|h2|h3|summary)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => [m[1], m[2].replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim()]);
  for (const ld of h.matchAll(/"@type":"Question","name":"([^"]+)"/g)) items.push(["faq", ld[1]]);
  for (const [tag, txt] of items) if (/Tà Xùa/.test(txt) && !/^Tà Xùa Booking$/.test(txt)) { console.log(p, tag, "|", txt); out.add(txt); }
}
