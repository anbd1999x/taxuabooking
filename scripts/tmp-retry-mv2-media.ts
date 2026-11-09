// Nhập lại các file MV2 (Haus Meej) bị lỗi 502 lần trước. Chạy: npx tsx scripts/tmp-retry-mv2-media.ts <cookie-file>
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const COOKIE = readFileSync(process.argv[2], "utf8").trim();
const WANT = ["NTT08780.jpeg", "NTT08785.jpeg", "z7194667149834_507243daa902a424a8be8e5d285b779f.jpg", "7194763650519.mp4", "Video phòng.mov"];

async function main() {
  const room = await prisma.room.findFirstOrThrow({
    where: { name: "MV2", roomType: { service: { slug: "haus-meej-ta-xua" } } },
    select: { id: true, roomTypeId: true },
  });
  const html = await (await fetch("https://drive.google.com/embeddedfolderview?id=1PjTaTKB3utfj4VfZyVulwV_A99A0Jt6o")).text();
  const files = [...html.matchAll(/<a href="https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})[^"]*"[\s\S]*?flip-entry-title">([^<]*)</g)]
    .map((m) => ({ id: m[1], name: m[2].trim() }))
    .filter((f) => WANT.includes(f.name));
  for (const f of files) {
    const isVid = /\.(mp4|mov)$/i.test(f.name);
    const target = isVid ? { roomTypeId: room.roomTypeId } : { roomId: room.id };
    let ok = false;
    for (let i = 0; i < 3 && !ok; i++) {
      const res = await fetch("https://taxuabooking.com/api/admin/drive-import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: COOKIE },
        body: JSON.stringify({ op: "import", fileId: f.id, name: f.name, ...target }),
      }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: String(e) }) }) as unknown as Response);
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      ok = res.ok && !!j.url;
      console.log(`${f.name}: ${ok ? "OK" : `lỗi ${res.status} ${j.error ?? ""}`}`);
    }
  }
}
main().finally(() => prisma.$disconnect());
