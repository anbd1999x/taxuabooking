/**
 * Kiểm thử luồng Quản lý phòng (homestay) trên DB thật — tạo homestay thử CHƯA ĐĂNG, tự dọn khi xong.
 * Gọi thẳng route handler POST /api/admin/stay (+ /api/admin/room-status) với cookie phiên ký sẵn.
 *
 *   npx tsx --tsconfig scripts/tsconfig.route-test.json --env-file=.env scripts/test-stay-flow.ts
 */
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, createSessionToken, type Role } from "@/lib/auth-token";
import { parseDateOnly } from "@/lib/dates";
import { assignRoomsForBooking } from "@/lib/inventory";
import { holKeysFor, loadHome, releaseExpiredStayHolds, syncHomeBookings, syncStaysForBooking } from "@/lib/stay";
import { addDaysKey, billOf, cancelMoney, nightPrice, normalizeHomeConfig, paidOf, quoteStay, vnNow, type HomeRoomVM, type StayVM } from "@/lib/stay-core";
import { getHolidays } from "@/lib/holidays-server";
import { holidayKeysBetween } from "@/lib/holidays";
import { POST as stayPOST } from "@/app/api/admin/stay/route";
import { POST as roomStatusPOST } from "@/app/api/admin/room-status/route";

let pass = 0, fail = 0;
function ok(cond: unknown, name: string, extra?: unknown) {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ""); }
}

async function as(role: Role, sub: string) {
  const token = await createSessionToken({ sub, role, username: "kiem-thu", name: "Kiểm thử" });
  (globalThis as unknown as { __testCookies: Record<string, string> }).__testCookies = { [AUTH_COOKIE_NAME]: token };
}
async function api(serviceId: string, body: Record<string, unknown>) {
  const res = await stayPOST(new Request("http://x/api/admin/stay", { method: "POST", body: JSON.stringify({ serviceId, ...body }) }));
  const j = await res.json();
  return { status: res.status, ...j } as { status: number; error?: string; message?: string } & Awaited<ReturnType<typeof loadHome>>;
}
const cells = (roomId: string) => prisma.roomDayStatus.findMany({ where: { roomId }, orderBy: { date: "asc" } });

