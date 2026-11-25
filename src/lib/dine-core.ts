/**
 * Gọi món QR tại bàn (nhà hàng) — phần THUẦN: kiểu dữ liệu dùng chung cho server, màn hình quán và điện thoại khách.
 * Theo mẫu claude.ai/design "Nha hang QR Order" (project 4ec052fe…). Dùng chung bàn (`TicketTable`) và thực đơn
 * (`TicketMenuItem`) với module Vé & đặt bàn.
 */
import type { DineGate } from "./ticket-core";

export type DineStatus = "new" | "cooking" | "served" | "paid" | "cancel";
/** Nhóm món gợi ý khi quán chưa đặt nhóm nào. */
export const DINE_CATS = ["Món chính", "Ăn kèm", "Đồ uống"];
/** Quá ngần này phút chưa lên món ⇒ thẻ đơn hiện đỏ. */
export const DINE_LATE_MIN = 15;
/** Mô tả chi tiết món: admin nhập; trang khách rút gọn 2 dòng ở thẻ món, hiện đủ khi bấm xem món. */
export const DINE_DESC_MAX = 500;
/** Giới hạn một lần gọi của khách. */
export const DINE_MAX_LINES = 30;
export const DINE_MAX_QTY = 50;
/** Số ảnh tối đa của một món. */
export const DINE_MAX_IMAGES = 8;
/**
 * PHỤ THU: quán thêm vào hoá đơn bàn = một DineOrder `source = DINE_FEE`, trạng thái "served" sẵn, một dòng (lý do, số tiền) —
 * nên tự cộng vào tổng hoá đơn, mã VietQR và "Đã thu · dọn bàn"; KHÔNG hiện ở các cột bếp.
 */
export const DINE_FEE = "Phụ thu";
export const DINE_FEE_PRESETS = ["Phí phục vụ", "Phụ thu ngày lễ", "Khăn lạnh / đồ dùng thêm", "Phí mang rượu ngoài"];
export const DINE_FEE_MAX = 5_000_000;
export const isFee = (o: { source: string }) => o.source === DINE_FEE;

export interface DineItem { name: string; price: number; qty: number; note: string }
export interface DineOrderVM {
  id: string; tableId: string | null; table: string; status: DineStatus; note: string; source: string;
  at: number; servedAt: number | null; items: DineItem[]; total: number;
  /** Khách khai ở màn "Chào mừng" (đơn QR); đơn quầy / đơn cũ = null. */
  guest: DineGuest | null;
}
/** Thông tin khách khai khi mở bàn gọi món. */
export interface DineGuest { name: string; phone: string; pax: number }
/** Chuẩn hoá thông tin khách từ client; thiếu tên ⇒ null. SĐT chỉ giữ số (9–11 chữ số), sai thì bỏ trống. */
export function cleanGuest(g: unknown): DineGuest | null {
  const r = (g && typeof g === "object" ? g : {}) as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  if (!name) return null;
  const digits = typeof r.phone === "string" ? r.phone.replace(/\D/g, "") : "";
  const pax = Math.round(Number(r.pax)) || 0;
  return { name, phone: digits.length >= 9 && digits.length <= 11 ? digits : "", pax: Math.max(1, Math.min(99, pax)) };
}
/** Bản dịch en / zh / ko của một chuỗi. */
export interface Tr3 { en: string; zh: string; ko: string }
/** Bản dịch của một món (tab Thực đơn → "Dịch"). */
export interface DineMenuTr { name: Tr3; group: Tr3; desc: Tr3 }
/** Một khách trong danh sách "Khách hàng" (gom theo SĐT, không có SĐT thì theo tên). */
export interface DineGuestRow { key: string; name: string; phone: string; visits: number; lastAt: number; lastTable: string; pax: number; spent: number; orders: number; top: string[] }
export const DINE_GATES: [DineGate, string, string][] = [
  ["full", "Tên + số điện thoại + số khách", "Biết khách là ai, gọi lại được khi cần. Khách phải nhập nhiều nhất."],
  ["lite", "Chỉ tên + số khách", "Nhanh hơn, không xin số điện thoại."],
  ["off", "Không hỏi — vào thẳng thực đơn", "Quét là gọi món ngay. Quán không biết tên khách."],
];
/** Khách bấm "Gọi NV" chọn một trong các việc này (gửi kèm yêu cầu). */
export const DINE_STAFF_NEEDS = ["Hỗ trợ về món", "Thêm chén đũa / dụng cụ ăn", "Thêm đá / nước / khăn", "Đổi bàn", "Việc khác"];
/** Gợi ý ghi chú nhanh cho từng món. */
export const DINE_NOTE_CHIPS = ["Ít cay", "Không cay", "Không hành", "Ít đá", "Ít đường"];
/** Khách báo đã chuyển khoản: lúc nào, tổng hoá đơn khi đó, ảnh bill. */
export interface DineClaim { at: number; amount: number; proof: string | null }
export interface DineReqVM { id: string; tableId: string | null; table: string; kind: "staff" | "pay"; method: string; /** staff: khách cần gì */ note: string; at: number; claim: DineClaim | null }
export interface DineMenuVM { id: string; name: string; group: string; desc: string; price: number; hot: boolean; avail: boolean; imageUrl: string | null; /** mọi ảnh của món, ảnh đầu là bìa */ images: string[]; sold: number }
export interface DineTableVM { id: string; name: string; cap: number; zone: string; floor: number; /** đường dẫn gọi món của bàn, kèm khoá */ url: string }

