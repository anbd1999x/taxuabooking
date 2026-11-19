/**
 * Kiểm thử "Combo tự chọn" + công thức tiền combo dùng chung (comboQuote).
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/test-combo-custom.ts          # logic thuần
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env scripts/test-combo-custom.ts --db
 *
 * `--db` CHỈ ĐỌC dữ liệu thật: đối chiếu giá phòng trang tìm combo đưa cho khách với giá server sẽ tính khi đặt.
 */
import { comboQuote, cabinSeatTotal, COMBO_DISCOUNT, type ComboQuoteRoom } from "../src/lib/combo-pricing";
import { cheapestPick, groupRooms, pickedRooms, toQuoteRoom, CUSTOM_MAX_ROOMS } from "../src/lib/combo-custom";
import type { ComboRoomOption } from "../src/lib/combo";

let pass = 0;
let fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.error(`✗ ${name}\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`); }
}

// Bộ sinh số ngẫu nhiên có hạt giống (kết quả lặp lại được).
let seed = 20261118;
const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };

const R = (cost: number, capacity: number, o: Partial<ComboQuoteRoom> = {}): ComboQuoteRoom =>
  ({ cost, capacity, maxCapacity: capacity, communal: false, noComboDiscount: false, costOld: null, ...o });

/* ---------- 1. Ca tính tay ---------- */
{
  // 4 khách, 2 phòng đôi 575k (niêm yết 600k), 4 vé 500k nằm ghép ⇒ 1.150.000 + 2.000.000 − 100.000.
  const q = comboQuote({ rooms: [R(575000, 2, { costOld: 600000 }), R(575000, 2, { costOld: 600000 })], people: 4, extraFeeStay: 0, fare: 500000, shared: 4, solo: 0 });
  eq("cơ bản: tổng", q.total, 3050000);
  eq("cơ bản: phòng/niêm yết/vé/giảm", [q.roomCost, q.roomCostOld, q.busAmount, q.discount], [1150000, 1200000, 2000000, 100000]);
  eq("cơ bản: không lỗi", q.error, null);
}
{
  // 1 khách nằm riêng: 3 ghép + 1 riêng = 3×500 + 2×500 = 2.500.000; giảm vẫn 4 người.
  const q = comboQuote({ rooms: [R(1140000, 4)], people: 4, extraFeeStay: 0, fare: 500000, shared: 3, solo: 1 });
  eq("nằm riêng ×2 vé", [q.busAmount, q.seatCount, q.discount, q.total], [2500000, 4, 100000, 1140000 + 2500000 - 100000]);
}
{
  // Ít vé hơn khách: 4 khách, 2 vé ⇒ giảm 25k × 2.
  const q = comboQuote({ rooms: [R(1140000, 4)], people: 4, extraFeeStay: 0, fare: 600000, shared: 2, solo: 0 });
  eq("ít vé hơn khách", [q.discountPeople, q.discount, q.total], [2, 50000, 1140000 + 1200000 - 50000]);
}
{
  // Nhiều vé hơn khách: giảm chỉ theo số khách.
  const q = comboQuote({ rooms: [R(600000, 2)], people: 2, extraFeeStay: 0, fare: 500000, shared: 5, solo: 0 });
  eq("nhiều vé hơn khách", [q.discountPeople, q.total], [2, 600000 + 2500000 - 50000]);
}
{
  // Ở ghép: phòng 2 (tối đa 3) cho 3 khách, phụ thu 150k/khách/kỳ — cộng vào cả giá bán lẫn niêm yết.
  const q = comboQuote({ rooms: [R(600000, 2, { maxCapacity: 3, costOld: 700000 })], people: 3, extraFeeStay: 150000, fare: 500000, shared: 3, solo: 0 });
  eq("ở ghép", [q.extraGuests, q.extraCost, q.roomCost, q.roomCostOld, q.total], [1, 150000, 750000, 850000, 750000 + 1500000 - 75000]);
}
{
  const q = comboQuote({ rooms: [R(600000, 2, { maxCapacity: 3 })], people: 4, extraFeeStay: 150000, fare: 500000, shared: 4, solo: 0 });
  eq("thiếu chỗ ⇒ CAPACITY", [q.error, q.capacityMax, q.extraGuests], ["CAPACITY", 3, 0]);
}
{
  // Giường cộng đồng: giá theo NGƯỜI, xếp giường rẻ trước, không giảm combo, không ở ghép.
  const q = comboQuote({ rooms: [R(200000, 4, { communal: true, maxCapacity: 9 }), R(150000, 2, { communal: true })], people: 5, extraFeeStay: 99999, fare: 500000, shared: 5, solo: 0 });
  eq("cộng đồng", [q.roomCost, q.noDiscount, q.discount, q.capacityMax, q.extraCost, q.total], [150000 * 2 + 200000 * 3, true, 0, 6, 0, 900000 + 2500000]);
}
{
  const q = comboQuote({ rooms: [R(200000, 4, { communal: true }), R(600000, 2)], people: 3, extraFeeStay: 0, fare: 500000, shared: 3, solo: 0 });
  eq("lẫn cộng đồng + thường ⇒ MIXED", q.error, "MIXED");
}
{
  const q = comboQuote({ rooms: [R(600000, 2), R(900000, 2, { noComboDiscount: true })], people: 4, extraFeeStay: 0, fare: 500000, shared: 4, solo: 0 });
  eq("phòng tick không giảm combo", [q.noDiscount, q.discount, q.total], [true, 0, 1500000 + 2000000]);
}
eq("chưa chọn phòng ⇒ NO_ROOM, không giảm", (() => { const q = comboQuote({ rooms: [], people: 2, extraFeeStay: 0, fare: 500000, shared: 2, solo: 0 }); return [q.error, q.discount]; })(), ["NO_ROOM", 0]);

