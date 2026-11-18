/**
 * Nhập ảnh Sóc Nâu Homestay từ Drive vào PROD qua /api/admin/drive-import.
 * - Thư mục theo nhóm phòng → ảnh HẠNG phòng (phòng con tự dùng ảnh hạng): S201-206 → Phòng đơn,
 *   S101-104 → Phòng đôi nhà sàn, B101-105 → Bungalow. "Vip 6-9" → ảnh riêng Bungalow 6 và 9.
 * - 5 ảnh đầu mỗi thư mục → gallery homestay. Thư mục "Combo Nhặt Nắng House" là home khác — bỏ qua.
 * Chạy: npx tsx --env-file=.env scripts/tmp-import-socnau-media.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "https://taxuabooking.com";
const ROOT = "1f1TPPC90Z4LgXnOgxdD8S6C49JVxZTyy";
const SLUG = "soc-nau-homestay-ta-xua";
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

const MAP: [RegExp, { type?: string; rooms?: string[] }][] = [
  [/^b101/i, { type: "Bungalow" }],
  [/^s201/i, { type: "Phòng đơn" }],
  [/^s101/i, { type: "Phòng đôi nhà sàn" }],
  [/^vip\s*6/i, { rooms: ["Bungalow 6", "Bungalow 9"] }],
];
async function main() {
  const svc = await prisma.service.findUniqueOrThrow({
    where: { slug: SLUG },
    select: { id: true, roomTypes: { select: { id: true, name: true, rooms: { select: { id: true, name: true } } } } },
  });
  const cookie = await login();
  const folders = await listFolder(ROOT);
  const gallery: { id: string; name: string }[] = [];
  for (const [re, target] of MAP) {
    const folder = folders.find((f) => re.test(f.name));
    if (!folder) { console.log("? thiếu thư mục " + re); continue; }
    const imgs = (await listFolder(folder.id)).filter((f) => IMG.test(f.name));
    const targets: Target[] = target.type
      ? [{ roomTypeId: svc.roomTypes.find((t) => t.name === target.type)!.id }]
      : target.rooms!.map((n) => ({ roomId: svc.roomTypes.flatMap((t) => t.rooms).find((r) => r.name === n)!.id }));
    let ok = 0;
    for (const t of targets) for (const f of imgs) if (await imp(cookie, f, t)) ok++;
    gallery.push(...imgs.slice(0, 5));
    console.log(folder.name + ": " + ok + "/" + imgs.length * targets.length);
  }
  let g = 0;
  for (const f of gallery) if (await imp(cookie, f, { serviceId: svc.id })) g++;
  console.log("Gallery: " + g + "/" + gallery.length + " · lỗi: " + fails);
}
main().finally(() => prisma.$disconnect());
