import "server-only";
import { prisma } from "./prisma";
import { parseDateOnly } from "./dates";
import { DEMO_USERNAME, ensureFleetDemo } from "./fleet-demo";
import { createSessions, createTicketOrder, createVenue, patchVenueConfig, toggleSeatLock } from "./ticket";
import { addDaysKey, vnNow } from "./ticket-core";
import { createDineOrder, createDineRequest, loadDine } from "./dine";
import { createWithCode, writeStayCells } from "./stay";

/**
 * BẢN DEMO của các module cho chủ dịch vụ (trang /hop-tac): Bán vé & show (`ticket`), Gọi món QR (`qr`), Quản lý phòng (`home`).
 * (Quản lý xe đã có sẵn ở fleet-demo.ts.) Dùng CHUNG chủ demo + cookie demo của bản demo xe: khách bấm "Mở bản demo"
 * ⇒ /hop-tac/demo?m=… dựng dữ liệu mẫu (nếu cũ) rồi mở /demo/… — trang độc lập, không đụng phiên quản trị.
 * Dữ liệu mẫu để published=false (khách thật không thấy), dựng lại theo ngày hôm nay khi cũ > 6 giờ hoặc sang ngày mới.
 */
export type DemoModule = "xe" | "home" | "ticket" | "qr";
export const DEMO_MODULES: DemoModule[] = ["xe", "home", "ticket", "qr"];
/** Trang demo của từng module. */
export const DEMO_PATH: Record<DemoModule, string> = { xe: "/demo/quan-ly-xe", home: "/demo/quan-ly-phong", ticket: "/demo/ve", qr: "/demo/goi-mon" };

const STALE_MS = 6 * 3600e3;
const HOME_SLUG = "demo-homestay-may-ta-xua";
const NAMES = ["Nguyễn Thu Trang", "Phạm Minh Đức", "Trần Khánh Linh", "Lê Hoàng Nam", "Vũ Hải Yến", "Đặng Quốc Bảo", "Bùi Ngọc Mai", "Hoàng Gia Huy", "Đỗ Lan Anh", "Ngô Minh Châu"];
const phone = (i: number) => "09" + String(10000000 + ((i * 7919301) % 89999999)).slice(0, 8);

/** Chủ demo (tài khoản PROVIDER không đăng nhập bằng mật khẩu được) — tạo cùng bản demo xe. */
export async function demoOwner(): Promise<{ id: string; name: string }> {
  const o = await prisma.adminUser.findUnique({ where: { username: DEMO_USERNAME }, select: { id: true, name: true } });
  if (o) return o;
  const d = await ensureFleetDemo(false);
  return { id: d.ownerId, name: d.ownerName };
}

/** Dữ liệu mẫu còn mới? (cùng ngày + chưa quá 6 giờ; `force` = khách bấm làm mới, tối đa 1 lần / 2 phút). */
async function isFresh(key: string, force: boolean): Promise<boolean> {
  const s = await prisma.siteSetting.findUnique({ where: { key } });
  const at = s ? Number(s.value) || 0 : 0;
  const age = Date.now() - at;
  const fresh = age < STALE_MS && vnNow().today === new Date(at + 7 * 3600e3).toISOString().slice(0, 10);
  return fresh && !(force && age > 120e3);
}
const stamp = (key: string) => prisma.siteSetting.upsert({ where: { key }, create: { key, value: String(Date.now()) }, update: { value: String(Date.now()) } });
/**
 * Dựng lại dữ liệu demo mất hàng chục giây và bắt đầu bằng XOÁ dữ liệu cũ ⇒ không được để hai nơi cùng dựng
 * (hai bản app, hoặc app + script): bên dựng ghi mốc "<key>:building" vào SiteSetting; bên đến sau thấy mốc còn mới
 * (< 4 phút) thì CHỜ tới khi dữ liệu mới xong rồi dùng luôn, không dựng lại.
 */
async function buildOnce(key: string, ready: () => Promise<boolean>, build: () => Promise<void>): Promise<void> {
  const lock = key + ":building";
  for (let i = 0; i < 120; i++) {
    const b = await prisma.siteSetting.findUnique({ where: { key: lock } });
    if (!b || Date.now() - (Number(b.value) || 0) > 240_000) break; // không ai dựng (hoặc bên dựng đã chết)
    await new Promise((r) => setTimeout(r, 2000));
    if (await ready()) return;
  }
  if (await ready()) return;
  await prisma.siteSetting.upsert({ where: { key: lock }, create: { key: lock, value: String(Date.now()) }, update: { value: String(Date.now()) } });
  try {
    await build();
  } finally {
    await prisma.siteSetting.deleteMany({ where: { key: lock } });
  }
}
/** Hai khách bấm demo cùng lúc ⇒ chỉ một bên dựng dữ liệu (bên kia chờ rồi dùng luôn). */
const building = new Map<string, Promise<unknown>>();
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cur = building.get(key) as Promise<T> | undefined;
  if (cur) return cur;
  const p = fn().finally(() => building.delete(key));
  building.set(key, p);
  return p;
}

