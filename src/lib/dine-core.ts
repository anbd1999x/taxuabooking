/**
 * Gọi món QR tại bàn (nhà hàng) — phần THUẦN: kiểu dữ liệu dùng chung cho server, màn hình quán và điện thoại khách.
 * Theo mẫu claude.ai/design "Nha hang QR Order" (project 4ec052fe…). Dùng chung bàn (`TicketTable`) và thực đơn
 * (`TicketMenuItem`) với module Vé & đặt bàn.
 */
export type DineStatus = "new" | "cooking" | "served" | "paid" | "cancel";
/** Nhóm món gợi ý khi quán chưa đặt nhóm nào. */
export const DINE_CATS = ["Món chính", "Ăn kèm", "Đồ uống"];
/** Quá ngần này phút chưa lên món ⇒ thẻ đơn hiện đỏ. */
export const DINE_LATE_MIN = 15;
/** Giới hạn một lần gọi của khách. */
export const DINE_MAX_LINES = 30;
export const DINE_MAX_QTY = 50;
/** Số ảnh tối đa của một món. */
export const DINE_MAX_IMAGES = 8;

export interface DineItem { name: string; price: number; qty: number; note: string }
export interface DineOrderVM {
  id: string; tableId: string | null; table: string; status: DineStatus; note: string; source: string;
  at: number; servedAt: number | null; items: DineItem[]; total: number;
}
export interface DineReqVM { id: string; tableId: string | null; table: string; kind: "staff" | "pay"; method: string; at: number }
export interface DineMenuVM { id: string; name: string; group: string; desc: string; price: number; hot: boolean; avail: boolean; imageUrl: string | null; /** mọi ảnh của món, ảnh đầu là bìa */ images: string[]; sold: number }
export interface DineTableVM { id: string; name: string; cap: number; zone: string; floor: number; /** đường dẫn gọi món của bàn, kèm khoá */ url: string }

/** Dữ liệu màn hình quán. */
export interface DineData {
  venue: { id: string; name: string; slug: string; hasBank: boolean };
  tables: DineTableVM[];
  menu: DineMenuVM[];
  /** Mọi lần gọi chưa thu tiền / chưa huỷ. */
  orders: DineOrderVM[];
  /** Yêu cầu của khách chưa xử lý. */
  reqs: DineReqVM[];
  revenueToday: number;
  now: number;
}

/** Dữ liệu điện thoại khách của MỘT bàn. */
export interface DineCustomer {
  venue: string;
  table: string;
  menu: Omit<DineMenuVM, "sold">[];
  orders: DineOrderVM[];
  bill: number;
  /** Đã xin thanh toán (kèm cách trả) / đã gọi nhân viên, quán chưa xử lý. */
  payReq: string | null;
  staffAsked: boolean;
  /** Quán vừa thu tiền xong bàn này (trong 30 phút) và chưa có lần gọi mới. */
  paid: boolean;
  /** Chuyển khoản: thông tin tài khoản + chuỗi VietQR đã kèm số tiền hoá đơn. */
  bank: { name: string; account: string; holder: string; memo: string; qr: string } | null;
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