/* ---------- 2. Khớp CÔNG THỨC CŨ của server (combo gợi ý: số vé = số khách) ---------- */
// Bản sao nguyên văn cách createComboBooking tính trước khi gom về comboQuote.
function legacy(rooms: ComboQuoteRoom[], people: number, fee: number, fare: number, nDouble: number, nSingle: number) {
  const communal = rooms.every((r) => r.communal);
  const capacityStd = rooms.reduce((n, r) => n + r.capacity, 0);
  let roomCost = 0;
  let extraGuests = 0;
  let extraCost = 0;
  if (communal) {
    let remaining = people;
    for (const r of rooms.map((room) => ({ cap: room.capacity, cost: room.cost })).sort((a, b) => a.cost - b.cost)) {
      const take = Math.min(remaining, r.cap);
      roomCost += r.cost * take;
      remaining -= take;
    }
  } else {
    roomCost = rooms.reduce((a, b) => a + b.cost, 0);
    if (people > capacityStd) {
      extraGuests = people - capacityStd;
      let rem = extraGuests;
      for (const sl of rooms.map((r) => ({ slots: Math.max(0, r.maxCapacity - r.capacity), fee })).filter((x) => x.slots > 0).sort((a, b) => a.fee - b.fee)) {
        const take = Math.min(rem, sl.slots);
        extraCost += take * sl.fee;
        rem -= take;
        if (rem === 0) break;
      }
      roomCost += extraCost;
    }
  }
  const busAmount = cabinSeatTotal(fare, nDouble, nSingle);
  const noDiscount = communal || rooms.some((r) => r.noComboDiscount);
  return { roomCost, extraGuests, extraCost, busAmount, total: Math.max(0, roomCost + busAmount - (noDiscount ? 0 : COMBO_DISCOUNT * people)) };
}
{
  let checked = 0;
  for (let it = 0; it < 20000; it++) {
    const dorm = rnd(6) === 0;
    const rooms: ComboQuoteRoom[] = Array.from({ length: 1 + rnd(6) }, () => {
      const capacity = 1 + rnd(dorm ? 8 : 4);
      return R((1 + rnd(40)) * 50000, capacity, { maxCapacity: capacity + (dorm ? 0 : rnd(3)), communal: dorm, noComboDiscount: rnd(8) === 0 });
    });
    const people = 1 + rnd(14);
    const fee = rnd(5) * 50000;
    const fare = (6 + rnd(10)) * 50000;
    const solo = rnd(people + 1);
    const q = comboQuote({ rooms, people, extraFeeStay: fee, fare, shared: people - solo, solo });
    if (q.error) continue; // server từ chối các ca này (thiếu chỗ)
    const l = legacy(rooms, people, fee, fare, people - solo, solo);
    checked++;
    const got = [q.roomCost, q.extraGuests, q.extraCost, q.busAmount, q.total];
    const want = [l.roomCost, l.extraGuests, l.extraCost, l.busAmount, l.total];
    if (JSON.stringify(got) !== JSON.stringify(want)) { eq(`khớp công thức cũ #${it}`, got, want); break; }
  }
  eq("khớp công thức cũ: đã so đủ nhiều ca", checked > 5000, true);
}