// ============================ NHÀ HÀNG MẪU (dùng chung cho demo + scripts/seed-ticket-sample.ts) ============================
const TABLES: [string, string, number, number, boolean][] = [
  ["B1", "Trong nhà", 4, 0, false], ["B2", "Trong nhà", 4, 0, false], ["B3", "Trong nhà", 6, 0, false], ["B4", "Trong nhà", 6, 0, false], ["B5", "Trong nhà", 8, 0, false], ["B6", "Trong nhà", 10, 0, false],
  ["BC1", "Ban công view mây", 2, 1, true], ["BC2", "Ban công view mây", 2, 1, true], ["BC3", "Ban công view mây", 4, 1, true], ["BC4", "Ban công view mây", 4, 1, true],
];
/** [tên, nhóm, mô tả chi tiết, giá, bán chạy, còn món] */
const MENU: [string, string, string, number, boolean, boolean][] = [
  ["Lẩu gà đen", "Món chính", "Nồi cho 3–4 người. Gà đen bản nuôi thả đồi, chặt miếng vừa, hầm cùng nấm hương rừng, táo mèo và sả gừng nên nước dùng ngọt thanh, thơm mùi thảo mộc. Kèm rau cải mèo, nấm và mỳ hoặc bún.", 450000, true, true],
  ["Thịt trâu gác bếp", "Món chính", "Đĩa 300g. Thịt trâu tẩm mắc khén, hạt dổi, ớt rồi hun khói trên gác bếp nhiều ngày; nướng lại cho nóng, xé sợi. Thịt dai ngọt, thơm khói, chấm chẩm chéo cay nhẹ — hợp nhâm nhi cùng rượu táo mèo.", 220000, true, true],
  ["Cá suối nướng", "Món chính", "Đĩa 4 con. Cá suối bắt trong ngày, ướp muối ớt, mắc khén, kẹp tre nướng trên than hoa đến khi da giòn, thịt chắc ngọt. Ăn kèm rau thơm và chẩm chéo.", 180000, false, true],
  ["Gà đồi nướng mật ong", "Món chính", "Nửa con (khoảng 700–800g). Gà đồi ướp mật ong rừng, sả, tỏi và mắc khén, nướng than chậm nên da vàng óng, thịt mềm mọng. Chờ khoảng 25–30 phút.", 350000, false, false],
  ["Cơm lam", "Ăn kèm", "1 ống. Gạo nếp nương ngâm, nhồi vào ống nứa non rồi nướng trên lửa than, bóc vỏ còn lớp màng lụa thơm mùi tre. Chấm muối vừng lạc rang.", 40000, true, true],
  ["Cải mèo xào tỏi", "Ăn kèm", "Đĩa vừa cho 2–3 người. Rau cải mèo trồng trên nương, vị hơi đắng nhẹ rồi ngọt hậu, xào lửa lớn với tỏi để rau còn giòn xanh.", 60000, false, true],
  ["Măng đắng luộc", "Ăn kèm", "Đĩa vừa. Măng rừng tươi luộc kỹ cho bớt đắng, giữ vị đắng nhẹ ngọt hậu đặc trưng. Chấm chẩm chéo hoặc muối ớt.", 50000, false, true],
  ["Khoai lang nướng", "Ăn kèm", "Túi 3 củ. Khoai lang trồng trên đồi, nướng vùi than đến khi vỏ xém, ruột vàng dẻo bùi — món ăn vặt ấm bụng khi ngắm mây.", 30000, false, true],
  ["Rượu táo mèo", "Đồ uống", "Bình 500ml. Rượu ngô ngâm táo mèo Tà Xùa từ 6 tháng, màu hổ phách, vị chua chát nhẹ, thơm dịu, uống ấm người. Phục vụ kèm chén nhỏ.", 120000, true, true],
  ["Trà Shan tuyết", "Đồ uống", "Ấm lớn, pha nóng. Búp trà từ những cây chè Shan tuyết cổ thụ trên núi Tà Xùa, nước vàng sáng, vị chát nhẹ rồi ngọt hậu, hương thơm cốm non. Châm thêm nước nóng miễn phí.", 50000, false, true],
  ["Bia Hà Nội", "Đồ uống", "Chai 450ml, ướp lạnh hoặc để nhiệt độ thường tuỳ chọn.", 20000, false, true],
  ["Nước ngọt", "Đồ uống", "Lon 330ml — Coca-Cola, 7Up hoặc Sting. Ghi chú loại muốn uống khi gọi món.", 15000, false, true],
];
/** Mô tả mẫu cũ (bản ngắn) — món còn đúng chữ này / để trống thì được cập nhật sang mô tả chi tiết; quán tự viết thì giữ nguyên. */
const OLD_MENU_DESC = new Set(["Nồi 3–4 người, gà bản, nấm rừng", "Đĩa 300g, chẩm chéo", "Đĩa 4 con, nướng than", "Nửa con", "1 ống, chấm muối vừng", "Chấm chẩm chéo", "Túi 3 củ", "Bình 500ml", "Ấm lớn, nóng", "Chai 450ml", "Coca, 7Up, Sting"]);

/**
 * Ảnh của từng món mẫu: public/hop-tac/demo/mon/<mã>-1..n.jpg — ẢNH THẬT lấy tạm từ kho ảnh các nhà hàng Tà Xùa đã đăng
 * (mâm lẩu gà đen, đồ nướng, mâm cơm bản…), chọn ảnh gần với món nhất chứ không phải ảnh chụp đúng món đó. [mã, số ảnh]
 */
