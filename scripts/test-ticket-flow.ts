/**
 * Kiểm thử luồng module Vé & đặt bàn (src/lib/ticket.ts) trên DB thật: tạo 3 địa điểm thử
 * (vé cổng / show / nhà hàng, published=false, slug "zz-test-ve-…"), chạy các ca rồi TỰ DỌN.
 * Chạy: npx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env scripts/test-ticket-flow.ts
 */
import { prisma } from "../src/lib/prisma";
import {
  TicketError, cancelOrder, confirmOrder, createSessions, createTicketOrder, createVenue, deleteSession, finalizeDraft, loadTicketData, moveSeat,
  orderByToken, publicVenue, publicVenueCards, releaseDraft, patchSession, patchVenueConfig, payOrder, releaseExpiredTicketHolds, saveLayout, scanStats, scanTicket, setTableStatus,
  toggleSeatLock, unpayOrder,
} from "../src/lib/ticket";
import { addDaysKey, crc16, vietQrPayload, vnNow } from "../src/lib/ticket-core";

let pass = 0, failN = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) pass++;
  else failN++;
  console.log(`${cond ? "✓" : "✗ FAIL"} ${name}${extra ? " — " + extra : ""}`);
};
/** Kỳ vọng bị từ chối bằng TicketError. */
async function rejects(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(name, false, "không bị từ chối");
  } catch (e) {
    ok(name, e instanceof TicketError, e instanceof Error ? e.message : "");
  }
}

