import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getDemoSession } from "@/lib/fleet-demo";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";
import { isVideoUrl } from "@/lib/utils";
import { canManageFleet, fleetCode, loadConfig, loadFleet, lockFleet, pushFleetPayments, rentalVM, saveConfig, syncFleetForBooking, vehicleVM } from "@/lib/fleet";
import { hashPassword } from "@/lib/auth";
import {
  FLEET_ACC,
  FLEET_DOCS,
  FUEL_LEVELS,
  addDaysKey,
  diffDays,
  feeSum,
  isVehicleFree,
  normPlate,
  normalizeConfig,
  quoteRental,
  rentalStatus,
  returnFees,
  vnNow,
} from "@/lib/fleet-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KINDS = ["so", "ga", "con"];
const CONDS = ["good", "ok", "service"];
const MODES = ["ready", "maint", "off"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^0\d{9}$/;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown) => {
  const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};
const r10k = (n: number) => Math.round(n / 10000) * 10000;
const fuelOk = (f: unknown) => ((FUEL_LEVELS as readonly string[]).includes(String(f)) ? String(f) : "Đầy");
const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
/** Danh sách media hợp lệ (chỉ tệp đã tải lên /uploads, tối đa 24). */
const cleanMedia = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map((x) => str(x, 300)).filter((x) => /^\/uploads\/[\w.-]+$/.test(x)))].slice(0, 24) : [];
const coverOf = (media: string[]) => media.find((u) => !isVideoUrl(u)) ?? null;

/**
 * Quản lý đội xe (chủ dịch vụ xe máy / admin) — theo mẫu "Admin Quan ly Xe may v2".
 * Mọi thao tác trả lại toàn bộ dữ liệu đội xe để giao diện thay state một lần.
 * (Tải ảnh/video: POST /api/admin/fleet/upload.)
 * - JSON op: saveVehicle | deleteVehicle | setMode | createRental | assign | webConfirm | webReject | changeVehicle |
 *   deposit | handover | return | extend | cancel | addPay | svcLog | oilDone | insRenew | saveConfig | blacklist | ctvPaid
 */
