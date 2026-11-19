/**
 * Kiểm thử luồng đặt xe máy ↔ đội xe (không cần dev server). Tạo nhà xe THỬ riêng, chạy các ca, rồi dọn sạch.
 * Chạy: npx tsx --tsconfig scripts/tsconfig.route-test.json --env-file=.env scripts/tmp-fleet-flow-test.ts
 * (route-test: stub next/headers để gọi thẳng POST /api/admin/fleet với cookie phiên ký sẵn.)
 */
import { PrismaClient } from "@prisma/client";
import { bookingInputSchema } from "../src/lib/validation";
import { computeAvailability, createBooking } from "../src/lib/booking";
import { assignComboBikeService, canManageFleet, comboBikeAssignInfo, fleetFreeByWebType, loadFleet, pushFleetPayments, releaseExpiredHolds, syncFleetBookings, syncFleetForBooking } from "../src/lib/fleet";
import { KEEP_FEE, isVehicleFree, rentalStatus, suggestDeposit } from "../src/lib/fleet-core";
import { getRentalBikes } from "../src/lib/queries";
import { AUTH_COOKIE_NAME, createSessionToken } from "../src/lib/auth-token";
import { POST as fleetPOST } from "../src/app/api/admin/fleet/route";

const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const key = (n: number) => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10);

