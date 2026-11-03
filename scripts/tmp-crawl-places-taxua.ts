/**
 * Giai đoạn A: tìm ảnh quán từ taxua.vn (WP REST). Mỗi quán: search bài viết có
 * TIÊU ĐỀ chứa tên quán (đã chuẩn hoá) → rút ảnh wp-content/uploads trong bài
 * (bỏ thumbnail, khử trùng lặp) → xử lý như media.ts → out-places/ +
 * manifest-places.json {slug: [{file, src}]}. Quán không có bài → để trống (giai đoạn B).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const SCRATCH = process.argv[2];
if (!SCRATCH) throw new Error("usage: tsx tmp-crawl-places-taxua.ts <scratchpad-dir>");
const OUT = path.join(SCRATCH, "out-places");
mkdirSync(OUT, { recursive: true });

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";
const MAX_PER = 6;

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// slug → {q: từ khoá search, must: cụm bắt buộc trong tiêu đề bài (đã norm)}
const SEARCH: Record<string, { q: string; must: string[] }> = {
  "ca-phe-ban-song-lung-khung-long": { q: "cà phê bản", must: ["ca phe ban"] },
  "sunset-clouds-coffee": { q: "sunset clouds", must: ["sunset"] },
  "cloud-coffee-cloud-forest-ta-xua": { q: "cloud forest", must: ["cloud forest"] },
  "may-bay-coffee": { q: "mây bay coffee", must: ["may bay"] },
  "an-s-coffee-ta-xua": { q: "an's coffee", must: ["an s coffee", "ans coffee"] },
  "cafe-lang-van-hoa": { q: "cafe làng văn hóa", must: ["lang van hoa"] },
  "hien": { q: "hiên cafe", must: ["hien cafe", "cafe hien"] },
  "nha-cua-an-homestay-coffee": { q: "nhà của an", must: ["nha cua an"] },
  "moong-homestay-coffee": { q: "moong", must: ["moong"] },
  "mi-ami-mountain-retreat-cafe-nha-hang": { q: "mi ami", must: ["mi ami"] },
  "chillout-village-nha-hang-cafe": { q: "chillout village", must: ["chillout"] },
  "lili-mountain-tiem-ca-phe-tu-te": { q: "lili mountain", must: ["lili"] },
  "khe-cai-coffee-ngay-nao-do": { q: "ngày nào đó", must: ["ngay nao do"] },
  "noong-oi-homestay-coffee": { q: "noong ơi", must: ["noong oi", "nong oi"] },
  "ca-phe-thang-10": { q: "cà phê tháng 10", must: ["thang 10"] },
  "nha-h-mong": { q: "nhà h'mông cafe", must: ["nha h mong", "nha hmong"] },
  "man-the-cocktail-bar": { q: "mận cocktail", must: ["cocktail"] },
  "hien-nha-tren-thao-nguyen": { q: "hiên nhà thảo nguyên", must: ["hien nha"] },
  "khen-coffee-house": { q: "khèn coffee", must: ["khen coffee"] },
  "tram-may-ta-xua-2": { q: "trạm mây", must: ["tram may"] },
  "nha-hang-a-phu-tinh-hoa-am-thuc-ta-xua": { q: "nhà hàng a phủ", must: ["a phu"] },
  "bep-an-xuan-thi-ta-xua": { q: "xuân thì", must: ["xuan thi"] },
  "nha-hang-doi-may": { q: "nhà hàng đồi mây", must: ["doi may"] },
  "tiem-lau-nuong-tram-may": { q: "trạm mây", must: ["tram may"] },
  "nha-hang-hang-chu-ta-xua": { q: "hang chú", must: ["hang chu"] },
  "tiem-mi-cay-ta-xua": { q: "mì cay", must: ["mi cay"] },
  "vua-lau-nuong-ta-xua": { q: "vua lẩu", must: ["vua lau"] },
  "com-nha-namiya-dinh-gio": { q: "namiya", must: ["namiya"] },
  "nha-hang-coffee-gio-ban-ta-xua": { q: "gió bản", must: ["gio ban"] },
  "nha-hang-bep-viet": { q: "bếp việt", must: ["bep viet"] },
  "mua-quan-ta-xua": { q: "mùa quán", must: ["mua quan"] },
  "tram-may-ta-xua": { q: "trạm mây", must: ["tram may"] },
  "nha-hang-pho-nui": { q: "nhà hàng phố núi", must: ["pho nui"] },
  "nha-hang-sammu-ta-xua": { q: "sammu", must: ["sammu", "samu"] },
  "tiem-nuong-canh-cam": { q: "cánh cam", must: ["canh cam"] },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function wpPosts(q: string): Promise<{ title: string; link: string; content: string }[]> {
  try {
    // /search xếp theo độ liên quan (không như /posts?search= xếp theo ngày)
    const res = await fetch(
      `https://taxua.vn/wp-json/wp/v2/search?search=${encodeURIComponent(q)}&per_page=8`,
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) return [];
    const hits = (await res.json()) as { id: number; title: string; url: string; subtype: string }[];
    const out: { title: string; link: string; content: string }[] = [];
    for (const h of hits) {
      if (h.subtype !== "post") continue;
      out.push({ title: h.title, link: h.url, content: "" }); // content tải sau khi khớp
    }
    return out;
  } catch {
    return [];
  }
}

async function wpPostContentByUrl(url: string): Promise<string> {
  try {
    const slug = url.replace(/\/$/, "").split("/").pop()?.replace(/\.html$/, "") ?? "";
    const res = await fetch(
      `https://taxua.vn/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=content`,
      { headers: { "User-Agent": UA } },
    );
    if (res.ok) {
      const j = (await res.json()) as { content: { rendered: string } }[];
      if (j[0]) return j[0].content.rendered;
    }
  } catch { /* rơi xuống fetch HTML */ }
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return await res.text();
  } catch { /* thôi */ }
  return "";
}