export async function POST(request: Request) {
  let session = await getSession();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("Thiếu dữ liệu.");
  }
  const serviceId = str(body.serviceId, 40);
  let svc = await canManageFleet(session, serviceId);
  // Bản demo (/demo/quan-ly-xe): phiên demo nằm ở cookie riêng.
  if (!svc) {
    const demo = await getDemoSession();
    if (demo) { session = demo; svc = await canManageFleet(demo, serviceId); }
  }
  if (!svc || !session) return bad("Không có quyền.", 403);
  const { today: T, now: NOW } = vnNow();
  const who = session.name || session.username;
  const op = str(body.op, 30);
  // Nhân viên giao xe: chỉ tạo đơn tại quầy, cọc, giao / nhận xe, gia hạn, ghi thu.
  const STAFF_OPS = ["createRental", "deposit", "handover", "return", "extend", "addPay"];
  if (session.role === "STAFF" && !STAFF_OPS.includes(op)) return bad("Tài khoản nhân viên không có quyền thao tác này.", 403);
  // Bản demo: thử mọi thao tác, trừ tạo / sửa tài khoản đăng nhập thật.
  if (session.role === "DEMO" && op.startsWith("staff")) return bad("Bản demo không tạo / sửa tài khoản nhân viên được.", 403);
  const done = async (message: string, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ ...(await loadFleet(serviceId)), message, ...extra });

  const ownVehicle = (id: string) => (id ? prisma.fleetVehicle.findFirst({ where: { id, serviceId } }) : null);
  const ownRental = (id: string) =>
    id ? prisma.fleetRental.findFirst({ where: { id, vehicle: { serviceId } }, include: { vehicle: true, payments: true } }) : null;
  const vehicleRentals = async (vehicleId: string, from: string) =>
    (await prisma.fleetRental.findMany({ where: { vehicleId, endDate: { gte: parseDateOnly(addDaysKey(from, -60)) } } })).map((r) => rentalVM(r));

  try {
    switch (op) {
      // ===================== XE =====================
      case "saveVehicle": {
        const v = (body.vehicle ?? {}) as Record<string, unknown>;
        const name = str(v.name, 80);
        const plate = normPlate(str(v.plate, 20));
        const price = int(v.price);
        if (name.length < 2) return bad("Nhập tên xe.");
        if (!/^\d{2}[A-Z]{1,2}\d?-?\d{3}\.?\d{2}$/.test(plate)) return bad("Biển số chưa đúng dạng, VD 26B1-123.45");
        if (price < 10000) return bad("Nhập giá thuê mỗi ngày.");
        const rentalVehicleId = str(v.rentalVehicleId, 40) || null;
        if (rentalVehicleId && !(await prisma.rentalVehicle.findFirst({ where: { id: rentalVehicleId, serviceId } })))
          return bad("Loại xe trên web không hợp lệ.");
        const insExp = str(v.insExp, 10);
        const odo = int(v.odo);
        const lastOil = String(v.lastOil ?? "").trim() === "" ? null : int(v.lastOil);
        const data = {
          name,
          plate,
          kind: KINDS.includes(String(v.kind)) ? String(v.kind) : "ga",
          color: str(v.color, 40) || null,
          year: int(v.year) || null,
          odo,
          pricePerDay: price,
          condition: CONDS.includes(String(v.cond)) ? String(v.cond) : "good",
          mode: MODES.includes(String(v.mode)) ? String(v.mode) : "ready",
          note: str(v.note, 500) || null,
          media: cleanMedia(v.media),
          imageUrl: coverOf(cleanMedia(v.media)),
          rentalVehicleId,
          oilEvery: Math.min(20000, Math.max(300, int(v.oilEvery) || 2000)),
          lastOilOdo: lastOil != null ? Math.min(lastOil, odo) : odo,
          insuranceExp: DATE_RE.test(insExp) ? parseDateOnly(insExp) : null,
        };
        const dup = await prisma.fleetVehicle.findFirst({ where: { serviceId, plate, NOT: v.id ? { id: String(v.id) } : undefined } });
        if (dup) return bad("Biển số này đã có trong đội xe.");
        const saved =
          v.id && (await ownVehicle(String(v.id)))
            ? await prisma.fleetVehicle.update({ where: { id: String(v.id) }, data })
            : await prisma.fleetVehicle.create({ data: { ...data, serviceId } });
        return done(v.id ? `Đã lưu ${plate}` : `Đã thêm xe ${plate}`, { savedId: saved.id });
      }
      case "deleteVehicle": {
        const v = await ownVehicle(str(body.id, 40));
        if (!v) return bad("Không tìm thấy xe.");
        // Xe đã có lịch sử thuê ⇒ không xoá (xoá sẽ mất sổ thu chi / báo cáo) — chuyển "Ngừng cho thuê".
        if (await prisma.fleetRental.count({ where: { vehicleId: v.id, OR: [{ state: null }, { state: { notIn: ["cancel", "reject"] } }] } }))
          return bad('Xe đã có lịch thuê (giữ sổ thu chi, báo cáo) — hãy chuyển "Ngừng cho thuê" thay vì xoá.');
        await prisma.fleetVehicle.delete({ where: { id: v.id } });
        return done("Đã xoá xe");
      }
      case "setMedia": {
        const v = await ownVehicle(str(body.id, 40));
        if (!v) return bad("Không tìm thấy xe.");
        const media = cleanMedia(body.media);
        await prisma.fleetVehicle.update({ where: { id: v.id }, data: { media, imageUrl: coverOf(media) } });
        return done(str(body.message, 60) || "Đã lưu ảnh/video");
      }
      case "setMode": {
        const v = await ownVehicle(str(body.id, 40));
        if (!v) return bad("Không tìm thấy xe.");
        const mode = MODES.includes(String(body.mode)) ? String(body.mode) : "ready";
        await prisma.fleetVehicle.update({
          where: { id: v.id },
          data: { mode, condition: mode === "maint" ? "service" : mode === "ready" && v.condition === "service" ? "good" : v.condition },
        });
        return done(mode === "maint" ? `${v.plate} chuyển sang bảo dưỡng` : mode === "ready" ? `Đã đưa ${v.plate} vào cho thuê` : `${v.plate} ngừng cho thuê`);
      }

      // ===================== ĐƠN =====================
      case "createRental": {
        const o = (body.order ?? {}) as Record<string, unknown>;
        const s = str(o.s, 10), e = str(o.e, 10);
        if (!DATE_RE.test(s) || !DATE_RE.test(e) || e < s) return bad("Kiểm tra lại ngày nhận / trả xe.");
        if (s < T) return bad("Ngày nhận xe đã qua.");
        if (diffDays(s, e) > 90) return bad("Thời gian thuê tối đa 90 ngày.");
        if (s === e && str(o.et, 5) && str(o.st, 5) && str(o.et, 5) <= str(o.st, 5)) return bad("Giờ trả phải sau giờ nhận.");
        const name = str(o.name, 80);
        const phone = str(o.phone, 20).replace(/\s/g, "");
        if (name.length < 2) return bad("Nhập họ tên người thuê.");
        if (!PHONE_RE.test(phone)) return bad("Số điện thoại chưa đúng (10 số).");
        const ids = Array.isArray(o.picks) ? [...new Set((o.picks as unknown[]).map(String))].slice(0, 20) : [];
        if (!ids.length) return bad("Chưa có xe nào được chọn.");
        const dep = [0, 0.3, 0.5, 1].includes(Number(o.dep)) ? Number(o.dep) : 0;
        const st = TIME_RE.test(str(o.st, 5)) ? str(o.st, 5) : "08:00";
        const et = TIME_RE.test(str(o.et, 5)) ? str(o.et, 5) : "17:00";
        const hourly = !!o.hourly && s === e;
        if (hourly && st >= et) return bad("Giờ trả phải sau giờ nhận.");
        const place = o.place === "home" ? "Giao homestay (≤3 km)" : o.place === "far" ? "Giao xa" : "Nhận tại cửa hàng";
        const src = ["Web", "CTV", "Zalo", "Khách quen"].includes(String(o.src)) ? String(o.src) : "Zalo";
        const P = await loadConfig(serviceId);
        const far = o.place === "far" ? P.far : 0;
        const created = await prisma.$transaction(async (tx) => {
          await lockFleet(tx, serviceId);
          const vs = await tx.fleetVehicle.findMany({ where: { serviceId, id: { in: ids } } });
          if (vs.length !== ids.length) throw new Error("Xe đã chọn không hợp lệ.");
          const rs = (await tx.fleetRental.findMany({ where: { vehicleId: { in: ids }, endDate: { gte: parseDateOnly(addDaysKey(s, -60)) } } })).map((r) => rentalVM(r));
          const out: string[] = [];
          for (const [i, raw] of vs.entries()) {
            const v = vehicleVM(raw);
            if (!isVehicleFree(v, s, e, rs, T, undefined, NOW, st, et)) throw new Error(`${v.plate} vừa có đơn khác trùng thời gian — bấm "Tự xếp lại".`);
            const total = quoteRental(v, s, e, st, et, hourly, P).t + (i === 0 ? far : 0);
            const paid = dep === 1 ? total : r10k(total * dep);
            const r = await tx.fleetRental.create({
              data: {
                code: fleetCode(),
                vehicleId: v.id,
                customerName: name,
                phone,
                cccd: str(o.cccd, 20) || null,
                startDate: parseDateOnly(s),
                endDate: parseDateOnly(e),
                startTime: st,
                endTime: et,
                total,
                deposit: paid,
                place,
                source: src,
                ctvName: src === "CTV" ? str(o.ctvName, 80) || "CTV" : null,
                note: str(o.note, 500) || null,
                ...(paid > 0 ? { payments: { create: { amount: paid, method: "Chuyển khoản", kind: dep === 1 ? "Thu đủ" : "Cọc", by: who } } } : {}),
              },
            });
            out.push(r.id);
          }
          return { ids: out, plates: vs.map((v) => v.plate) };
        });
        return done("Đã tạo đơn · xếp " + created.plates.join(", "), { savedId: created.ids[0] });
      }
      case "assign": {
        // Xếp tay xe cho đơn web còn thiếu xe.
        const b = await prisma.bookingRequest.findFirst({ where: { id: str(body.bookingId, 40), serviceId, category: "MOTORBIKE" }, include: { ctv: { select: { name: true } } } });
        const raw = await ownVehicle(str(body.vehicleId, 40));
        if (!b || !raw) return bad("Không tìm thấy đơn hoặc xe.");
        const v = vehicleVM(raw);
        const s = b.useDate.toISOString().slice(0, 10), e = (b.endDate ?? b.useDate).toISOString().slice(0, 10);
        const qty = Math.max(1, b.quantity);
        const ref = b.referencePrice ? Number(b.referencePrice) : null;
        await prisma.$transaction(async (tx) => {
          await lockFleet(tx, serviceId);
          const rs = (await tx.fleetRental.findMany({ where: { vehicleId: v.id, endDate: { gte: parseDateOnly(addDaysKey(s, -60)) } } })).map((x) => rentalVM(x));
          // Đơn đã đủ xe (kể cả vừa được người khác xếp) ⇒ không xếp thừa.
          const have = await tx.fleetRental.count({ where: { bookingId: b.id, OR: [{ state: null }, { state: { notIn: ["cancel", "reject"] } }] } });
          if (have >= qty) throw new Error(`Đơn ${b.code} đã đủ ${qty} xe.`);
          if (!isVehicleFree(v, s, e, rs, T, undefined, NOW, b.pickupTime ?? "08:00", b.returnTime ?? "17:00")) throw new Error(`${v.plate} không rảnh trong thời gian của đơn.`);
          await tx.fleetRental.create({
          data: {
            code: fleetCode(), vehicleId: v.id, bookingId: b.id, customerName: b.customerName, phone: b.phone,
            startDate: b.useDate, endDate: b.endDate ?? b.useDate, startTime: b.pickupTime ?? "08:00", endTime: b.returnTime ?? "17:00",
            total: ref != null ? Math.round(ref / qty) : v.price * (diffDays(s, e) + 1),
            deposit: 0, place: "Theo đơn web", source: b.ctvId ? "CTV" : "Web", ctvName: b.ctv?.name ?? null, note: b.note, webPending: true,
          },
          });
        });
        await syncFleetForBooking(b.id).catch(() => {}); // khớp tiền đã thu của đơn vào sổ xe
        return done(`Đã xếp ${v.plate} cho đơn ${b.code}`);
      }
      case "webConfirm":
      case "webReject":
      case "changeVehicle":
      case "deposit":
      case "handover":
      case "return":
      case "extend":
      case "cancel":
      case "addPay": {
        const r = await ownRental(str(body.id, 40));
        if (!r) return bad("Không tìm thấy đơn.");
        const vm = rentalVM(r);
        const v = vehicleVM(r.vehicle);
        const stNow = rentalStatus(vm, T, NOW);
        if (op === "webConfirm") {
          await prisma.fleetRental.update({ where: { id: r.id }, data: { webPending: false } });
          // Đơn web: mọi xe của đơn đã được nhà xe duyệt ⇒ báo cho sàn (cờ "đã giữ chỗ" + nhật ký đơn).
          if (r.bookingId) {
            const sib = await prisma.fleetRental.findMany({ where: { bookingId: r.bookingId, OR: [{ state: null }, { state: { notIn: ["cancel", "reject"] } }] }, include: { vehicle: { select: { plate: true } } } });
            if (sib.every((x) => !x.webPending)) {
              await prisma.$transaction([
                prisma.bookingRequest.update({ where: { id: r.bookingId }, data: { heldRoom: true } }),
                prisma.bookingLog.create({ data: { bookingId: r.bookingId, kind: "SUPPLIER", title: "Nhà xe xác nhận có xe", body: "Đã giữ xe: " + sib.map((x) => x.vehicle.plate).join(", "), by: who } }),
              ]);
            }
          }
          return done(`Đã xác nhận ${vm.code} · nhắn Zalo khách để cọc`);
        }
        if (op === "webReject" || op === "cancel") {
          if (vm.ret) return bad("Đơn đã trả xe, không huỷ được.");
          if (vm.hand) return bad("Xe đã giao cho khách — hãy “Nhận xe & quyết toán” để kết thúc đơn, không huỷ được.");
          if (vm.cancelled) return bad("Đơn đã huỷ trước đó.");
          // Lượt thuê sinh từ đơn web: chủ xe huỷ/từ chối ⇒ "reject" (không tự xếp lại) + báo sàn qua nhật ký đơn.
          const fromWeb = !!r.bookingId;
          await prisma.fleetRental.update({ where: { id: r.id }, data: { state: fromWeb ? "reject" : "cancel", webPending: false } });
          if (r.bookingId) {
            const reason = str(body.reason, 200);
            await prisma.$transaction([
              prisma.bookingRequest.update({ where: { id: r.bookingId }, data: { heldRoom: false } }),
              prisma.bookingLog.create({ data: { bookingId: r.bookingId, kind: "SUPPLIER", title: op === "webReject" ? "Nhà xe từ chối đơn (không có xe)" : "Nhà xe huỷ xe đã xếp", body: `Xe ${v.plate} · ${vm.code}${reason ? " · " + reason : ""}`, by: who } }),
            ]);
          }
          return done(op === "webReject" ? `Đã từ chối ${vm.code} · đã báo sàn để xử lý với khách` : `Đã huỷ ${vm.code}, xe trống lại`);
        }
        if (op === "changeVehicle") {
          if (vm.hand) return bad("Xe đã giao, không đổi được.");
          const nv = await ownVehicle(str(body.vehicleId, 40));
          if (!nv) return bad("Không tìm thấy xe.");
          const nvm = vehicleVM(nv);
          await prisma.$transaction(async (tx) => {
            await lockFleet(tx, serviceId);
            const rs = (await tx.fleetRental.findMany({ where: { vehicleId: nv.id, endDate: { gte: parseDateOnly(addDaysKey(vm.s, -60)) } } })).map((x) => rentalVM(x));
            if (!isVehicleFree(nvm, vm.s, vm.e, rs, T, r.id, NOW, vm.st, vm.et)) throw new Error(`${nv.plate} không rảnh trong thời gian này.`);
            await tx.fleetRental.update({ where: { id: r.id }, data: { vehicleId: nv.id } });
          });
          return done(`Đã đổi sang ${nv.plate}`);
        }
        if (op === "deposit") {
          if (stNow === "cancel" || stNow === "done") return bad("Đơn đã kết thúc, không ghi cọc được.");
          if (stNow === "web") return bad("Hãy xác nhận đơn web trước khi ghi cọc.");
          if (vm.deposit >= vm.total) return bad("Đơn đã thu đủ tiền thuê.");
          const amt = Math.min(r10k(vm.total * 0.3) || vm.total, vm.total - vm.deposit);
          await prisma.$transaction(async (tx) => {
            await tx.fleetRental.update({ where: { id: r.id }, data: { deposit: vm.deposit + amt, payments: { create: { amount: amt, method: "Chuyển khoản", kind: "Cọc", by: who } } } });
            if (r.bookingId) await pushFleetPayments(tx, r.bookingId, who, { title: `Nhà xe ghi nhận cọc ${vnd(amt)}`, body: `Xe ${v.plate} · Chuyển khoản` });
          });
          return done(`Đã ghi nhận cọc ${vnd(amt)}`);
        }
        if (op === "handover") {
          if (vm.hand) return bad("Xe đã được giao.");
          if (stNow === "web") return bad("Hãy xác nhận đơn web trước khi giao xe.");
          if (stNow === "cancel") return bad("Đơn đã huỷ, không giao xe được.");
          if (stNow === "done") return bad("Đơn đã quá ngày trả, không giao xe được — hãy tạo đơn mới.");
          if (v.mode !== "ready") return bad(`${v.plate} đang ${v.mode === "maint" ? "bảo dưỡng" : "ngừng cho thuê"} — đổi xe khác hoặc đưa xe vào cho thuê trước khi giao.`);
          // Giao sớm hơn lịch ⇒ lượt thuê bắt đầu từ bây giờ: xe phải rảnh suốt từ lúc giao tới giờ trả
          // (khách trước chưa trả xe, hoặc còn đơn khác chen giữa ⇒ chặn, tránh giao trùng một xe).
          const early = vm.s > T || (vm.s === T && vm.st > NOW);
          const hs = early ? T : vm.s, hst = early ? NOW : vm.st;
          const clash = (await vehicleRentals(v.id, hs)).find((x) => x.id !== r.id && !isVehicleFree(v, hs, vm.e, [x], T, r.id, NOW, hst, vm.et));
          if (clash) return bad(clash.hand && !clash.ret ? `${v.plate} chưa được trả (đơn ${clash.code} · ${clash.name}) — nhận lại xe trước, hoặc đổi xe khác cho đơn này.` : `${v.plate} đang có đơn ${clash.code} (${clash.name}, ${dm(clash.s)} ${clash.st} → ${dm(clash.e)} ${clash.et}) trùng thời gian — đổi xe khác cho đơn này.`);
          const h = (body.hand ?? {}) as Record<string, unknown>;
          const odo = int(h.odo) || v.odo;
          const hand = {
            odo,
            fuel: fuelOk(h.fuel),
            acc: Array.isArray(h.acc) ? (h.acc as unknown[]).map(String).filter((a) => (FLEET_ACC as readonly string[]).includes(a)) : [],
            doc: (FLEET_DOCS as readonly string[]).includes(String(h.doc)) ? String(h.doc) : "Không giữ",
            // Ảnh chụp xe lúc giao: chỉ nhận tệp đã tải lên; bản demo (không tải tệp được) dùng ảnh mẫu có sẵn.
            photos: Array.isArray(h.photos)
              ? (h.photos as unknown[]).map((x) => str(x, 300)).filter((x) => /^\/uploads\/[\w.-]+$/.test(x) || (session.role === "DEMO" && /^\/hop-tac\/[\w/-]+\.(jpg|png|webp)$/.test(x))).slice(0, 4)
              : [],
            at: `${T} ${NOW}`,
            by: who,
          };
          await prisma.$transaction([
            prisma.fleetRental.update({ where: { id: r.id }, data: { hand, ...(early ? { startDate: parseDateOnly(T), startTime: NOW } : {}) } }),
            prisma.fleetVehicle.update({ where: { id: v.id }, data: { odo: Math.max(v.odo, odo) } }),
          ]);
          return done(`Đã giao ${v.plate} cho ${vm.name}`);
        }
        if (op === "return") {
          if (!vm.hand) return bad("Chưa lập biên bản giao xe.");
          if (vm.ret) return bad("Xe đã được nhận lại.");
          const f = (body.ret ?? {}) as Record<string, unknown>;
          const odo = int(f.odo) || v.odo;
          const P = await loadConfig(serviceId);
          const rf = {
            fuel: fuelOk(f.fuel),
            accBack: Array.isArray(f.accBack) ? (f.accBack as unknown[]).map(String) : [],
            dmg: int(f.dmg),
            dmgNote: str(f.dmgNote, 120),
          };
          const newFees = returnFees(vm, v, rf, P, T, NOW);
          const allFees = [...vm.fees, ...newFees];
          const finalDue = vm.total + feeSum({ fees: allFees }) - vm.deposit;
          const method = str(f.method, 20) === "Chuyển khoản" ? "Chuyển khoản" : "Tiền mặt";
          await prisma.$transaction(async (tx) => {
            await tx.fleetRental.update({
              where: { id: r.id },
              data: {
                ret: { odo, fuel: rf.fuel, at: `${T} ${NOW}`, by: who },
                fees: allFees,
                deposit: vm.total + feeSum({ fees: allFees }),
                ...(vm.e > T || (vm.e === T && vm.et > NOW) ? { endDate: parseDateOnly(T), endTime: NOW } : {}),
                ...(finalDue ? { payments: { create: { amount: finalDue, method, kind: finalDue > 0 ? "Thu khi trả" : "Hoàn cọc", by: who } } } : {}),
              },
            });
            await tx.fleetVehicle.update({ where: { id: v.id }, data: { odo: Math.max(v.odo, odo) } });
            // Đơn web: phí phát sinh ⇒ phụ thu của đơn; tiền thu khi trả ⇒ "đã thu" của đơn.
            if (r.bookingId) {
              await pushFleetPayments(tx, r.bookingId, who, {
                title: `Nhà xe nhận lại xe ${v.plate}${finalDue ? (finalDue > 0 ? " · thu " : " · hoàn ") + vnd(Math.abs(finalDue)) : ""}`,
                body: newFees.length ? "Phát sinh: " + newFees.map((x) => `${x.k} ${vnd(x.amt)}`).join(", ") : undefined,
              }, newFees, v.plate);
            }
          });
          const docBack = vm.hand.doc && vm.hand.doc !== "Không giữ" ? ` · Nhớ trả lại ${vm.hand.doc.replace(/^(B|C(?=ọc))/, (c) => c.toLowerCase())} cho khách` : "";
          return done((finalDue >= 0 ? "Đã thu " : "Đã hoàn ") + vnd(Math.abs(finalDue)) + docBack);
        }
        if (op === "extend") {
          if (vm.ret || vm.cancelled) return bad("Đơn đã kết thúc.");
          const nx = addDaysKey(vm.e, 1);
          // Gia hạn 24 giờ: xe phải rảnh từ giờ trả cũ tới cùng giờ ngày hôm sau.
          if (!isVehicleFree({ ...v, mode: "ready" }, vm.e, nx, await vehicleRentals(v.id, vm.e), T, r.id, NOW, vm.et, vm.et)) return bad(`Ngày ${dm(nx)} xe đã có đơn khác.`);
          await prisma.fleetRental.update({ where: { id: r.id }, data: { endDate: parseDateOnly(nx), total: vm.total + v.price } });
          return done(`Đã gia hạn tới ${dm(nx)}`);
        }
        // addPay
        const a = int(body.amt);
        if (!a) return bad("Nhập số tiền.");
        const refund = body.kind === "Hoàn cọc";
        if (refund && a > vm.deposit) return bad(`Chỉ hoàn được tối đa ${vnd(Math.max(0, vm.deposit))} (số đã thu của đơn).`);
        const amt = refund ? -a : a;
        const method = body.method === "Chuyển khoản" ? "Chuyển khoản" : "Tiền mặt";
        await prisma.$transaction(async (tx) => {
          await tx.fleetRental.update({
            where: { id: r.id },
            data: { deposit: vm.deposit + amt, payments: { create: { amount: amt, method, kind: refund ? "Hoàn cọc" : "Thu thêm", by: who } } },
          });
          if (r.bookingId) await pushFleetPayments(tx, r.bookingId, who, { title: `Nhà xe ghi ${refund ? "hoàn" : "thu"} ${vnd(a)}`, body: `Xe ${v.plate} · ${method}` });
        });
        return done(`Đã ghi ${refund ? "hoàn" : "thu"} ${vnd(a)}`);
      }

      // ===================== BẢO DƯỠNG =====================
      case "svcLog":
      case "oilDone":
      case "insRenew": {
        const v = await ownVehicle(str(body.vehicleId, 40));
        if (!v) return bad("Không tìm thấy xe.");
        const P = await loadConfig(serviceId);
        if (op === "oilDone") {
          await prisma.$transaction([
            prisma.fleetServiceLog.create({ data: { vehicleId: v.id, date: parseDateOnly(T), what: "Thay nhớt", cost: P.oilCost, odo: v.odo } }),
            prisma.fleetVehicle.update({ where: { id: v.id }, data: { lastOilOdo: v.odo } }),
          ]);
          return done(`Đã ghi thay nhớt ${v.plate}`);
        }
        if (op === "insRenew") {
          const base = v.insuranceExp && v.insuranceExp.toISOString().slice(0, 10) >= T ? v.insuranceExp.toISOString().slice(0, 10) : T;
          const next = addDaysKey(base, 365);
          await prisma.$transaction([
            prisma.fleetServiceLog.create({ data: { vehicleId: v.id, date: parseDateOnly(T), what: "Gia hạn bảo hiểm TNDS", cost: P.insCost, odo: v.odo } }),
            prisma.fleetVehicle.update({ where: { id: v.id }, data: { insuranceExp: parseDateOnly(next) } }),
          ]);
          return done(`Đã gia hạn bảo hiểm ${v.plate} tới ${dm(next)}/${next.slice(0, 4)}`);
        }
        const what0 = str(body.what, 60) || "Khác";
        const note = str(body.note, 160);
        const what = what0 + (note ? ": " + note : "");
        const cost = int(body.cost);
        const odo = int(body.odo) || v.odo;
        await prisma.$transaction([
          prisma.fleetServiceLog.create({ data: { vehicleId: v.id, date: parseDateOnly(T), what, cost, odo } }),
          prisma.fleetVehicle.update({
            where: { id: v.id },
            data: {
              odo: Math.max(v.odo, odo),
              ...(what0 === "Thay nhớt" ? { lastOilOdo: odo } : {}),
              ...(body.toMaint ? { mode: "maint", condition: "service", note: what } : {}),
            },
          }),
        ]);
        return done(`Đã ghi ${what0.toLowerCase()} · ${vnd(cost)}`);
      }

      // ===================== CẤU HÌNH =====================
      case "saveConfig": {
        const cur = await loadConfig(serviceId);
        const next = normalizeConfig({ ...cur, ...(body.config as object), black: cur.black, ctvPaid: cur.ctvPaid });
        await saveConfig(serviceId, next);
        return done(str(body.message, 80) || "Đã lưu cài đặt");
      }
      case "blacklist": {
        const phone = str(body.phone, 15);
        if (!PHONE_RE.test(phone)) return bad("Số điện thoại không hợp lệ.");
        const cur = await loadConfig(serviceId);
        const black = { ...cur.black };
        const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : null;
        if (reason === null) delete black[phone];
        else black[phone] = reason || "Không rõ lý do";
        await saveConfig(serviceId, { ...cur, black });
        return done(reason === null ? "Đã gỡ khỏi danh sách đen" : "Đã đưa vào danh sách đen");
      }
      case "ctvPaid": {
        const name = str(body.name, 80);
        const cur = await loadConfig(serviceId);
        await saveConfig(serviceId, { ...cur, ctvPaid: { ...cur.ctvPaid, [name]: !!body.paid } });
        return done(body.paid ? "Đã đánh dấu đã trả hoa hồng" : "Đã bỏ đánh dấu");
      }
      // ===================== TÀI KHOẢN NHÂN VIÊN =====================
      case "staffCreate":
      case "staffToggle":
      case "staffReset":
      case "staffDelete": {
        if (!svc.ownerId) return bad("Dịch vụ chưa gắn tài khoản chủ — admin gắn chủ dịch vụ trước khi tạo nhân viên.");
        if (op === "staffCreate") {
          const name = str(body.name, 60);
          const username = str(body.username, 40).toLowerCase();
          const phone = str(body.phone, 15).replace(/\s/g, "");
          const password = typeof body.password === "string" ? body.password : "";
          if (name.length < 2) return bad("Nhập tên nhân viên.");
          if (!/^[a-z0-9._-]{3,40}$/.test(username)) return bad("Tên đăng nhập 3–40 ký tự: chữ thường, số, dấu . _ -");
          if (phone && !PHONE_RE.test(phone)) return bad("Số điện thoại chưa đúng (10 số).");
          if (password.length < 6) return bad("Mật khẩu tối thiểu 6 ký tự.");
          if (await prisma.adminUser.findUnique({ where: { username } })) return bad("Tên đăng nhập đã có người dùng.");
          await prisma.adminUser.create({ data: { username, name, phone: phone || null, role: "STAFF", providerId: svc.ownerId, passwordHash: await hashPassword(password) } });
          return done(`Đã tạo tài khoản ${username} — gửi tên đăng nhập + mật khẩu cho nhân viên`);
        }
        const u = await prisma.adminUser.findFirst({ where: { id: str(body.id, 40), role: "STAFF", providerId: svc.ownerId } });
        if (!u) return bad("Không tìm thấy nhân viên.");
        if (op === "staffToggle") {
          await prisma.adminUser.update({ where: { id: u.id }, data: { active: !u.active } });
          return done(u.active ? `Đã khoá ${u.username}` : `Đã mở khoá ${u.username}`);
        }
        if (op === "staffReset") {
          const password = typeof body.password === "string" ? body.password : "";
          if (password.length < 6) return bad("Mật khẩu tối thiểu 6 ký tự.");
          await prisma.adminUser.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(password) } });
          return done(`Đã đổi mật khẩu ${u.username}`);
        }
        await prisma.adminUser.delete({ where: { id: u.id } });
        return done(`Đã xoá tài khoản ${u.username}`);
      }
      default:
        return bad("Thao tác không hợp lệ.");
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return bad("Biển số này đã có trong đội xe.");
    return bad(err instanceof Error ? err.message : "Có lỗi xảy ra.");
  }
}
