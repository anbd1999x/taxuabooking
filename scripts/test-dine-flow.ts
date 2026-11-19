/**
 * Kiểm thử luồng Gọi món QR tại bàn (src/lib/dine.ts) trên DB thật: tạo 1 nhà hàng thử ("zz test qr …"), chạy các ca rồi TỰ DỌN.
 * Chạy: npx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env scripts/test-dine-flow.ts
 */
import { prisma } from "../src/lib/prisma";
import { TicketError, createVenue, patchVenueConfig } from "../src/lib/ticket";
import { addDineFee, addDineTable, advanceDineOrder, cancelDineOrder, cancelDineOrderByGuest, claimDinePaid, rejectDineClaim, removeDineFee, saveDineBank, closeDineRequest, createDineOrder, createDineRequest, dineCustomerState, loadDine, payDineTable, rotateDineQr, SOLD_DAYS, tableForQr, tableForQrGuarded } from "../src/lib/dine";
import { isFee, tableState } from "../src/lib/dine-core";
import { crc16 } from "../src/lib/ticket-core";

let pass = 0, failN = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) pass++;
  else failN++;
  console.log(`${cond ? "✓" : "✗ FAIL"} ${name}${extra ? " — " + extra : ""}`);
};
async function rejects(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(name, false, "không bị từ chối");
  } catch (e) {
    ok(name, e instanceof TicketError, e instanceof Error ? e.message : "");
  }
}

