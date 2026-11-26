import { SITE } from "@/lib/site";
import "server-only";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { vnNow } from "@/lib/fleet-core";

/**
 * BẢN DEMO quản lý xe (nút "Xem bản demo" ở /hop-tac/xe-may).
 * Một nhà xe mẫu (ẩn khỏi web: published=false ⇒ không lên tìm kiếm / không nhận combo) + chủ xe mẫu.
 * Khách vào demo nhận phiên vai trò DEMO (src/lib/auth-token.ts) — proxy chỉ cho /admin/provider/xe,
 * API đội xe chặn tạo tài khoản, chặn tải tệp. Dữ liệu tự dựng lại theo NGÀY HÔM NAY khi cũ hơn 6 giờ.
 */
export const DEMO_USERNAME = "demo-nha-xe";
const DEMO_SLUG = "demo-nha-xe-may-ta-xua";
const SEED_KEY = "fleetDemoSeededAt";
const STALE_MS = 6 * 3600e3;

const IMG = {
  vang: "/hop-tac/xe-vang.jpg", xanh: "/hop-tac/xe-xanh.jpg", bac: "/hop-tac/xe-bac.jpg", hong: "/hop-tac/xe-hong.jpg",
  den: "/hop-tac/demo/pg1-den.jpg", wTrang: "/hop-tac/demo/wave-trang.jpg", wDen: "/hop-tac/demo/wave-den.jpg", wDo: "/hop-tac/demo/wave-mau.jpg",
};

const NAMES = [
  "Nguyễn Thu Hà", "Trần Minh Đức", "Lê Lan Anh", "Phạm Quang Huy", "Đỗ Anh Tuấn", "Vũ Hải Yến", "Hoàng Văn Nam", "Bùi Thị Mai",
  "Ngô Khánh Linh", "Đặng Tiến Dũng", "Lý Hoàng Nam", "Trịnh Thu Trang", "Mai Xuân Phúc", "Cao Minh Khoa", "Tạ Ngọc Ánh", "Kiều Văn Hải",
  "Phan Thảo Vy", "Hà Quang Vinh", "Lương Bích Ngọc", "Đinh Văn Quân", "Nguyễn Hoàng Long", "Trần Bảo Châu", "Lê Đức Thịnh", "Phạm Hồng Nhung",
  "Vũ Tuấn Kiệt", "Đoàn Mỹ Linh", "Hồ Quốc Bảo", "Chu Thanh Hương", "Tô Gia Huy", "Dương Khánh Vân", "Lâm Nhật Minh", "Quách Thu Thảo",
];
const PHONES = NAMES.map((_, i) => "0" + ["98", "97", "96", "86", "91", "94", "88", "39", "38", "35", "33", "32", "70", "76", "77", "78"][i % 16] + String(1234567 + i * 271829).slice(-7));
const CTVS = ["CTV Hà Nội Trip", "CTV Mây Tà Xùa", "CTV Săn Mây"];
const BLACK_IDX = 27; // khách trong danh sách đen