const DISH_IMG: Record<string, [string, number]> = {
  "Lẩu gà đen": ["lau-ga-den", 3], "Thịt trâu gác bếp": ["thit-trau-gac-bep", 2], "Cá suối nướng": ["ca-suoi-nuong", 2], "Gà đồi nướng mật ong": ["ga-doi-nuong-mat-ong", 3],
  "Cơm lam": ["com-lam", 2], "Cải mèo xào tỏi": ["cai-meo-xao-toi", 2], "Măng đắng luộc": ["mang-dang-luoc", 2], "Khoai lang nướng": ["khoai-lang-nuong", 2],
  "Chạm Hoàng Hôn": ["set-cham-hoang-hon", 2], "Say Hoàng Hôn": ["set-say-hoang-hon", 2], "Dạ Tiệc Hoàng Hôn": ["set-da-tiec-hoang-hon", 2],
  "Rượu táo mèo": ["ruou-tao-meo", 1], "Trà Shan tuyết": ["tra-shan-tuyet", 2], "Bia Hà Nội": ["bia-ha-noi", 2], "Nước ngọt": ["nuoc-ngot", 2],
};
const dishImages = (name: string) => (DISH_IMG[name] ? Array.from({ length: DISH_IMG[name][1] }, (_, n) => `/hop-tac/demo/mon/${DISH_IMG[name][0]}-${n + 1}.jpg`) : []);
/** Ảnh bìa địa điểm mẫu (public/hop-tac/demo/bia/) — cũng lấy tạm từ kho ảnh điểm check-in / nhà hàng có sẵn. */
export const demoCover = (name: "mom-ca-heo" | "checkin-doi-may" | "dem-nhac-may" | "acoustic-hoang-hon" | "thac-may-show" | "nha-hang-may-ngan") => `/hop-tac/demo/bia/${name}.jpg`;

/**
 * Đổ dữ liệu mẫu vào một nhà hàng (TicketVenue RESTAURANT): bàn, thực đơn, vài lần gọi món đang chạy, một yêu cầu thanh toán,
 * hai đơn đặt bàn trước cho ngày mai. Cái gì đã có thì bỏ qua ⇒ chạy lại không nhân đôi.
 */
export async function seedRestaurantSample(venueId: string): Promise<void> {
  await patchVenueConfig(venueId, {
    policy: "deposit", amount: 100000,
    floors: [{ name: "Tầng 1", sub: "Sảnh & bếp lửa · lối vào chính" }, { name: "Tầng 2", sub: "Ban công view mây" }],
    notes: ["Quán giữ bàn 15 phút sau giờ hẹn", "Đổi giờ / huỷ bàn báo trước 2 tiếng qua Zalo"],
  });
  const haveT = new Set((await prisma.ticketTable.findMany({ where: { venueId }, select: { name: true } })).map((t) => t.name));
  const newT = TABLES.filter((t) => !haveT.has(t[0]));
  if (newT.length) await prisma.ticketTable.createMany({ data: newT.map(([name, zone, capacity, floor, round], i) => ({ venueId, name, zone, capacity, floor, round, sortOrder: i })) });
  const haveM = new Set((await prisma.ticketMenuItem.findMany({ where: { venueId }, select: { name: true } })).map((m) => m.name));
  const newM = MENU.map((m, i) => [m, i] as const).filter(([m]) => !haveM.has(m[0]));
  if (newM.length) await prisma.ticketMenuItem.createMany({ data: newM.map(([[name, group, description, price, hot, active], i]) => ({ venueId, name, group, description: description || null, price, hot, active, sortOrder: i })) });

  // Món mẫu tạo từ trước còn mô tả cũ / trống ⇒ thay bằng mô tả chi tiết (mô tả quán tự viết thì giữ nguyên).
  for (const m of await prisma.ticketMenuItem.findMany({ where: { venueId, name: { in: MENU.map((x) => x[0]) } }, select: { id: true, name: true, description: true } })) {
    const desc = MENU.find((x) => x[0] === m.name)![2];
    if (desc && desc !== m.description && (!m.description || OLD_MENU_DESC.has(m.description))) await prisma.ticketMenuItem.update({ where: { id: m.id }, data: { description: desc } });
  }

  // Món mẫu chưa có ảnh ⇒ gắn 3 ảnh minh hoạ (món quán đã tự tải ảnh thì giữ nguyên).
  for (const m of await prisma.ticketMenuItem.findMany({ where: { venueId }, select: { id: true, name: true, images: true, imageUrl: true } })) {
    const images = dishImages(m.name);
    const own = [m.imageUrl, ...m.images].some((u) => u && !u.startsWith("/hop-tac/demo/mon/")); // quán đã tự tải ảnh ⇒ giữ nguyên
    if (images.length && !own && images.join() !== m.images.join()) await prisma.ticketMenuItem.update({ where: { id: m.id }, data: { images, imageUrl: images[0] } });
  }

  const d = await loadDine(venueId); // cũng cấp khoá QR cho bàn mới
  const T = (name: string) => d.tables.find((t) => t.name === name)!.id;
  const M = (name: string) => d.menu.find((m) => m.name === name)!.id;
  if (!d.orders.length) {
    const mk = async (table: string, minsAgo: number, status: "new" | "cooking" | "served", items: [string, number, string?][], note = "") => {
      const o = await createDineOrder({ venueId, tableId: T(table), note, items: items.map(([name, qty, nt]) => ({ menuId: M(name), qty, note: nt })) });
      const at = new Date(Date.now() - minsAgo * 60_000);
      await prisma.dineOrder.update({ where: { id: o.id }, data: { createdAt: at, status, cookingAt: status === "new" ? null : new Date(at.getTime() + 60_000), servedAt: status === "served" ? new Date(at.getTime() + 9 * 60_000) : null } });
    };
    await mk("B1", 7, "cooking", [["Lẩu gà đen", 1, "ít cay"], ["Cơm lam", 3], ["Bia Hà Nội", 6]]);
    await mk("B2", 38, "served", [["Thịt trâu gác bếp", 1], ["Cá suối nướng", 1], ["Trà Shan tuyết", 1]]);
    await mk("BC3", 2, "new", [["Rượu táo mèo", 1], ["Khoai lang nướng", 2]], "Lên đồ uống trước");
    await mk("B5", 22, "served", [["Lẩu gà đen", 2], ["Cải mèo xào tỏi", 2, "không tỏi"], ["Nước ngọt", 4]]);
    await mk("B5", 4, "cooking", [["Măng đắng luộc", 1], ["Cơm lam", 4]]);
    await createDineRequest({ venueId, tableId: T("B2"), kind: "pay", method: "Chuyển khoản" });
  }
  if (!(await prisma.ticketOrder.count({ where: { venueId } }))) {
    const tomorrow = addDaysKey(vnNow().today, 1);
    await createTicketOrder({ venueId, date: tomorrow, time: "19:00", name: "Nguyễn Thu Trang (mẫu)", phone: "0900000001", guests: 5, source: "Điện thoại", mode: "confirmed", staff: true, tableIds: [T("B3")], food: [{ menuId: M("Lẩu gà đen"), qty: 1, note: "ít cay" }, { menuId: M("Cơm lam"), qty: 4 }] });
    await createTicketOrder({ venueId, date: tomorrow, time: "18:30", name: "Phạm Minh Đức (mẫu)", phone: "0900000002", guests: 2, source: "Web", mode: "request", staff: true, tableIds: [T("BC1")] });
  }
}