async function main() {
  const stamp = Date.now().toString(36);
  let venueId = "";
  try {
    venueId = await createVenue({ kind: "RESTAURANT", name: `zz test qr ${stamp}` });
    const slug = (await prisma.ticketVenue.findUniqueOrThrow({ where: { id: venueId } })).slug;
    ok("Thêm bàn: tự đánh số theo khu", (await addDineTable(venueId, "Trong nhà")) === "TN1" && (await addDineTable(venueId, "Trong nhà")) === "TN2" && (await addDineTable(venueId, "Ban công")) === "BC1");
    await prisma.ticketMenuItem.createMany({ data: [
      { venueId, name: "Lẩu gà đen", group: "Món chính", price: 450000, hot: true, description: "Nồi 3–4 người" },
      { venueId, name: "Cơm lam", group: "Ăn kèm", price: 40000 },
      { venueId, name: "Gà đồi nướng", group: "Món chính", price: 350000, active: false },
    ] });
    let d = await loadDine(venueId);
    const [t1, t2] = d.tables.filter((t) => t.zone === "Trong nhà");
    const lau = d.menu.find((m) => m.name === "Lẩu gà đen")!, com = d.menu.find((m) => m.name === "Cơm lam")!, ga = d.menu.find((m) => m.name === "Gà đồi nướng")!;
    ok("Mỗi bàn có đường dẫn QR kèm khoá", d.tables.length === 3 && d.tables.every((t) => /^\/qr\/[a-z0-9-]+\/[a-z0-9]+\?k=[0-9a-f]{8}$/.test(t.url)), d.tables[0].url);
    ok("Thực đơn: hết món + bán chạy + mô tả", !ga.avail && lau.hot && lau.desc === "Nồi 3–4 người");

    // --- mã QR ---
    const key = new URL("http://x" + t1.url).searchParams.get("k")!;
    const q = (await tableForQr(slug, "tn1", key))!;
    ok("QR đúng khoá ⇒ ra đúng bàn (không phân biệt hoa thường)", q?.table.id === t1.id);
    ok("QR sai khoá / khoá của bàn khác / sai quán ⇒ không vào được", (await tableForQr(slug, "tn1", "deadbeef")) === null && (await tableForQr(slug, "tn2", key)) === null && (await tableForQr("khong-co-quan", "tn1", key)) === null && (await tableForQr(slug, "tn1", "")) === null);

    // Chống dò khoá: 20 bộ sai KHÁC NHAU / IP ⇒ chặn cả khoá đúng; một bộ sai lặp lại (trang cũ tự nạp) không chặn.
    const ipA = `test-${stamp}-a`, ipB = `test-${stamp}-b`;
    for (let i = 0; i < 30; i++) await tableForQrGuarded(ipB, slug, "tn1", "deadbeef");
    ok("Một mã sai lặp lại (điện thoại nạp lại) không chặn IP", (await tableForQrGuarded(ipB, slug, "tn1", key))?.table.id === t1.id);
    for (let i = 0; i < 20; i++) await tableForQrGuarded(ipA, slug, "tn1", (0xa0000000 + i).toString(16));
    ok("Dò 20 khoá sai khác nhau ⇒ IP bị chặn cả khoá đúng, IP khác vẫn vào", (await tableForQrGuarded(ipA, slug, "tn1", key)) === null && (await tableForQrGuarded(ipB, slug, "tn1", key))?.table.id === t1.id);

    // --- Đổi mã QR ---
    const key2 = new URL("http://x" + t2.url).searchParams.get("k")!;
    const rot = await rotateDineQr(venueId, t2.id);
    const key2b = new URL("http://x" + rot.url).searchParams.get("k")!;
    ok("Đổi mã QR: khoá mới khác khoá cũ, đường dẫn mới trả về để in", key2b !== key2 && /^[0-9a-f]{8}$/.test(key2b) && (await loadDine(venueId)).tables.find((t) => t.id === t2.id)!.url === rot.url);
    ok("Đổi mã QR: thẻ cũ bị từ chối ngay, thẻ mới vào đúng bàn, bàn khác không ảnh hưởng", (await tableForQr(slug, "tn2", key2)) === null && (await tableForQr(slug, "tn2", key2b))?.table.id === t2.id && (await tableForQr(slug, "tn1", key))?.table.id === t1.id);
    await rejects("Đổi mã QR: bàn của quán khác bị từ chối", () => rotateDineQr("khong-phai-quan-nay", t2.id));

    // --- gọi món ---
    await rejects("Gọi món đang 'Hết món' bị từ chối", () => createDineOrder({ venueId, tableId: t1.id, items: [{ menuId: ga.id, qty: 1 }] }));
    await rejects("Giỏ trống bị từ chối", () => createDineOrder({ venueId, tableId: t1.id, items: [{ menuId: lau.id, qty: 0 }] }));
    await rejects("Số lượng quá lớn bị từ chối", () => createDineOrder({ venueId, tableId: t1.id, items: [{ menuId: lau.id, qty: 999 }] }));
    await rejects("Tách cùng một món thành nhiều dòng để vượt giới hạn phần bị từ chối", () => createDineOrder({ venueId, tableId: t1.id, items: [{ menuId: lau.id, qty: 30 }, { menuId: lau.id, qty: 30, note: "x" }] }));
    await rejects("Món của quán khác / không tồn tại bị từ chối", () => createDineOrder({ venueId, tableId: t1.id, items: [{ menuId: "khong-co", qty: 1 }] }));
    await rejects("Bàn chưa gọi món không xin thanh toán được", () => createDineRequest({ venueId, tableId: t1.id, kind: "pay", method: "Tiền mặt" }));
    const o1 = await createDineOrder({ venueId, tableId: t1.id, items: [{ menuId: lau.id, qty: 1, note: "ít cay" }, { menuId: com.id, qty: 3 }], note: "Lên đồ uống trước" });
    ok("Gọi 4 món", o1.qty === 4);
    // Quán đổi giá SAU khi khách gọi: đơn cũ giữ giá cũ.
    await prisma.ticketMenuItem.update({ where: { id: com.id }, data: { price: 50000 } });
    d = await loadDine(venueId);
    const v1 = d.orders.find((o) => o.id === o1.id)!;
    ok("Đơn mới: giá chụp lúc gọi (570.000đ), có ghi chú món + ghi chú bàn", v1.status === "new" && v1.total === 570000 && v1.items[0].note === "ít cay" && v1.note === "Lên đồ uống trước" && v1.table === "TN1");
    ok("Bàn chuyển sang 'chờ món', bàn khác vẫn trống", tableState(d.orders, d.reqs, t1.id) === "wait" && tableState(d.orders, d.reqs, t2.id) === "free");

    let c = await dineCustomerState(q);
    ok("Khách thấy lần gọi + tạm tính, chưa có VietQR (quán chưa khai tài khoản)", c.orders.length === 1 && c.bill === 570000 && c.bank === null && !c.paid && c.menu.find((m) => m.id === com.id)!.price === 50000);

    await advanceDineOrder(venueId, o1.id);
    ok("Nhận đơn ⇒ bếp đang làm", (await loadDine(venueId)).orders[0].status === "cooking");
    const o2 = await createDineOrder({ venueId, tableId: t1.id, items: [{ menuId: com.id, qty: 2 }] });
    await advanceDineOrder(venueId, o1.id);
    d = await loadDine(venueId);
    ok("Lên món lần 1, lần gọi 2 còn mới ⇒ bàn vẫn 'chờ món', hoá đơn gộp 670.000đ", d.orders.find((o) => o.id === o1.id)!.status === "served" && !!d.orders.find((o) => o.id === o1.id)!.servedAt && tableState(d.orders, d.reqs, t1.id) === "wait" && d.orders.reduce((a, o) => a + o.total, 0) === 670000);
    await advanceDineOrder(venueId, o1.id);
    ok("Đơn đã lên món bấm tiếp không đổi gì", (await loadDine(venueId)).orders.find((o) => o.id === o1.id)!.status === "served");
    await rejects("Không huỷ được lần gọi đã lên món", () => cancelDineOrder(venueId, o1.id));
    await cancelDineOrder(venueId, o2.id);
    d = await loadDine(venueId);
    ok("Huỷ lần gọi 2 ⇒ rời hoá đơn, bàn 'đang dùng bữa'", d.orders.length === 1 && tableState(d.orders, d.reqs, t1.id) === "eat");
    ok("Quán tự huỷ ⇒ không báo 'khách huỷ'", d.guestCancels.length === 0);

    // --- khách tự huỷ (bếp chưa bắt đầu làm) ---
    const g1 = await createDineOrder({ venueId, tableId: t1.id, items: [{ menuId: com.id, qty: 2 }] });
    await rejects("Khách bàn khác không huỷ được lần gọi của bàn này", () => cancelDineOrderByGuest(venueId, t2.id, g1.id));
    await cancelDineOrderByGuest(venueId, t1.id, g1.id);
    d = await loadDine(venueId);
    ok("Khách huỷ lần gọi còn 'Đơn mới' ⇒ rời hoá đơn + quán thấy trong 'khách vừa huỷ'", !d.orders.some((o) => o.id === g1.id) && d.guestCancels.length === 1 && d.guestCancels[0].table === "TN1" && d.guestCancels[0].qty === 2 && d.guestCancels[0].summary.includes("2×"), JSON.stringify(d.guestCancels));
    const g2 = await createDineOrder({ venueId, tableId: t1.id, items: [{ menuId: com.id, qty: 1 }] });
    await advanceDineOrder(venueId, g2.id);
    await rejects("Bếp đã bấm 'Đang làm' ⇒ khách không tự huỷ được", () => cancelDineOrderByGuest(venueId, t1.id, g2.id));
    await cancelDineOrder(venueId, g2.id); // dọn: quán huỷ hộ

    // --- gọi nhân viên / xin thanh toán ---
    await createDineRequest({ venueId, tableId: t1.id, kind: "staff" });
    await createDineRequest({ venueId, tableId: t1.id, kind: "staff" });
    d = await loadDine(venueId);
    ok("Gọi nhân viên 2 lần chỉ ra 1 yêu cầu", d.reqs.length === 1 && d.reqs[0].kind === "staff");
    await closeDineRequest(venueId, d.reqs[0].id);
    await createDineRequest({ venueId, tableId: t1.id, kind: "pay", method: "Tiền mặt" });
    await patchVenueConfig(venueId, { bankBin: "970422", bankAcc: "0123456789", bankHolder: "nha hang may ngan" });
    await createDineRequest({ venueId, tableId: t1.id, kind: "pay", method: "Chuyển khoản" });
    d = await loadDine(venueId);
    ok("Đổi cách thanh toán cập nhật yêu cầu cũ; bàn 'chờ thanh toán'", d.reqs.length === 1 && d.reqs[0].method === "Chuyển khoản" && tableState(d.orders, d.reqs, t1.id) === "pay");
    c = await dineCustomerState((await tableForQr(slug, "TN1", key))!);
    ok("Khách thấy VietQR đúng số tiền + nội dung 'BAN TN1'", c.payReq === "Chuyển khoản" && c.bank?.memo === "BAN TN1" && !!c.bank && c.bank.qr.includes("5406570000") && c.bank.qr.includes("0807BAN TN1") && c.bank.qr.slice(-4) === crc16(c.bank.qr.slice(0, -4)) && c.bank.holder === "NHA HANG MAY NGAN", c.bank?.qr);

    // Tên bàn có dấu: nội dung CK hiện cho khách khớp chuỗi trong VietQR.
    const san = await prisma.ticketTable.create({ data: { venueId, name: "Sân 1", zone: "Sân vườn", qrKey: "abcdef12" } });
    await createDineOrder({ venueId, tableId: san.id, items: [{ menuId: com.id, qty: 1 }] });
    await createDineRequest({ venueId, tableId: san.id, kind: "pay", method: "Chuyển khoản" });
    const cs = await dineCustomerState((await tableForQr(slug, "sân 1", "abcdef12"))!);
    ok("Bàn tên có dấu: nội dung CK 'BAN SAN 1' khớp mã VietQR", cs.bank?.memo === "BAN SAN 1" && !!cs.bank?.qr.includes("0809BAN SAN 1"), cs.bank?.memo);
    // Bàn chuyển 'ngừng dùng' khi còn món chưa thu ⇒ vẫn hiện trên sơ đồ để thu tiền.
    await prisma.ticketTable.update({ where: { id: san.id }, data: { active: false } });
    ok("Bàn ngừng dùng còn món chưa thu vẫn hiện để thu tiền", (await loadDine(venueId)).tables.some((t) => t.id === san.id));
    await payDineTable(venueId, san.id, "Tiền mặt", "Test");
    ok("Thu xong ⇒ bàn ngừng dùng rời sơ đồ", !(await loadDine(venueId)).tables.some((t) => t.id === san.id));

    // --- thu tiền ---
    // Nhân viên mở hoá đơn (thấy o1) → khách gọi thêm trước khi bấm thu ⇒ từ chối, lần gọi mới không bị đóng 'đã thu'.
    const seenIds = (await loadDine(venueId)).orders.filter((o) => o.tableId === t1.id).map((o) => o.id);
    const late = await createDineOrder({ venueId, tableId: t1.id, items: [{ menuId: com.id, qty: 1 }] });
    await rejects("Thu tiền khi bàn vừa gọi thêm (nhân viên chưa thấy) bị từ chối", () => payDineTable(venueId, t1.id, "Tiền mặt", "Test", seenIds));
    ok("Lần gọi mới vẫn ở cột Đơn mới", (await prisma.dineOrder.findUniqueOrThrow({ where: { id: late.id } })).status === "new");
    await cancelDineOrder(venueId, late.id);
    await rejects("Bàn trống không thu tiền được", () => payDineTable(venueId, t2.id, "Tiền mặt", "Test"));
    const got = await payDineTable(venueId, t1.id, "Chuyển khoản", "Test", seenIds);
    d = await loadDine(venueId);
    ok("Đã thu · dọn bàn: thu 570.000đ, bàn trống, hết yêu cầu, tính vào doanh thu hôm nay", got === 570000 && !d.orders.length && !d.reqs.length && d.revenueToday === 620000 && tableState(d.orders, d.reqs, t1.id) === "free");
    c = await dineCustomerState(q);
    ok("Điện thoại khách hiện 'Cảm ơn'", c.paid && !c.orders.length && c.bill === 0);
    await createDineOrder({ venueId, tableId: t1.id, items: [{ menuId: com.id, qty: 1 }] });
    c = await dineCustomerState(q);
    ok("Khách mới ngồi vào gọi món ⇒ hết 'Cảm ơn', hoá đơn mới theo giá mới", !c.paid && c.bill === 50000);
    ok("Thực đơn đếm 'đã bán' (không tính lần gọi đã huỷ)", (await loadDine(venueId)).menu.find((m) => m.id === com.id)!.sold === 5, String((await loadDine(venueId)).menu.find((m) => m.id === com.id)!.sold));
    // PERF-3: 'đã bán' chỉ tính SOLD_DAYS (30) ngày gần nhất — lần gọi cũ hơn (đã thu) không cộng vào, màn quán nạp 5 giây/lần không groupBy cả lịch sử.
    const old = await createDineOrder({ venueId, tableId: t2.id, items: [{ menuId: com.id, qty: 3 }] });
    await prisma.dineOrder.update({ where: { id: old.id }, data: { status: "paid", createdAt: new Date(Date.now() - (SOLD_DAYS + 10) * 86_400_000) } });
    ok("PERF-3: lần gọi quá 30 ngày không tính vào 'đã bán'", (await loadDine(venueId)).menu.find((m) => m.id === com.id)!.sold === 5);

    // --- phụ thu + khách báo đã chuyển khoản (bàn thử riêng PT1, món lẩu ⇒ không lệch các ca đếm ở trên/dưới) ---
    const pt = await prisma.ticketTable.create({ data: { venueId, name: "PT1", zone: "Trong nhà", qrKey: "feed0001" } });
    const qp = (await tableForQr(slug, "PT1", "feed0001"))!;
    await rejects("Phụ thu bàn chưa có món bị từ chối", () => addDineFee(venueId, pt.id, "Phí phục vụ", 10000));
    await createDineOrder({ venueId, tableId: pt.id, items: [{ menuId: lau.id, qty: 1 }] });
    const base = (await dineCustomerState(qp)).bill;
    await rejects("Phụ thu số tiền 0 bị từ chối", () => addDineFee(venueId, pt.id, "Phí phục vụ", 0));
    await addDineFee(venueId, pt.id, "Phí phục vụ", 30000);
    await addDineFee(venueId, pt.id, "Khăn lạnh", 5000);
    d = await loadDine(venueId);
    const ptFees = d.orders.filter((o) => o.tableId === pt.id && isFee(o));
    await removeDineFee(venueId, ptFees.find((o) => o.items[0].name === "Khăn lạnh")!.id);
    let cp = await dineCustomerState(qp);
    ok("Phụ thu cộng vào hoá đơn khách + mã VietQR; bỏ phụ thu thì trừ lại", cp.bill === base + 30000 && !!cp.bank?.qr.includes(`54${String(base + 30000).length.toString().padStart(2, "0")}${base + 30000}`), `${base} → ${cp.bill}`);
    ok("Phụ thu ở trạng thái 'đã lên món', nguồn 'Phụ thu' (không vào cột bếp)", ptFees.length === 2 && ptFees.every((o) => o.status === "served"));
    await claimDinePaid(qp, "/uploads/bill-test.jpg");
    cp = await dineCustomerState(qp);
    d = await loadDine(venueId);
    const pr = d.reqs.find((r) => r.tableId === pt.id)!;
    ok("Khách báo đã CK ⇒ quán thấy yêu cầu CK kèm ảnh bill + số tiền lúc báo", pr?.kind === "pay" && pr.method === "Chuyển khoản" && pr.claim?.amount === base + 30000 && pr.claim.proof === "/uploads/bill-test.jpg" && cp.payClaim?.amount === base + 30000, JSON.stringify(pr));
    await rejectDineClaim(venueId, pr.id, "Chưa thấy tiền về");
    cp = await dineCustomerState(qp);
    ok("Quán báo chưa nhận được ⇒ khách thấy lý do, hết trạng thái 'đã CK'", !cp.payClaim && cp.claimNote === "Chưa thấy tiền về" && cp.payReq === "Chuyển khoản");
    await claimDinePaid(qp, null);
    cp = await dineCustomerState(qp);
    ok("Gửi lại xác nhận (không ảnh) ⇒ xoá lý do cũ", !!cp.payClaim && cp.payClaim.proof === null && cp.claimNote === "");
    const ptIds = (await loadDine(venueId)).orders.filter((o) => o.tableId === pt.id).map((o) => o.id);
    const paidPt = await payDineTable(venueId, pt.id, "Chuyển khoản", "Test", ptIds);
    d = await loadDine(venueId);
    ok("Xác thực · hoàn thành ⇒ thu đủ cả phụ thu, đóng bàn + yêu cầu", paidPt === base + 30000 && !d.orders.some((o) => o.tableId === pt.id) && !d.reqs.some((r) => r.tableId === pt.id), String(paidPt));
    // Cấu hình tài khoản chuyển khoản
    await rejects("Lưu tài khoản: ngân hàng không hợp lệ", () => saveDineBank(venueId, "123", "0123456789", "NGUYEN VAN A"));
    await rejects("Lưu tài khoản: số tài khoản quá ngắn", () => saveDineBank(venueId, "970436", "12", "NGUYEN VAN A"));
    await saveDineBank(venueId, "970436", " 0071 0000 12345 ", "Nguyễn Văn Ánh");
    d = await loadDine(venueId);
    ok("Lưu tài khoản: bỏ khoảng trắng STK, tên chủ TK bỏ dấu + viết hoa", d.venue.bankBin === "970436" && d.venue.bankAcc === "0071000012345" && d.venue.bankHolder === "NGUYEN VAN ANH", JSON.stringify(d.venue));
    await saveDineBank(venueId, "", "", "");
    await createDineOrder({ venueId, tableId: pt.id, items: [{ menuId: lau.id, qty: 1 }] });
    const qpOff = (await tableForQr(slug, "PT1", "feed0001"))!; // mỗi yêu cầu thật đều đọc lại cấu hình quán
    await rejects("Tắt chuyển khoản ⇒ khách không báo 'đã CK' được", () => claimDinePaid(qpOff, null));
    await payDineTable(venueId, pt.id, "Tiền mặt", "Test");

    // Xoá bàn ⇒ mã QR cũ hết dùng, lịch sử đơn vẫn còn tên bàn.
    await prisma.dineOrder.updateMany({ where: { venueId, status: "new" }, data: { status: "cancel" } });
    await prisma.ticketTable.delete({ where: { id: t1.id } });
    ok("Xoá bàn: QR cũ không vào được, đơn cũ giữ tên bàn", (await tableForQr(slug, "tn1", key)) === null && (await prisma.dineOrder.count({ where: { venueId, tableName: "TN1", tableId: null } })) === 6); // 4 lần gọi + 2 lần thử khách huỷ
  } finally {
    if (venueId) await prisma.ticketVenue.delete({ where: { id: venueId } });
    console.log(`\nDọn dữ liệu thử: còn sót ${await prisma.dineOrder.count({ where: { venueId } })} đơn.`);
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
