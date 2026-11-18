/**
 * Nhập ảnh/video Tà Xùa Clouds Homestay từ Drive vào PROD qua /api/admin/drive-import.
 * - "Khuôn viên" (lấy 30 ảnh đầu) → gallery homestay.
 * - Thư mục phòng → RoomImage phòng đó ("F8 2-4" → F6 view 2 và 4); "Bung 123", "Double" → ảnh hạng phòng.
 * - 3 ảnh đầu của phòng đầu tiên mỗi hạng + 1 video → hạng phòng.
 * Chạy: npx tsx --env-file=.env scripts/tmp-import-taxuaclouds-media.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "https://taxuabooking.com";
const ROOT = "12iDFKATtpUS6ZIGfo2GBPDiNZBCkDYmf";
const SLUG = "ta-xua-clouds-homestay";
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
  [/^big team/i, ["Big team"]],
  [/^bung 123/i, ["#Bung"]],
  [/^bung 4/i, ["Bung 4"]],
  [/^bung 5/i, ["Bung 5"]],
  [/^bếp 10/i, ["Bếp 10"]],
  [/^bếp 6/i, ["Bếp 6"]],
  [/^dorm/i, ["Family 8"]],
  [/^double/i, ["#Double"]],
  [/^f8$/i, ["Family 6"]],
  [/^f8 2-4/i, ["F6 view 2", "F6 view 4"]],
  [/^f8-1/i, ["F6 view 1"]],
  [/^f8-3/i, ["F6 view 3"]],
  [/^pano 1/i, ["Panorama 1"]],
  [/^pano 2/i, ["Panorama 2"]],
  [/^pano 3/i, ["Panorama 3"]],
  [/^pano 4/i, ["Panorama 4"]],
];
async function main() {
  const svc = await prisma.service.findUniqueOrThrow({
    where: { slug: SLUG },
    select: { id: true, roomTypes: { select: { id: true, name: true, rooms: { select: { id: true, name: true } } } } },
  });
  const cookie = await login();
  const folders = await listFolder(ROOT);
  const yard = folders.find((f) => /khuôn viên/i.test(f.name.normalize("NFC")));
  if (yard) {
    const files = (await listFolder(yard.id)).filter((f) => IMG.test(f.name));
    const pick = [...files.filter((f) => !/\.png$/i.test(f.name)), ...files.filter((f) => /\.png$/i.test(f.name))].slice(0, 30);
    let ok = 0;
    for (const f of pick) if (await imp(cookie, f, { serviceId: svc.id })) ok++;
    console.log("Khuôn viên: " + ok + "/" + pick.length + " (thư mục có " + files.length + " ảnh)");
  }
  const typeCover = new Set<string>();
  const typeVideo = new Set<string>();
  for (const folder of folders) {
    const fname = folder.name.normalize("NFC").trim();
    const keys = MAP.find(([re]) => re.test(fname))?.[1];
    if (!keys) { if (folder !== yard) console.log("? bỏ qua thư mục " + fname); continue; }
    const files = await listFolder(folder.id);
    const imgs = files.filter((f) => IMG.test(f.name));
    const vids = files.filter((f) => VID.test(f.name));
    for (const key of keys) {
      const isType = key.startsWith("#");
      const type = isType ? svc.roomTypes.find((t) => t.name === key.slice(1)) : svc.roomTypes.find((t) => t.rooms.some((r) => r.name === key));
      const room = isType ? null : type?.rooms.find((r) => r.name === key);
      if (!type || (!isType && !room)) { console.log("? không khớp: " + fname + " → " + key); continue; }
      let ok = 0;
      for (const f of imgs) if (await imp(cookie, f, isType ? { roomTypeId: type.id } : { roomId: room!.id })) ok++;
      if (!isType && !typeCover.has(type.id)) {
        typeCover.add(type.id);
        for (const f of imgs.slice(0, 3)) await imp(cookie, f, { roomTypeId: type.id });
      }
      let v = "";
      if (vids[0] && !typeVideo.has(type.id) && (await imp(cookie, vids[0], { roomTypeId: type.id }))) { typeVideo.add(type.id); v = " + video hạng"; }
      console.log(fname + " → " + key + ": " + ok + "/" + imgs.length + v);
    }
  }
  console.log("Xong · lỗi: " + fails);
}
main().finally(() => prisma.$disconnect());
