/**
 * Nạp tình trạng phòng Dốc Mơ từ sheet (docmo-lich.csv): 01/10 → 31/12/2026.
 * "Đã đặt" → BOOKED · "Không bán" → CLOSED · "Trống" → bỏ (mặc định AVAILABLE).
 * Chạy: npx tsx scripts/tmp-docmo-avail.ts <scratchpad-dir>
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, RoomStatus } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "doc-mo-homestay";
const SCRATCH = process.argv[2];
if (!SCRATCH) throw new Error("usage: tsx tmp-docmo-avail.ts <scratchpad-dir>");

const START = new Date(Date.UTC(2026, 9, 1)); // 2026-10-01
const NDAYS = 92; // 01/10 → 31/12/2026
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };

// CSV name → DB room name
const NAME_MAP: Record<string, string> = {
  "Dốc mơ": "Dốc Mơ",
  "Cozy 1": "Cozy 1", "Cozy 2": "Cozy 2", "Cozy 3": "Cozy 3", "Cozy 4": "Cozy 4", "Cozy 5": "Cozy 5",
  "Sweet 1": "Sweet 1", "Sweet 2": "Sweet 2", "Sweet 3": "Sweet 3",
  "Nhà Sàn": "Nhà sàn H'mong",
};

function statusOf(v: string): RoomStatus | null {
  const s = v.trim();
  if (s === "Đã đặt") return RoomStatus.BOOKED;
  if (s === "Không bán") return RoomStatus.CLOSED;
  return null; // Trống / rỗng → mặc định AVAILABLE (không tạo bản ghi)
}

async function main() {
  const service = await prisma.service.findUniqueOrThrow({
    where: { slug: SLUG },
    select: { roomTypes: { select: { rooms: { select: { id: true, name: true } } } } },
  });
  const roomByName = new Map(service.roomTypes.flatMap((rt) => rt.rooms.map((r) => [r.name, r.id] as const)));

  const csv = readFileSync(path.join(SCRATCH, "docmo-lich.csv"), "utf8");
  const lines = csv.split(/\r?\n/);

  const end = addDays(START, NDAYS);
  let totalRows = 0, booked = 0, closed = 0;

  for (const [csvName, dbName] of Object.entries(NAME_MAP)) {
    const roomId = roomByName.get(dbName);
    if (!roomId) { console.log(`!! Không thấy phòng DB: ${dbName}`); continue; }
    const line = lines.find((l) => l.startsWith(csvName + ","));
    if (!line) { console.log(`!! Không thấy dòng sheet: ${csvName}`); continue; }
    const cells = line.split(",").slice(1, 1 + NDAYS);
    if (cells.length !== NDAYS) console.log(`   (cảnh báo) ${csvName}: ${cells.length} cột (mong ${NDAYS})`);

    // Xoá lịch cũ trong khoảng rồi nạp lại
    await prisma.roomDayStatus.deleteMany({ where: { roomId, date: { gte: START, lt: end } } });

    const rows: { roomId: string; date: Date; status: RoomStatus; note: string }[] = [];
    cells.forEach((v, j) => {
      const st = statusOf(v);
      if (!st) return;
      rows.push({ roomId, date: addDays(START, j), status: st, note: "Nạp từ sheet lịch phòng" });
      if (st === RoomStatus.BOOKED) booked++; else closed++;
    });
    if (rows.length) await prisma.roomDayStatus.createMany({ data: rows });
    totalRows += rows.length;
    console.log(`  ${dbName}: ${rows.length} ngày không-trống`);
  }
  console.log(`Xong: ${totalRows} bản ghi (BOOKED ${booked} · CLOSED ${closed}).`);
}
main().finally(() => prisma.$disconnect());
