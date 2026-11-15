// Quét HTML thật của trang khách ở 1 ngôn ngữ, liệt kê đoạn chữ còn tiếng Việt (bỏ qua tên riêng).
//   node scripts/i18n/scan.mjs [en] [base=http://localhost:3000] [/duong-dan ...]
const VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const PROPER_NAMES = [
  "Tà Xùa", "TÀ XÙA", "Bắc Yên", "Sơn La", "Đỉnh Gió", "Khe Cải", "Háng Đồng", "Bản Bẹ", "Mống Vài", "Mống Vàng",
  "Chung Trinh", "Bùi Danh An", "Tăng Mai Linh", "Bùi An", "Tăng Linh", "Hồng Lĩnh", "Hà Tĩnh", "Đậu Liêu",
  "Nội Bài", "Phù Yên", "Mạc Thái Tổ", "Hà Nội", "Việt Nam", "Mông", "Tiếng Việt",
];
const PROPER = new RegExp(PROPER_NAMES.join("|") + "|[Cc]af[ée]s?|\\d[\\d.,]*\\s?đ|đ/", "g");
const [loc = "en", base = "http://localhost:3000", ...extra] = process.argv.slice(2);
const paths = extra.length
  ? extra
  : ["/", "/homestay", "/xe-cabin", "/combo", "/thue-xe-may", "/xe-om", "/taxi", "/lich-trinh", "/ban-do", "/kinh-nghiem", "/nha-hang", "/cafe", "/huong-dan", "/tra-cuu", "/gop-y", "/cam-ket", "/cam-ket/dieu-khoan", "/lien-he", "/gioi-thieu", "/chinh-sach-bao-mat", "/tai-khoan"];
const seen = new Map();
for (const p of paths) {
  const html = await (await fetch(`${base}/${loc}${p === "/" ? "" : p}`)).text();
  const body = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ");
  const texts = [...body.matchAll(/>([^<>]+)</g)].map((m) => m[1]);
  const attrs = [...body.matchAll(/(?:alt|title|placeholder|aria-label|content)="([^"]+)"/g)].map((m) => m[1]);
  for (const raw of [...texts, ...attrs]) {
    const s = raw.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
    if (s && VI.test(s.replace(PROPER, "")) && !seen.has(s)) seen.set(s, p);
  }
}
for (const [s, p] of seen) console.log(`${p}\t${s.slice(0, 160)}`);
console.log(`--- ${seen.size} đoạn còn tiếng Việt (${loc})`);