/* ---------- 3. Bất biến của comboQuote ---------- */
{
  let bad = "";
  for (let it = 0; it < 20000 && !bad; it++) {
    const rooms = Array.from({ length: rnd(7) }, () => { const c = 1 + rnd(5); const cost = (1 + rnd(40)) * 50000; return R(cost, c, { maxCapacity: c + rnd(2), communal: rnd(7) === 0, noComboDiscount: rnd(9) === 0, costOld: rnd(2) ? cost + rnd(4) * 50000 : null }); });
    const people = 1 + rnd(30);
    const shared = rnd(20);
    const solo = rnd(8);
    const fare = (6 + rnd(10)) * 50000;
    const q = comboQuote({ rooms, people, extraFeeStay: rnd(4) * 50000, fare, shared, solo });
    if (q.total !== Math.max(0, q.roomCost + q.busAmount - q.discount)) bad = "total ≠ phòng + vé − giảm";
    else if (q.busAmount !== fare * shared + 2 * fare * solo) bad = "tiền vé sai";
    else if (q.roomCostOld < q.roomCost) bad = "niêm yết < giá bán";
    else if (q.discount > COMBO_DISCOUNT * Math.min(people, shared + solo)) bad = "giảm vượt trần";
    else if (!Number.isInteger(q.total) || q.total < 0) bad = "tổng không phải số nguyên ≥ 0";
    else if (!q.error && q.capacityMax < people) bad = "đủ chỗ sai";
    if (bad) console.error("   ca lỗi:", JSON.stringify({ rooms, people, shared, solo, fare }));
  }
  eq("bất biến comboQuote", bad, "");
}

/* ---------- 4. Gợi ý rẻ nhất = vét cạn ---------- */
const mkRoom = (id: string, typeId: string, cost: number, cap: number, communal = false): ComboRoomOption => ({
  serviceId: "s", slug: "s", title: "S", area: null, distanceKm: null, cover: null, featured: false, priorityOrder: 0, childFreeUnderAge: 6,
  roomTypeId: typeId, roomId: id, roomName: `T · ${id}`, typeName: "T", capacity: cap, maxCapacity: cap, extraFeeStay: 0, roomCost: cost, roomCostOld: null,
  features: { hasBathtub: false, cloudView: false, breakfast: false, airCon: false, heating: false }, easyRoad: false, pool: false, kind: "double",
  communal, noComboDiscount: false, images: [], description: null, amenityList: [],
});
{
  let bad = "";
  for (let it = 0; it < 3000 && !bad; it++) {
    const rooms: ComboRoomOption[] = [];
    const types = 1 + rnd(4);
    for (let ti = 0; ti < types; ti++) {
      const cost = (2 + rnd(30)) * 50000;
      const cap = 1 + rnd(5);
      for (let k = 0, m = 1 + rnd(3); k < m; k++) rooms.push(mkRoom(`r${ti}_${k}`, `t${ti}`, cost, cap));
    }
    const n = 1 + rnd(14);
    const groups = groupRooms({ rooms });
    const pick = cheapestPick(groups, n);
    const chosen = pickedRooms(groups, pick);
    const cap = chosen.reduce((a, r) => a + r.capacity, 0);
    const cost = chosen.reduce((a, r) => a + r.roomCost, 0);
    // Vét cạn mọi tập con.
    let bestCost = Infinity;
    for (let mask = 1; mask < 1 << rooms.length; mask++) {
      let c = 0, p = 0;
      for (let i = 0; i < rooms.length; i++) if (mask & (1 << i)) { c += rooms[i].capacity; p += rooms[i].roomCost; }
      if (c >= n && p < bestCost) bestCost = p;
    }
    if (bestCost === Infinity) { if (chosen.length) bad = "không thể đủ chỗ mà vẫn gợi ý"; }
    else if (cap < n) bad = `gợi ý thiếu chỗ (${cap}/${n})`;
    else if (cost !== bestCost) bad = `gợi ý ${cost} ≠ rẻ nhất ${bestCost}`;
    else if (new Set(chosen.map((r) => r.roomId)).size !== chosen.length) bad = "trùng phòng";
    else if (chosen.length > CUSTOM_MAX_ROOMS) bad = "vượt trần số phòng";
    if (bad) console.error("   ca lỗi:", JSON.stringify({ n, rooms: rooms.map((r) => [r.roomId, r.roomCost, r.capacity]) }));
  }
  eq("gợi ý rẻ nhất = vét cạn", bad, "");
  // Chỉ có giường cộng đồng.
  const dormGroups = groupRooms({ rooms: [mkRoom("d1", "td", 200000, 6, true), mkRoom("d2", "td2", 150000, 4, true)] });
  eq("gợi ý dorm: rẻ trước, đủ chỗ", pickedRooms(dormGroups, cheapestPick(dormGroups, 7)).map((r) => r.roomId).sort(), ["d1", "d2"]);
  eq("gợi ý dorm: không đủ chỗ ⇒ rỗng", cheapestPick(dormGroups, 11), {});
  eq("0 khách ⇒ rỗng", cheapestPick(dormGroups, 0), {});
}