// ============================ SHOW NGỒI BÀN (mẫu theo "Thác Mây Show – Acoustic Hoàng Hôn") ============================
/**
 * Đổ dữ liệu mẫu cho một show bán theo BÀN, theo cấu hình công khai trên thacmaytaxua.vn (xem ngày 19/11/2026):
 * diễn 16:30–18:30 mỗi ngày · 15 bàn Premium (P-01…P-15) + 25 bàn Standard (S-01…S-25), mỗi bàn 2–4 người, giữ bàn miễn phí ·
 * khách chọn 1 trong 3 Set Hoàng Hôn (199k / 279k / 399k cho 2 người). Chạy lại không nhân đôi.
 */
export async function seedTableShowSample(venueId: string): Promise<void> {
  // Sơ đồ 8 hàng × 5 bàn: 3 hàng đầu Premium (15 bàn), 5 hàng sau Standard (25 bàn).
  const cells: Record<string, string> = {};
  for (let r = 0; r < 8; r++) for (let c = 0; c < 5; c++) cells[`${r}-${c}`] = r < 3 ? "vip" : "norm";
  await prisma.ticketVenue.update({ where: { id: venueId }, data: { layout: { rows: 8, cols: 5, cells } } });
  await patchVenueConfig(venueId, {
    seatUnit: "table", holdMin: 30, artist: "Ban nhạc acoustic · nhạc công saxophone, violin, sáo trúc", hours: "16:30 – 18:30 · khung giờ hoàng hôn",
    notes: ["Mỗi bàn 2 – 4 người, vui lòng đặt trước để giữ bàn view đẹp", "Mỗi bàn chọn 1 trong 3 Set Hoàng Hôn", "Premium: tầng cao, view toàn cảnh hoàng hôn, nhạc công phục vụ tận bàn", "Standard: view sân khấu, xếp theo vị trí còn trống"],
  });
  await prisma.ticketTier.updateMany({ where: { venueId, seatClass: "vip" }, data: { name: "Premium", price: 0, listPrice: null } });
  await prisma.ticketTier.updateMany({ where: { venueId, seatClass: "norm" }, data: { name: "Standard", price: 0, listPrice: null } });
  for (const m of await prisma.ticketMenuItem.findMany({ where: { venueId, imageUrl: { startsWith: "/hop-tac/demo/mon/" } }, select: { id: true, name: true } }))
    if (dishImages(m.name).length) await prisma.ticketMenuItem.update({ where: { id: m.id }, data: { images: dishImages(m.name), imageUrl: dishImages(m.name)[0] } });
  if (!(await prisma.ticketMenuItem.count({ where: { venueId } })))
    await prisma.ticketMenuItem.createMany({
      data: ([["Chạm Hoàng Hôn", 199000, "SET 1 · 2 ly rượu vang + khoai tây chiên · cho 2 người", false], ["Say Hoàng Hôn", 279000, "SET 2 · 2 ly rượu vang + khoai tây chiên + đĩa hoa quả · cho 2 người", true], ["Dạ Tiệc Hoàng Hôn", 399000, "SET 3 · 2 ly rượu vang cao cấp + khoai tây chiên + thịt lợn khô Tây Bắc · cho 2 người", false]] as const)
        .map(([name, price, description, hot], i) => ({ venueId, name, group: "Set Hoàng Hôn", price, description, hot, sortOrder: i, images: dishImages(name), imageUrl: dishImages(name)[0] ?? null })),
    });
  const { today } = vnNow();
  await createSessions(venueId, Array.from({ length: 7 }, (_, i) => addDaysKey(today, i)), "16:30");
  if (await prisma.ticketOrder.count({ where: { venueId } })) return;
  const menu = await prisma.ticketMenuItem.findMany({ where: { venueId }, orderBy: { sortOrder: "asc" } });
  const key = (r: number, c: number) => String.fromCharCode(65 + r) + (c + 1);
  // [ngày, các bàn, set (0–2), cách đặt]
  const ORDERS: [number, string[], number, "paid" | "confirmed" | "hold"][] = [
    [0, [key(0, 0)], 2, "paid"], [0, [key(0, 1), key(0, 2)], 1, "paid"], [0, [key(1, 2)], 1, "confirmed"], [0, [key(3, 0)], 0, "paid"], [0, [key(3, 1)], 1, "paid"], [0, [key(4, 3)], 0, "confirmed"], [0, [key(2, 4)], 2, "hold"],
    [1, [key(0, 2)], 2, "paid"], [1, [key(1, 0), key(1, 1)], 1, "confirmed"], [1, [key(5, 2)], 0, "paid"],
  ];
  for (const [i, [d, seats, set, mode]] of ORDERS.entries())
    await createTicketOrder({ venueId, date: addDaysKey(today, d), time: "16:30", name: NAMES[i % NAMES.length], phone: phone(60 + i), guests: seats.length * 3, source: i % 3 === 0 ? "Zalo" : "Web", mode, payMethod: "Chuyển khoản", staff: true, seats, food: [{ menuId: menu[set].id, qty: seats.length }] });
}