/** Số ngẫu nhiên tất định (dữ liệu mỗi lần dựng giống nhau, đẹp và ổn định). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const addDays = (k: string, n: number) => new Date(Date.parse(k + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const D = (k: string) => new Date(k + "T00:00:00Z");
const at = (k: string, hm: string, offsetDays = 0) => new Date(Date.parse(addDays(k, offsetDays) + "T" + hm + ":00+07:00"));

async function lastSeed(): Promise<number> {
  const s = await prisma.siteSetting.findUnique({ where: { key: SEED_KEY } });
  return s ? Number(s.value) || 0 : 0;
}

/** Đảm bảo có nhà xe demo còn mới; `force` = khách bấm "Làm mới dữ liệu mẫu" (tối đa 1 lần / 2 phút). */
export async function ensureFleetDemo(force = false): Promise<{ ownerId: string; ownerName: string; serviceId: string }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(918273645)");
    const owner = await tx.adminUser.findUnique({ where: { username: DEMO_USERNAME } });
    const svc = owner ? await tx.service.findUnique({ where: { slug: DEMO_SLUG } }) : null;
    const seededAt = await lastSeed();
    const age = Date.now() - seededAt;
    const fresh = !!owner && !!svc && age < STALE_MS && vnNow().today === new Date(seededAt + 7 * 3600e3).toISOString().slice(0, 10);
    if (fresh && !(force && age > 120e3)) return { ownerId: owner!.id, ownerName: owner!.name, serviceId: svc!.id };
    return seedDemo(tx);
  }, { timeout: 60_000, maxWait: 30_000 });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function seedDemo(tx: Tx) {
  const { today: T } = vnNow();
  const r = rng(20261117);
  const pick = <X,>(a: readonly X[]) => a[Math.floor(r() * a.length)];

  // Chủ xe demo (không đăng nhập bằng mật khẩu được — chỉ vào qua nút demo).
  let owner = await tx.adminUser.findUnique({ where: { username: DEMO_USERNAME } });
  if (!owner) {
    owner = await tx.adminUser.create({ data: { username: DEMO_USERNAME, name: "Nhà xe Mây Tà Xùa", role: "PROVIDER", phone: SITE.defaultPhone, passwordHash: await bcrypt.hash(randomUUID(), 8) } });
  }
  await tx.adminUser.deleteMany({ where: { providerId: owner.id, role: "STAFF" } });
  await tx.service.deleteMany({ where: { slug: DEMO_SLUG } });

  const svc = await tx.service.create({
    data: { slug: DEMO_SLUG, category: "MOTORBIKE", title: "Nhà xe Mây Tà Xùa (demo)", summary: "Nhà xe mẫu cho bản demo quản lý xe.", description: "Dữ liệu mẫu, không bán trên web.", published: false, ownerId: owner.id, contactPhone: SITE.defaultPhone },
  });
  const pg1 = await tx.rentalVehicle.create({ data: { serviceId: svc.id, vehicleType: "Yamaha PG-1", pricePerDay: 280000, totalUnits: 5 } });
  const wave = await tx.rentalVehicle.create({ data: { serviceId: svc.id, vehicleType: "Honda Wave", pricePerDay: 180000, totalUnits: 3 } });
  await tx.adminUser.create({ data: { username: "demo-nv-" + randomUUID().slice(0, 6), name: "Tuấn giao xe", role: "STAFF", providerId: owner.id, phone: "0912345678", passwordHash: await bcrypt.hash(randomUUID(), 8) } });

  await tx.fleetConfig.create({
    data: {
      serviceId: svc.id,
      data: {
        webSync: true, wk: 30000, hol: 50000, md3: 10000, md5: 20000, U: { wk: "vnd", hol: "vnd", md3: "vnd", md5: "vnd" },
        hourly: { so: 30000, ga: 40000, con: 50000 }, late: 30000, fuel: 20000, far: 50000, holdH: 24, ctv: 10, oilCost: 120000, insCost: 66000,
        acc: { "2 mũ bảo hiểm": 300000, "Áo mưa": 50000, "Khoá đĩa": 200000, "Giá đỡ điện thoại": 100000 },
        hols: ["2026-12-31", "2027-01-01", "2027-02-05", "2027-02-06", "2027-02-07"],
        black: { [PHONES[BLACK_IDX]]: "Trả xe trễ 2 ngày, không nghe máy, xe trầy yếm trái" },
        staff: [], ctvPaid: {},
      },
    },
  });

  // Đội xe: [tên, biển, loại, màu, đời, odo, giá, ảnh, loại web, tình trạng, chế độ, odo thay nhớt gần nhất, hạn bảo hiểm (ngày)]
  const V: [string, string, string, string, number, number, number, string, string, string, string, number, number][] = [
    ["Yamaha PG-1", "26B2-777.15", "con", "Vàng", 2024, 8600, 280000, IMG.vang, pg1.id, "good", "ready", 7900, 210],
    ["Yamaha PG-1", "26B2-781.02", "con", "Xanh ngọc", 2024, 12480, 280000, IMG.xanh, pg1.id, "good", "ready", 10600, 160],
    ["Yamaha PG-1", "26B2-850.66", "con", "Bạc", 2023, 15200, 280000, IMG.bac, pg1.id, "ok", "ready", 13450, 20],
    ["Yamaha PG-1", "26B1-520.33", "con", "Hồng", 2024, 6300, 280000, IMG.hong, pg1.id, "good", "ready", 5100, 290],
    ["Yamaha PG-1", "26B2-812.40", "con", "Đen nhám", 2023, 18950, 280000, IMG.den, pg1.id, "good", "ready", 17200, 120],
    ["Honda Wave RSX", "26B1-234.56", "so", "Trắng", 2022, 21400, 180000, IMG.wTrang, wave.id, "good", "ready", 20100, 240],
    ["Honda Wave Alpha", "26B1-318.62", "so", "Đen", 2023, 14700, 180000, IMG.wDen, wave.id, "ok", "ready", 13200, 75],
    ["Honda Wave Alpha", "26B1-402.15", "so", "Đỏ", 2021, 27800, 180000, IMG.wDo, wave.id, "service", "maint", 25300, 45],
  ];
  const vehicles: { id: string }[] = [];
  for (const [i, v] of V.entries()) {
    vehicles.push(
      await tx.fleetVehicle.create({
        data: {
          serviceId: svc.id, sortOrder: i, name: v[0], plate: v[1], kind: v[2], color: v[3], year: v[4], odo: v[5], pricePerDay: v[6],
          imageUrl: v[7], media: [v[7]], rentalVehicleId: v[8], condition: v[9], mode: v[10], lastOilOdo: v[11], oilEvery: 2000,
          insuranceExp: D(addDays(T, v[12])), note: i === 7 ? "Đang thay má phanh, côn" : null,
        },
      }),
    );
  }

  type Row = { id: string; code: string; vehicleId: string; customerName: string; phone: string; cccd: string | null; startDate: Date; endDate: Date; startTime: string; endTime: string; total: number; deposit: number; place: string; source: string; note: string | null; state: string | null; webPending: boolean; ctvName: string | null; hand: object | null; ret: object | null; fees: object; createdAt: Date };
  type Pay = { id: string; rentalId: string; at: Date; amount: number; method: string; kind: string; by: string };
  const rows: Row[] = [];
  const pays: Pay[] = [];
  let n = 0;
  const code = () => "XD-" + String(++n).padStart(4, "0");
  const cccd = (i: number) => "0" + String(10000000000 + i * 3571113).slice(-11);
  const add = (o: Partial<Row> & { vi: number; ci: number; s: string; e: string; total: number }, p: [number, string, string, string, string?][] = []) => {
    const id = randomUUID();
    const { vi, ci, s, e, ...rest } = o;
    rows.push({
      id, code: code(), vehicleId: vehicles[vi].id, customerName: NAMES[ci], phone: PHONES[ci], cccd: cccd(ci),
      startDate: D(s), endDate: D(e), startTime: "08:00", endTime: "17:00", deposit: p.reduce((a, x) => a + x[0], 0),
      place: "Nhận tại cửa hàng", source: "Zalo", note: null, state: null, webPending: false, ctvName: null, hand: null, ret: null, fees: [],
      createdAt: at(s, "09:00", -3), ...rest,
    });
    for (const [amt, kind, method, when, by] of p) pays.push({ id: randomUUID(), rentalId: id, amount: amt, kind, method, at: new Date(when), by: by ?? "Chủ xe" });
  };
  // Biên bản giao xe mẫu có kèm ảnh chụp xe lúc giao (ảnh của chính chiếc xe đó).
  const hand = (vi: number, odo: number, k: string, hm = "08:05") => ({ odo, fuel: "Đầy", acc: ["2 mũ bảo hiểm", "Áo mưa"], doc: "CCCD gốc", photos: [V[vi][7]], at: k + "T" + hm, by: "Tuấn giao xe" });

  // Lịch sử ~4 tháng (đã trả xe) — mùa mây tháng 10–11 dày khách hơn.
  for (const [vi, v] of V.entries()) {
    let cur = addDays(T, -125 + Math.floor(r() * 4));
    let odo = v[5] - 2600;
    const stop = addDays(T, vi === 0 || vi === 2 || vi === 4 ? -3 : -2);
    while (true) {
      const recent = Date.parse(cur) > Date.parse(addDays(T, -45));
      cur = addDays(cur, Math.floor(r() * (recent ? 2 : 5)));
      const len = r() < 0.12 ? 1 : r() < 0.6 ? 2 : 3; // ít lượt 1 ngày ⇒ lịch tháng gọn, đọc được tên khách
      const e = addDays(cur, len - 1);
      if (e >= stop) break;
      const ci = Math.floor(r() * NAMES.length);
      const days = len;
      const wkSur = [0, 6].includes(new Date(cur + "T00:00:00Z").getUTCDay()) ? 30000 : 0;
      const total = days * v[6] + wkSur - (days >= 3 ? 10000 * days : 0);
      const src = ci === BLACK_IDX ? "Zalo" : pick(["Web", "Web", "Zalo", "Zalo", "Khách quen", "CTV"] as const);
      const fees = ci === BLACK_IDX ? [{ k: "Trả muộn 5 giờ", amt: 150000 }, { k: "Hư hỏng: trầy yếm trái", amt: 200000 }] : r() < 0.12 ? [pick([{ k: "Trả muộn 1 giờ", amt: 30000 }, { k: "Thiếu xăng 1 vạch", amt: 20000 }, { k: "Mất Áo mưa", amt: 50000 }])] : [];
      const extra = fees.reduce((a, f) => a + f.amt, 0);
      const dep = Math.round((total * 0.3) / 10000) * 10000;
      const km = 60 + Math.floor(r() * 90) * days;
      const method = r() < 0.55 ? "Chuyển khoản" : "Tiền mặt";
      add(
        { vi, ci, s: cur, e, total, state: "done", source: src, ctvName: src === "CTV" ? pick(CTVS) : null, fees, place: r() < 0.3 ? "Giao tận homestay" : "Nhận tại cửa hàng", hand: hand(vi, odo, cur), ret: { odo: odo + km, fuel: fees.some((f) => f.k.startsWith("Thiếu xăng")) ? "3/4" : "Đầy", at: e + "T16:40", by: "Tuấn giao xe" } },
        [[dep, "Cọc", "Chuyển khoản", at(cur, "20:15", -1).toISOString()], [total - dep + extra, "Thu khi trả", method, at(e, "16:45").toISOString(), "Tuấn giao xe"]],
      );
      odo += km;
      cur = addDays(e, 1);
    }
  }

  // Hiện tại & sắp tới — đủ mọi trạng thái để demo.
  const Y = addDays(T, -1);
  add({ vi: 0, ci: 0, s: Y, e: T, endTime: "17:00", total: 600000, source: "Zalo", state: "renting", hand: hand(0, 8540, Y, "08:10") }, [[180000, "Cọc", "Chuyển khoản", at(Y, "21:00", -1).toISOString()]]);
  add({ vi: 0, ci: 1, s: addDays(T, 3), e: addDays(T, 5), total: 840000, source: "Web" }, [[250000, "Cọc", "Chuyển khoản", at(T, "08:30", -1).toISOString()]]);
  add({ vi: 1, ci: 2, s: T, e: addDays(T, 2), startTime: "14:00", endTime: "12:00", total: 840000, source: "Web", place: "Giao tận homestay" }, [[250000, "Cọc", "Chuyển khoản", at(T, "19:20", -2).toISOString()]]);
  add({ vi: 1, ci: 3, s: addDays(T, 6), e: addDays(T, 8), total: 840000, source: "Zalo", note: "Hẹn cọc tối nay", createdAt: new Date(Date.now() - 2 * 3600e3) });
  add({ vi: 2, ci: 4, s: Y, e: addDays(T, 1), total: 840000, source: "Khách quen", state: "renting", hand: hand(2, 15080, Y, "07:50") }, [[300000, "Cọc", "Tiền mặt", at(Y, "07:50").toISOString(), "Tuấn giao xe"]]);
  add({ vi: 2, ci: 13, s: addDays(T, 4), e: addDays(T, 5), total: 560000, source: "Web", webPending: true, createdAt: new Date(Date.now() - 40 * 60e3) });
  add({ vi: 3, ci: 5, s: addDays(T, 2), e: addDays(T, 5), total: 1080000, source: "CTV", ctvName: CTVS[1] }, [[300000, "Cọc", "Chuyển khoản", at(T, "10:05", -1).toISOString()]]);
  add({ vi: 4, ci: 6, s: addDays(T, -2), e: Y, total: 560000, source: "Zalo", state: "renting", hand: hand(4, 18800, addDays(T, -2), "08:20"), note: "Khách báo kẹt sương mù, về muộn" }, [[200000, "Cọc", "Chuyển khoản", at(T, "21:30", -3).toISOString()]]);
  add({ vi: 5, ci: 7, s: T, e: T, startTime: "07:00", endTime: "18:00", total: 180000, source: "Khách quen", state: "renting", hand: hand(5, 21390, T, "07:05") }, [[180000, "Thu đủ", "Tiền mặt", at(T, "07:05").toISOString(), "Tuấn giao xe"]]);
  add({ vi: 5, ci: 8, s: addDays(T, 1), e: addDays(T, 2), total: 360000, source: "Web", webPending: true, createdAt: new Date(Date.now() - 15 * 60e3) });
  add({ vi: 6, ci: 9, s: addDays(T, 1), e: addDays(T, 3), total: 510000, source: "CTV", ctvName: CTVS[0] }, [[150000, "Cọc", "Chuyển khoản", at(T, "09:40").toISOString()]]);
  add({ vi: 6, ci: 10, s: addDays(T, 5), e: addDays(T, 6), total: 360000, source: "Zalo", createdAt: new Date(Date.now() - 5 * 3600e3) });

  await tx.fleetRental.createMany({ data: rows.map((x) => ({ ...x, hand: x.hand ?? undefined, ret: x.ret ?? undefined })) as never });
  await tx.fleetPayment.createMany({ data: pays });

  // Bảo dưỡng: thay nhớt gần nhất + bảo hiểm.
  const logs = V.flatMap((v, i) => [
    { vehicleId: vehicles[i].id, date: D(addDays(T, -20 - i * 3)), what: "Thay nhớt", cost: 120000, odo: v[11] },
    ...(i % 3 === 0 ? [{ vehicleId: vehicles[i].id, date: D(addDays(T, -60 - i)), what: "Thay lốp sau", cost: 350000, odo: v[11] - 1500 }] : []),
    { vehicleId: vehicles[i].id, date: D(addDays(T, v[12] - 365)), what: "Gia hạn bảo hiểm TNDS", cost: 66000, odo: null },
  ]);
  logs.push({ vehicleId: vehicles[7].id, date: D(T), what: "Thay má phanh + côn", cost: 450000, odo: 27800 });
  await tx.fleetServiceLog.createMany({ data: logs });

  await tx.siteSetting.upsert({ where: { key: SEED_KEY }, create: { key: SEED_KEY, value: String(Date.now()) }, update: { value: String(Date.now()) } });
  return { ownerId: owner.id, ownerName: owner.name, serviceId: svc.id };
}

/** Cookie RIÊNG của bản demo (không đụng phiên đăng nhập quản trị `taxua_admin`). */
export const DEMO_COOKIE = "taxua_fleet_demo";

/** Phiên demo từ cookie riêng (vai trò DEMO) — dùng cho trang /demo/quan-ly-xe và API đội xe. */
export async function getDemoSession() {
  const { cookies } = await import("next/headers");
  const { verifySessionToken } = await import("@/lib/auth-token");
  const tok = (await cookies()).get(DEMO_COOKIE)?.value;
  const s = tok ? await verifySessionToken(tok) : null;
  return s?.role === "DEMO" ? s : null;
}