function extractImages(html: string): string[] {
  const urls = new Set<string>();
  const re = /https:\/\/taxua\.vn\/wp-content\/uploads\/[^\s"'<>\\]+?\.(?:jpe?g|png|webp)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    // về bản gốc: bỏ hậu tố -WxH trước đuôi
    const orig = m[0].replace(/-\d+x\d+(\.(?:jpe?g|png|webp))$/i, "$1");
    urls.add(orig);
  }
  return [...urls];
}

async function downloadImg(url: string): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15_000 || buf.length > 15_000_000) return null;
    return buf;
  } catch {
    return null;
  }
}

async function main() {
  const mfPath = path.join(SCRATCH, "manifest-places.json");
  const manifest: Record<string, { file: string; src: string }[]> = existsSync(mfPath)
    ? JSON.parse(readFileSync(mfPath, "utf8"))
    : {};
  for (const [slug, cfg] of Object.entries(SEARCH)) {
    if ((manifest[slug] ?? []).length > 0) { console.log(`${slug}: đã có, bỏ qua`); continue; }
    manifest[slug] = [];
    const posts = await wpPosts(cfg.q);
    const post = posts.find((p) => {
      const t = ` ${norm(p.title)} `;
      return cfg.must.some((mu) => t.includes(` ${mu} `));
    });
    if (!post) { console.log(`${slug}: KHÔNG có bài khớp (q=${cfg.q})`); await sleep(300); continue; }
    post.content = await wpPostContentByUrl(post.link);
    const imgs = extractImages(post.content);
    for (const u of imgs) {
      if (manifest[slug].length >= MAX_PER) break;
      const buf = await downloadImg(u);
      if (!buf) continue;
      try {
        let pipe = sharp(buf, { failOn: "none" }).rotate();
        const meta = await pipe.metadata();
        if (!meta.width || meta.width < 500 || !meta.height || meta.height < 350) continue;
        const ratio = meta.width / meta.height;
        if (ratio < 0.4 || ratio > 3) continue;
        if (meta.width > 2400) pipe = pipe.resize({ width: 2400, withoutEnlargement: true });
        const data = await pipe.jpeg({ quality: 82 }).toBuffer();
        const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;
        writeFileSync(path.join(OUT, name), data);
        manifest[slug].push({ file: name, src: u });
      } catch { /* bỏ ảnh hỏng */ }
    }
    console.log(`${slug}: ${manifest[slug].length} ảnh ← ${post.link}`);
    await sleep(300);
  }
  writeFileSync(mfPath, JSON.stringify(manifest, null, 2));
  const missing = Object.entries(manifest).filter(([, v]) => v.length === 0).map(([k]) => k);
  console.log("Thiếu:", missing.join(", ") || "(không)");
}
main();