// ============================ DEMO BÁN VÉ · SHOW · NHÀ HÀNG ============================
const TICKET_KEY = "ticketDemoSeededAt";

/** Ba địa điểm demo của chủ demo: vé cổng, show có sơ đồ ghế, nhà hàng (đặt bàn + gọi món QR). */
export async function ensureTicketDemo(force = false): Promise<{ ownerId: string; ownerName: string }> {
  return once("ticket", async () => {
    const owner = await demoOwner();
    const ready = async () => (await prisma.ticketVenue.count({ where: { ownerId: owner.id } })) >= 5 && (await isFresh(TICKET_KEY, force));
    await buildOnce(TICKET_KEY, ready, () => buildTicketDemo(owner));
    return { ownerId: owner.id, ownerName: owner.name };
  });
}

async function buildTicketDemo(owner: { id: string; name: string }): Promise<void> {
  {
    await prisma.siteSetting.deleteMany({ where: { key: TICKET_KEY } }); // đang dựng dở ⇒ chưa coi là "mới"
    await prisma.ticketVenue.deleteMany({ where: { ownerId: owner.id } });
    const { today } = vnNow();

    // --- Vé cổng ---
    const gate = await createVenue({ kind: "GATE", name: "Mỏm Cá Heo (demo)", ownerId: owner.id });
    await prisma.ticketVenue.update({ where: { id: gate }, data: { coverImage: demoCover("mom-ca-heo") } });
    await prisma.ticketVenue.update({ where: { id: gate }, data: { area: "Háng Đồng · 9 km", description: "Mỏm đá nhô ra giữa biển mây. Vé gồm phí vào cổng, giữ xe máy và chòi ngắm mây." } });
    await patchVenueConfig(gate, { quota: 150, hours: "05:00 – 18:00", notes: ["Vé dùng trong ngày đã chọn, vào cổng 1 lần", "Đổi ngày miễn phí trước 20:00 hôm trước"] });
    const sideMenu = (venueId: string, rows: [string, string, number, string][]) =>
      prisma.ticketMenuItem.createMany({ data: rows.map(([name, group, price, description], i) => ({ venueId, name, group, price, description, sortOrder: i, images: dishImages(name), imageUrl: dishImages(name)[0] ?? null })) });
    await sideMenu(gate, [["Trà Shan tuyết", "Đồ uống nóng", 25000, "Ấm nhỏ cho 2 người, trà Shan tuyết cổ thụ pha nóng — vị chát nhẹ, ngọt hậu. Nhận và uống ngay tại chòi ngắm mây."], ["Khoai lang nướng", "Ăn nhẹ", 20000, "Túi 3 củ khoai đồi nướng vùi than, ruột vàng dẻo bùi, còn nóng khi giao."], ["Nước ngọt", "Đồ uống", 15000, "Lon 330ml — Coca-Cola, 7Up hoặc Sting, chọn khi nhận tại quầy vé."]]);
    const gTiers = await prisma.ticketTier.findMany({ where: { venueId: gate }, orderBy: { sortOrder: "asc" } });
    const tea = (await prisma.ticketMenuItem.findFirstOrThrow({ where: { venueId: gate, name: "Trà Shan tuyết" } })).id;
    const gOrder = (i: number, date: string, mode: "paid" | "confirmed" | "request", source: string, ad: number, ch = 0, food = 0) =>
      createTicketOrder({ venueId: gate, date, time: "", name: NAMES[i % NAMES.length], phone: phone(i), source, mode, staff: true, tickets: [{ tierId: gTiers[0].id, qty: ad }, { tierId: gTiers[1].id, qty: ch }], food: food ? [{ menuId: tea, qty: food }] : [] });
    await gOrder(0, today, "paid", "Quầy", 18, 4);
    await gOrder(1, today, "confirmed", "Web", 3);
    await gOrder(2, today, "request", "Web", 2, 1);
    await gOrder(3, today, "request", "CTV", 4, 0, 2);
    await gOrder(4, addDaysKey(today, 1), "confirmed", "Zalo", 12, 3);
    await gOrder(5, addDaysKey(today, 2), "confirmed", "Web", 130, 6);

    // --- Điểm check-in thứ hai: nhiều hạng vé (có vé kèm đồ uống, vé hoàng hôn, giá gạch) ---
    const doi = await createVenue({ kind: "GATE", name: "Checkin Đồi Mây (demo)", ownerId: owner.id });
    await prisma.ticketVenue.update({ where: { id: doi }, data: { coverImage: demoCover("checkin-doi-may") } });
    await prisma.ticketVenue.update({ where: { id: doi }, data: { area: "Đỉnh Gió · 2 km từ trung tâm", description: "Đồi cỏ nhìn thẳng xuống biển mây, có xích đu, cầu gỗ và chòi ngắm hoàng hôn. Vé gồm phí vào cổng và giữ xe." } });
    await patchVenueConfig(doi, { quota: 200, hours: "05:00 – 18:30", notes: ["Vé dùng trong ngày đã chọn", "Trẻ dưới 6 tuổi miễn phí, vẫn lấy vé để soát", "Vé hoàng hôn chỉ vào sau 16:00"] });
    await prisma.ticketTier.deleteMany({ where: { venueId: doi } });
    await prisma.ticketTier.createMany({
      data: [
        { venueId: doi, name: "Người lớn", price: 40000, listPrice: 50000, sortOrder: 0 },
        { venueId: doi, name: "Trẻ em 6–11 tuổi", price: 20000, sortOrder: 1 },
        { venueId: doi, name: "Dưới 6 tuổi", price: 0, sortOrder: 2 },
        { venueId: doi, name: "Vé hoàng hôn (sau 16:00)", price: 30000, sortOrder: 3 },
        { venueId: doi, name: "Vé + trà Shan tuyết", price: 60000, listPrice: 75000, sortOrder: 4 },
      ],
    });
    await sideMenu(doi, [["Trà Shan tuyết", "Đồ uống nóng", 25000, "Ấm nhỏ cho 2 người, trà Shan tuyết cổ thụ pha nóng — vị chát nhẹ, ngọt hậu. Nhận và uống ngay tại chòi ngắm mây."], ["Khoai lang nướng", "Ăn nhẹ", 20000, "Túi 3 củ khoai đồi nướng vùi than, ruột vàng dẻo bùi, còn nóng khi giao."]]);
    const dTiers = await prisma.ticketTier.findMany({ where: { venueId: doi }, orderBy: { sortOrder: "asc" } });
    const dOrder = (i: number, date: string, mode: "paid" | "confirmed" | "request", source: string, qty: number[]) =>
      createTicketOrder({ venueId: doi, date, time: "", name: NAMES[(i + 4) % NAMES.length], phone: phone(110 + i), source, mode, staff: true, tickets: dTiers.map((t, n) => ({ tierId: t.id, qty: qty[n] ?? 0 })) });
    await dOrder(0, today, "paid", "Quầy", [10, 3, 2]);
    await dOrder(1, today, "confirmed", "Web", [2, 0, 0, 0, 2]);
    await dOrder(2, today, "request", "Web", [0, 0, 0, 4]);
    await dOrder(3, addDaysKey(today, 1), "confirmed", "CTV", [8, 2]);

    // --- Show ---
    const show = await createVenue({ kind: "SHOW", name: "Đêm nhạc Mây (demo)", ownerId: owner.id });
    await prisma.ticketVenue.update({ where: { id: show }, data: { coverImage: demoCover("dem-nhac-may") } });
    await prisma.ticketVenue.update({ where: { id: show }, data: { area: "Sân khấu ngoài trời Đỉnh Gió", description: "Đêm nhạc mộc giữa sương núi, có lửa trại và trà nóng. Ghế có số chia hạng VIP và Thường, thêm khu đứng sát sân khấu." } });
    await patchVenueConfig(show, { artist: "Ban nhạc Mây Ngàn & khách mời", hours: "Mở cửa trước 45 phút · diễn khoảng 2 tiếng", holdMin: 30 });
    // Lối đi giữa các khối ghế (cột 4 và 11), 2 hàng đầu VIP (đã có sẵn từ createVenue).
    const cells: Record<string, string> = {};
    for (let r = 0; r < 8; r++) for (let c = 0; c < 14; c++) cells[`${r}-${c}`] = c === 3 || c === 10 ? "aisle" : r < 2 ? "vip" : "norm";
    await prisma.ticketVenue.update({ where: { id: show }, data: { layout: { rows: 8, cols: 14, cells } } });
    await prisma.ticketTier.create({ data: { venueId: show, name: "Khu đứng", price: 150000, quota: 40, sortOrder: 2 } });
    const stand = (await prisma.ticketTier.findFirstOrThrow({ where: { venueId: show, seatClass: null } })).id;
    await sideMenu(show, [["Trà Shan tuyết", "Đồ uống", 30000, "Cốc giấy 300ml trà Shan tuyết pha nóng, giữ ấm suốt đêm nhạc. Đưa mã voucher để nhận tại quầy đồ uống."], ["Rượu táo mèo", "Đồ uống", 30000, "Shot 50ml rượu ngô ngâm táo mèo Tà Xùa, chua chát nhẹ, uống ấm người. Chỉ bán cho khách từ 18 tuổi."], ["Bia Hà Nội", "Đồ uống", 25000, "Chai 450ml ướp lạnh, nhận tại quầy đồ uống."], ["Khoai lang nướng", "Ăn nhẹ", 25000, "Túi 3 củ khoai đồi nướng than hồng, ăn nóng bên lửa trại."]]);
    const days = [today, addDaysKey(today, 1), addDaysKey(today, 2)];
    for (const d of days) await createSessions(show, [d], d === days[2] ? "19:30" : "20:00");
    const seat = (r: number, c: number) => String.fromCharCode(65 + r) + (c + 1);
    const free = (c: number) => c !== 3 && c !== 10;
    // Suất hôm nay bán vừa phải, suất mai gần kín.
    for (const [si, ratio] of [[0, 0.42], [1, 0.86]] as const) {
      const time = "20:00";
      let n = 0;
      for (let r = 0; r < 8; r++) {
        const row = Array.from({ length: 14 }, (_, c) => c).filter((c) => free(c) && Math.abs(Math.sin((si * 100 + r + 3) * 12.9898 + (c + 7) * 78.233) * 43758.5453) % 1 < ratio).map((c) => seat(r, c));
        // Mỗi hàng chia 2–3 đơn (đoàn ngồi cạnh nhau).
        for (let i = 0; i < row.length; i += 4) {
          const part = row.slice(i, i + 4);
          await createTicketOrder({ venueId: show, date: days[si], time, name: NAMES[n % NAMES.length], phone: phone(20 + n), source: n % 5 === 0 ? "Quầy" : n % 3 === 0 ? "CTV" : "Web", mode: "paid", payMethod: n % 5 === 0 ? "Tiền mặt" : "Chuyển khoản", staff: true, seats: part });
          n++;
        }
      }
      await createTicketOrder({ venueId: show, date: days[si], time, name: NAMES[7], phone: phone(77), source: "Web", mode: "paid", payMethod: "Chuyển khoản", staff: true, tickets: [{ tierId: stand, qty: si ? 30 : 12 }] });
    }
    const s0 = await prisma.ticketSession.findFirstOrThrow({ where: { venueId: show, date: parseDateOnly(today) } });
    const taken = new Set((await prisma.ticketSeat.findMany({ where: { sessionId: s0.id }, select: { key: true } })).map((x) => x.key));
    const freeSeats = Array.from({ length: 8 * 14 }, (_, i) => [Math.floor(i / 14), i % 14] as const).filter(([, c]) => free(c)).map(([r, c]) => seat(r, c)).filter((k) => !taken.has(k));
    // Hai đơn đang chờ chuyển khoản (đếm ngược) + hai ghế khoá cho khách mời.
    await createTicketOrder({ venueId: show, date: today, time: "20:00", name: NAMES[2], phone: phone(90), source: "Web", mode: "hold", staff: true, seats: freeSeats.slice(0, 2) });
    await createTicketOrder({ venueId: show, date: today, time: "20:00", name: NAMES[3], phone: phone(91), source: "Điện thoại", mode: "hold", staff: true, seats: freeSeats.slice(2, 5) });
    for (const k of freeSeats.slice(5, 7)) await toggleSeatLock(show, s0.id, k);

    // --- Show ngồi bàn (kiểu Acoustic Hoàng Hôn) ---
    const tshow = await createVenue({ kind: "SHOW", name: "Acoustic Hoàng Hôn (demo)", ownerId: owner.id });
    await prisma.ticketVenue.update({ where: { id: tshow }, data: { coverImage: demoCover("acoustic-hoang-hon") } });
    await prisma.ticketVenue.update({ where: { id: tshow }, data: { area: "Sân khấu ngắm hoàng hôn · Đỉnh Gió", description: "Đêm nhạc acoustic đón hoàng hôn: ngồi bàn 2–4 người, chọn một Set Hoàng Hôn, nhạc công phục vụ tận bàn ở khu Premium." } });
    await seedTableShowSample(tshow);

    // --- Nhà hàng (đặt bàn + gọi món QR) ---
    const rest = await createVenue({ kind: "RESTAURANT", name: "Nhà hàng Mây Ngàn (demo)", ownerId: owner.id });
    await prisma.ticketVenue.update({ where: { id: rest }, data: { coverImage: demoCover("nha-hang-may-ngan") } });
    await prisma.ticketVenue.update({ where: { id: rest }, data: { area: "Trung tâm Tà Xùa", description: "Lẩu gà đen, thịt trâu gác bếp, cơm lam. Ban công nhìn thẳng xuống thung lũng mây." } });
    await patchVenueConfig(rest, { hours: "10:00 – 22:00" });
    await seedRestaurantSample(rest);
    await stamp(TICKET_KEY);
  }
}

