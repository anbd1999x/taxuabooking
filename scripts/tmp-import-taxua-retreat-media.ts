/**
 * Nhập ảnh + video "Tà Xùa Retreat" từ các thư mục Drive ghi ở cột "LINK ẢNH" (tab Bảng Giá Phòng)
 * vào PROD qua /api/admin/drive-import. Thư mục con ("Ảnh Phòng" / "Video Phòng") được quét 1 cấp.
 * - Ảnh → từng phòng (RoomImage); thư mục dùng chung 2 phòng (Bun 2-3, Ban Mai 1-2) gắn cho cả hai.
 * - Video → hạng phòng (RoomTypeImage, video chỉ gắn được vào hạng), mỗi thư mục gắn 1 lần.
 * - 2 ảnh đầu mỗi thư mục → gallery homestay (ServiceImage) làm ảnh bìa/ảnh chung.
 * Chạy: ADMIN_USER=admin ADMIN_PASS=... npx tsx scripts/tmp-import-taxua-retreat-media.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const BASE = "https://taxuabooking.com";
const SLUG = "ta-xua-retreat";
const IMG = /\.(jpe?g|png|webp|heic|heif)$/i;
const VID = /\.(mp4|mov|m4v|webm)$/i;
const MAX_IMG_PER_FOLDER = 20;
type Target = { serviceId?: string; roomTypeId?: string; roomId?: string };

const FOLDERS: { id: string; rooms: string[] }[] = [
  { id: "1raJKrRHw0XtnekxVG6KKRbFxTCfQYqsz", rooms: ["Bun 1"] },
  { id: "18wng92scmarU3JmBRlcNkEnw6Sh3wrap", rooms: ["Bun 2", "Bun 3"] },
  { id: "1kwFD3sFfj8ZUZRs9hV1NiWmHJ_m-V7n7", rooms: ["Vườn Mây 1"] },
  { id: "1L3oZXnLwmEE4YxOrMsMiFR6CTWvH9a47", rooms: ["Vườn Mây 2"] },
  { id: "1aKBxIB97pB7z5KJK1VvM6PZujAe9mr_o", rooms: ["Vườn Mây 3"] },
  { id: "1WK0o5RNzDWSjarRR-DzZlPHT7WOwWtBh", rooms: ["Ban Mai 1", "Ban Mai 2"] },
  { id: "1CEcEin2AG-QcSo82Dhc0GXgoNLgyPgjE", rooms: ["Ban Mai 3"] },
];

async function listFolder(id: string, depth = 0): Promise<{ id: string; name: string }[]> {
  const html = await (await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`)).text();
  const out: { id: string; name: string }[] = [];
  const re = /id="entry-([a-zA-Z0-9_-]{10,})"[\s\S]*?flip-entry-title">([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const entry = { id: m[1], name: m[2].trim() };
    if (out.some((x) => x.id === entry.id)) continue;
    if (!/\.[a-z0-9]{2,5}$/i.test(entry.name) && depth === 0) out.push(...(await listFolder(entry.id, 1))); // thư mục con
    else out.push(entry);
  }
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

async function importOne(cookie: string, fileId: string, name: string, target: Target): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/admin/drive-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ op: "import", fileId, name, ...target }),
      });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && j.url) return true;
      console.log(`    ✗ ${name}: ${res.status} ${j.error ?? ""}`);
      if (res.status < 500) return false;
    } catch (e) {
      console.log(`    ✗ ${name}: ${(e as Error).message}`);
    }
  }
  return false;
}

async function main() {
  const svc = await prisma.service.findUniqueOrThrow({
    where: { slug: SLUG },
    select: { id: true, roomTypes: { select: { id: true, rooms: { select: { id: true, name: true } } } } },
  });
  const roomByName = new Map(svc.roomTypes.flatMap((rt) => rt.rooms.map((r) => [r.name, { roomId: r.id, roomTypeId: rt.id }] as const)));
  const cookie = await login();
  let fail = 0;
  for (const f of FOLDERS) {
    const files = await listFolder(f.id);
    const imgs = files.filter((x) => IMG.test(x.name)).slice(0, MAX_IMG_PER_FOLDER);
    const vids = files.filter((x) => VID.test(x.name));
    const targets = f.rooms.map((n) => roomByName.get(n)!);
    let okI = 0, okV = 0;
    for (const t of targets) for (const img of imgs) (await importOne(cookie, img.id, img.name, { roomId: t.roomId })) ? okI++ : fail++;
    for (const v of vids) (await importOne(cookie, v.id, v.name, { roomTypeId: targets[0].roomTypeId })) ? okV++ : fail++;
    for (const img of imgs.slice(0, 2)) (await importOne(cookie, img.id, img.name, { serviceId: svc.id })) || fail++;
    console.log(`${f.rooms.join(" + ")}: ảnh ${okI}/${imgs.length * targets.length}, video ${okV}/${vids.length}`);
  }
  // Hạng phòng chưa có ảnh (chỉ có video/không có) → lấy 2 ảnh đầu của mỗi phòng làm gallery hạng.
  const types = await prisma.roomType.findMany({
    where: { serviceId: svc.id },
    select: { id: true, name: true, images: { select: { type: true } }, rooms: { orderBy: { sortOrder: "asc" }, select: { images: { orderBy: { sortOrder: "asc" }, take: 2, select: { url: true } } } } },
  });
  for (const rt of types) {
    if (rt.images.some((i) => i.type === "image")) continue;
    const urls = [...new Set(rt.rooms.flatMap((r) => r.images.map((i) => i.url)))];
    if (!urls.length) continue;
    const start = rt.images.length;
    await prisma.roomTypeImage.createMany({ data: urls.map((url, i) => ({ roomTypeId: rt.id, url, sortOrder: start + i, isCover: i === 0 })) });
    await prisma.roomType.update({ where: { id: rt.id }, data: { imageUrl: urls[0] } });
    console.log(`Gallery hạng ${rt.name}: ${urls.length} ảnh`);
  }
  console.log(`Lỗi: ${fail}`);
}
main().finally(() => prisma.$disconnect());
