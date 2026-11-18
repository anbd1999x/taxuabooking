/**
 * Nhập ảnh/video Nhặt Nắng House từ Drive (mỗi phòng 1 thư mục) vào PROD qua /api/admin/drive-import.
 * - Ảnh thư mục phòng → RoomImage phòng đó; 3 ảnh đầu của phòng đầu tiên mỗi hạng + 1 video → hạng phòng.
 * - "Đào gác xép 202-204-205" → hạng "Phòng đôi gác xép" (3 phòng dùng chung).
 * - 2 ảnh đầu mỗi thư mục → gallery homestay. Bỏ ảnh ghép quảng cáo "Grey Minimalist…".
 * Chạy: npx tsx --env-file=.env scripts/tmp-import-nhatnang-media.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "https://taxuabooking.com";
const ROOT = "1_C-duW_dMIp1eLaB77wmhO_qaS24Q2aZ";
const SLUG = "nhat-nang-house-ta-xua";
const IMG = /\.(jpe?g|png|webp|heic|heif)$/i;
const VID = /\.(mp4|mov|m4v|webm)$/i;
type Target = { serviceId?: string; roomTypeId?: string; roomId?: string };

async function listFolder(id: string) {
  const html = await (await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`)).text();
  const out: { id: string; name: string }[] = [];
  const re = /id="entry-([a-zA-Z0-9_-]{10,})"[\s\S]*?flip-entry-title">([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) if (!out.some((x) => x.id === m![1])) out.push({ id: m[1], name: m[2].trim() });
  return out;
}
async function login(): Promise<string> {
  const pass = process.env.ADMIN_PASS ?? process.env.ADMIN_PASSWORD;
  if (!pass) throw new Error("Thiếu ADMIN_PASS");
  const page = await (await fetch(`${BASE}/admin/login`)).text();
  const fd = new FormData();
  const re = /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(page))) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  fd.append("username", process.env.ADMIN_USER ?? process.env.ADMIN_USERNAME ?? "admin");
  fd.append("password", pass);
  const res = await fetch(`${BASE}/admin/login`, { method: "POST", body: fd, redirect: "manual" });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("taxua_admin="));
  if (!cookie) throw new Error(`Đăng nhập thất bại (HTTP ${res.status})`);
  return cookie;
}
let fails = 0;
async function imp(cookie: string, f: { id: string; name: string }, target: Target) {
  for (let a = 0; a < 2; a++) {
    try {
      const res = await fetch(`${BASE}/api/admin/drive-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ op: "import", fileId: f.id, name: f.name, ...target }),
      });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && j.url) return true;
      console.log(`    ✗ ${f.name}: ${res.status} ${j.error ?? ""}`);
      if (res.status < 500) break;
    } catch (e) {
      console.log(`    ✗ ${f.name}: ${(e as Error).message}`);
    }
  }
  fails++;
  return false;
}

const MAP: [RegExp, string][] = [
  [/gác xép/i, "#Phòng đôi gác xép"],
  [/mây đào/i, "Mây Đào"],
  [/mận\s*1/i, "Mận 1"],
  [/mận\s*2/i, "Mận 2"],
  [/nắng\s*([2-5])/i, "Nắng $1"],
  [/đào\s*(\d{3})/i, "Đào $1"],
];
async function main() {
  const svc = await prisma.service.findUniqueOrThrow({
    where: { slug: SLUG },
    select: { id: true, roomTypes: { select: { id: true, name: true, rooms: { select: { id: true, name: true } } } } },
  });
  const cookie = await login();
  const folders = await listFolder(ROOT);
  const typeCover = new Set<string>();
  const typeVideo = new Set<string>();
  const gallery: { id: string; name: string }[] = [];
  for (const folder of folders) {
    const fname = folder.name.normalize("NFC");
    const hit = MAP.find(([re]) => re.test(fname));
    if (!hit) { console.log("? bỏ qua thư mục " + fname); continue; }
    const key = fname.replace(hit[0], hit[1]).match(/#?[^#]*$/) ? hit[1].replace(/\$1/, (fname.match(hit[0]) ?? [])[1] ?? "") : hit[1];
    const isType = key.startsWith("#");
    const type = isType ? svc.roomTypes.find((t) => t.name === key.slice(1)) : svc.roomTypes.find((t) => t.rooms.some((r) => r.name === key));
    const room = isType ? null : type?.rooms.find((r) => r.name === key);
    if (!type || (!isType && !room)) { console.log("? không khớp: " + fname + " → " + key); continue; }
    const files = (await listFolder(folder.id)).filter((f) => !/^grey minimalist/i.test(f.name));
    const imgs = files.filter((f) => IMG.test(f.name)).sort((a, b) => Number(/\.png$/i.test(a.name)) - Number(/\.png$/i.test(b.name)));
    const vids = files.filter((f) => VID.test(f.name));
    let ok = 0;
    for (const f of imgs) if (await imp(cookie, f, isType ? { roomTypeId: type.id } : { roomId: room!.id })) ok++;
    if (!isType && !typeCover.has(type.id)) {
      typeCover.add(type.id);
      for (const f of imgs.slice(0, 3)) await imp(cookie, f, { roomTypeId: type.id });
    }
    let v = "";
    if (vids[0] && !typeVideo.has(type.id) && (await imp(cookie, vids[0], { roomTypeId: type.id }))) { typeVideo.add(type.id); v = " + video hạng"; }
    gallery.push(...imgs.slice(0, 2));
    console.log(fname + " → " + key + ": " + ok + "/" + imgs.length + v);
  }
  let g = 0;
  for (const f of gallery) if (await imp(cookie, f, { serviceId: svc.id })) g++;
  console.log("Gallery: " + g + "/" + gallery.length + " · lỗi: " + fails);
}
main().finally(() => prisma.$disconnect());