// ============================ DEMO QUẢN LÝ PHÒNG ============================
const HOME_KEY = "stayDemoSeededAt";

/** Homestay demo của chủ demo: 3 hạng phòng, 8 phòng, vài lượt ở quanh hôm nay. */
export async function ensureStayDemo(force = false): Promise<{ ownerId: string; ownerName: string; serviceId: string }> {
  return once("home", async () => {
    const owner = await demoOwner();
    const cur = await prisma.service.findUnique({ where: { slug: HOME_SLUG }, select: { id: true } });
    if (cur && (await isFresh(HOME_KEY, force))) return { ownerId: owner.id, ownerName: owner.name, serviceId: cur.id };
    await prisma.service.deleteMany({ where: { slug: HOME_SLUG } });
    const { today } = vnNow();
    const svc = await prisma.service.create({
      data: { slug: HOME_SLUG, category: "HOMESTAY", title: "Homestay Mây Tà Xùa (demo)", summary: "Homestay mẫu cho bản demo quản lý phòng.", description: "Dữ liệu mẫu, không bán trên web.", published: false, ownerId: owner.id, contactPhone: "0397943155" },
    });
    const TYPES: [string, number, number, string[]][] = [["Phòng đôi view mây", 2, 900000, ["101", "102", "201", "202"]], ["Bungalow gia đình", 4, 1600000, ["BG1", "BG2"]], ["Phòng tập thể", 6, 1200000, ["TT1", "TT2"]]];
    const rooms: Record<string, string> = {};
    for (const [ti, [name, capacity, price, list]] of TYPES.entries()) {
      const t = await prisma.roomType.create({ data: { serviceId: svc.id, name, capacity, weekdayPrice: price, weekendPrice: Math.round(price * 1.2), totalRooms: list.length, sortOrder: ti, cloudView: ti === 0 } });
      for (const [ri, rn] of list.entries()) rooms[rn] = (await prisma.room.create({ data: { roomTypeId: t.id, name: rn, capacity, listPrice: price, priceSat: Math.round(price * 1.2), sortOrder: ri } })).id;
    }
    const D = (n: number) => addDaysKey(today, n);
    // [phòng, nhận, trả, khách, số người, cọc, đã nhận phòng?, nguồn, tên đoàn]
    const STAYS: [string, number, number, number, number, number, boolean, string, string?][] = [
      ["101", -1, 1, 0, 2, 900000, true, "Gọi điện"],
      ["102", -2, 0, 1, 2, 1800000, true, "Facebook"],
      ["201", 0, 3, 2, 2, 1000000, false, "Zalo"],
      ["202", 2, 4, 3, 2, 0, false, "Gọi điện"],
      ["BG1", -1, 2, 4, 4, 2000000, true, "Zalo"],
      ["BG2", 3, 5, 5, 4, 1500000, false, "Gọi điện", "Đoàn Mai Anh"],
      ["TT1", 3, 5, 5, 6, 0, false, "Gọi điện", "Đoàn Mai Anh"],
      ["101", 4, 6, 6, 2, 500000, false, "Vãng lai"],
    ];
    await prisma.$transaction(async (tx) => {
      for (const [rn, a, b, who, guests, dep, inHouse, src, group] of STAYS) {
        const ci = D(a), co = D(b), nights = b - a;
        const price = TYPES.find((t) => t[3].includes(rn))![2];
        const s = await createWithCode(tx, {
          serviceId: svc.id, roomId: rooms[rn], groupId: group ? "g:demo" : null, groupName: group ?? null, customerName: NAMES[who], phone: phone(40 + who), guests,
          checkIn: parseDateOnly(ci), checkOut: parseDateOnly(co), total: price * nights, source: src,
          holdUntil: dep > 0 || group ? null : new Date(Date.now() + 20 * 3_600_000), createdBy: owner.name,
          checkedInAt: inHouse ? new Date(Date.parse(`${ci}T14:20:00+07:00`)) : null,
        });
        if (dep > 0) await tx.stayPayment.create({ data: { stayId: s.id, amount: dep, method: "Chuyển khoản", kind: "Cọc", by: owner.name } });
        await writeStayCells(tx, { id: s.id, roomId: rooms[rn], ci, co }, dep > 0 || !!group ? "BOOKED" : "PENDING");
      }
    }, { timeout: 60_000, maxWait: 30_000 });
    await stamp(HOME_KEY);
    return { ownerId: owner.id, ownerName: owner.name, serviceId: svc.id };
  });
}