async function main() {
  const svc = await prisma.service.create({ data: { slug: "test-fleet-" + Date.now(), category: "MOTORBIKE", title: "TEST đội xe", summary: "t", description: "t", published: true } });
  const rv = await prisma.rentalVehicle.create({ data: { serviceId: svc.id, vehicleType: "TEST Wave", pricePerDay: 150000, totalUnits: 5 } });
  const bookingIds: string[] = [];
  const extraSvcIds: string[] = [];
  const ownerIds: string[] = [];
  try {
    const D1 = key(5), D2 = key(6);
    // Chưa có đội xe ⇒ không ghi đè lịch tồn cũ.
    ok((await fleetFreeByWebType([svc.id], D1, D2)).size === 0, "Chưa có đội xe → dùng lịch tồn cũ");
    await prisma.fleetConfig.create({ data: { serviceId: svc.id, data: { webSync: false } } });
    const [v1, v2] = await Promise.all(["99Z9-111.01", "99Z9-111.02"].map((plate) => prisma.fleetVehicle.create({ data: { serviceId: svc.id, name: "TEST Wave", plate, kind: "so", pricePerDay: 150000, rentalVehicleId: rv.id } })));
    ok((await fleetFreeByWebType([svc.id], D1, D2)).size === 0, "Có xe nhưng chưa bật đồng bộ → web vẫn dùng lịch tồn cũ");
    await prisma.fleetConfig.update({ where: { serviceId: svc.id }, data: { data: { webSync: true } } });
    ok((await fleetFreeByWebType([svc.id], D1, D2)).get(rv.id)?.free === 2, "Bật đồng bộ, có 2 xe → còn 2 xe");

    const input = (qty: number, s = D1, e = D2, name = "Khách Thử") =>
      bookingInputSchema.parse({ serviceId: svc.id, useDate: s, endDate: e, quantity: qty, rentalVehicleId: rv.id, customerName: name, phone: "0386274915" });
    const r1 = await createBooking(input(1));
    const b1 = await prisma.bookingRequest.findUniqueOrThrow({ where: { code: r1.code } });
    bookingIds.push(b1.id);
    const fr1 = await prisma.fleetRental.findMany({ where: { bookingId: b1.id } });
    ok(fr1.length === 1 && fr1[0].webPending, "Khách đặt 1 xe → tự xếp 1 xe, chờ duyệt", fr1.map((r) => r.vehicleId === v1.id ? "xe1" : "xe2").join());
    ok((await fleetFreeByWebType([svc.id], D1, D2)).get(rv.id)?.free === 1, "Sau đơn 1 → còn 1 xe");

    let err = "";
    try { await createBooking(input(2, D1, D2, "Khách 2")); } catch (e) { err = (e as Error).message; }
    ok(err.includes("Chỉ còn 1 xe"), "Đặt 2 xe khi chỉ còn 1 → bị chặn", err);

    const av = await computeAvailability(svc.id, D1, D2, 1);
    const opt = av?.stayOptions?.find((o) => o.id === rv.id);
    ok(opt?.availableUnits === 1 && opt.bookable === true, "Form đặt hiện còn 1 xe, đặt được", `units=${opt?.availableUnits} status=${opt?.status}`);
    const cards = await getRentalBikes(D1, D2);
    const card = cards.find((c) => c.id === rv.id);
    ok(card?.available === 1, "Trang danh sách xe máy hiện còn 1 xe", `available=${card?.available} state=${card?.state}`);

    // Admin sửa đơn: tăng lên 2 xe.
    await prisma.bookingRequest.update({ where: { id: b1.id }, data: { quantity: 2 } });
    await syncFleetForBooking(b1.id);
    let alive = await prisma.fleetRental.findMany({ where: { bookingId: b1.id, state: null } });
    ok(alive.length === 2, "Admin tăng lên 2 xe → tự xếp thêm 1 xe");
    // Giảm lại 1 xe.
    await prisma.bookingRequest.update({ where: { id: b1.id }, data: { quantity: 1 } });
    await syncFleetForBooking(b1.id);
    alive = await prisma.fleetRental.findMany({ where: { bookingId: b1.id, state: null } });
    ok(alive.length === 1, "Admin giảm về 1 xe → nhả bớt 1 xe");
    // Đổi ngày.
    const N1 = key(10), N2 = key(12);
    await prisma.bookingRequest.update({ where: { id: b1.id }, data: { useDate: new Date(N1), endDate: new Date(N2) } });
    await syncFleetForBooking(b1.id);
    alive = await prisma.fleetRental.findMany({ where: { bookingId: b1.id, state: null } });
    ok(alive.length === 1 && alive[0].startDate.toISOString().slice(0, 10) === N1 && alive[0].endDate.toISOString().slice(0, 10) === N2, "Admin đổi ngày → lịch xe đổi theo");
    ok((await fleetFreeByWebType([svc.id], D1, D2)).get(rv.id)?.free === 2, "Ngày cũ được nhả → còn 2 xe");

    // Huỷ đơn: chưa đồng bộ vẫn tính là trống; đồng bộ thì lượt thuê bị huỷ.
    await prisma.bookingRequest.update({ where: { id: b1.id }, data: { status: "CANCELLED" } });
    ok((await fleetFreeByWebType([svc.id], N1, N2)).get(rv.id)?.free === 2, "Đơn huỷ → xe trống ngay (chưa cần mở trang xe)");
    await syncFleetForBooking(b1.id);
    alive = await prisma.fleetRental.findMany({ where: { bookingId: b1.id, state: null } });
    ok(alive.length === 0, "Đồng bộ đơn huỷ → huỷ lượt thuê");

    // Chủ xe từ chối ⇒ không tự xếp lại, không nhắc "chưa đủ xe".
    const r3 = await createBooking(input(1, key(20), key(21), "Khách 3"));
    const b3 = await prisma.bookingRequest.findUniqueOrThrow({ where: { code: r3.code } });
    bookingIds.push(b3.id);
    await prisma.fleetRental.updateMany({ where: { bookingId: b3.id }, data: { state: "reject", webPending: false } });
    await syncFleetBookings(svc.id);
    const b3alive = await prisma.fleetRental.count({ where: { bookingId: b3.id, state: null } });
    const data = await loadFleet(svc.id);
    ok(b3alive === 0 && !data.pending.some((p) => p.id === b3.id), "Chủ xe từ chối → không tự xếp lại, không nhắc thiếu xe");

    // Đơn web chờ duyệt đã quá ngày ⇒ không còn giữ xe.
    const fake = { ...data.rentals[0], web: true, cancelled: false, s: key(-5), e: key(-3) };
    ok(rentalStatus(fake, key(0)) === "done", "Đơn web chờ duyệt quá ngày → hết giữ xe");

    // Xe ngừng cho thuê ⇒ không tính vào số xe còn trống.
    await prisma.fleetVehicle.update({ where: { id: v2.id }, data: { mode: "off" } });
    ok((await fleetFreeByWebType([svc.id], key(30), key(31))).get(rv.id)?.free === 1, "Xe ngừng cho thuê → không tính còn trống");
    await prisma.fleetVehicle.update({ where: { id: v2.id }, data: { mode: "ready" } });

    // ===== Mục 4: lịch theo GIỜ (không chừa khoảng nghỉ) =====
    const H1 = key(40), H2 = key(41), H3 = key(42);
    const rh = await prisma.fleetRental.create({ data: { code: "XM-T" + Date.now().toString(36).slice(-4).toUpperCase(), vehicleId: v1.id, customerName: "Giờ", phone: "0386274915", startDate: new Date(H1), endDate: new Date(H2), startTime: "08:00", endTime: "08:00", total: 150000 } });
    const fd = await loadFleet(svc.id);
    const v1vm = fd.vehicles.find((x) => x.id === v1.id)!;
    ok(isVehicleFree(v1vm, H2, H3, fd.rentals, fd.today, undefined, fd.now, "08:00", "17:00"), "Xe trả 08:00 → nhận 08:00 cùng ngày được (không khoảng nghỉ)");
    ok(!isVehicleFree(v1vm, H2, H3, fd.rentals, fd.today, undefined, fd.now, "07:00", "17:00"), "Nhận 07:00 khi xe 08:00 mới trả → báo trùng");
    ok(isVehicleFree(v1vm, H2, H2, fd.rentals, fd.today, undefined, fd.now, "14:00", "18:00"), "Thuê theo giờ chiều cùng ngày trả → được");
    const avH = await computeAvailability(svc.id, H2, H2, 2, { pickup: "09:00", ret: "18:00" });
    ok(avH?.stayOptions?.find((o) => o.id === rv.id)?.availableUnits === 2, "Web: khách trước trả 08:00, đặt 09:00 cùng ngày → còn đủ 2 xe");
    await prisma.fleetRental.delete({ where: { id: rh.id } });

    // ===== Mục 3: sổ tiền một nguồn =====
    const r5 = await createBooking(input(1, key(45), key(46), "Khách tiền"));
    const b5 = await prisma.bookingRequest.findUniqueOrThrow({ where: { code: r5.code } });
    bookingIds.push(b5.id);
    await prisma.bookingRequest.update({ where: { id: b5.id }, data: { amountCollected: 100000, paymentStatus: "DEPOSITED" } });
    await syncFleetForBooking(b5.id);
    let fr5 = await prisma.fleetRental.findFirstOrThrow({ where: { bookingId: b5.id, state: null }, include: { payments: true } });
    ok(Number(fr5.deposit) === 100000 && fr5.payments.some((p) => p.method === "Sàn thu hộ"), "Sàn ghi đã thu 100k → sổ xe có dòng Sàn thu hộ 100k", `deposit=${fr5.deposit}`);
    await prisma.$transaction(async (tx) => {
      await tx.fleetRental.update({ where: { id: fr5.id }, data: { deposit: { increment: 200000 }, payments: { create: { amount: 200000, method: "Tiền mặt", kind: "Thu khi trả", by: "Test" } } } });
      await pushFleetPayments(tx, b5.id, "Test", { title: "Nhà xe thu 200k" }, [{ k: "Thiếu xăng 1 vạch", amt: 20000 }], "TEST");
    });
    const b5b = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: b5.id } });
    ok(Number(b5b.amountCollected) === 300000, "Nhà xe thu 200k → đơn admin đã thu = 300k", `${b5b.amountCollected}`);
    ok(Number(b5b.referencePrice) === Number(b5.referencePrice) + 20000 && Array.isArray(b5b.surcharges) && (b5b.surcharges as unknown[]).length === 1, "Phí phát sinh khi trả → thành phụ thu của đơn");
    ok(b5b.paymentStatus === (Number(b5b.amountCollected) >= Number(b5b.referencePrice) ? "PAID" : "DEPOSITED"), "Tình trạng thanh toán của đơn cập nhật theo", b5b.paymentStatus);
    await syncFleetForBooking(b5.id);
    fr5 = await prisma.fleetRental.findFirstOrThrow({ where: { id: fr5.id }, include: { payments: true } });
    ok(fr5.payments.length === 2, "Đồng bộ lại không tạo dòng thu trùng", `${fr5.payments.length} dòng`);

    // ===== Mục 1: xe máy kèm combo =====
    await prisma.fleetVehicle.update({ where: { id: v2.id }, data: { name: "Honda Wave RSX" } });
    const cb = await prisma.bookingRequest.create({ data: { code: "TX-CB-T" + Date.now().toString(36).slice(-4), category: "COMBO", serviceTitle: "Homestay thử", customerName: "Khách combo", phone: "0386274915", useDate: new Date(key(50)), endDate: new Date(key(52)), quantity: 2, bikeCount: 1, bikeType: "wave", bikeFrom: new Date(key(51)), bikeTo: new Date(key(52)), bikePickup: "08:00", bikeReturn: "12:00", bikeAmount: 340000 } });
    bookingIds.push(cb.id);
    await syncFleetForBooking(cb.id);
    const cr = await prisma.fleetRental.findMany({ where: { bookingId: cb.id, state: null }, include: { vehicle: true } });
    ok(cr.length === 1 && cr[0].vehicle.serviceId === svc.id && Number(cr[0].total) === 340000 && cr[0].webPending, "Combo thuê 1 xe Wave → tự xếp vào nhà xe có xe Wave trống, chờ nhà xe duyệt", `${cr.length} xe`);
    const logs = await prisma.bookingLog.count({ where: { bookingId: cb.id, title: { startsWith: "Xe máy kèm combo" } } });
    ok(logs === 1, "Đơn combo có nhật ký đã xếp xe máy");

    // ===== Admin phân xe máy kèm combo cho nhà xe khác =====
    const mk = async (tag: string, bike: string) => {
      const s = await prisma.service.create({ data: { slug: `test-fleet-${tag}-${Date.now()}`, category: "MOTORBIKE", title: `TEST nhà xe ${tag}`, summary: "t", description: "t", published: false } });
      extraSvcIds.push(s.id);
      await prisma.fleetVehicle.create({ data: { serviceId: s.id, name: bike, plate: `99Z9-${tag}.01`, kind: "so", pricePerDay: 150000 } });
      return s;
    };
    const svcB = await mk("B", "Honda Wave Alpha");
    const svcC = await mk("C", "Honda Vision");
    const aliveAt = async () => (await prisma.fleetRental.findMany({ where: { bookingId: cb.id, state: null }, include: { vehicle: true } })).map((r) => r.vehicle.serviceId);
    const rB = await assignComboBikeService(cb.id, svcB.id, "Admin thử");
    const atB = await aliveAt();
    ok("ok" in rB && rB.assigned === 1 && atB.length === 1 && atB[0] === svcB.id, "Admin phân sang nhà xe B → nhả xe nhà xe cũ, xếp 1 xe ở B", JSON.stringify(rB));
    ok((await prisma.fleetRental.count({ where: { bookingId: cb.id, state: "cancel", vehicle: { serviceId: svc.id } } })) === 1, "Lượt thuê ở nhà xe cũ chuyển thành đã huỷ");
    const infoB = await comboBikeAssignInfo(cb.id);
    ok(infoB?.currentId === svcB.id && infoB.assigned === 1 && infoB.pending && infoB.options.some((o) => o.id === svcB.id && o.free === 1), "Form sửa đơn: nhà xe đang giữ = B, B còn 1 xe trống (không tính xe đơn này giữ)", `free=${infoB?.options.find((o) => o.id === svcB.id)?.free}`);
    ok((await prisma.bookingLog.count({ where: { bookingId: cb.id, title: { startsWith: "Phân xe máy kèm cho" } } })) === 1, "Nhật ký đơn ghi lần phân nhà xe");
    const rC = await assignComboBikeService(cb.id, svcC.id, "Admin thử");
    const atC = await aliveAt();
    ok("error" in rC && atC.length === 1 && atC[0] === svcB.id, "Phân sang nhà xe không có xe Wave → báo lỗi, giữ nguyên ở B", "error" in rC ? rC.error : "");
    await syncFleetForBooking(cb.id);
    ok((await aliveAt()).join() === svcB.id, "Đồng bộ lại sau khi phân → vẫn ở nhà xe B");
    await prisma.fleetRental.updateMany({ where: { bookingId: cb.id, state: null }, data: { state: "reject", webPending: false } });
    const rA = await assignComboBikeService(cb.id, svc.id, "Admin thử");
    const atA = await aliveAt();
    ok("ok" in rA && atA.length === 1 && atA[0] === svc.id, "Nhà xe B từ chối → admin phân lại về nhà xe A được");

    await prisma.bookingRequest.update({ where: { id: cb.id }, data: { status: "CANCELLED" } });
    await syncFleetForBooking(cb.id);
    ok((await prisma.fleetRental.count({ where: { bookingId: cb.id, state: null } })) === 0, "Huỷ combo → nhả xe máy kèm");

    // ===== Mục 2: tài khoản nhân viên =====
    const owner = await prisma.adminUser.create({ data: { username: "test-owner-" + Date.now(), name: "Chủ thử", role: "PROVIDER", passwordHash: "x" } });
    await prisma.service.update({ where: { id: svc.id }, data: { ownerId: owner.id } });
    const staff = await prisma.adminUser.create({ data: { username: "test-staff-" + Date.now(), name: "NV thử", role: "STAFF", providerId: owner.id, passwordHash: "x" } });
    const sess = { sub: staff.id, username: staff.username, name: staff.name, role: "STAFF" as const };
    ok(!!(await canManageFleet(sess, svc.id)), "Nhân viên vào được nhà xe của chủ mình");
    const other = await prisma.service.findFirst({ where: { category: "MOTORBIKE", NOT: { id: svc.id } }, select: { id: true } });
    ok(!other || !(await canManageFleet(sess, other.id)), "Nhân viên KHÔNG vào được nhà xe khác");
    await prisma.adminUser.update({ where: { id: staff.id }, data: { active: false } });
    ok(!(await canManageFleet(sess, svc.id)), "Khoá tài khoản nhân viên → mất quyền ngay");
    await prisma.adminUser.delete({ where: { id: staff.id } });
    await prisma.service.update({ where: { id: svc.id }, data: { ownerId: null } });
    await prisma.adminUser.delete({ where: { id: owner.id } });

    // ===== Mục 5: tự nhả xe chưa cọc =====
    await prisma.fleetConfig.update({ where: { serviceId: svc.id }, data: { data: { webSync: true, holdH: 1 } } });
    const oldR = await prisma.fleetRental.create({ data: { code: "XM-H" + Date.now().toString(36).slice(-4).toUpperCase(), vehicleId: v1.id, customerName: "Chưa cọc", phone: "0386274915", startDate: new Date(key(60)), endDate: new Date(key(61)), total: 300000, createdAt: new Date(Date.now() - 2 * 3600e3) } });
    const fresh = await prisma.fleetRental.create({ data: { code: "XM-F" + Date.now().toString(36).slice(-4).toUpperCase(), vehicleId: v2.id, customerName: "Mới tạo", phone: "0386274915", startDate: new Date(key(60)), endDate: new Date(key(61)), total: 300000 } });
    await releaseExpiredHolds(svc.id);
    const [o2, f2] = await Promise.all([prisma.fleetRental.findUniqueOrThrow({ where: { id: oldR.id } }), prisma.fleetRental.findUniqueOrThrow({ where: { id: fresh.id } })]);
    ok(o2.state === "cancel" && f2.state === null, "Quá 1 giờ chưa cọc → tự nhả; đơn mới tạo giữ nguyên");

    // ===== Hồi quy (rà soát 19/11/2026): gọi thẳng API đội xe với phiên admin =====
    await prisma.fleetConfig.update({ where: { serviceId: svc.id }, data: { data: { webSync: true, holdH: 0 } } });
    (globalThis as unknown as { __testCookies: Record<string, string> }).__testCookies = {
      [AUTH_COOKIE_NAME]: await createSessionToken({ sub: "test-admin", role: "ADMIN", username: "kiem-thu", name: "Kiểm thử" }),
    };
    const api = async (body: Record<string, unknown>) => {
      const res = await fleetPOST(new Request("http://x/api/admin/fleet", { method: "POST", body: JSON.stringify({ serviceId: svc.id, ...body }) }));
      return { status: res.status, j: (await res.json()) as { error?: string; message?: string } };
    };
    const bk = (id: string) => prisma.bookingRequest.findUniqueOrThrow({ where: { id } });
    await prisma.fleetVehicle.updateMany({ where: { id: { in: [v1.id, v2.id] } }, data: { mode: "maint" } });
    const v3 = await prisma.fleetVehicle.create({ data: { serviceId: svc.id, name: "TEST Wave", plate: "99Z9-111.03", kind: "so", pricePerDay: 150000, rentalVehicleId: rv.id } });
    const r6 = await createBooking(input(1, key(80), key(81), "Khách hồi quy"));
    const b6 = await prisma.bookingRequest.findUniqueOrThrow({ where: { code: r6.code } });
    bookingIds.push(b6.id);
    const R6 = await prisma.fleetRental.findFirstOrThrow({ where: { bookingId: b6.id, state: null } });
    ok(R6.vehicleId === v3.id, "Hồi quy: đơn web xếp vào xe 3");
    await api({ op: "webConfirm", id: R6.id });
    ok((await bk(b6.id)).heldRoom === true, "Đơn 1 xe, nhà xe xác nhận → báo sàn đã giữ");
    // Sàn ghi đã thu 100k nhưng trang xe chưa đồng bộ (trang đang mở từ trước) ⇒ nhà xe ghi cọc.
    await prisma.bookingRequest.update({ where: { id: b6.id }, data: { amountCollected: 100000, paymentStatus: "DEPOSITED" } });
    const ref6 = Number(b6.referencePrice);
    const dep = await api({ op: "deposit", id: R6.id, amt: suggestDeposit(ref6, 100000), method: "Chuyển khoản" });
    const b6a = await bk(b6.id);
    ok(dep.status === 200 && Number(b6a.amountCollected) === 100000 + Math.min(Math.round((ref6 * 0.3) / 10000) * 10000, ref6 - 100000), "Nhà xe ghi cọc khi sàn vừa thu (chưa đồng bộ) → không mất khoản sàn đã thu", `đã thu=${b6a.amountCollected} ${dep.j.error ?? ""}`);
    ok((await prisma.fleetPayment.count({ where: { rentalId: R6.id, method: "Sàn thu hộ" } })) === 1, "Sổ xe có dòng Sàn thu hộ trước khi ghi cọc");
    const ho = await api({ op: "handover", id: R6.id, hand: { odo: 1000, fuel: "Đầy", acc: [], doc: "Không giữ" } });
    ok(ho.status === 200, "Giao xe sớm (xe rảnh) → được", ho.j.error ?? "");
    const ex = await api({ op: "extend", id: R6.id });
    const b6b = await bk(b6.id);
    ok(ex.status === 200 && Number(b6b.referencePrice) === ref6 + 150000, "Gia hạn xe của đơn web → giá đơn ở sàn tăng theo", `giá=${b6b.referencePrice} ${ex.j.error ?? ""}`);
    await prisma.bookingRequest.update({ where: { id: b6.id }, data: { amountCollected: Number(b6b.amountCollected) + 50000 } });
    const [ra, rb] = await Promise.all([api({ op: "return", id: R6.id, ret: { odo: 1100, fuel: "Đầy", method: "Tiền mặt" } }), api({ op: "return", id: R6.id, ret: { odo: 1100, fuel: "Đầy", method: "Tiền mặt" } })]);
    ok([ra.status, rb.status].sort().join() === "200,400", "Bấm 'Nhận xe' 2 lần cùng lúc → chỉ 1 lần quyết toán", `${ra.status}/${rb.status}`);
    const pays6 = await prisma.fleetPayment.findMany({ where: { rentalId: R6.id } });
    const b6c = await bk(b6.id);
    const ledger6 = pays6.reduce((a, p) => a + Number(p.amount), 0);
    ok(pays6.filter((p) => p.kind === "Thu khi trả").length === 1 && ledger6 === Number(b6c.referencePrice) && Number(b6c.amountCollected) === ledger6 && b6c.paymentStatus === "PAID",
      "Trả xe: tính cả khoản sàn vừa thu, không thu trùng; đơn = đã thu đủ", `sổ=${ledger6} giá=${b6c.referencePrice} đã thu=${b6c.amountCollected} ${b6c.paymentStatus}`);

    // Đơn 2 xe mà mới xếp được 1 ⇒ xác nhận 1 xe KHÔNG báo sàn "đã giữ".
    const b7 = await prisma.bookingRequest.create({ data: { code: "TX-XM-T" + Date.now().toString(36).slice(-4), category: "MOTORBIKE", serviceId: svc.id, serviceTitle: svc.title, rentalVehicleId: rv.id, customerName: "Khách 2 xe", phone: "0386274915", useDate: new Date(key(85)), endDate: new Date(key(86)), quantity: 2, referencePrice: 600000 } });
    bookingIds.push(b7.id);
    await syncFleetForBooking(b7.id);
    const R7 = await prisma.fleetRental.findMany({ where: { bookingId: b7.id, state: null } });
    const c7 = await api({ op: "webConfirm", id: R7[0]?.id });
    ok(R7.length === 1 && (await bk(b7.id)).heldRoom === false && /mới xếp 1/.test(c7.j.message ?? ""), "Đơn 2 xe mới xếp 1 → xác nhận không báo sàn đã giữ đủ", c7.j.message ?? c7.j.error ?? "");
    await api({ op: "webReject", id: R7[0].id, reason: "test" });
    const c7b = await api({ op: "webConfirm", id: R7[0].id });
    ok(c7b.status === 400 && (await bk(b7.id)).heldRoom === false, "Xác nhận lại lượt đã từ chối → bị chặn", c7b.j.error ?? "");

    // Đổi ngày buộc đổi xe ⇒ tiền đã thu đi theo lượt mới (không bị kẹt ở lượt huỷ).
    await prisma.fleetVehicle.updateMany({ where: { id: { in: [v1.id, v2.id] } }, data: { mode: "ready" } });
    const b8 = await prisma.bookingRequest.create({ data: { code: "TX-XM-U" + Date.now().toString(36).slice(-4), category: "MOTORBIKE", serviceId: svc.id, serviceTitle: svc.title, rentalVehicleId: rv.id, customerName: "Khách đổi ngày", phone: "0386274915", useDate: new Date(key(90)), endDate: new Date(key(91)), quantity: 1, referencePrice: 300000, amountCollected: 100000, paymentStatus: "DEPOSITED" } });
    bookingIds.push(b8.id);
    await syncFleetForBooking(b8.id);
    const R8 = await prisma.fleetRental.findFirstOrThrow({ where: { bookingId: b8.id, state: null } });
    await prisma.fleetRental.create({ data: { code: "XM-B" + Date.now().toString(36).slice(-4).toUpperCase(), vehicleId: R8.vehicleId, customerName: "Chặn xe", phone: "0386274915", startDate: new Date(key(95)), endDate: new Date(key(96)), startTime: "00:00", endTime: "23:59", total: 300000 } });
    await prisma.bookingRequest.update({ where: { id: b8.id }, data: { useDate: new Date(key(95)), endDate: new Date(key(96)) } });
    await syncFleetForBooking(b8.id);
    const all8 = await prisma.fleetRental.findMany({ where: { bookingId: b8.id }, include: { payments: true } });
    const new8 = all8.find((r) => r.state === null);
    const old8 = all8.find((r) => r.id === R8.id)!;
    const sum8 = all8.reduce((a, r) => a + r.payments.reduce((c, p) => c + Number(p.amount), 0), 0);
    ok(!!new8 && new8.vehicleId !== R8.vehicleId && Number(new8.deposit) === 100000 && Number(old8.deposit) === 0 && sum8 === 100000,
      "Đổi ngày phải đổi xe → khoản đã thu chuyển sang lượt mới, tổng sổ không đổi", `mới=${new8?.deposit} cũ=${old8.deposit} tổng=${sum8}`);
    await syncFleetForBooking(b8.id);
    const sum8b = (await prisma.fleetPayment.findMany({ where: { rental: { bookingId: b8.id } } })).reduce((a, p) => a + Number(p.amount), 0);
    ok(sum8b === 100000, "Đồng bộ lại không chuyển / nhân đôi tiền", `${sum8b}`);

    // Tự xếp đơn web KHÔNG được chọn xe đang có lượt thuê tạo tay (bookingId null) trùng thời gian.
    await prisma.fleetVehicle.updateMany({ where: { id: { in: [v2.id, v3.id] } }, data: { mode: "maint" } });
    await prisma.fleetRental.create({ data: { code: "XM-W" + Date.now().toString(36).slice(-4).toUpperCase(), vehicleId: v1.id, customerName: "Khách tại quầy", phone: "0386274915", startDate: new Date(key(110)), endDate: new Date(key(111)), total: 300000 } });
    const b9 = await prisma.bookingRequest.create({ data: { code: "TX-XM-V" + Date.now().toString(36).slice(-4), category: "MOTORBIKE", serviceId: svc.id, serviceTitle: svc.title, rentalVehicleId: rv.id, customerName: "Khách web trùng", phone: "0386274915", useDate: new Date(key(110)), endDate: new Date(key(111)), quantity: 1, referencePrice: 300000 } });
    bookingIds.push(b9.id);
    await syncFleetForBooking(b9.id);
    ok((await prisma.fleetRental.count({ where: { bookingId: b9.id, state: null } })) === 0, "Xe duy nhất đang có đơn tại quầy → đơn web KHÔNG bị xếp trùng vào xe đó");
    await prisma.fleetVehicle.update({ where: { id: v2.id }, data: { mode: "ready" } });
    await syncFleetForBooking(b9.id);
    const R9 = await prisma.fleetRental.findMany({ where: { bookingId: b9.id, state: null } });
    ok(R9.length === 1 && R9[0].vehicleId === v2.id, "Có xe khác rảnh → xếp vào xe rảnh");

    // Xe có lượt huỷ nhưng còn dòng thu chi (cọc mất) ⇒ không xoá được (xoá sẽ mất sổ tiền).
    const v4 = await prisma.fleetVehicle.create({ data: { serviceId: svc.id, name: "TEST Vision", plate: "99Z9-111.04", kind: "ga", pricePerDay: 150000 } });
    const ord = (picks: string[], extra: Record<string, unknown> = {}, s = key(100), e = key(101)) => ({ op: "createRental", order: { s, e, name: "Khách cọc", phone: "0386274915", picks, ...extra } });
    // ===== Việc 1: nhập số tiền + hình thức =====
    const badDep = await Promise.all([
      api(ord([v4.id], { depAmt: "1.5", depMethod: "Tiền mặt" })),
      api(ord([v4.id], { depAmt: -50000, depMethod: "Tiền mặt" })),
      api(ord([v4.id], { depAmt: 90000, depMethod: "Ví điện tử" })),
      api(ord([v4.id], { depAmt: 90000 })),
      api(ord([v4.id], { depAmt: 999999, depMethod: "Tiền mặt" })),
    ]);
    ok(badDep.every((x) => x.status === 400) && (await prisma.fleetRental.count({ where: { vehicleId: v4.id } })) === 0, "Tạo đơn: tiền cọc lẻ / âm / hình thức lạ / thiếu hình thức / vượt tổng → bị chặn, không tạo đơn", badDep.map((x) => x.j.error).join(" | "));
    const cr4 = await api(ord([v4.id], { depAmt: 90000, depMethod: "Tiền mặt" }));
    const R4 = await prisma.fleetRental.findFirstOrThrow({ where: { vehicleId: v4.id }, include: { payments: true } });
    ok(cr4.status === 200 && Number(R4.deposit) === 90000 && R4.payments.length === 1 && R4.payments[0].method === "Tiền mặt" && Number(R4.payments[0].amount) === 90000 && R4.payments[0].kind === "Cọc", "Tạo đơn tại quầy: cọc đúng số nhập + Tiền mặt", `${R4.payments.map((p) => `${p.amount} ${p.method} ${p.kind}`).join()}`);
    // ===== Việc 2: huỷ đơn có cọc → hỏi Hoàn / Giữ =====
    const c4a = await api({ op: "cancel", id: R4.id });
    ok(c4a.status === 400 && /Hoàn cọc/.test(c4a.j.error ?? "") && (await prisma.fleetRental.findUniqueOrThrow({ where: { id: R4.id } })).state === null, "Huỷ đơn có cọc mà chưa chọn hoàn / giữ → bị chặn, đơn giữ nguyên", c4a.j.error ?? "");
    const c4b = await api({ op: "cancel", id: R4.id, money: "refund", refundAmt: 100000, method: "Tiền mặt" });
    ok(c4b.status === 400, "Hoàn vượt số đã thu → bị chặn", c4b.j.error ?? "");
    const c4c = await api({ op: "cancel", id: R4.id, money: "keep" });
    const R4k = await prisma.fleetRental.findUniqueOrThrow({ where: { id: R4.id }, include: { payments: true } });
    const fees4 = (R4k.fees as { k: string; amt: number }[] | null) ?? [];
    ok(c4c.status === 200 && R4k.state === "cancel" && Number(R4k.deposit) === 90000 && R4k.payments.length === 1 && fees4.some((f) => f.k === KEEP_FEE && f.amt === 90000) && (R4k.note ?? "").includes(KEEP_FEE), "Giữ cọc → đơn huỷ, tiền vẫn ở sổ, ghi phí “Giữ cọc khi huỷ”", c4c.j.message ?? c4c.j.error ?? "");
    const del4 = await api({ op: "deleteVehicle", id: v4.id });
    ok(del4.status === 400 && (await prisma.fleetVehicle.count({ where: { id: v4.id } })) === 1, "Xoá xe có lượt huỷ còn tiền cọc → bị chặn", del4.j.error ?? "");
    const ref4 = await api({ op: "addPay", id: R4.id, amt: 10000, kind: "Hoàn cọc", method: "Tiền mặt" });
    ok(ref4.status === 400, "Đã giữ cọc thì không hoàn thêm phần đã giữ", ref4.j.error ?? "");

    // Hoàn một phần: phần còn lại thành giữ cọc; hoàn bằng Chuyển khoản.
    await api(ord([v4.id], { depAmt: 100000, depMethod: "Chuyển khoản" }, key(102), key(103)));
    const R4b = await prisma.fleetRental.findFirstOrThrow({ where: { vehicleId: v4.id, state: null } });
    const c4d = await api({ op: "cancel", id: R4b.id, money: "refund", refundAmt: 60000, method: "Chuyển khoản" });
    const R4bb = await prisma.fleetRental.findUniqueOrThrow({ where: { id: R4b.id }, include: { payments: true } });
    const fees4b = (R4bb.fees as { k: string; amt: number }[] | null) ?? [];
    ok(c4d.status === 200 && Number(R4bb.deposit) === 40000 && R4bb.payments.some((p) => Number(p.amount) === -60000 && p.method === "Chuyển khoản" && p.kind === "Hoàn cọc khi huỷ") && fees4b.some((f) => f.k === KEEP_FEE && f.amt === 40000), "Hoàn 60k / cọc 100k → dòng hoàn −60k Chuyển khoản, giữ 40k", c4d.j.message ?? c4d.j.error ?? "");
    // Không có tiền ⇒ không hỏi.
    await api(ord([v4.id], {}, key(104), key(105)));
    const R4c = await prisma.fleetRental.findFirstOrThrow({ where: { vehicleId: v4.id, state: null } });
    const c4e = await api({ op: "cancel", id: R4c.id });
    ok(c4e.status === 200 && (await prisma.fleetRental.findUniqueOrThrow({ where: { id: R4c.id } })).state === "cancel", "Huỷ đơn chưa thu tiền → không cần chọn hoàn / giữ", c4e.j.error ?? "");

    // Ghi cọc / thu thêm / gia hạn / trả xe: số tiền + hình thức do người dùng chọn.
    await api(ord([v4.id], {}, key(106), key(107)));
    const R4d = await prisma.fleetRental.findFirstOrThrow({ where: { vehicleId: v4.id, state: null } });
    const dBad = await Promise.all([
      api({ op: "deposit", id: R4d.id, amt: 50000 }),
      api({ op: "deposit", id: R4d.id, amt: "50000.5", method: "Tiền mặt" }),
      api({ op: "deposit", id: R4d.id, amt: 0, method: "Tiền mặt" }),
      api({ op: "deposit", id: R4d.id, amt: 400000, method: "Tiền mặt" }),
      api({ op: "addPay", id: R4d.id, amt: "abc", kind: "Thu", method: "Tiền mặt" }),
      api({ op: "addPay", id: R4d.id, amt: 10000, kind: "Thu", method: "Momo" }),
    ]);
    ok(dBad.every((x) => x.status === 400) && (await prisma.fleetPayment.count({ where: { rentalId: R4d.id } })) === 0, "Ghi cọc / thu: thiếu hình thức, số lẻ, 0, vượt còn phải thu, chữ, hình thức lạ → bị chặn", dBad.map((x) => x.j.error).join(" | "));
    const d4 = await api({ op: "deposit", id: R4d.id, amt: 70000, method: "Tiền mặt" });
    const p4 = await api({ op: "addPay", id: R4d.id, amt: 30000, kind: "Thu", method: "Chuyển khoản" });
    const pays4 = await prisma.fleetPayment.findMany({ where: { rentalId: R4d.id }, orderBy: { at: "asc" } });
    ok(d4.status === 200 && p4.status === 200 && pays4.map((p) => `${p.amount}|${p.method}|${p.kind}`).join() === "70000|Tiền mặt|Cọc,30000|Chuyển khoản|Thu thêm", "Ghi cọc 70k Tiền mặt + thu thêm 30k Chuyển khoản → đúng số, đúng hình thức", pays4.map((p) => `${p.amount}|${p.method}|${p.kind}`).join());
    // Sổ thu chi tách theo hình thức (cách LedgerTab cộng).
    const fdL = await loadFleet(svc.id);
    const lp = fdL.rentals.filter((r) => r.vid === v4.id).flatMap((r) => r.pays);
    const cash = lp.filter((y) => y.amt > 0 && y.method === "Tiền mặt").reduce((a, y) => a + y.amt, 0);
    const bank = lp.filter((y) => y.amt > 0 && y.method === "Chuyển khoản").reduce((a, y) => a + y.amt, 0);
    const back = -lp.filter((y) => y.amt < 0 && y.method !== "Sàn thu hộ").reduce((a, y) => a + y.amt, 0);
    ok(cash === 160000 && bank === 130000 && back === 60000, "Thu chi tách đúng: tiền mặt 160k, chuyển khoản 130k, đã hoàn 60k", `TM=${cash} CK=${bank} hoàn=${back}`);
    await prisma.fleetRental.update({ where: { id: R4d.id }, data: { startDate: new Date(key(0)), startTime: "00:00" } });
    await prisma.fleetVehicle.update({ where: { id: v4.id }, data: { mode: "ready" } });
    const ho4 = await api({ op: "handover", id: R4d.id, hand: { odo: 10, fuel: "Đầy", acc: [], doc: "Không giữ" } });
    const ex4bad = await api({ op: "extend", id: R4d.id, payAmt: 150000 });
    const ex4 = await api({ op: "extend", id: R4d.id, payAmt: 150000, method: "Chuyển khoản" });
    const R4e = await prisma.fleetRental.findUniqueOrThrow({ where: { id: R4d.id }, include: { payments: true } });
    ok(ho4.status === 200 && ex4bad.status === 400 && ex4.status === 200 && R4e.payments.some((p) => p.kind === "Thu gia hạn" && Number(p.amount) === 150000 && p.method === "Chuyển khoản") && Number(R4e.deposit) === 250000, "Gia hạn kèm thu 150k: thiếu hình thức → chặn; có → ghi “Thu gia hạn” Chuyển khoản", `${ho4.j.error ?? ""} ${ex4bad.j.error ?? ""} ${ex4.j.error ?? ""}`);
    const rt4bad = await api({ op: "return", id: R4d.id, ret: { odo: 50, fuel: "Đầy", method: "Thẻ" } });
    const rt4 = await api({ op: "return", id: R4d.id, ret: { odo: 50, fuel: "Đầy", method: "Chuyển khoản" } });
    const R4f = await prisma.fleetRental.findUniqueOrThrow({ where: { id: R4d.id }, include: { payments: true } });
    const settle4 = R4f.payments.find((p) => p.kind === "Thu khi trả" || p.kind === "Hoàn cọc");
    ok(rt4bad.status === 400 && rt4.status === 200 && !!R4f.ret && (!settle4 || settle4.method === "Chuyển khoản"), "Trả xe còn tiền quyết toán: hình thức lạ → chặn; chọn Chuyển khoản → ghi đúng", `${rt4bad.j.error ?? ""} ${settle4 ? settle4.amount + " " + settle4.method : "không phát sinh"}`);

    // ===== Việc 2 (đơn web): không hoàn tiền Sàn thu hộ; sổ ↔ đơn khớp =====
    await prisma.fleetVehicle.updateMany({ where: { id: { in: [v1.id, v2.id, v3.id] } }, data: { mode: "ready" } });
    const bW = await prisma.bookingRequest.create({ data: { code: "TX-XM-W" + Date.now().toString(36).slice(-4), category: "MOTORBIKE", serviceId: svc.id, serviceTitle: svc.title, rentalVehicleId: rv.id, customerName: "Khách web huỷ", phone: "0386274915", useDate: new Date(key(130)), endDate: new Date(key(131)), quantity: 1, referencePrice: 300000, amountCollected: 100000, paymentStatus: "DEPOSITED" } });
    bookingIds.push(bW.id);
    await syncFleetForBooking(bW.id);
    const RW = await prisma.fleetRental.findFirstOrThrow({ where: { bookingId: bW.id, state: null } });
    await api({ op: "webConfirm", id: RW.id });
    await api({ op: "deposit", id: RW.id, amt: 50000, method: "Tiền mặt" });
    const cw1 = await api({ op: "cancel", id: RW.id, reason: "test" });
    const cw2 = await api({ op: "cancel", id: RW.id, money: "refund", refundAmt: 150000, method: "Tiền mặt", reason: "test" });
    ok(cw1.status === 400 && /50\.000đ/.test(cw1.j.error ?? "") && cw2.status === 400, "Huỷ xe đơn web: chỉ hỏi phần nhà xe tự thu (50k), hoàn cả tiền sàn (150k) → chặn", `${cw1.j.error} | ${cw2.j.error}`);
    const cw3 = await api({ op: "cancel", id: RW.id, money: "refund", method: "Tiền mặt", reason: "test" });
    const RWa = await prisma.fleetRental.findUniqueOrThrow({ where: { id: RW.id }, include: { payments: true } });
    const bWa = await bk(bW.id);
    const ledW = RWa.payments.reduce((a, p) => a + Number(p.amount), 0);
    ok(cw3.status === 200 && RWa.state === "reject" && RWa.payments.some((p) => Number(p.amount) === -50000 && p.method === "Tiền mặt") && !RWa.payments.some((p) => p.method === "Sàn thu hộ" && Number(p.amount) < 0) && Number(bWa.amountCollected) === 100000 && ledW === 100000,
      "Hoàn cọc khi huỷ xe đơn web → hoàn 50k nhà xe thu, giữ nguyên 100k sàn thu hộ; đơn đã thu = 100k", `sổ=${ledW} đơn=${bWa.amountCollected} ${cw3.j.error ?? ""}`);
    await syncFleetForBooking(bW.id);
    ok((await prisma.fleetPayment.count({ where: { rentalId: RW.id } })) === RWa.payments.length, "Đồng bộ lại sau hoàn → không sinh dòng thu chi thừa");

    // Đơn web 2 xe: giữ cọc khi huỷ 1 xe → tiền giữ KHÔNG bị chuyển sang xe còn lại.
    const bK = await prisma.bookingRequest.create({ data: { code: "TX-XM-K" + Date.now().toString(36).slice(-4), category: "MOTORBIKE", serviceId: svc.id, serviceTitle: svc.title, rentalVehicleId: rv.id, customerName: "Khách giữ cọc", phone: "0386274915", useDate: new Date(key(135)), endDate: new Date(key(136)), quantity: 2, referencePrice: 600000 } });
    bookingIds.push(bK.id);
    await syncFleetForBooking(bK.id);
    const RK = await prisma.fleetRental.findMany({ where: { bookingId: bK.id, state: null }, orderBy: { createdAt: "asc" } });
    for (const x of RK) await api({ op: "webConfirm", id: x.id });
    await api({ op: "deposit", id: RK[0].id, amt: 60000, method: "Chuyển khoản" });
    const ck = await api({ op: "cancel", id: RK[0].id, money: "keep", reason: "khách huỷ 1 xe" });
    await syncFleetForBooking(bK.id);
    const RKa = await prisma.fleetRental.findMany({ where: { bookingId: bK.id }, include: { payments: true } });
    const k0 = RKa.find((x) => x.id === RK[0].id)!, k1 = RKa.find((x) => x.id === RK[1]?.id);
    const bKa = await bk(bK.id);
    ok(RK.length === 2 && ck.status === 200 && Number(k0.deposit) === 60000 && !!k1 && Number(k1.deposit) === 0 && Number(bKa.amountCollected) === 60000, "Đơn web 2 xe, giữ cọc khi huỷ 1 xe → tiền giữ ở lượt đã huỷ, không chuyển sang xe kia", `huỷ=${k0.deposit} còn=${k1?.deposit} đơn=${bKa.amountCollected} ${ck.j.error ?? ""}`);

    // ===== Việc 3: nhân viên đội xe vs lễ tân homestay =====
    const own3 = await prisma.adminUser.create({ data: { username: "test-owner3-" + Date.now(), name: "Chủ thử 3", role: "PROVIDER", passwordHash: "x" } });
    ownerIds.push(own3.id);
    await prisma.service.update({ where: { id: svc.id }, data: { ownerId: own3.id } });
    const sc = await api({ op: "staffCreate", name: "NV xe", username: "test-nvxe-" + Date.now().toString(36), password: "123456" });
    const nvXe = await prisma.adminUser.findFirst({ where: { providerId: own3.id, role: "STAFF" } });
    const leTan = await prisma.adminUser.create({ data: { username: "test-letan-" + Date.now(), name: "Lễ tân", role: "STAFF", staffArea: "phong", providerId: own3.id, passwordHash: "x" } });
    const oldStaff = await prisma.adminUser.create({ data: { username: "test-nvcu-" + Date.now(), name: "NV cũ", role: "STAFF", providerId: own3.id, passwordHash: "x" } });
    ok(sc.status === 200 && nvXe?.staffArea === "xe", "Chủ tạo nhân viên ở trang xe → staffArea = xe", sc.j.error ?? "");
    const st3 = (await loadFleet(svc.id)).staff.map((x) => x.id);
    ok(st3.includes(nvXe!.id) && st3.includes(oldStaff.id) && !st3.includes(leTan.id), "Danh sách nhân viên đội xe không có lễ tân homestay (gồm cả tài khoản cũ staffArea trống)");
    const tg = await Promise.all(["staffToggle", "staffDelete"].map((op) => api({ op, id: leTan.id })));
    const rs3 = await api({ op: "staffReset", id: leTan.id, password: "654321" });
    const leTan2 = await prisma.adminUser.findUnique({ where: { id: leTan.id } });
    ok(tg.every((x) => x.status === 400) && rs3.status === 400 && !!leTan2 && leTan2.active && leTan2.passwordHash === "x", "Khoá / xoá / đổi mật khẩu lễ tân từ trang xe → không được", tg.map((x) => x.j.error).join(" | "));
    const ss = (u: { id: string; username: string; name: string | null }) => ({ sub: u.id, username: u.username, name: u.name ?? "", role: "STAFF" as const });
    ok(!(await canManageFleet(ss(leTan), svc.id)) && !!(await canManageFleet(ss(nvXe!), svc.id)) && !!(await canManageFleet(ss(oldStaff), svc.id)), "Lễ tân homestay KHÔNG vào được đội xe; nhân viên xe (xe / cũ) vẫn vào được");
    const tgOk = await api({ op: "staffToggle", id: oldStaff.id });
    ok(tgOk.status === 200 && (await prisma.adminUser.findUniqueOrThrow({ where: { id: oldStaff.id } })).active === false, "Khoá nhân viên xe (tài khoản cũ) vẫn được");
  } catch (e) { fail++; console.log("✗ LỖI:", (e as Error).message); } finally {
    await prisma.bookingRequest.deleteMany({ where: { OR: [{ id: { in: bookingIds } }, { serviceId: svc.id }] } });
    await prisma.service.deleteMany({ where: { id: { in: [svc.id, ...extraSvcIds] } } });
    if (ownerIds.length) {
      await prisma.adminUser.deleteMany({ where: { providerId: { in: ownerIds } } });
      await prisma.adminUser.deleteMany({ where: { id: { in: ownerIds } } });
    }
    console.log(`\nKết quả: ${pass} đạt · ${fail} lỗi · đã dọn dữ liệu thử`);
    await prisma.$disconnect();
    process.exit(0);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
