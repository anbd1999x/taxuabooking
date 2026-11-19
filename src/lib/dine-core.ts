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
}
/** Khách báo đã chuyển khoản: lúc nào, tổng hoá đơn khi đó, ảnh bill. */
export interface DineClaim { at: number; amount: number; proof: string | null }
export interface DineReqVM { id: string; tableId: string | null; table: string; kind: "staff" | "pay"; method: string; at: number; claim: DineClaim | null }
export interface DineMenuVM { id: string; name: string; group: string; desc: string; price: number; hot: boolean; avail: boolean; imageUrl: string | null; /** mọi ảnh của món, ảnh đầu là bìa */ images: string[]; sold: number }
export interface DineTableVM { id: string; name: string; cap: number; zone: string; floor: number; /** đường dẫn gọi món của bàn, kèm khoá */ url: string }

/** Dữ liệu màn hình quán. */
export interface DineData {
  venue: { id: string; name: string; slug: string; hasBank: boolean; bankBin: string; bankAcc: string; bankHolder: string };
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
