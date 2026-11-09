/**
 * Nhập ảnh + video "Nhà của An" từ thư mục Google Drive (công khai) vào PROD qua /api/admin/drive-import
 * (server tự tải & lưu volume uploads, gắn DB).
 * - Ảnh mang tên căn ("AN 1 + 2", "An 4 + 8 + 9", "An 5"…) → gắn vào TỪNG phòng được nhắc tới (RoomImage).
 * - Ảnh trong căn / nhà vệ sinh + mọi video → hạng phòng (RoomTypeImage; video chỉ gắn được vào hạng).
 * - Khuôn viên / lối đi / cafe → gallery homestay (ServiceImage).
 * Đăng nhập: form /admin/login (cookie taxua_admin) — token tự ký không dùng được trên prod.
 * Chạy: ADMIN_USER=admin ADMIN_PASS=... npx tsx scripts/tmp-import-nhacuaan-media.ts   (DATABASE_URL theo .env = prod)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const BASE = "https://taxuabooking.com";
const FOLDER = "1xzRu5CMY-YnuCy2y4zq8dPl7aK9GDzOy";
const SLUG = "nha-cua-an-ta-xua";
const IMG = /\.(jpe?g|png|webp|heic|heif)$/i;
const VID = /\.(mp4|mov|m4v|webm)$/i;
type Target = { serviceId?: string; roomTypeId?: string; roomId?: string };

async function listFolder(): Promise<{ id: string; name: string }[]> {
  const html = await (await fetch(`https://drive.google.com/embeddedfolderview?id=${FOLDER}`)).text();
  const out: { id: string; name: string }[] = [];
  const re = /id="entry-([a-zA-Z0-9_-]{10,})"[\s\S]*?flip-entry-title">([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) if (!out.some((x) => x.id === m![1])) out.push({ id: m[1], name: m[2].trim() });
  return out;
}

/** Đăng nhập form admin (server action) → cookie taxua_admin. */
async function login(): Promise<string> {
  const user = process.env.ADMIN_USER ?? "admin";
  const pass = process.env.ADMIN_PASS;
  if (!pass) throw new Error("Thiếu ADMIN_PASS");
  const page = await (await fetch(`${BASE}/admin/login`)).text();
  const fd = new FormData();
  const re = /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(page))) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  fd.append("username", user);
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
  const rt = svc.roomTypes[0];
  const roomByNo = new Map(rt.rooms.map((r) => [Number(r.name.replace(/\D/g, "")), r.id]));
  const files = await listFolder();
  const cookie = await login();
  const tally = { room: 0, type: 0, service: 0, fail: 0 };

  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, "");
    if (VID.test(f.name)) {
      (await importOne(cookie, f.id, f.name, { roomTypeId: rt.id })) ? tally.type++ : tally.fail++;
      continue;
    }
    if (!IMG.test(f.name)) continue;
    const named = /^an\s*\d/i.test(base);
    if (named) {
      // "An 4 + 8 + 9" → phòng 4, 8, 9
      const nums = [...new Set((base.match(/\d+/g) ?? []).map(Number))].filter((n) => roomByNo.has(n));
      for (const n of nums) (await importOne(cookie, f.id, f.name, { roomId: roomByNo.get(n)! })) ? tally.room++ : tally.fail++;
    } else if (/trong căn|vệ sinh/i.test(base)) {
      (await importOne(cookie, f.id, f.name, { roomTypeId: rt.id })) ? tally.type++ : tally.fail++;
    } else {
      (await importOne(cookie, f.id, f.name, { serviceId: svc.id })) ? tally.service++ : tally.fail++;
    }
  }
  console.log(`Ảnh phòng: ${tally.room} · hạng phòng (ảnh+video): ${tally.type} · homestay: ${tally.service} · lỗi: ${tally.fail}`);

  // Ảnh bìa: homestay = ảnh khuôn viên đầu tiên; hạng phòng có ảnh "trong căn".
  const counts = await prisma.room.findMany({ where: { roomTypeId: rt.id }, select: { name: true, _count: { select: { images: true } } }, orderBy: { sortOrder: "asc" } });
  console.log(counts.map((r) => `${r.name}: ${r._count.images} ảnh`).join(" · "));
}
main().finally(() => prisma.$disconnect());
