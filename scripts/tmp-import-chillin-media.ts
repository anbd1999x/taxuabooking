/**
 * Nhập ảnh/video Chillin House từ Drive vào PROD qua /api/admin/drive-import.
 * - "Sân cf home" → gallery homestay (ảnh bìa) + 1 ảnh đầu mỗi thư mục phòng.
 * - "Deluxe 101" / "Deluxe 105" / "Suite" → RoomImage đúng phòng; "Superior" → cả 2 phòng Superior.
 * - 3 ảnh đầu + video đầu của mỗi nhóm → hạng phòng. "Chính sách home" (ảnh chữ) bỏ qua.
 * Chạy: npx tsx --env-file=.env scripts/tmp-import-chillin-media.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "https://taxuabooking.com";
const ROOT = "1daEJlKEvgXSkhl-yRX0JRmklVOm7jDig";
const SLUG = "chillin-house-ta-xua";
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

const MAP: [RegExp, string[]][] = [
  [/^deluxe\s*101/i, ["Deluxe 101"]],
  [/^deluxe\s*105/i, ["Deluxe 105"]],
  [/^suite/i, ["Chillin Suite"]],
  [/^superior/i, ["Superior 1", "Superior 2"]],
];
async function main() {
  const svc = await prisma.service.findUniqueOrThrow({
    where: { slug: SLUG },
    select: { id: true, roomTypes: { select: { id: true, rooms: { select: { id: true, name: true } } } } },
  });
  const rooms = new Map<string, { roomId: string; typeId: string }>();
  for (const t of svc.roomTypes) for (const r of t.rooms) rooms.set(r.name, { roomId: r.id, typeId: t.id });
  const cookie = await login();
  const folders = await listFolder(ROOT);
  const typeCover = new Set<string>();
  const firstPerRoom: { id: string; name: string }[] = [];
  const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, "i") : null;
  const yard = ONLY ? undefined : folders.find((f) => /sân|san cf/i.test(f.name));
  if (yard) {
    const files = (await listFolder(yard.id)).filter((f) => IMG.test(f.name));
    let ok = 0;
    for (const f of files) if (await imp(cookie, f, { serviceId: svc.id })) ok++;
    console.log(`Sân cf home: ${ok}/${files.length} ảnh`);
  }
  for (const folder of folders) {
    const names = MAP.find(([re]) => re.test(folder.name))?.[1];
    if (!names || (ONLY && !ONLY.test(folder.name))) continue;
    const targets = names.map((n) => rooms.get(n)!);
    const files = await listFolder(folder.id);
    const imgs = files.filter((f) => IMG.test(f.name));
    const vids = files.filter((f) => VID.test(f.name));
    let ok = 0;
    for (const t of targets) for (const f of imgs) if (await imp(cookie, f, { roomId: t.roomId })) ok++;
    const typeId = targets[0].typeId;
    if (!typeCover.has(typeId)) {
      typeCover.add(typeId);
      for (const f of imgs.slice(0, 3)) await imp(cookie, f, { roomTypeId: typeId });
      if (vids[0]) await imp(cookie, vids[0], { roomTypeId: typeId });
    }
    if (imgs[0]) firstPerRoom.push(imgs[0]);
    console.log(`${folder.name}: ${ok}/${imgs.length * targets.length} ảnh phòng${vids[0] ? " + video hạng" : ""}`);
  }
  for (const f of firstPerRoom) await imp(cookie, f, { serviceId: svc.id });
  console.log(`Xong · lỗi: ${fails}`);
}
main().finally(() => prisma.$disconnect());