/* ---------- 5. (--db, CHỈ ĐỌC) giá trang tìm combo = giá server tính khi đặt ---------- */
async function dbCheck() {
  const { findComboMatches, isCommunalRoom, EMPTY_FILTERS } = await import("../src/lib/combo");
  const { prisma } = await import("../src/lib/prisma");
  const { roomPricing, priceForDay } = await import("../src/lib/availability");
  const { parseDateOnly, addDays, enumerateNights, toDateKey, today } = await import("../src/lib/dates");
  const { toNumber } = await import("../src/lib/format");
  const holidays = await (await import("../src/lib/holidays-server")).getHolidays();
  let rooms = 0;
  let homes = 0;
  for (const [offset, len] of [[1, 2], [3, 3], [9, 2], [20, 4]] as const) {
    const fromKey = toDateKey(addDays(today(), offset));
    const toKey = toDateKey(addDays(today(), offset + len));
    const res = await findComboMatches({ fromKey, toKey, people: 4, adults: 4, childrenAges: [], budget: null, filters: EMPTY_FILTERS, keepAllHomes: true });
    if (!res) continue;
    const nights = enumerateNights(addDays(parseDateOnly(fromKey), 1), parseDateOnly(toKey));
    const ids = res.homes.flatMap((h) => h.rooms.map((r) => r.roomId));
    const db = await prisma.room.findMany({ where: { id: { in: ids } }, include: { roomType: { include: { service: true } } } });
    const byId = new Map(db.map((r) => [r.id, r]));
    for (const h of res.homes) {
      homes++;
      for (const r of h.rooms) {
        rooms++;
        const d = byId.get(r.roomId)!;
        const pr = roomPricing(d, holidays);
        const serverCost = nights.reduce((n, day) => n + priceForDay(day, pr, null), 0);
        const want = [serverCost, d.capacity, Math.max(d.capacity, d.maxCapacity ?? d.capacity), isCommunalRoom(d.roomType.name, d.name), d.noComboDiscount, (toNumber(d.roomType.service.extraPersonFee) ?? 0) * nights.length];
        const got = [r.roomCost, r.capacity, r.maxCapacity, r.communal, r.noComboDiscount, r.extraFeeStay];
        if (JSON.stringify(got) !== JSON.stringify(want)) eq(`DB ${h.title} · ${r.roomName} (${fromKey}→${toKey})`, got, want);
      }
      // Gợi ý mặc định của mỗi home phải ra báo giá hợp lệ.
      const groups = groupRooms(h);
      const pick = pickedRooms(groups, cheapestPick(groups, h.billable));
      if (pick.length) {
        const q = comboQuote({ rooms: pick.map(toQuoteRoom), people: h.billable, extraFeeStay: h.rooms[0].extraFeeStay, fare: res.buses[0]?.farePerPerson ?? 0, shared: h.billable, solo: 0, discountPerGuest: res.comboDiscount });
        if (q.error) eq(`DB gợi ý mặc định ${h.title}`, q.error, null);
      }
    }
  }
  eq("DB: có dữ liệu để đối chiếu", rooms > 0, true);
  console.log(`   DB: đã đối chiếu ${rooms} lượt phòng / ${homes} lượt homestay`);
  await prisma.$disconnect();
}

(async () => {
  if (process.argv.includes("--db")) await dbCheck();
  console.log(`${fail === 0 ? "✓" : "✗"} ${pass} đạt, ${fail} lỗi`);
  process.exit(fail ? 1 : 0);
})();
