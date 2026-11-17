/**
 * Kiểm thử luồng đặt xe máy ↔ đội xe (không cần dev server). Tạo nhà xe THỬ riêng, chạy các ca, rồi dọn sạch.
 * Chạy: npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/tmp-fleet-flow-test.ts
 */
import { PrismaClient } from "@prisma/client";
import { bookingInputSchema } from "../src/lib/validation";
import { computeAvailability, createBooking } from "../src/lib/booking";
import { canManageFleet, fleetFreeByWebType, loadFleet, pushFleetPayments, releaseExpiredHolds, syncFleetBookings, syncFleetForBooking } from "../src/lib/fleet";
import { isVehicleFree, rentalStatus } from "../src/lib/fleet-core";
import { getRentalBikes } from "../src/lib/queries";

const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const key = (n: number) => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10);

async function main() {
  const svc = await prisma.service.create({ data: { slug: "test-fleet-" + Date.now(), category: "MOTORBIKE", title: "TEST đội xe", summary: "t", description: "t", published: true } });
  const rv = await prisma.rentalVehicle.create({ data: { serviceId: svc.id, vehicleType: "TEST Wave", pricePerDay: 150000, totalUnits: 5 } });
  const bookingIds: string[] = [];
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
  } catch (e) { fail++; console.log("✗ LỖI:", (e as Error).message); } finally {
    await prisma.bookingRequest.deleteMany({ where: { OR: [{ id: { in: bookingIds } }, { serviceId: svc.id }] } });
    await prisma.service.delete({ where: { id: svc.id } });
    console.log(`\nKết quả: ${pass} đạt · ${fail} lỗi · đã dọn dữ liệu thử`);
    await prisma.$disconnect();
    process.exit(0);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