async function main() {
  const { today: T } = vnNow();
  const stamp = Date.now();
  const made = { bookings: [] as string[], users: [] as string[], service: "" };
  try {
    // ---------- dựng dữ liệu ----------
    const owner = await prisma.adminUser.create({ data: { username: `test-chu-${stamp}`, name: "Chủ thử", role: "PROVIDER", passwordHash: "x" } });
    made.users.push(owner.id);
    const svc = await prisma.service.create({
      data: { category: "HOMESTAY", slug: `test-stay-${stamp}`, title: "TEST Quản lý phòng", summary: "Kiểm thử", description: "Kiểm thử", area: "Tà Xùa", published: false, ownerId: owner.id, extraPersonFee: 100000, earlyCheckinFee: 100000, lateCheckoutFee: 150000 },
    });
    made.service = svc.id;
    const tDouble = await prisma.roomType.create({ data: { serviceId: svc.id, name: "Phòng đôi", capacity: 2, weekdayPrice: 0, weekendPrice: 0, totalRooms: 2 } });
    const tFam = await prisma.roomType.create({ data: { serviceId: svc.id, name: "Gia đình", capacity: 4, weekdayPrice: 0, weekendPrice: 0, totalRooms: 1, sortOrder: 1 } });
    const R1 = await prisma.room.create({ data: { roomTypeId: tDouble.id, name: "101", capacity: 2, listPrice: 500000, priceSat: 700000 } });
    const R2 = await prisma.room.create({ data: { roomTypeId: tDouble.id, name: "102", capacity: 2, listPrice: 500000, priceSat: 700000, sortOrder: 1 } });
    const R3 = await prisma.room.create({ data: { roomTypeId: tFam.id, name: "201", capacity: 4, maxCapacity: 5, listPrice: 900000 } });
    const S = svc.id;
    await as("ADMIN", owner.id);

    console.log("\n1. Đặt phòng tạo tay");
    let r = await api(S, { op: "createStay", name: "Nguyễn Thử", phone: "0912000001", ci: addDaysKey(T, 5), co: addDaysKey(T, 7), guests: 2, src: "Gọi điện", rooms: [R1.id] });
    ok(r.status === 200, "tạo lượt ở R1 chưa cọc", r.error);
    const st1 = r.stays?.find((s) => s.roomId === R1.id && s.state === null);
    ok(st1 && st1.holdUntil, "giữ chỗ có hạn tự nhả");
    let c1 = await cells(R1.id);
    ok(c1.length === 2 && c1.every((c) => c.status === "PENDING" && c.stayId === st1?.id), "2 đêm PENDING gắn stayId", c1.map((c) => c.status));
    ok(st1?.total === 1000000 || st1?.total === 1200000, "báo giá server theo giá phòng", st1?.total);

    r = await api(S, { op: "createStay", name: "Trùng Lịch", phone: "0912000002", ci: addDaysKey(T, 6), co: addDaysKey(T, 8), guests: 2, rooms: [R1.id] });
    ok(r.status === 400 && /bận/.test(r.error ?? ""), "chặn đặt trùng đêm", r.error);

    const [a, b] = await Promise.all([
      api(S, { op: "createStay", name: "Song Song A", phone: "0912000003", ci: addDaysKey(T, 10), co: addDaysKey(T, 12), guests: 2, rooms: [R2.id], dep: 200000 }),
      api(S, { op: "createStay", name: "Song Song B", phone: "0912000004", ci: addDaysKey(T, 11), co: addDaysKey(T, 13), guests: 2, rooms: [R2.id], dep: 200000 }),
    ]);
    ok([a.status, b.status].sort().join() === "200,400", "2 yêu cầu song song: đúng 1 thành công", [a.status, b.status, a.error, b.error]);

    console.log("\n2. Thu cọc ⇒ Đã đặt; web không giữ được phòng");
    r = await api(S, { op: "addPay", id: st1!.id, kind: "Cọc", amt: 300000, method: "Chuyển khoản" });
    ok(r.status === 200, "ghi cọc", r.error);
    c1 = await cells(R1.id);
    ok(c1.every((c) => c.status === "BOOKED"), "ô lịch chuyển BOOKED");
    ok(r.stays?.find((s) => s.id === st1!.id)?.holdUntil === null, "bỏ hạn tự nhả");
    const web1 = await prisma.bookingRequest.create({
      data: { code: `TEST-${stamp}-1`, category: "HOMESTAY", serviceId: S, serviceTitle: svc.title, customerName: "Khách Web", phone: "0912000009", useDate: parseDateOnly(addDaysKey(T, 5)), endDate: parseDateOnly(addDaysKey(T, 6)), roomTypeId: tDouble.id, roomId: R1.id, roomIds: [R1.id], status: "CONFIRMED" },
    });
    made.bookings.push(web1.id);
    let threw = false;
    try { await prisma.$transaction((tx) => assignRoomsForBooking(tx, web1, true)); } catch { threw = true; }
    ok(threw, "sàn chốt đơn vào đêm đã có lượt ở ⇒ báo trùng");
    await prisma.bookingRequest.update({ where: { id: web1.id }, data: { status: "CANCELLED" } });

    console.log("\n3. Đổi phòng / gia hạn / huỷ");
    r = await api(S, { op: "move", id: st1!.id, to: R3.id });
    ok(r.status === 200, "đổi R1 → R3", r.error);
    ok((await cells(R1.id)).length === 0 && (await cells(R3.id)).filter((c) => c.stayId === st1!.id).length === 2, "ô lịch chuyển theo phòng");
    const before = r.stays!.find((s) => s.id === st1!.id)!.total;
    r = await api(S, { op: "extend", id: st1!.id });
    const after = r.stays?.find((s) => s.id === st1!.id);
    ok(r.status === 200 && after?.co === addDaysKey(T, 8) && after.total > before, "gia hạn +1 đêm cộng tiền", [r.error, after?.co, before, after?.total]);
    r = await api(S, { op: "cancel", id: st1!.id, refund: "keep" });
    ok(r.status === 200 && (await prisma.roomDayStatus.count({ where: { stayId: st1!.id } })) === 0, "huỷ ⇒ nhả hết ô", r.error);

    console.log("\n4. Tự nhả giữ chỗ quá hạn");
    r = await api(S, { op: "createStay", name: "Giữ Chỗ", phone: "0912000005", ci: addDaysKey(T, 15), co: addDaysKey(T, 16), guests: 2, rooms: [R1.id] });
    const hold = r.stays!.find((s) => s.name === "Giữ Chỗ")!;
    await prisma.roomStay.update({ where: { id: hold.id }, data: { holdUntil: new Date(Date.now() - 60_000) } });
    const n = await releaseExpiredStayHolds(S);
    ok(n === 1 && (await prisma.roomStay.findUnique({ where: { id: hold.id } }))?.state === "cancel" && (await prisma.roomDayStatus.count({ where: { stayId: hold.id } })) === 0, "quá hạn ⇒ huỷ + nhả ô", n);

    console.log("\n5. Đóng / mở phòng");
    r = await api(S, { op: "close", rooms: [R3.id], from: addDaysKey(T, 20), to: addDaysKey(T, 22), reason: "Bảo trì" });
    ok(r.status === 200 && (await prisma.roomDayStatus.count({ where: { roomId: R3.id, status: "CLOSED", note: { startsWith: "PMS#c:" } } })) === 3, "đóng 3 ngày ⇒ 3 ô CLOSED", r.error);
    r = await api(S, { op: "createStay", name: "Vào Ngày Đóng", phone: "0912000006", ci: addDaysKey(T, 21), co: addDaysKey(T, 22), guests: 2, rooms: [R3.id] });
    ok(r.status === 400, "không đặt được ngày đóng", r.error);
    const closeId = (await prisma.homeClose.findFirst({ where: { serviceId: S } }))!.id;
    r = await api(S, { op: "reopen", id: closeId });
    ok(r.status === 200 && (await prisma.roomDayStatus.count({ where: { roomId: R3.id, status: "CLOSED" } })) === 0, "mở lại ⇒ xoá ô đóng", r.error);

    console.log("\n6. Nhận phòng / dịch vụ / trả phòng");
    r = await api(S, { op: "createStay", name: "Đang Ở", phone: "0912000007", ci: T, co: addDaysKey(T, 2), guests: 5, rooms: [R3.id], dep: 300000 });
    ok(r.status === 200, "tạo lượt ở hôm nay (5 khách / phòng 4 ⇒ phụ thu)", r.error);
    const inh = r.stays!.find((s) => s.name === "Đang Ở")!;
    ok(inh.total === 900000 * 2 + 100000 * 2 || inh.total > 1800000, "báo giá có phụ thu ở ghép", inh.total);
    r = await api(S, { op: "checkIn", id: inh.id, time: "10:00", guests: [{ name: "Đang Ở", cccd: "001099012345" }] });
    const inh2 = r.stays?.find((s) => s.id === inh.id);
    ok(r.status === 200 && inh2?.inAt && inh2.fees.some((f) => f.name === "Nhận phòng sớm"), "nhận phòng sớm ⇒ tự cộng phí", [r.error, inh2?.fees]);
    ok(inh2?.guestList[0]?.cccd === "001099012345", "lưu khách lưu trú + CCCD");
    r = await api(S, { op: "charge", id: inh.id, name: "Lẩu gà đen", amt: 450000 });
    ok(r.status === 200, "ghi dịch vụ vào phòng", r.error);
    const inhTotal = r.stays?.find((s) => s.id === inh.id)?.total;
    r = await api(S, { op: "checkOut", id: inh.id, late: true, early: true, method: "Tiền mặt" });
    const out = r.stays?.find((s) => s.id === inh.id);
    ok(out && !out.fees.some((f) => /sớm/i.test(f.name) && f.name !== "Nhận phòng sớm") && out.total === inhTotal, "trả sớm: không phí 'Trả sớm', tiền phòng giữ nguyên như đã đặt", [out?.fees, out?.total, inhTotal]);
    const billed = out ? out.total + out.fees.reduce((x, f) => x + f.amt, 0) : -1;
    const paidAll = out ? out.pays.reduce((x, p) => x + p.amt, 0) : -2;
    ok(r.status === 200 && out?.outAt && billed === paidAll, "trả phòng ⇒ thu đủ bill", [r.error, billed, paidAll]);
    ok(r.rooms?.find((x) => x.id === R3.id)?.hk === "dirty", "phòng chuyển Chưa dọn");
    ok(out?.co === addDaysKey(T, 1) && (await prisma.roomDayStatus.count({ where: { stayId: inh.id } })) === 1, "trả ngay ngày nhận (đặt 2 đêm) ⇒ giữ đêm nhận, nhả đêm sau", [out?.co]);

    console.log("\n7. Đơn web: chủ xác nhận ⇒ giữ phòng; sàn chốt; tiền một nguồn");
    const web2 = await prisma.bookingRequest.create({
      data: { code: `TEST-${stamp}-2`, category: "HOMESTAY", serviceId: S, serviceTitle: svc.title, customerName: "Khách Sàn", phone: "0912000010", useDate: parseDateOnly(addDaysKey(T, 30)), endDate: parseDateOnly(addDaysKey(T, 32)), roomTypeId: tDouble.id, roomId: R1.id, roomIds: [R1.id], referencePrice: 1000000, status: "NEW", adults: 2 },
    });
    made.bookings.push(web2.id);
    const home = await loadHome(S);
    ok(home.web.some((o) => o.id === web2.id), "đơn mới hiện ở tab Đơn web");
    r = await api(S, { op: "webConfirm", bookingId: web2.id, roomId: R2.id });
    ok(r.status === 200, "xác nhận còn phòng + xếp sang R2", r.error);
    let b2 = await prisma.bookingRequest.findUnique({ where: { id: web2.id } });
    ok(b2?.heldRoom && b2.roomIds[0] === R2.id, "đơn: heldRoom + đổi phòng", [b2?.heldRoom, b2?.roomIds]);
    ok((await prisma.roomDayStatus.count({ where: { bookingId: web2.id, roomId: R2.id, status: "PENDING" } })) === 2, "ô PENDING giữ hộ theo đơn");
    ok(r.stays?.some((s) => s.bookingId === web2.id && s.roomId === R2.id && s.state === null), "sinh lượt ở cho đơn sàn");
    ok(!r.web.some((o) => o.id === web2.id), "đơn rời tab Đơn web");
    let threw2 = false;
    try { await prisma.$transaction((tx) => assignRoomsForBooking(tx, b2!, true)); } catch (e) { threw2 = true; console.log("    ", (e as Error).message.split("\n")[0]); }
    ok(!threw2 && (await prisma.roomDayStatus.count({ where: { bookingId: web2.id, status: "BOOKED" } })) === 2, "sàn chốt: ô của chính đơn không bị tính trùng ⇒ BOOKED");
    await prisma.bookingRequest.update({ where: { id: web2.id }, data: { status: "CONFIRMED", amountCollected: 300000, paymentStatus: "DEPOSITED" } });
    await syncStaysForBooking(web2.id);
    const pays = await prisma.stayPayment.findMany({ where: { stay: { bookingId: web2.id } } });
    ok(pays.length === 1 && Number(pays[0].amount) === 300000 && pays[0].method === "Sàn thu hộ", "sàn đã thu ⇒ dòng Sàn thu hộ", pays.map((p) => [Number(p.amount), p.method]));
    const st2 = await prisma.roomStay.findFirst({ where: { bookingId: web2.id, state: null } });
    r = await api(S, { op: "addPay", id: st2!.id, kind: "Thu", amt: 100000, method: "Tiền mặt" });
    b2 = await prisma.bookingRequest.findUnique({ where: { id: web2.id } });
    ok(r.status === 200 && Number(b2?.amountCollected) === 400000 && b2?.paymentStatus === "DEPOSITED", "chủ thu thêm ⇒ đơn cập nhật đã thu", [r.error, Number(b2?.amountCollected)]);
    const logs = await prisma.bookingLog.count({ where: { bookingId: web2.id, kind: { in: ["SUPPLIER", "PAYMENT"] } } });
    ok(logs >= 2, "nhật ký đơn có SUPPLIER + PAYMENT", logs);
    await syncHomeBookings(S);
    await syncHomeBookings(S);
    ok((await prisma.stayPayment.count({ where: { stay: { bookingId: web2.id } } })) === 2, "đồng bộ lặp lại không nhân đôi sổ tiền");
    await prisma.$transaction(async (tx) => {
      const cur = await tx.bookingRequest.findUnique({ where: { id: web2.id } });
      await assignRoomsForBooking(tx, cur!, false);
      await tx.bookingRequest.update({ where: { id: web2.id }, data: { status: "CANCELLED" } });
    });
    await syncStaysForBooking(web2.id);
    ok((await prisma.roomStay.findFirst({ where: { bookingId: web2.id } }))?.state === "cancel" && (await prisma.roomDayStatus.count({ where: { bookingId: web2.id } })) === 0, "sàn huỷ ⇒ lượt ở huỷ, ô nhả");

    console.log("\n8. Đơn web bị từ chối / đơn chờ bị tự huỷ");
    const web3 = await prisma.bookingRequest.create({
      data: { code: `TEST-${stamp}-3`, category: "HOMESTAY", serviceId: S, serviceTitle: svc.title, customerName: "Khách Từ Chối", phone: "0912000011", useDate: parseDateOnly(addDaysKey(T, 40)), endDate: parseDateOnly(addDaysKey(T, 41)), roomTypeId: tDouble.id, roomId: R1.id, roomIds: [R1.id], status: "NEW" },
    });
    made.bookings.push(web3.id);
    r = await api(S, { op: "webReject", bookingId: web3.id, reason: "Hết phòng thực tế" });
    ok(r.status === 200 && !r.web.some((o) => o.id === web3.id), "từ chối ⇒ rời tab Đơn web", r.error);
    const web4 = await prisma.bookingRequest.create({
      data: { code: `TEST-${stamp}-4`, category: "HOMESTAY", serviceId: S, serviceTitle: svc.title, customerName: "Khách Chờ", phone: "0912000012", useDate: parseDateOnly(addDaysKey(T, 45)), endDate: parseDateOnly(addDaysKey(T, 46)), roomTypeId: tDouble.id, roomId: R1.id, roomIds: [R1.id], status: "NEW" },
    });
    made.bookings.push(web4.id);
    await api(S, { op: "webConfirm", bookingId: web4.id });
    await prisma.bookingRequest.update({ where: { id: web4.id }, data: { status: "CANCELLED" } }); // như tự huỷ quá giờ chưa cọc
    await syncStaysForBooking(web4.id);
    ok((await prisma.roomDayStatus.count({ where: { bookingId: web4.id } })) === 0, "đơn chờ đã xác nhận bị huỷ ⇒ nhả ô giữ hộ");

    console.log("\n9. Quyền & lưới tình trạng cũ");

    r = await api(S, { op: "createStay", name: "Khoá Lưới", phone: "0912000013", ci: addDaysKey(T, 50), co: addDaysKey(T, 51), guests: 2, rooms: [R1.id] });
    await as("PROVIDER", owner.id);
    const rs = await roomStatusPOST(new Request("http://x", { method: "POST", body: JSON.stringify({ roomId: R1.id, date: addDaysKey(T, 50), status: "AVAILABLE", force: true }) }));
    ok(rs.status === 409 && (await prisma.roomDayStatus.count({ where: { roomId: R1.id, stayId: { not: null } } })) === 1, "lưới cũ không gỡ được ô của Quản lý phòng", rs.status);
    const staff = await prisma.adminUser.create({ data: { username: `test-letan-${stamp}`, name: "Lễ tân thử", role: "STAFF", staffArea: "phong", providerId: owner.id, passwordHash: "x" } });
    made.users.push(staff.id);
    await as("STAFF", staff.id);
    r = await api(S, { op: "expense", cat: "Lương", amt: 100 });
    ok(r.status === 403, "lễ tân không ghi chi phí");
    r = await api(S, { op: "setHk", roomId: R3.id, hk: "clean" });
    ok(r.status === 200, "lễ tân đổi tình trạng dọn", r.error);
    ok(Array.isArray(r.exps) && r.exps.length === 0 && r.staff.length === 0, "lễ tân không nhận dữ liệu chi phí / tài khoản nhân viên");
    await prisma.adminUser.update({ where: { id: staff.id }, data: { active: false } });
    r = await api(S, { op: "setHk", roomId: R3.id, hk: "dirty" });
    ok(r.status === 403, "tài khoản bị khoá ⇒ mất quyền ngay");
    const other = await prisma.adminUser.create({ data: { username: `test-chu2-${stamp}`, name: "Chủ khác", role: "PROVIDER", passwordHash: "x" } });
    made.users.push(other.id);
    await as("PROVIDER", other.id);
    r = await api(S, { op: "setHk", roomId: R3.id, hk: "dirty" });
    ok(r.status === 403, "chủ khác không thao tác được");

    console.log("\n10. Sổ thu chi / chi phí");
    await as("PROVIDER", owner.id);
    r = await api(S, { op: "expense", cat: "Điện nước", amt: 1850000, note: "Tháng 10" });
    ok(r.status === 200 && r.exps.some((e) => e.amt === 1850000), "ghi khoản chi", r.error);
    r = await api(S, { op: "svcLog", roomId: R2.id, what: "Thay vòi sen", cost: 450000 });
    ok(r.status === 200 && r.logs.some((l) => l.what === "Thay vòi sen") && r.exps.some((e) => e.cat === "Sửa chữa" && e.amt === 450000), "sự cố có phí ⇒ cộng vào chi phí", r.error);
    r = await api(S, { op: "flag", phone: "0912000007", flag: "black" });
    ok(r.status === 200 && r.cfg.flags["0912000007"] === "black", "đưa vào danh sách đen");
    r = await api(S, { op: "saveCfg", patch: { ci: 13, hold: 4, flags: {} } });
    ok(r.status === 200 && r.cfg.ci === 13 && r.cfg.hold === 4 && r.cfg.flags["0912000007"] === "black", "lưu cài đặt, không ghi đè DS đen qua saveCfg");

    console.log("\n11. Hồi quy các lỗi rà soát");
    // a) sàn ghi đã thu > giá đơn ⇒ sổ phòng hội tụ, không thêm dòng mỗi lần đồng bộ
    const over = await prisma.bookingRequest.create({
      data: { code: `TEST-${stamp}-5`, category: "HOMESTAY", serviceId: S, serviceTitle: svc.title, customerName: "Thu Dư", phone: "0912000014", useDate: parseDateOnly(addDaysKey(T, 60)), endDate: parseDateOnly(addDaysKey(T, 61)), roomTypeId: tDouble.id, roomId: R2.id, roomIds: [R2.id], referencePrice: 800000, amountCollected: 1000000, paymentStatus: "PAID", status: "CONFIRMED" },
    });
    made.bookings.push(over.id);
    await prisma.$transaction((tx) => assignRoomsForBooking(tx, over, true));
    await syncStaysForBooking(over.id); await syncHomeBookings(S); await syncHomeBookings(S);
    const op = await prisma.stayPayment.findMany({ where: { stay: { bookingId: over.id } } });
    ok(op.length === 1 && Number(op[0].amount) === 1000000, "đã thu > giá đơn: 1 dòng Sàn thu hộ, không nhân lên", op.map((p) => Number(p.amount)));
    // b) từ chối đơn đã chốt ⇒ không bị hồi sinh khi đồng bộ
    const conf = await prisma.bookingRequest.create({
      data: { code: `TEST-${stamp}-6`, category: "HOMESTAY", serviceId: S, serviceTitle: svc.title, customerName: "Đã Chốt", phone: "0912000015", useDate: parseDateOnly(addDaysKey(T, 64)), endDate: parseDateOnly(addDaysKey(T, 65)), roomTypeId: tDouble.id, roomId: R1.id, roomIds: [R1.id], referencePrice: 500000, status: "CONFIRMED" },
    });
    made.bookings.push(conf.id);
    await prisma.$transaction((tx) => assignRoomsForBooking(tx, conf, true));
    await syncStaysForBooking(conf.id);
    r = await api(S, { op: "webReject", bookingId: conf.id, reason: "Giá đã đổi" });
    await syncHomeBookings(S); await syncStaysForBooking(conf.id);
    const after2 = await loadHome(S);
    ok(r.status === 200 && !after2.web.some((o) => o.id === conf.id) && !after2.stays.some((s) => s.bookingId === conf.id && s.state === null), "từ chối đơn đã chốt: không quay lại sau đồng bộ", r.error);
    // c) combo: trả phòng chỉ thu dịch vụ, không thu lại tiền phòng của sàn
    const combo = await prisma.bookingRequest.create({
      data: { code: `TEST-${stamp}-7`, category: "COMBO", serviceId: S, serviceTitle: svc.title, customerName: "Khách Combo", phone: "0912000016", useDate: parseDateOnly(T), endDate: parseDateOnly(addDaysKey(T, 1)), roomTypeId: tDouble.id, roomId: R1.id, roomIds: [R1.id], referencePrice: 2000000, roomAmount: 1200000, amountCollected: 1000000, paymentStatus: "DEPOSITED", status: "CONFIRMED" },
    });
    made.bookings.push(combo.id);
    await prisma.$transaction((tx) => assignRoomsForBooking(tx, combo, true));
    await syncStaysForBooking(combo.id);
    const cs = await prisma.roomStay.findFirst({ where: { bookingId: combo.id, state: null } });
    await api(S, { op: "checkIn", id: cs!.id, time: "15:00", guests: [] });
    await api(S, { op: "charge", id: cs!.id, name: "BBQ", amt: 200000 });
    r = await api(S, { op: "checkOut", id: cs!.id, method: "Tiền mặt" });
    const cp = await prisma.stayPayment.findMany({ where: { stayId: cs!.id, method: { not: "Sàn thu hộ" } } });
    ok(r.status === 200 && cp.length === 1 && Number(cp[0].amount) === 200000, "combo: trả phòng chỉ thu 200.000đ dịch vụ", [r.error, cp.map((p) => Number(p.amount))]);
    // d) đóng phòng ghi đè dòng AVAILABLE sót lại
    await prisma.roomDayStatus.create({ data: { roomId: R2.id, date: parseDateOnly(addDaysKey(T, 70)), status: "AVAILABLE" } });
    r = await api(S, { op: "close", rooms: [R2.id], from: addDaysKey(T, 70), to: addDaysKey(T, 70), reason: "Chủ dùng" });
    ok(r.status === 200 && (await prisma.roomDayStatus.findFirst({ where: { roomId: R2.id, date: parseDateOnly(addDaysKey(T, 70)) } }))?.status === "CLOSED", "đóng phòng ghi đè dòng Trống sót lại", r.error);
    // e) sàn ép xác nhận đè ô lượt ở ⇒ ô thuộc hẳn về đơn; huỷ lượt ở không xoá đêm của đơn
    r = await api(S, { op: "createStay", name: "Bị Đè", phone: "0912000017", ci: addDaysKey(T, 75), co: addDaysKey(T, 76), guests: 2, rooms: [R2.id] });
    const vic = r.stays!.find((s) => s.name === "Bị Đè")!;
    const forced = await prisma.bookingRequest.create({
      data: { code: `TEST-${stamp}-8`, category: "HOMESTAY", serviceId: S, serviceTitle: svc.title, customerName: "Ép Đè", phone: "0912000018", useDate: parseDateOnly(addDaysKey(T, 75)), endDate: parseDateOnly(addDaysKey(T, 76)), roomTypeId: tDouble.id, roomId: R2.id, roomIds: [R2.id], status: "CONFIRMED" },
    });
    made.bookings.push(forced.id);
    await prisma.$transaction((tx) => assignRoomsForBooking(tx, forced, true, { force: true }));
    await api(S, { op: "cancel", id: vic.id });
    const fc = await prisma.roomDayStatus.findFirst({ where: { roomId: R2.id, date: parseDateOnly(addDaysKey(T, 75)) } });
    ok(fc?.bookingId === forced.id && fc.stayId === null && fc.status === "BOOKED", "ô bị ép đè thuộc đơn, huỷ lượt ở không mất đêm", fc);

    console.log("\n12. Hồi quy rà soát vòng 2");
    // a) tiền đoàn (thuần): phòng đã trả nhận đủ phần mình, phòng trả sau không bị thu thiếu
    const vm = (id: string, total: number, paid: number, extra: Partial<StayVM> = {}): StayVM => ({
      id, code: id, roomId: id, bookingId: null, bookingCode: null, combo: false, payBlock: "", groupId: "g", groupName: "Đoàn", name: "A", phone: "0912000000",
      guests: 2, guestList: [], ci: T, co: addDaysKey(T, 1), total, src: "Gọi điện", note: "", state: null, holdUntil: null, inAt: `${T} 14:00`, outAt: null,
      fees: [], pays: paid ? [{ id: id + "p", at: `${T} 10:00`, amt: paid, method: "Tiền mặt", kind: "Cọc", by: "" }] : [], comm: 0, ...extra,
    });
    let g3 = [vm("A", 1000000, 1000000), vm("B", 1000000, 0), vm("C", 1000000, 0)];
    let paidTotal = 1000000;
    for (const id of ["A", "B", "C"]) {
      const me = g3.find((s) => s.id === id)!;
      const due = billOf(me) - paidOf(me, g3);
      paidTotal += due;
      g3 = g3.map((s) => (s.id === id ? { ...s, outAt: `${T} 11:00`, pays: [...s.pays, { id: id + "q", at: "", amt: due, method: "Tiền mặt", kind: "Thu khi trả", by: "" }] } : s));
    }
    ok(paidTotal === 3000000, "đoàn 3 phòng trả lần lượt ⇒ thu đủ 3.000.000đ", paidTotal);
    const g2 = [vm("A", 1000000, 600000, { state: "cancel" }), vm("B", 1000000, 0)];
    ok(paidOf(g2[1], g2) === 600000, "huỷ phòng đang giữ cọc đoàn ⇒ cọc vẫn tính cho đoàn", paidOf(g2[1], g2));

    // b) đoàn chủ tạo qua API: trả từng phòng ⇒ tổng thu = tổng bill
    r = await api(S, { op: "createStay", name: "Đoàn Trả Lần Lượt", phone: "0912000019", ci: addDaysKey(T, 80), co: addDaysKey(T, 81), guests: 4, rooms: [R1.id, R2.id], override: 2000000, dep: 1000000 });
    ok(r.status === 200, "tạo đoàn 2 phòng cọc 1.000.000đ", r.error);
    const grp = r.stays!.filter((s) => s.name === "Đoàn Trả Lần Lượt");
    await prisma.roomStay.updateMany({ where: { id: { in: grp.map((s) => s.id) } }, data: { checkedInAt: new Date() } });
    for (const s of grp) await api(S, { op: "checkOut", id: s.id, method: "Tiền mặt" });
    const gp = await prisma.stayPayment.aggregate({ where: { stayId: { in: grp.map((s) => s.id) } }, _sum: { amount: true } });
    ok(Number(gp._sum.amount) === 2000000, "đoàn trả từng phòng ⇒ đã thu đúng 2.000.000đ", Number(gp._sum.amount));

    // c) combo nhiều phòng: trả phòng chỉ thu phụ thu, không hoàn nhầm tiền phòng sàn thu
    const combo2 = await prisma.bookingRequest.create({
      data: { code: `TEST-${stamp}-9`, category: "COMBO", serviceId: S, serviceTitle: svc.title, customerName: "Combo Hai Phòng", phone: "0912000020", useDate: parseDateOnly(addDaysKey(T, 85)), endDate: parseDateOnly(addDaysKey(T, 86)), roomTypeId: tDouble.id, roomId: R1.id, roomIds: [R1.id, R2.id], referencePrice: 2000000, roomAmount: 1200000, amountCollected: 2000000, paymentStatus: "PAID", status: "CONFIRMED", adults: 4 },
    });
    made.bookings.push(combo2.id);
    await prisma.$transaction((tx) => assignRoomsForBooking(tx, combo2, true));
    await syncStaysForBooking(combo2.id);
    const cst = await prisma.roomStay.findMany({ where: { bookingId: combo2.id, state: null }, include: { payments: true } });
    await prisma.roomStay.updateMany({ where: { id: { in: cst.map((s) => s.id) } }, data: { checkedInAt: new Date() } });
    const plain = cst.find((s) => !s.payments.length)!; // phòng không mang dòng "Sàn thu hộ"
    ok(cst.length === 2 && !!plain, "combo 2 phòng sinh 2 lượt ở (1 phòng mang dòng Sàn thu hộ)", cst.map((s) => s.payments.length));
    r = await api(S, { op: "checkOut", id: plain.id, dmg: 200000, method: "Tiền mặt" });
    const cp2 = await prisma.stayPayment.findMany({ where: { stayId: plain.id, method: { not: "Sàn thu hộ" } } });
    ok(r.status === 200 && cp2.length === 1 && Number(cp2[0].amount) === 200000, "combo 2 phòng: trả phòng thu đúng 200.000đ phụ thu", [r.error, cp2.map((p) => Number(p.amount))]);

    // d) "Không đến" trước ngày nhận bị chặn (lễ tân không lách được quyền huỷ)
    r = await api(S, { op: "createStay", name: "Chưa Tới", phone: "0912000021", ci: addDaysKey(T, 90), co: addDaysKey(T, 91), guests: 2, rooms: [R3.id] });
    const fut = r.stays!.find((s) => s.name === "Chưa Tới")!;
    r = await api(S, { op: "noShow", id: fut.id });
    ok(r.status === 400 && (await prisma.roomDayStatus.count({ where: { stayId: fut.id } })) === 1, "không đến trước ngày nhận ⇒ chặn, ô còn giữ", r.error);

    // e) bấm trả phòng 2 lần song song ⇒ chỉ ghi thu 1 lần
    r = await api(S, { op: "createStay", name: "Bấm Đúp", phone: "0912000022", ci: addDaysKey(T, 95), co: addDaysKey(T, 96), guests: 2, rooms: [R3.id] });
    const dbl = r.stays!.find((s) => s.name === "Bấm Đúp")!;
    await prisma.roomStay.update({ where: { id: dbl.id }, data: { checkedInAt: new Date() } });
    const [o1, o2] = await Promise.all([api(S, { op: "checkOut", id: dbl.id, method: "Tiền mặt" }), api(S, { op: "checkOut", id: dbl.id, method: "Tiền mặt" })]);
    const dp = await prisma.stayPayment.count({ where: { stayId: dbl.id } });
    ok([o1.status, o2.status].sort().join() === "200,400" && dp === 1, "trả phòng song song ⇒ 1 lần thu", [o1.status, o2.status, dp]);

    // f) xoá khoản chi không cần gửi số tiền
    r = await api(S, { op: "expense", cat: "Khác", amt: 12345, note: "xoá thử" });
    const exId = r.exps.find((e) => e.amt === 12345)!.id;
    r = await api(S, { op: "expense", deleteId: exId });
    ok(r.status === 200 && !r.exps.some((e) => e.id === exId), "xoá khoản chi", r.error);

    console.log("\n13. Một hệ giá lễ (lịch lễ chung + Room.holidayPrice)");
    await as("PROVIDER", owner.id);
    // a) thuần: đêm lễ + phòng có giá lễ ⇒ giá lễ; phòng không có giá lễ ⇒ giá thường
    const rv = (id: string, hol: number): HomeRoomVM => ({ id, name: id, typeId: "t", cap: 2, max: 2, hk: "clean", dow: [600000, 500000, 500000, 500000, 500000, 500000, 700000], hol });
    const hk = addDaysKey(T, 3);
    ok(nightPrice(rv("a", 1500000), hk, [hk]) === 1500000 && nightPrice(rv("b", 0), hk, [hk]) === rv("b", 0).dow[new Date(hk + "T00:00:00Z").getUTCDay()], "nightPrice: giá lễ chỉ khi đêm lễ VÀ phòng có giá lễ");
    const q2 = quoteStay([rv("a", 1500000), rv("b", 0)], hk, addDaysKey(hk, 1), 4, [hk], 100000);
    ok(q2.base === 1500000 + rv("b", 0).dow[new Date(hk + "T00:00:00Z").getUTCDay()] && q2.hols.join() === hk, "quoteStay theo khoá lễ", q2);
    const oldCfg = normalizeHomeConfig({ hols: [hk], holPct: 50, ci: 13 }) as unknown as Record<string, unknown>;
    ok(!("hols" in oldCfg) && !("holPct" in oldCfg) && oldCfg.ci === 13, "normalizeHomeConfig bỏ qua hols/holPct cũ", oldCfg);
    // b) server: cấu hình cũ còn hols/holPct không làm đổi giá; ngày lễ thật trong lịch chung ⇒ giá lễ của phòng
    const R4 = await prisma.room.create({ data: { roomTypeId: tFam.id, name: "301", capacity: 4, listPrice: 800000, holidayPrice: 2000000, sortOrder: 5 } });
    const freeDay = addDaysKey(T, 200);
    await prisma.homeConfig.upsert({ where: { serviceId: S }, create: { serviceId: S, data: { hols: [freeDay], holPct: 100 } }, update: { data: { hols: [freeDay], holPct: 100 } } });
    const holKeysAll = holidayKeysBetween(await getHolidays(), addDaysKey(T, 2), addDaysKey(T, 700));
    let nonHol = freeDay;
    while (holKeysAll.includes(nonHol)) nonHol = addDaysKey(nonHol, 1);
    r = await api(S, { op: "createStay", name: "Giá Thường", phone: "0912000031", ci: nonHol, co: addDaysKey(nonHol, 1), guests: 2, rooms: [R4.id] });
    ok(r.status === 200 && r.stays.find((s) => s.name === "Giá Thường")?.total === 800000 && !("hols" in r.cfg), "đêm không lễ: giá thường (bỏ qua phụ thu lễ cũ trong cấu hình)", [r.error, r.stays?.find((s) => s.name === "Giá Thường")?.total]);
    ok(Array.isArray(r.holKeys) && Array.isArray(r.holidays), "dữ liệu trang có holKeys + holidays từ lịch chung");
    if (holKeysAll.length) {
      const hd = holKeysAll[0];
      r = await api(S, { op: "createStay", name: "Giá Lễ", phone: "0912000032", ci: hd, co: addDaysKey(hd, 1), guests: 2, rooms: [R4.id] });
      ok(r.status === 200 && r.stays.find((s) => s.name === "Giá Lễ")?.total === 2000000 && r.holKeys.includes(hd), `đêm lễ ${hd} (lịch chung): giá lễ của phòng`, [r.error, r.stays?.find((s) => s.name === "Giá Lễ")?.total]);
    } else console.log("    (lịch lễ chung chưa có ngày nào trong 700 ngày tới — bỏ qua ca giá lễ qua route; không sửa SiteSetting thật)");
    // Lịch lễ GIẢ trong bộ nhớ (thay hàm đọc SiteSetting của prisma trong tiến trình test — không ghi DB thật) ⇒ thử đường route.
    const fakeHol = addDaysKey(T, 205);
    const ss = prisma.siteSetting as unknown as { findUnique: (a: { where: { key: string } }) => Promise<unknown> };
    const origFind = ss.findUnique.bind(ss);
    let patched = false;
    try {
      ss.findUnique = (a) => (a?.where?.key === "holidays" ? Promise.resolve({ key: "holidays", value: JSON.stringify([{ name: "Lễ thử", from: fakeHol, to: fakeHol, yearly: false }]) }) : origFind(a));
      patched = (await getHolidays()).some((h) => h.from === fakeHol);
    } catch { patched = false; }
    if (patched) {
      r = await api(S, { op: "createStay", name: "Lễ Giả", phone: "0912000043", ci: addDaysKey(fakeHol, -1), co: addDaysKey(fakeHol, 1), guests: 2, rooms: [R4.id, R1.id] });
      const lg = r.stays?.filter((s) => s.name === "Lễ Giả") ?? [];
      const r1Night = (d: string) => (new Date(d + "T00:00:00Z").getUTCDay() === 6 ? 700000 : 500000);
      ok(r.status === 200 && lg.reduce((a, s) => a + s.total, 0) === 800000 + 2000000 + r1Night(addDaysKey(fakeHol, -1)) + r1Night(fakeHol) && r.holKeys.includes(fakeHol), "route: đêm lễ ⇒ phòng có giá lễ tính giá lễ, phòng không có giá lễ giữ giá thường", [r.error, lg.map((s) => s.total)]);
      const e0 = lg.find((s) => s.roomId === R4.id)!;
      r = await api(S, { op: "extend", id: e0.id });
      ok(r.status === 200 && r.stays.find((s) => s.id === e0.id)?.total === e0.total + 800000, "gia hạn đêm thường sau lễ ⇒ +giá thường", r.error);
    } else console.log("    (không thay được hàm đọc lịch lễ — bỏ qua ca route giá lễ)");
    ss.findUnique = origFind;
    const hk3 = await holKeysFor(freeDay, addDaysKey(freeDay, 3), [{ name: "Lễ thử", from: addDaysKey(freeDay, 1), to: addDaysKey(freeDay, 5), yearly: false }]);
    ok(hk3.join() === [addDaysKey(freeDay, 1), addDaysKey(freeDay, 2)].join(), "holKeysFor: chỉ các đêm trong [nhận, trả) rơi vào lịch lễ", hk3);

    console.log("\n14. Huỷ / không đến khi đã thu: hoàn cọc hoặc giữ cọc");
    r = await api(S, { op: "createStay", name: "Huỷ Hoàn", phone: "0912000033", ci: addDaysKey(T, 210), co: addDaysKey(T, 211), guests: 2, rooms: [R4.id], dep: 300000 });
    const hh1 = r.stays.find((s) => s.name === "Huỷ Hoàn")!;
    r = await api(S, { op: "cancel", id: hh1.id });
    ok(r.status === 400 && /Hoàn cọc|Giữ cọc/.test(r.error ?? "") && (await prisma.roomStay.findUnique({ where: { id: hh1.id } }))?.state === null, "có cọc mà không chọn ⇒ chặn, chưa huỷ", r.error);
    r = await api(S, { op: "cancel", id: hh1.id, refund: "refund", method: "Chuyển khoản" });
    const hp = await prisma.stayPayment.findMany({ where: { stayId: hh1.id } });
    ok(r.status === 200 && hp.length === 2 && hp.reduce((a, p) => a + Number(p.amount), 0) === 0 && hp.some((p) => Number(p.amount) === -300000 && /Hoàn cọc/.test(p.kind)), "Hoàn cọc ⇒ dòng hoàn −300.000đ", [r.error, hp.map((p) => [Number(p.amount), p.kind])]);
    ok((await prisma.roomDayStatus.count({ where: { stayId: hh1.id } })) === 0, "huỷ có hoàn ⇒ vẫn nhả ô");
    r = await api(S, { op: "createStay", name: "Huỷ Giữ", phone: "0912000034", ci: addDaysKey(T, 212), co: addDaysKey(T, 213), guests: 2, rooms: [R4.id], dep: 400000 });
    const hk1 = r.stays.find((s) => s.name === "Huỷ Giữ")!;
    r = await api(S, { op: "cancel", id: hk1.id, refund: "keep" });
    const hkRow = await prisma.roomStay.findUnique({ where: { id: hk1.id }, include: { payments: true } });
    ok(r.status === 200 && hkRow?.state === "cancel" && /Giữ cọc khi huỷ: 400\.000đ/.test(hkRow.note ?? "") && hkRow.payments.length === 1 && Number(hkRow.payments[0].amount) === 400000, "Giữ cọc ⇒ tiền giữ nguyên, ghi chú rõ", [r.error, hkRow?.note]);
    r = await api(S, { op: "createStay", name: "Huỷ Không Tiền", phone: "0912000035", ci: addDaysKey(T, 214), co: addDaysKey(T, 215), guests: 2, rooms: [R4.id] });
    r = await api(S, { op: "cancel", id: r.stays.find((s) => s.name === "Huỷ Không Tiền")!.id });
    ok(r.status === 200, "không có tiền ⇒ huỷ thẳng, không hỏi", r.error);
    r = await api(S, { op: "createStay", name: "Đoàn Huỷ", phone: "0912000036", ci: addDaysKey(T, 216), co: addDaysKey(T, 217), guests: 4, rooms: [R1.id, R4.id], dep: 500000 });
    const dg = r.stays.filter((s) => s.name === "Đoàn Huỷ");
    const lead = dg.find((s) => s.pays.length)!, rest = dg.find((s) => !s.pays.length)!;
    r = await api(S, { op: "cancel", id: lead.id });
    ok(r.status === 200, "huỷ 1 phòng đoàn (còn phòng khác) ⇒ không hỏi, cọc vẫn tính cho đoàn", r.error);
    r = await api(S, { op: "cancel", id: rest.id });
    ok(r.status === 400 && /500\.000đ/.test(r.error ?? ""), "huỷ phòng cuối của đoàn ⇒ hỏi hoàn/giữ tiền cả đoàn", r.error);
    r = await api(S, { op: "cancel", id: rest.id, refund: "refund" });
    const dgp = await prisma.stayPayment.aggregate({ where: { stayId: { in: dg.map((s) => s.id) } }, _sum: { amount: true } });
    ok(r.status === 200 && Number(dgp._sum.amount) === 0, "hoàn cọc đoàn ⇒ tổng sổ = 0", [r.error, Number(dgp._sum.amount)]);
    ok(cancelMoney("x", [{ id: "x", state: null, pays: [{ amt: 300000, method: "Sàn thu hộ" }, { amt: 100000, method: "Tiền mặt" }] }]) === 100000, "cancelMoney không tính dòng Sàn thu hộ");

    console.log("\n15. Sửa lượt ở");
    r = await api(S, { op: "createStay", name: "Sửa Thử", phone: "0912000037", ci: addDaysKey(T, 220), co: addDaysKey(T, 222), guests: 2, rooms: [R4.id] });
    const ed = r.stays.find((s) => s.name === "Sửa Thử")!;
    r = await api(S, { op: "edit", id: ed.id, name: "Sửa Rồi", phone: "0912000038", cccd: "001099000111", guests: 3, note: "ghi chú mới", src: "Zalo", ci: addDaysKey(T, 221), co: addDaysKey(T, 224) });
    let e1 = r.stays?.find((s) => s.id === ed.id);
    const ec = await prisma.roomDayStatus.findMany({ where: { stayId: ed.id }, orderBy: { date: "asc" } });
    ok(r.status === 200 && e1?.name === "Sửa Rồi" && e1.phone === "0912000038" && e1.guests === 3 && e1.src === "Zalo" && e1.note === "ghi chú mới" && e1.guestList[0]?.cccd === "001099000111", "sửa tên / SĐT / CCCD / số khách / nguồn / ghi chú", [r.error, e1]);
    ok(e1?.ci === addDaysKey(T, 221) && e1.co === addDaysKey(T, 224) && ec.length === 3 && ec[0].date.toISOString().slice(0, 10) === addDaysKey(T, 221), "đổi ngày ⇒ ghi lại ô lịch đúng 3 đêm mới", ec.map((c) => c.date.toISOString().slice(0, 10)));
    ok(e1?.total === 3 * 800000, "đổi ngày ⇒ server báo giá lại (3 đêm)", e1?.total);
    r = await api(S, { op: "edit", id: ed.id, total: 2000000 });
    ok(r.status === 200 && r.stays.find((s) => s.id === ed.id)?.total === 2000000, "sửa tay tổng tiền", r.error);
    r = await api(S, { op: "createStay", name: "Chặn Đường", phone: "0912000039", ci: addDaysKey(T, 226), co: addDaysKey(T, 227), guests: 2, rooms: [R4.id] });
    r = await api(S, { op: "edit", id: ed.id, co: addDaysKey(T, 227) });
    ok(r.status === 400 && /bận/.test(r.error ?? "") && (await prisma.roomDayStatus.count({ where: { stayId: ed.id } })) === 3, "kéo dài vào đêm đã có khách ⇒ chặn, ô giữ nguyên", r.error);
    // đã nhận phòng: chỉ đổi ngày trả
    r = await api(S, { op: "createStay", name: "Đang Ở Sửa", phone: "0912000040", ci: T, co: addDaysKey(T, 3), guests: 2, rooms: [R4.id], dep: 100000 });
    const ei = r.stays.find((s) => s.name === "Đang Ở Sửa")!;
    await api(S, { op: "checkIn", id: ei.id, time: "15:00", guests: [] });
    r = await api(S, { op: "edit", id: ei.id, ci: addDaysKey(T, 1) });
    ok(r.status === 400, "đã nhận phòng ⇒ không đổi ngày nhận", r.error);
    r = await api(S, { op: "edit", id: ei.id, co: addDaysKey(T, 2) });
    ok(r.status === 200 && r.stays.find((s) => s.id === ei.id)?.co === addDaysKey(T, 2) && (await prisma.roomDayStatus.count({ where: { stayId: ei.id } })) === 2, "đã nhận phòng ⇒ rút ngày trả, nhả đêm thừa", r.error);
    await api(S, { op: "checkOut", id: ei.id, method: "Tiền mặt" });
    r = await api(S, { op: "edit", id: ei.id, note: "x" });
    ok(r.status === 400, "đã trả phòng ⇒ không sửa được", r.error);
    // lễ tân được sửa
    await prisma.adminUser.update({ where: { id: staff.id }, data: { active: true } });
    await as("STAFF", staff.id);
    r = await api(S, { op: "edit", id: ed.id, note: "lễ tân sửa" });
    ok(r.status === 200 && r.stays.find((s) => s.id === ed.id)?.note === "lễ tân sửa", "lễ tân dùng được Sửa", r.error);
    await as("PROVIDER", owner.id);
    // đơn sàn: chỉ SĐT / CCCD / ghi chú
    const pf = await prisma.bookingRequest.create({
      data: { code: `TEST-${stamp}-10`, category: "HOMESTAY", serviceId: S, serviceTitle: svc.title, customerName: "Sàn Sửa", phone: "0912000041", useDate: parseDateOnly(addDaysKey(T, 230)), endDate: parseDateOnly(addDaysKey(T, 231)), roomTypeId: tFam.id, roomId: R4.id, roomIds: [R4.id], referencePrice: 800000, status: "CONFIRMED", note: "ghi chú khách" },
    });
    made.bookings.push(pf.id);
    await prisma.$transaction((tx) => assignRoomsForBooking(tx, pf, true));
    await syncStaysForBooking(pf.id);
    const pst = (await prisma.roomStay.findFirst({ where: { bookingId: pf.id, state: null } }))!;
    r = await api(S, { op: "edit", id: pst.id, co: addDaysKey(T, 232) });
    ok(r.status === 400, "đơn sàn ⇒ không đổi ngày", r.error);
    r = await api(S, { op: "edit", id: pst.id, total: 100000 });
    ok(r.status === 400, "đơn sàn ⇒ không sửa giá", r.error);
    r = await api(S, { op: "edit", id: pst.id, phone: "0912000042", cccd: "001099000222", note: "chủ nhà ghi" });
    await syncStaysForBooking(pf.id); await syncHomeBookings(S);
    const pst2 = await prisma.roomStay.findUnique({ where: { id: pst.id } });
    const pfb = await prisma.bookingRequest.findUnique({ where: { id: pf.id } });
    ok(r.status === 200 && pst2?.phone === "0912000042" && pfb?.phone === "0912000042" && pst2?.note === "chủ nhà ghi", "đơn sàn: sửa SĐT (lên cả đơn) + ghi chú, đồng bộ không đổi ngược", [r.error, pst2?.phone, pfb?.phone, pst2?.note]);

    console.log("\n16. Khu nhân viên (staffArea)");
    const fleetStaff = await prisma.adminUser.create({ data: { username: `test-nvxe-${stamp}`, name: "NV xe thử", role: "STAFF", providerId: owner.id, passwordHash: "x" } });
    made.users.push(fleetStaff.id);
    await as("STAFF", fleetStaff.id);
    r = await api(S, { op: "setHk", roomId: R3.id, hk: "clean" });
    ok(r.status === 403, "nhân viên xe (staffArea null) không vào được Quản lý phòng", r.status);
    await as("PROVIDER", owner.id);
    r = await api(S, { op: "staffCreate", name: "Lễ tân mới", username: `test-letan2-${stamp}`, password: "123456" });
    const newStaff = await prisma.adminUser.findUnique({ where: { username: `test-letan2-${stamp}` } });
    if (newStaff) made.users.push(newStaff.id);
    ok(r.status === 200 && newStaff?.staffArea === "phong", "staffCreate ⇒ staffArea phong", [r.error, newStaff?.staffArea]);
    ok(!r.staff.some((u) => u.id === fleetStaff.id) && r.staff.some((u) => u.id === newStaff?.id), "danh sách nhân viên chỉ gồm lễ tân phòng");
    r = await api(S, { op: "staffToggle", id: fleetStaff.id });
    ok(r.status === 400 && (await prisma.adminUser.findUnique({ where: { id: fleetStaff.id } }))?.active === true, "không khoá được nhân viên xe từ Quản lý phòng", r.error);
    r = await api(S, { op: "staffDelete", id: fleetStaff.id });
    ok(r.status === 400 && !!(await prisma.adminUser.findUnique({ where: { id: fleetStaff.id } })), "không xoá được nhân viên xe từ Quản lý phòng", r.error);
  } finally {
    // ---------- dọn ----------
    if (made.bookings.length) {
      await prisma.bookingLog.deleteMany({ where: { bookingId: { in: made.bookings } } });
      await prisma.bookingRequest.deleteMany({ where: { id: { in: made.bookings } } });
    }
    if (made.service) await prisma.service.delete({ where: { id: made.service } }).catch((e) => console.error("dọn service lỗi", e));
    if (made.users.length) await prisma.adminUser.deleteMany({ where: { id: { in: made.users } } });
    console.log(`\nKết quả: ${pass} đạt · ${fail} lỗi`);
    await prisma.$disconnect();
    process.exit(fail ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