/** Dữ liệu màn hình quán. */
export interface DineData {
  venue: { id: string; name: string; slug: string; hasBank: boolean; bankBin: string; bankAcc: string; bankHolder: string; /** màn Chào mừng hỏi gì */ gate: DineGate };
  tables: DineTableVM[];
  menu: DineMenuVM[];
  /** Mọi lần gọi chưa thu tiền / chưa huỷ. */
  orders: DineOrderVM[];
  /** Yêu cầu của khách chưa xử lý. */
  reqs: DineReqVM[];
  /** Lần gọi KHÁCH tự huỷ trong 10 phút qua (bếp chưa làm) — để báo bếp. */
  guestCancels: { id: string; table: string; at: number; summary: string; qty: number }[];
  revenueToday: number;
  now: number;
}

/** Dữ liệu điện thoại khách của MỘT bàn. */
export interface DineCustomer {
  venue: string;
  table: string;
  /** Màn "Chào mừng": full = tên + SĐT + số khách · lite = tên + số khách · off = vào thẳng thực đơn. */
  gate: DineGate;
  menu: Omit<DineMenuVM, "sold">[];
  orders: DineOrderVM[];
  bill: number;
  /** Đã xin thanh toán (kèm cách trả) / đã gọi nhân viên, quán chưa xử lý. */
  payReq: string | null;
  staffAsked: boolean;
  /** Việc khách vừa nhờ khi gọi nhân viên (hiện lại trên điện thoại). */
  staffNote: string;
  /** Quán vừa thu tiền xong bàn này (trong 30 phút) và chưa có lần gọi mới. */
  paid: boolean;
  /** Chuyển khoản: thông tin tài khoản + chuỗi VietQR đã kèm số tiền hoá đơn. */
  bank: { name: string; account: string; holder: string; memo: string; qr: string } | null;
  /** Khách đã báo chuyển khoản, quán chưa xác thực. */
  payClaim: DineClaim | null;
  /** Quán báo chưa nhận được tiền (lý do) — khách kiểm tra rồi gửi lại. */
  claimNote: string;
  now: number;
}

export const money = (n: number) => n.toLocaleString("vi-VN") + "đ";
export const hm = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(11, 16);
/** "45 giây" / "7 phút". */
export const ago = (now: number, t: number) => {
  const s = Math.max(0, Math.floor((now - t) / 1000));
  return s < 60 ? `${s} giây` : `${Math.floor(s / 60)} phút`;
};
export const orderQty = (o: Pick<DineOrderVM, "items">) => o.items.reduce((a, i) => a + i.qty, 0);
/** Trạng thái bàn trên sơ đồ: trống · chờ món · đang dùng bữa · chờ thanh toán. */
export type TableState = "free" | "wait" | "eat" | "pay";
export function tableState(orders: DineOrderVM[], reqs: DineReqVM[], tableId: string): TableState {
  if (reqs.some((r) => r.tableId === tableId && r.kind === "pay")) return "pay";
  const os = orders.filter((o) => o.tableId === tableId);
  return !os.length ? "free" : os.some((o) => o.status !== "served") ? "wait" : "eat";
}
