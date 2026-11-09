/**
 * Nhập ảnh + video Khèn Coffee House từ Google Drive vào PROD.
 * - JPG/PNG/HEIC + video: qua /api/admin/drive-import (server tự tải từ Drive).
 * - PSD (Nhà Của Nắng, Phòng Khèn): tải về <work-dir>, ffmpeg → JPG ≤2400px, upload /api/admin/upload.
 * Thư mục riêng từng căn → Room (video → hạng của căn). Thư mục chung → RoomType.
 * "Không gian Quán" → ServiceImage (chỉ ảnh; video không gắn được vào homestay).
 * Cuối cùng chép 2 ảnh đầu mỗi căn vào gallery hạng chưa có ảnh.
 * Chạy: npx tsx scripts/tmp-import-khen-media.ts <work-dir> <cookie-file>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const [WORK, COOKIE_FILE] = process.argv.slice(2);
if (!WORK || !COOKIE_FILE) throw new Error("usage: <work-dir> <cookie-file>");
mkdirSync(WORK, { recursive: true });
const COOKIE = readFileSync(COOKIE_FILE, "utf8").trim();
const BASE = "https://taxuabooking.com";
const SLUG = "khen-coffee-house-ta-xua";

const IMG = /\.(jpe?g|png|webp|heic|heif)$/i;
const VID = /\.(mp4|mov|m4v|webm)$/i;
const PSD = /\.psd$/i;

type Target = { serviceId?: string; roomTypeId?: string; roomId?: string };
interface Job { folder: string; label: string; kind: "room" | "type" | "service"; name?: string }

const JOBS: Job[] = [
  { folder: "1Ow_lnwvtQne2u7GKSLnxyXG8J4aRnd4W", label: "Không gian Quán", kind: "service" },
  { folder: "1xDlk0D0CN_8TVqx9Zl3NK_3DQyxzvd7n", label: "Căn 1 Bình Minh", kind: "room", name: "Bình Minh" },
  { folder: "1-sRpBXhoXuVYjeGXJbb_F5LCtxhp4VEb", label: "Căn 2 Chạm Mây", kind: "room", name: "Chạm Mây" },
  { folder: "1YzGm5N7WfnV97bKIMoyHxPCzI763KnZC", label: "Căn 3 Thác Mây", kind: "room", name: "Thác Mây" },
  { folder: "1oviFEv4cE-EElJ1kJX9DkiguMgPzHvR0", label: "Căn 4 Mây Bay", kind: "room", name: "Mây Bay" },
  { folder: "1U-tgWbIWuFK3vADdJmH3wWsYlDQgXbgg", label: "Căn 5 Hoàng Hôn", kind: "room", name: "Hoàng Hôn" },
  { folder: "17tEgtew2hWXVuJUXzcFJS_Bs3uv1TylY", label: "Phòng Thung Lũng Mây", kind: "room", name: "Thung Lũng Mây" },
  { folder: "14N4rRfMCXrvzT-19jp9JJ3yEwRyezGqG", label: "Phòng Mây Lang Thang", kind: "room", name: "Mây Lang Thang" },
  { folder: "1ytaXVqVMwxXsJ0glUzhzDkbOpYpRy-Oh", label: "Phòng Chạm bình yên", kind: "room", name: "Chạm Bình Yên" },
  { folder: "1ZVHVzynIrbN6KJNjf7rnISnxqMBj0Hdb", label: "nhà của nắng 1", kind: "room", name: "Nhà Của Nắng 1" },
  { folder: "1iaYctb3n7B48nghCAlGBDoysFbsNY-Ji", label: "nhà của nắng 2", kind: "room", name: "Nhà Của Nắng 2" },
  { folder: "1GwdiUhcrRLheO-9sHwAyLgXinI50Njug", label: "nhà của nắng 3", kind: "room", name: "Nhà Của Nắng 3" },
  { folder: "1EE9oX9Ui1RMUtI8DvwVo8Kphp0jRSn6f", label: "nhà của nắng 5", kind: "room", name: "Nhà Của Nắng 5" },
  { folder: "1pIApr6dadixT9ewleuPS2qPhPqSngmbz", label: "Phòng Khèn 1-2-3", kind: "type", name: "Phòng Khèn (không view)" },
];

async function listFolder(id: string): Promise<{ id: string; name: string }[]> {
  const html = await (await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`)).text();
  const out: { id: string; name: string }[] = [];
  const re = /id="entry-([a-zA-Z0-9_-]{10,})"[\s\S]*?flip-entry-title">([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) if (!out.some((x) => x.id === m![1])) out.push({ id: m[1], name: m[2].trim() });
  return out;
}

async function driveImport(fileId: string, name: string, target: Target): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/admin/drive-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: COOKIE },
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

/** PSD → tải về, ffmpeg lấy ảnh ghép (composite) → JPG ≤2400px → upload. */
async function psdImport(fileId: string, name: string, target: Target): Promise<boolean> {
  const src = path.join(WORK, `${fileId}.psd`);
  const jpg = path.join(WORK, `${fileId}.jpg`);
  try {
    const dl = await fetch(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`);
    const ct = dl.headers.get("content-type") ?? "";
    if (!dl.ok || ct.includes("text/html")) throw new Error(`tải lỗi ${dl.status}`);
    writeFileSync(src, Buffer.from(await dl.arrayBuffer()));
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-frames:v", "1",
      "-vf", "scale='min(2400,iw)':-2", "-q:v", "3", jpg]);
    const fd = new FormData();
    fd.append("file", new Blob([readFileSync(jpg)], { type: "image/jpeg" }), name.replace(PSD, ".jpg"));
    for (const [k, v] of Object.entries(target)) if (v) fd.append(k, v);
    const res = await fetch(`${BASE}/api/admin/upload`, { method: "POST", headers: { Cookie: COOKIE }, body: fd });
    const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.ok && j.url) return true;
    console.log(`    ✗ ${name}: ${res.status} ${j.error ?? ""}`);
  } catch (e) {
    console.log(`    ✗ ${name}: ${(e as Error).message.split("\n")[0]}`);
  }
  return false;
}

async function main() {
  const s = await prisma.service.findUniqueOrThrow({
    where: { slug: SLUG },
    select: { id: true, roomTypes: { select: { id: true, name: true, rooms: { select: { id: true, name: true } } } } },
  });

  for (const job of JOBS) {
    let target: Target;
    let videoTarget: Target | null = null;
    if (job.kind === "service") target = { serviceId: s.id };
    else if (job.kind === "type") {
      const rt = s.roomTypes.find((x) => x.name === job.name);
      if (!rt) throw new Error(`Không thấy hạng ${job.name}`);
      target = videoTarget = { roomTypeId: rt.id };
    } else {
      const rt = s.roomTypes.find((x) => x.rooms.some((r) => r.name === job.name));
      const room = rt?.rooms.find((x) => x.name === job.name);
      if (!rt || !room) throw new Error(`Không thấy phòng ${job.name}`);
      target = { roomId: room.id };
      videoTarget = { roomTypeId: rt.id };
    }
    const files = await listFolder(job.folder);
    const imgs = files.filter((f) => IMG.test(f.name)).slice(0, 25);
    const psds = files.filter((f) => PSD.test(f.name));
    const vids = videoTarget ? files.filter((f) => VID.test(f.name)) : [];
    let okI = 0, okP = 0, okV = 0;
    for (const f of imgs) if (await driveImport(f.id, f.name, target)) okI++;
    for (const f of psds) if (await psdImport(f.id, f.name, target)) okP++;
    for (const f of vids) if (await driveImport(f.id, f.name, videoTarget!)) okV++;
    console.log(`${job.label} → ${job.name ?? "homestay"}: ảnh ${okI}/${imgs.length}, psd ${okP}/${psds.length}, video ${okV}/${vids.length}`);
  }

  const fresh = await prisma.roomType.findMany({
    where: { serviceId: s.id },
    select: {
      id: true, name: true,
      images: { select: { type: true } },
      rooms: { orderBy: { sortOrder: "asc" }, select: { images: { orderBy: { sortOrder: "asc" }, take: 2, select: { url: true } } } },
    },
  });
  for (const rt of fresh) {
    if (rt.images.some((i) => i.type === "image")) continue;
    const urls = [...new Set(rt.rooms.flatMap((r) => r.images.map((i) => i.url)))];
    if (!urls.length) continue;
    await prisma.roomTypeImage.createMany({
      data: urls.map((url, i) => ({ roomTypeId: rt.id, url, sortOrder: 100 + i, isCover: i === 0 })),
    });
    await prisma.roomType.update({ where: { id: rt.id }, data: { imageUrl: urls[0] } });
    console.log(`RT ${rt.name}: gallery ${urls.length} ảnh`);
  }
}
main().finally(() => prisma.$disconnect());