async function main() {
  const { today } = vnNow();
  const tomorrow = addDaysKey(today, 1);
  const stamp = Date.now().toString(36);
  const ids: string[] = [];
  try {
    // ======================= VÉ CỔNG =======================
    const gateId = await createVenue({ kind: "GATE", name: `zz test ve cong ${stamp}` });
    ids.push(gateId);
    await prisma.ticketVenue.update({ where: { id: gateId }, data: { published: true } });
    await patchVenueConfig(gateId, { quota: 10 });
    let g = await loadTicketData(gateId);
    const [adult, child] = g.tiers;
    ok("GATE: tạo địa điểm + 3 hạng vé mặc định, quota 10", g.tiers.length === 3 && g.venue.config.quota === 10);
    await prisma.ticketMenuItem.create({ data: { venueId: gateId, name: "Trà Shan tuyết", price: 35000 } });
    g = await loadTicketData(gateId);

    const sale = await createTicketOrder({ venueId: gateId, date: today, time: "", name: "Khách quầy", phone: "", source: "Quầy", mode: "paid", payMethod: "Tiền mặt", staff: true, tickets: [{ tierId: adult.id, qty: 2 }, { tierId: child.id, qty: 1 }], food: [{ menuId: g.menu[0].id, qty: 2 }] });
    g = await loadTicketData(gateId);
    const so = g.orders.find((o) => o.id === sale.id)!;
    ok("GATE: bán tại cổng — giá tính ở server", so.total === 2 * adult.price + child.price + 70000 && so.paid === so.total && so.status === "ok", `${so.total}`);
    ok("GATE: phát 3 vé vào + 1 voucher, mã TX-VE-…-n", so.tickets.filter((t) => t.kind === "entry").length === 3 && so.tickets.filter((t) => t.kind === "food").length === 1 && /^TX-VE-[A-Z0-9]{5}-1$/.test(so.tickets[0].code), so.tickets.map((t) => t.code).join(","));

    const web = await createTicketOrder({ venueId: gateId, date: today, time: "", name: "Khách web", phone: "0900000001", source: "Web", mode: "request", tickets: [{ tierId: adult.id, qty: 4 }] });
    const webVm = (await loadTicketData(gateId)).orders.find((o) => o.id === web.id)!;
    ok("GATE: đơn web chờ xác nhận chưa có vé", webVm.tickets.length === 0);
    ok("30 PHÚT: đơn web vé cổng giữ chỗ 30 phút chờ xác nhận", !!webVm.holdUntil && Math.abs(webVm.holdUntil - Date.now() - 30 * 60_000) < 60_000, String(webVm.holdUntil && Math.round((webVm.holdUntil - Date.now()) / 60_000)));
    ok("30 PHÚT: đơn bán tại cổng (quầy) không có hạn giữ", (await loadTicketData(gateId)).orders.find((o) => o.id === sale.id)!.holdUntil === null);
    await rejects("GATE: vượt quota (đã 7/10, thêm 4) bị từ chối", () => createTicketOrder({ venueId: gateId, date: today, time: "", name: "Khách", phone: "", source: "Quầy", mode: "paid", staff: true, tickets: [{ tierId: adult.id, qty: 4 }] }));
    await rejects("GATE: hạ quota dưới số đã bán bị từ chối", () => patchSession(gateId, today, "", { quota: 5 }));
    await patchSession(gateId, today, "", { quota: 20 });
    await patchSession(gateId, tomorrow, "", { status: "paused" });
    await rejects("GATE: ngày tạm dừng không bán được", () => createTicketOrder({ venueId: gateId, date: tomorrow, time: "", name: "Khách", phone: "", source: "Web", mode: "request", tickets: [{ tierId: adult.id, qty: 1 }] }));
    await rejects("GATE: ngày đã qua bị từ chối", () => createTicketOrder({ venueId: gateId, date: addDaysKey(today, -1), time: "", name: "Khách", phone: "", source: "Web", mode: "request", tickets: [{ tierId: adult.id, qty: 1 }] }));

    // --- Soát vé ---
    const r0 = await scanTicket("all", "Test", web.code, { venueId: gateId });
    ok("SCAN: mã đơn chưa xác nhận ⇒ chưa có vé", r0.kind === "wrong", r0.title);
    await confirmOrder(gateId, web.id);
    const wo = (await loadTicketData(gateId)).orders.find((o) => o.id === web.id)!;
    ok("GATE: xác nhận ⇒ phát 4 vé", wo.status === "ok" && wo.tickets.length === 4);
    ok("30 PHÚT: xác nhận ⇒ xoá hạn giữ (không bị tự huỷ nữa)", wo.holdUntil === null);
    const r1 = await scanTicket("all", "Test", wo.tickets[0].token, { venueId: gateId });
    ok("SCAN: quét token ⇒ hợp lệ, vé 1/4", r1.kind === "ok" && r1.sub.includes("vé 1/4"), r1.sub);
    const r2 = await scanTicket("all", "Test", `https://taxuabooking.vn/ve/t/${wo.tickets[0].token}`, { venueId: gateId });
    ok("SCAN: quét lại (dạng URL) ⇒ vé đã dùng", r2.kind === "used", r2.sub);
    const r3 = await scanTicket("all", "Test", web.code.toLowerCase(), { venueId: gateId });
    ok("SCAN: nhập mã đơn ⇒ vé kế tiếp chưa dùng (2/4)", r3.kind === "ok" && r3.sub.includes("vé 2/4"), r3.sub);
    const food = so.tickets.find((t) => t.kind === "food")!;
    const r4 = await scanTicket("all", "Test", food.code, { venueId: gateId });
    const r5 = await scanTicket("all", "Test", food.code, { venueId: gateId, deliver: true });
    const r6 = await scanTicket("all", "Test", food.code, { venueId: gateId, deliver: true });
    ok("SCAN: voucher — xem trước, giao, rồi báo đã nhận", r4.kind === "food" && r5.kind === "ok" && r6.kind === "used", `${r4.kind}/${r5.kind}/${r6.kind}`);
    ok("SCAN: mã lạ ⇒ không tìm thấy", (await scanTicket("all", "Test", "TX-VE-ZZZZZ-9")).kind === "none");
    ok("SCAN: chủ khác không soát được vé này", (await scanTicket("khong-phai-chu", "Test", wo.tickets[2].token)).kind === "none");
    const st = await scanStats("all", gateId);
    ok("SCAN: thống kê 2/7 đã vào", st.checked === 2 && st.total === 7, `${st.checked}/${st.total}`);
    await rejects("GATE: đơn đã có vé soát không huỷ được", () => cancelOrder(gateId, web.id));
    const pub = await orderByToken(web.token);
    ok("WEB: trang vé điện tử tra theo token đơn", pub?.order.code === web.code && pub.order.tickets.length === 4);

    // ======================= SHOW =======================
    const showId = await createVenue({ kind: "SHOW", name: `zz test show ${stamp}` });
    ids.push(showId);
    await prisma.ticketVenue.update({ where: { id: showId }, data: { published: true } });
    const made = await createSessions(showId, [today, tomorrow], "20:00");
    ok("SHOW: tạo 2 suất, tạo lại không nhân đôi", made === 2 && (await createSessions(showId, [today], "20:00")) === 0);
    await prisma.ticketTier.create({ data: { venueId: showId, name: "Khu đứng", price: 150000, quota: 3 } });
    let s = await loadTicketData(showId);
    const sess = s.sessions.find((x) => x.date === today)!, sess2 = s.sessions.find((x) => x.date === tomorrow)!;
    const stand = s.tiers.find((t) => !t.seatClass)!;
    const o1 = await createTicketOrder({ venueId: showId, date: today, time: "20:00", name: "Khách A", phone: "0900000002", source: "Quầy", mode: "paid", staff: true, seats: ["A1", "A2", "C5"] });
    s = await loadTicketData(showId);
    const a = s.orders.find((o) => o.id === o1.id)!;
    ok("SHOW: bán 2 VIP + 1 Thường = 1.150.000đ, 3 vé có ghế", a.total === 450000 * 2 + 250000 && a.tickets.length === 3 && a.tickets[0].label.startsWith("Ghế A1"), `${a.total} ${a.tickets.map((t) => t.label).join("|")}`);
    await rejects("SHOW: bán trùng ghế A2 bị từ chối", () => createTicketOrder({ venueId: showId, date: today, time: "20:00", name: "Khách B", phone: "", source: "Web", mode: "hold", seats: ["A2", "A3"] }));
    ok("SHOW: đơn bị từ chối không giữ ghế A3", !(await prisma.ticketSeat.findFirst({ where: { sessionId: sess.id, key: "A3" } })));
    const two = await Promise.allSettled([1, 2].map((n) => createTicketOrder({ venueId: showId, date: today, time: "20:00", name: "Đua " + n, phone: "", source: "Web", mode: "hold", seats: ["B7"] })));
    ok("SHOW: 2 người cùng giành ghế B7 ⇒ đúng 1 người được", two.filter((x) => x.status === "fulfilled").length === 1);
    await rejects("SHOW: ghế ngoài sơ đồ bị từ chối", () => createTicketOrder({ venueId: showId, date: today, time: "20:00", name: "Khách", phone: "", source: "Web", mode: "hold", seats: ["Z9"] }));
    await rejects("SHOW: suất không tồn tại bị từ chối", () => createTicketOrder({ venueId: showId, date: today, time: "21:30", name: "Khách", phone: "", source: "Web", mode: "hold", seats: ["D1"] }));

    ok("SHOW: khoá ghế D4 cho khách mời", (await toggleSeatLock(showId, sess.id, "D4")) === true);
    await rejects("SHOW: ghế đang khoá không bán được", () => createTicketOrder({ venueId: showId, date: today, time: "20:00", name: "Khách", phone: "", source: "Web", mode: "hold", seats: ["D4"] }));
    ok("SHOW: mở khoá D4", (await toggleSeatLock(showId, sess.id, "D4")) === false);
    await rejects("SHOW: không khoá được ghế đã có đơn", () => toggleSeatLock(showId, sess.id, "A1"));

    await rejects("SHOW: đổi ghế khác hạng (A2 VIP → D4 Thường) bị từ chối", () => moveSeat(showId, o1.id, "A2", "D4"));
    await moveSeat(showId, o1.id, "A2", "B1");
    s = await loadTicketData(showId);
    const moved = s.orders.find((o) => o.id === o1.id)!;
    ok("SHOW: đổi ghế A2 → B1 cập nhật ghế + nhãn vé", moved.seats.includes("B1") && !moved.seats.includes("A2") && moved.tickets.some((t) => t.seatKey === "B1" && t.label.startsWith("Ghế B1")));

    await createTicketOrder({ venueId: showId, date: today, time: "20:00", name: "Khu đứng", phone: "", source: "Quầy", mode: "paid", staff: true, tickets: [{ tierId: stand.id, qty: 2 }] });
    await rejects("SHOW: khu đứng vượt 3 vé/suất bị từ chối", () => createTicketOrder({ venueId: showId, date: today, time: "20:00", name: "Khu đứng", phone: "", source: "Quầy", mode: "paid", staff: true, tickets: [{ tierId: stand.id, qty: 2 }] }));

    // --- Giữ chỗ chờ thu tiền ---
    const h1 = await createTicketOrder({ venueId: showId, date: today, time: "20:00", name: "Khách giữ", phone: "0900000003", source: "Điện thoại", mode: "hold", staff: true, seats: ["E1", "E2"] });
    s = await loadTicketData(showId);
    const held = s.orders.find((o) => o.id === h1.id)!;
    ok("SHOW: giữ chỗ — chờ thu, có hạn giữ, chưa phát vé", held.status === "wait" && !!held.holdUntil && held.holdUntil > Date.now() && !held.tickets.length);
    await payOrder(showId, h1.id, "Chuyển khoản");
    s = await loadTicketData(showId);
    ok("SHOW: đã thu tiền ⇒ xác nhận + phát 2 vé", s.orders.find((o) => o.id === h1.id)!.status === "ok" && s.orders.find((o) => o.id === h1.id)!.tickets.length === 2);
    await unpayOrder(showId, h1.id);
    s = await loadTicketData(showId);
    ok("SHOW: hoàn tác ⇒ về chờ thu, thu hồi vé, vẫn giữ ghế", s.orders.find((o) => o.id === h1.id)!.status === "wait" && !s.orders.find((o) => o.id === h1.id)!.tickets.length && s.orders.find((o) => o.id === h1.id)!.seats.length === 2);
    await prisma.ticketOrder.update({ where: { id: h1.id }, data: { holdUntil: new Date(Date.now() - 1000) } });
    const released = await releaseExpiredTicketHolds(showId);
    ok("SHOW: hết hạn giữ ⇒ tự huỷ + nhả ghế E1, E2", released === 1 && !(await prisma.ticketSeat.count({ where: { sessionId: sess.id, key: { in: ["E1", "E2"] } } })));
    await rejects("SHOW: thu tiền đơn đã hết hạn bị từ chối", () => payOrder(showId, h1.id, "Chuyển khoản"));

    // --- Sai suất khi soát + sơ đồ ---
    const o2 = await createTicketOrder({ venueId: showId, date: tomorrow, time: "20:00", name: "Khách mai", phone: "", source: "Quầy", mode: "paid", staff: true, seats: ["F1"] });
    const t2 = (await loadTicketData(showId)).orders.find((o) => o.id === o2.id)!.tickets[0];
    const rw = await scanTicket("all", "Test", t2.token, { venueId: showId });
    ok("SCAN: vé suất ngày mai ⇒ sai suất", rw.kind === "wrong", rw.sub);
    ok("SCAN: vé show quét ở cổng khác ⇒ sai địa điểm", (await scanTicket("all", "Test", a.tickets[0].token, { venueId: gateId })).kind === "wrong");
    const lay = (await loadTicketData(showId)).venue.layout;
    await rejects("SƠ ĐỒ: tô lối đi đè ghế F1 đang có đơn bị từ chối", () => saveLayout(showId, { ...lay, cells: { ...lay.cells, "5-0": "aisle" } }));
    const saved = await saveLayout(showId, { ...lay, cells: { ...lay.cells, "7-0": "broken", "7-1": "aisle" } });
    ok("SƠ ĐỒ: lưu ghế hỏng + lối đi", saved.cells["7-0"] === "broken" && saved.cells["7-1"] === "aisle");
    await rejects("SƠ ĐỒ: ghế hỏng H1 không bán được", () => createTicketOrder({ venueId: showId, date: today, time: "20:00", name: "Khách", phone: "", source: "Web", mode: "hold", seats: ["H1"] }));
    await rejects("SHOW: suất có đơn không xoá được", () => deleteSession(showId, sess2.id));
    await cancelOrder(showId, o2.id);
    await deleteSession(showId, sess2.id);
    ok("SHOW: huỷ đơn rồi xoá được suất", !(await prisma.ticketSession.findUnique({ where: { id: sess2.id } })));

    // ======================= NHÀ HÀNG =======================
    const restId = await createVenue({ kind: "RESTAURANT", name: `zz test nha hang ${stamp}` });
    ids.push(restId);
    await prisma.ticketVenue.update({ where: { id: restId }, data: { published: true } });
    await prisma.ticketTable.createMany({ data: [{ venueId: restId, name: "T1", capacity: 4 }, { venueId: restId, name: "T2", capacity: 6 }] });
    await prisma.ticketMenuItem.create({ data: { venueId: restId, name: "Lẩu gà đen", price: 450000 } });
    await patchVenueConfig(restId, { policy: "deposit", amount: 100000 });
    let r = await loadTicketData(restId);
    const [T1, T2] = r.tables;
    ok("GIỮ BÀN: mặc định giữ bàn 120 phút mỗi lượt", r.venue.config.mealMin === 120);
    const b1 = await createTicketOrder({ venueId: restId, date: tomorrow, time: "17:30", name: "Khách gọi điện", phone: "0900000004", guests: 4, source: "Điện thoại", mode: "confirmed", staff: true, tableIds: [T1.id], food: [{ menuId: r.menu[0].id, qty: 1, note: "ít cay" }] });
    r = await loadTicketData(restId);
    const bo = r.orders.find((o) => o.id === b1.id)!;
    ok("REST: giữ bàn — cọc 100k/bàn, món 450k, không phát vé", bo.status === "ok" && bo.deposit === 100000 && bo.foodAmount === 450000 && bo.paid === 0 && !bo.tickets.length && bo.items[0].note === "ít cay");
    await rejects("REST: bàn T1 cùng khung giờ không đặt trùng được", () => createTicketOrder({ venueId: restId, date: tomorrow, time: "17:30", name: "Khách 2", phone: "", source: "Web", mode: "request", tableIds: [T1.id] }));
    await rejects("GIỮ BÀN: T1 đặt 17:30 ⇒ khung 18:30 (chồng giờ ăn) không nhận đặt T1", () => createTicketOrder({ venueId: restId, date: tomorrow, time: "18:30", name: "Khách 2b", phone: "", source: "Web", mode: "request", tableIds: [T1.id] }));
    const b2 = await createTicketOrder({ venueId: restId, date: tomorrow, time: "19:30", name: "Khách 3", phone: "", source: "Web", mode: "request", tableIds: [T1.id, T2.id] });
    const b2v = (await loadTicketData(restId)).orders.find((o) => o.id === b2.id)!;
    ok("GIỮ BÀN: T1 khung 19:30 (= 17:30 + 120 phút) vẫn đặt được, 2 bàn = cọc 200k", b2v.deposit === 200000);
    ok("30 PHÚT: đặt bàn web không cọc chuyển khoản vẫn có hạn 30 phút chờ xác nhận", !!b2v.holdUntil && Math.abs(b2v.holdUntil - Date.now() - 30 * 60_000) < 60_000);
    await rejects("GIỮ BÀN: chiều ngược — T2 đã đặt 19:30 ⇒ quầy giữ T2 lúc 18:00 bị từ chối", () => createTicketOrder({ venueId: restId, date: tomorrow, time: "18:00", name: "Khách quầy", phone: "", source: "Điện thoại", mode: "confirmed", staff: true, tableIds: [T2.id] }));
    const restSlug0 = (await prisma.ticketVenue.findUniqueOrThrow({ where: { id: restId } })).slug;
    const ra = (await publicVenue(restSlug0))!.avail.rest;
    ok("GIỮ BÀN: trang khách — 18:30 báo bận cả T1 (17:30) lẫn T2 (19:30); 17:30 chỉ T1; 20:30 bận T1, T2 (19:30)", [T1.id, T2.id].every((id) => ra[`${tomorrow}|18:30`]?.includes(id)) && ra[`${tomorrow}|17:30`]?.join() === T1.id && [T1.id, T2.id].every((id) => ra[`${tomorrow}|20:30`]?.includes(id)) && (ra[`${addDaysKey(today, 2)}|19:00`] ?? []).length === 0, JSON.stringify({ a: ra[`${tomorrow}|17:30`], b: ra[`${tomorrow}|18:30`] }));
    await patchVenueConfig(restId, { mealMin: 5 });
    ok("GIỮ BÀN: thời lượng chuẩn hoá trong 30–360 phút", (await loadTicketData(restId)).venue.config.mealMin === 30);
    await patchVenueConfig(restId, { mealMin: 9999 });
    ok("GIỮ BÀN: thời lượng tối đa 360 phút", (await loadTicketData(restId)).venue.config.mealMin === 360);
    await patchVenueConfig(restId, { mealMin: 60 });
    const dRest = await createTicketOrder({ venueId: restId, date: tomorrow, time: "18:00", name: "", phone: "", source: "Web", mode: "draft", tableIds: [T2.id] });
    ok("GIỮ BÀN: rút còn 60 phút ⇒ T2 lúc 18:00 (cách 19:30 90 phút) giữ được", !!dRest.token);
    await patchVenueConfig(restId, { mealMin: 120 });
    await rejects("GIỮ BÀN: quán tăng lại 120 phút trước lúc khách chốt ⇒ chốt đơn nháp kiểm lại chồng giờ và từ chối", () => finalizeDraft({ token: dRest.token, slug: restSlug0, name: "Khách nháp", phone: "0900000012", food: [] }));
    await releaseDraft(dRest.token);
    const race2 = await Promise.allSettled(["18:00", "19:00"].map((time, n) => createTicketOrder({ venueId: restId, date: addDaysKey(today, 2), time, name: "Đua bàn " + n, phone: "", source: "Web", mode: "request", tableIds: [T2.id] })));
    ok("GIỮ BÀN: 2 khách cùng lúc giành T2 ở 2 khung chồng giờ (18:00 / 19:00) ⇒ đúng 1 người được", race2.filter((x) => x.status === "fulfilled").length === 1);
    for (const x of race2) if (x.status === "fulfilled") await cancelOrder(restId, x.value.id);
    await rejects("REST: khung giờ ngoài danh sách bị từ chối", () => createTicketOrder({ venueId: restId, date: tomorrow, time: "03:00", name: "Khách", phone: "", source: "Web", mode: "request", tableIds: [T2.id] }));
    await payOrder(restId, b1.id, "Chuyển khoản");
    ok("REST: đã thu cọc", (await loadTicketData(restId)).orders.find((o) => o.id === b1.id)!.paid === 100000);
    await rejects("REST: chưa đến không trả bàn được", () => setTableStatus(restId, b1.id, "done"));
    await setTableStatus(restId, b1.id, "here");
    await setTableStatus(restId, b1.id, "eat");
    await setTableStatus(restId, b1.id, "done");
    ok("REST: đến → lên món → trả bàn ⇒ bàn trống lại", !(await prisma.ticketSeat.count({ where: { orderId: b1.id } })));
    await patchVenueConfig(restId, { policy: "min", amount: 300000 });
    await rejects("REST: chính sách tối thiểu — khách web không đặt món bị từ chối", () => createTicketOrder({ venueId: restId, date: tomorrow, time: "19:00", name: "Khách", phone: "", source: "Web", mode: "request", tableIds: [T2.id] }));
    await cancelOrder(restId, b2.id);
    ok("REST: huỷ bàn ⇒ nhả cả 2 bàn", !(await prisma.ticketSeat.count({ where: { orderId: b2.id } })));

    // ======================= LUỒNG KHÁCH (/ve) =======================
    ok("VietQR: CRC-16/CCITT-FALSE đúng vector chuẩn", crc16("123456789") === "29B1");
    const qr = vietQrPayload({ bin: "970422", account: "0123456789", amount: 900000, memo: "TX-VE-ABCDE" });
    ok("VietQR: đủ trường BIN / STK / số tiền / nội dung + CRC khớp", qr.startsWith("000201010212") && qr.includes("0006970422") && qr.includes("01100123456789") && qr.includes("5406900000") && qr.includes("0811TX-VE-ABCDE") && qr.slice(-4) === crc16(qr.slice(0, -4)), qr);

    const showSlug = (await prisma.ticketVenue.findUniqueOrThrow({ where: { id: showId } })).slug;
    await prisma.ticketVenue.update({ where: { id: showId }, data: { published: false } });
    ok("WEB: địa điểm chưa mở bán không có trang đặt", (await publicVenue(showSlug)) === null);
    await rejects("WEB: địa điểm chưa mở bán không nhận đơn web", () => createTicketOrder({ venueId: showId, date: tomorrow, time: "20:00", name: "", phone: "", source: "Web", mode: "draft", seats: ["G1"] }));
    await prisma.ticketVenue.updateMany({ where: { id: { in: ids } }, data: { published: true } });
    await createSessions(showId, [tomorrow], "20:00");
    await patchVenueConfig(showId, { bankBin: "970422", bankAcc: "0123456789", bankHolder: "bui duc an", holdMin: 45 });

    const d1 = await createTicketOrder({ venueId: showId, date: tomorrow, time: "20:00", name: "", phone: "", source: "Web", mode: "draft", seats: ["A5", "C6"], tickets: [{ tierId: stand.id, qty: 1 }] });
    let pv = (await publicVenue(showSlug))!;
    const ps = pv.avail.shows.find((x) => x.date === tomorrow)!;
    ok("WEB: ghế đang giữ nháp hiện 'held' cho người khác, không lộ tên khách", ps.taken.A5 === "held" && ps.taken.C6 === "held" && ps.standLeft[stand.id] === 2 && !JSON.stringify(pv).includes("Khách"), JSON.stringify(ps.standLeft));
    ok("WEB: đơn nháp không có trang vé", (await orderByToken(d1.token)) === null);
    await rejects("WEB: mỗi đơn tối đa 10 vé", () => createTicketOrder({ venueId: showId, date: tomorrow, time: "20:00", name: "", phone: "", source: "Web", mode: "draft", seats: ["D1", "D2", "D3", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12"] }));
    await rejects("WEB: chốt đơn lệch tổng tiền bị từ chối", () => finalizeDraft({ token: d1.token, slug: showSlug, name: "Khách web", phone: "0900000005", email: "a@b.vn", expectedTotal: 1 }));
    const fin = await finalizeDraft({ token: d1.token, slug: showSlug, name: "Khách web", phone: "0900000005", email: "a@b.vn", expectedTotal: 450000 + 250000 + 150000 });
    const page = (await orderByToken(fin.token))!;
    ok("WEB: chốt đơn ⇒ chờ thanh toán, giữ ghế 30 phút (không theo holdMin 45 của quầy), có thông tin chuyển khoản", page.order.status === "wait" && !!page.order.holdUntil && Math.abs(page.order.holdUntil - Date.now() - 30 * 60_000) < 60_000 && page.webHoldMin === 30 && page.prepay && page.pay?.amount === 850000 && page.pay.holder === "BUI DUC AN", JSON.stringify(page.pay));
    await rejects("WEB: đơn đã chốt không chốt lại được", () => finalizeDraft({ token: d1.token, slug: showSlug, name: "Khách web", phone: "0900000005" }));
    await payOrder(showId, fin.id, "Chuyển khoản");
    const paidPage = (await orderByToken(fin.token))!;
    ok("WEB: thu tiền ⇒ 3 vé, hết phần thanh toán", paidPage.order.status === "ok" && paidPage.order.tickets.length === 3 && paidPage.pay === null);
    ok("30 PHÚT: ghi đã thu tiền ⇒ xoá hạn giữ", paidPage.order.holdUntil === null);
    const staffHold = await createTicketOrder({ venueId: showId, date: tomorrow, time: "20:00", name: "Khách điện thoại", phone: "0900000013", source: "Điện thoại", createdBy: "Test", mode: "hold", staff: true, seats: ["H3"] });
    const shp = (await orderByToken(staffHold.token))!;
    ok("30 PHÚT: đơn quầy / điện thoại giữ cách cũ — holdMin 45 phút", !!shp.order.holdUntil && Math.abs(shp.order.holdUntil - Date.now() - 45 * 60_000) < 60_000 && shp.webHoldMin === null, String(shp.order.holdUntil && Math.round((shp.order.holdUntil - Date.now()) / 60_000)));
    await cancelOrder(showId, staffHold.id);
    const cp = (await orderByToken(staffHold.token))!;
    ok("30 PHÚT: quản trị huỷ tay ⇒ trang khách báo 'đã huỷ', không phải 'hết hạn'", cp.order.status === "cancel" && !cp.expired);

    const d2 = await createTicketOrder({ venueId: showId, date: tomorrow, time: "20:00", name: "", phone: "", source: "Web", mode: "draft", seats: ["F3"] });
    await rejects("ADMIN: không xác nhận / thu tiền đơn khách đang giữ nháp", () => payOrder(showId, d2.id, "Chuyển khoản"));
    await releaseDraft(d2.token);
    pv = (await publicVenue(showSlug))!;
    ok("WEB: khách quay lại ⇒ nhả ghế nháp", !pv.avail.shows.find((x) => x.date === tomorrow)!.taken.F3);
    const d3 = await createTicketOrder({ venueId: showId, date: tomorrow, time: "20:00", name: "", phone: "", source: "Web", mode: "draft", seats: ["F4"] });
    await prisma.ticketOrder.update({ where: { id: d3.id }, data: { holdUntil: new Date(Date.now() - 1000) } });
    await rejects("WEB: quá 10 phút giữ nháp ⇒ không chốt được", () => finalizeDraft({ token: d3.token, slug: showSlug, name: "Khách", phone: "0900000006" }));
    ok("WEB: đơn nháp hết hạn tự nhả ghế", (await releaseExpiredTicketHolds(showId)) === 1 && !(await prisma.ticketSeat.count({ where: { orderId: d3.id } })));

    // --- Hồi quy: hạn giữ chỗ / đua / phát vé ---
    const d4 = await createTicketOrder({ venueId: showId, date: tomorrow, time: "20:00", name: "", phone: "", source: "Web", mode: "draft", seats: ["G2"] });
    await prisma.ticketOrder.update({ where: { id: d4.id }, data: { holdUntil: new Date(Date.now() - 1000) } });
    const after = await createTicketOrder({ venueId: showId, date: tomorrow, time: "20:00", name: "", phone: "", source: "Web", mode: "draft", seats: ["G2"] }).catch((e) => e);
    ok("HỒI QUY: nháp đã hết hạn (chưa chạy tác vụ định kỳ) không chặn người giữ ghế kế tiếp", !(after instanceof Error), after instanceof Error ? after.message : "");
    if (!(after instanceof Error)) await releaseDraft(after.token);

    let raceBad = 0;
    for (let n = 0; n < 6; n++) {
      const w = await createTicketOrder({ venueId: showId, date: tomorrow, time: "20:00", name: "Khách đua", phone: "0900000009", source: "Điện thoại", mode: "hold", staff: true, seats: [`G${3 + n}`] });
      await prisma.ticketOrder.update({ where: { id: w.id }, data: { holdUntil: new Date(Date.now() - 1000) } });
      await Promise.allSettled([payOrder(showId, w.id, "Chuyển khoản"), releaseExpiredTicketHolds(showId)]);
      const row = await prisma.ticketOrder.findUniqueOrThrow({ where: { id: w.id }, include: { seats: true, tickets: true } });
      const consistent = (row.status === "ok" && row.seats.length === 1 && row.tickets.length === 1) || (row.status === "cancel" && row.seats.length === 0 && row.tickets.length === 0);
      if (!consistent) raceBad++;
    }
    ok("HỒI QUY: 'Đã thu tiền' đua với tự nhả hết hạn ⇒ không có đơn đã thu mà mất ghế", raceBad === 0, `${raceBad}/6 lệch`);

    const ex = await createTicketOrder({ venueId: showId, date: tomorrow, time: "20:00", name: "Khách trễ", phone: "0900000010", source: "Điện thoại", mode: "hold", staff: true, seats: ["G10"] });
    await prisma.ticketOrder.update({ where: { id: ex.id }, data: { holdUntil: new Date(Date.now() - 1000) } });
    const exPage = await orderByToken(ex.token);
    ok("HỒI QUY: trang vé của đơn quá hạn giữ chỗ ⇒ đã huỷ, không còn mã chuyển khoản", exPage?.order.status === "cancel" && exPage.pay === null && !(await prisma.ticketSeat.count({ where: { orderId: ex.id } })), `${exPage?.order.status}`);

    const plastic = await prisma.ticketTier.create({ data: { venueId: showId, name: "Ghế nhựa sau", price: 200000, quota: 5 } });
    const po = await createTicketOrder({ venueId: showId, date: today, time: "20:00", name: "Khách ghế nhựa", phone: "", source: "Quầy", mode: "paid", staff: true, tickets: [{ tierId: plastic.id, qty: 2 }] });
    const pt = await prisma.ticket.findMany({ where: { orderId: po.id, kind: "entry" } });
    ok("HỒI QUY: hạng vé không số ghế tên bắt đầu 'Ghế …' vẫn phát đủ vé", pt.length === 2, `${pt.length} vé`);
    const ps2 = pt.length ? await scanTicket("all", "Test", pt[0].token, { venueId: showId }) : null;
    ok("HỒI QUY: soát vé show báo giờ suất", !!ps2 && ps2.kind === "ok" && ps2.sub.includes("suất 20:00"), ps2?.sub);
    await rejects("HỒI QUY: khách web không đặt quá 1 năm", () => createTicketOrder({ venueId: gateId, date: addDaysKey(today, 400), time: "", name: "Khách xa", phone: "0900000011", source: "Web", mode: "request", tickets: [{ tierId: adult.id, qty: 1 }] }));

    // Nhà hàng: chính sách tối thiểu kiểm ở bước chốt; không có tài khoản ⇒ chờ gọi xác nhận.
    const restSlug = (await prisma.ticketVenue.findUniqueOrThrow({ where: { id: restId } })).slug;
    const rd = await createTicketOrder({ venueId: restId, date: tomorrow, time: "19:00", name: "", phone: "", source: "Web", mode: "draft", guests: 5, tableIds: [T2.id] });
    const rv = (await publicVenue(restSlug))!;
    ok("WEB: bàn đang giữ nháp báo đã có khách", rv.avail.rest[`${tomorrow}|19:00`]?.includes(T2.id) === true && rv.venue.policy === "min" && !rv.venue.hasBank);
    await rejects("WEB: chưa đủ tiền món tối thiểu ⇒ không chốt được", () => finalizeDraft({ token: rd.token, slug: restSlug, name: "Khách bàn", phone: "0900000007", food: [] }));
    const rf = await finalizeDraft({ token: rd.token, slug: restSlug, name: "Khách bàn", phone: "0900000007", guests: 5, food: [{ menuId: r.menu[0].id, qty: 1, note: "không cay" }], expectedTotal: 450000 });
    const rp = (await orderByToken(rf.token))!;
    ok("WEB: đặt bàn ⇒ chờ quán xác nhận (giữ 30 phút, không VietQR vì chưa có tài khoản), ghi món + ghi chú", rp.order.status === "wait" && !!rp.order.holdUntil && Math.abs(rp.order.holdUntil - Date.now() - 30 * 60_000) < 60_000 && rp.pay === null && !rp.prepay && rp.order.foodAmount === 450000 && rp.order.items[0].note === "không cay" && rp.tables.join() === "T2" && rp.order.guests === 5);

    // Vé cổng: đơn web chờ gọi xác nhận; thẻ danh sách báo còn vé.
    const gw = await createTicketOrder({ venueId: gateId, date: tomorrow, time: "", name: "Khách cổng", phone: "0900000008", source: "Web", mode: "request", expectedTotal: 2 * adult.price, tickets: [{ tierId: adult.id, qty: 2 }] }).catch((e) => e);
    ok("WEB: ngày tạm dừng vẫn chặn đơn vé cổng", gw instanceof TicketError);
    await patchSession(gateId, tomorrow, "", { status: "open" });
    await rejects("WEB: vé cổng tối đa 20 vé / đơn", () => createTicketOrder({ venueId: gateId, date: tomorrow, time: "", name: "Khách cổng", phone: "0900000008", source: "Web", mode: "request", tickets: [{ tierId: adult.id, qty: 21 }] }));
    await createTicketOrder({ venueId: gateId, date: tomorrow, time: "", name: "Khách cổng", phone: "0900000008", source: "Web", mode: "request", expectedTotal: 2 * adult.price, tickets: [{ tierId: adult.id, qty: 2 }] });
    const cards = (await publicVenueCards()).cards.filter((c) => c.name.includes(stamp));
    const gc = cards.find((c) => c.kind === "GATE"), sc = cards.find((c) => c.kind === "SHOW"), rc = cards.find((c) => c.kind === "RESTAURANT");
    ok("WEB: thẻ danh sách — vé cổng còn 8/10, show có suất ngày mai, nhà hàng còn 1 bàn", gc?.days[tomorrow]?.left === 8 && gc.from === 30000 && sc?.days[tomorrow]?.time === "20:00" && (sc.days[tomorrow]?.left ?? 0) > 0 && sc.from === 150000 && rc?.days[tomorrow]?.left === 1, JSON.stringify([gc?.days[tomorrow], sc?.days[tomorrow], rc?.days[tomorrow]]));

    // --- 30 phút: đơn web quá hạn chưa xác nhận ⇒ tự huỷ, nhả quota / bàn; trang khách báo hết hạn ---
    const gateSlug = (await prisma.ticketVenue.findUniqueOrThrow({ where: { id: gateId } })).slug;
    const leftBefore = (await publicVenue(gateSlug))!.avail.gate[tomorrow].left;
    const gx = await createTicketOrder({ venueId: gateId, date: tomorrow, time: "", name: "Khách quên", phone: "0900000014", source: "Web", mode: "request", tickets: [{ tierId: adult.id, qty: 3 }] });
    const gxp = (await orderByToken(gx.token))!;
    ok("30 PHÚT: trang vé cổng chờ xác nhận — có hạn giữ, không VietQR (vé cổng trả khi gọi xác nhận)", gxp.order.status === "wait" && !!gxp.order.holdUntil && gxp.pay === null && gxp.webHoldMin === 30 && /^\d{2}:\d{2}$/.test(gxp.holdUntilHm));
    await prisma.ticketOrder.update({ where: { id: gx.id }, data: { holdUntil: new Date(Date.now() - 1000) } });
    const gxe = (await orderByToken(gx.token))!;
    ok("30 PHÚT: quá 30 phút chưa xác nhận ⇒ tự huỷ, trang khách báo hết hạn, trả lại 3 vé quota", gxe.order.status === "cancel" && gxe.expired && (await publicVenue(gateSlug))!.avail.gate[tomorrow].left === leftBefore, `${gxe.order.status} ${gxe.expired}`);
    await rejects("30 PHÚT: xác nhận đơn đã tự huỷ bị từ chối", () => confirmOrder(gateId, gx.id));

    await patchVenueConfig(restId, { policy: "deposit", amount: 100000, bankBin: "970436", bankAcc: "999888777", bankHolder: "quan may" });
    const rdx = await createTicketOrder({ venueId: restId, date: tomorrow, time: "20:30", name: "", phone: "", source: "Web", mode: "draft", guests: 2, tableIds: [T1.id] });
    const rfx = await finalizeDraft({ token: rdx.token, slug: restSlug, name: "Khách cọc", phone: "0900000015", guests: 2, food: [], expectedTotal: 100000 });
    const rpx = (await orderByToken(rfx.token))!;
    ok("30 PHÚT: đặt bàn có cọc + tài khoản ⇒ VietQR tiền cọc, giữ 30 phút", rpx.pay?.amount === 100000 && rpx.prepay && !!rpx.order.holdUntil && Math.abs(rpx.order.holdUntil - Date.now() - 30 * 60_000) < 60_000, JSON.stringify(rpx.pay));
    await prisma.ticketOrder.update({ where: { id: rfx.id }, data: { holdUntil: new Date(Date.now() - 1000) } });
    const rpe = (await orderByToken(rfx.token))!;
    ok("30 PHÚT: bàn chưa chuyển cọc quá 30 phút ⇒ tự huỷ + nhả bàn", rpe.order.status === "cancel" && rpe.expired && rpe.pay === null && !(await prisma.ticketSeat.count({ where: { orderId: rfx.id } })));
  } finally {
    const del = await prisma.ticketVenue.deleteMany({ where: { id: { in: ids } } });
    const left = await prisma.ticketOrder.count({ where: { venueId: { in: ids } } });
    console.log(`\nDọn dữ liệu thử: xoá ${del.count} địa điểm, còn sót ${left} đơn.`);
  }
  console.log(`\n${pass} đạt, ${failN} lỗi.`);
  await prisma.$disconnect();
  process.exit(failN ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
