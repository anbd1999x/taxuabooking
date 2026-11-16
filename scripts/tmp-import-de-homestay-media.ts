/**
 * Nhập ảnh/video Dê Homestay từ Drive (thư mục con theo phòng "Sa 2 - Đơn"…) vào PROD qua /api/admin/drive-import.
 * - Ảnh thư mục phòng → RoomImage của phòng đó.
 * - Video thư mục phòng (mỗi phòng 1 video đầu) → hạng phòng (RoomTypeImage; video chỉ gắn hạng).
 * - 3 ảnh đầu của phòng đại diện (Sa 2 / Sa 3) → hạng phòng.
 * - "khuôn viên" + 1 ảnh đầu mỗi phòng → gallery homestay (ServiceImage).
 * - "dorm - cộng đồng": bỏ qua (sheet không có giá dorm).
 * Chạy: ADMIN_PASS=... npx tsx scripts/tmp-import-de-homestay-media.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "https://taxuabooking.com";
const ROOT = "1TK_cNR3TItPVFjbGvSKlmeGMvNcMZ2MA";
const SLUG = "de-homestay-ta-xua";
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
  const pass = process.env.ADMIN_PASS;
  if (!pass) throw new Error("Thiếu ADMIN_PASS");
  const page = await (await fetch(`${BASE}/admin/login`)).text();
  const fd = new FormData();
  const re = /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(page))) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  fd.append("username", process.env.ADMIN_USER ?? "admin");
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

async function main() {
  const svc = await prisma.service.findUniqueOrThrow({
    where: { slug: SLUG },
    select: { id: true, roomTypes: { select: { id: true, name: true, rooms: { select: { id: true, name: true } } } } },
  });
  const rooms = new Map<string, { roomId: string; typeId: string }>();
  for (const t of svc.roomTypes) for (const r of t.rooms) rooms.set(r.name.replace(/\s+/g, "").toLowerCase(), { roomId: r.id, typeId: t.id });
  const cookie = await login();
  const folders = await listFolder(ROOT);
  const typeCover = new Set<string>();
  const firstPerRoom: { id: string; name: string }[] = [];

  // Khuôn viên trước để làm ảnh bìa homestay.
  const kv = folders.find((f) => /khuôn viên|khuon vien/i.test(f.name));
  if (kv) {
    const files = (await listFolder(kv.id)).filter((f) => IMG.test(f.name));
    for (const f of files) await imp(cookie, f, { serviceId: svc.id });
    console.log(`Khuôn viên: ${files.length} ảnh`);
  }
  for (const folder of folders) {
    const m = folder.name.match(/^sa\s*(\d+)/i);
    if (!m) continue;
    const room = rooms.get(`sa${m[1]}`);
    if (!room) { console.log(`  ? không khớp phòng: ${folder.name}`); continue; }
    const files = await listFolder(folder.id);
    const imgs = files.filter((f) => IMG.test(f.name));
    const vids = files.filter((f) => VID.test(f.name));
    let ok = 0;
    for (const f of imgs) if (await imp(cookie, f, { roomId: room.roomId })) ok++;
    if (vids[0]) await imp(cookie, vids[0], { roomTypeId: room.typeId });
    if (!typeCover.has(room.typeId)) {
      typeCover.add(room.typeId);
      for (const f of imgs.slice(0, 3)) await imp(cookie, f, { roomTypeId: room.typeId });
    }
    if (imgs[0]) firstPerRoom.push(imgs[0]);
    console.log(`${folder.name}: ${ok}/${imgs.length} ảnh phòng${vids[0] ? " + 1 video hạng" : ""}`);
  }
  for (const f of firstPerRoom) await imp(cookie, f, { serviceId: svc.id });
  console.log(`Xong · lỗi: ${fails}`);
}
main().finally(() => prisma.$disconnect());
