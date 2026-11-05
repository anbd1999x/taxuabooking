/**
 * Kiểm tra số DI ĐỘNG Việt Nam — chặn số điền bừa khi đặt đơn / đăng ký.
 * Thuần tuý (không import server) để dùng chung client (báo lỗi ngay) + server
 * (zod, chốt chặn thật — client có thể bị bỏ qua).
 *
 * Không xác minh được số CÓ ZALO (cần OTP qua ZNS) — chỉ loại số sai định dạng,
 * đầu số không tồn tại, và số "dãy" kiểu 0123456789 / 0987654321 / 0900000000.
 */

/**
 * Đầu số di động đang dùng (10 số):
 * Viettel 032–039, 086, 096–098 · Vinaphone 081–085, 088, 091, 094 ·
 * Mobifone 070, 076–079, 089, 090, 093 · Vietnamobile 052, 056, 058, 092 ·
 * Gmobile 059, 099 · Reddi 055 · iTel 087.
 */
const VN_MOBILE_RE = /^0(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-46-9])\d{7}$/;

/** Bỏ khoảng trắng/dấu chấm/gạch/ngoặc; +84 / 84 đầu → 0. */
export function normalizeVnPhone(raw: string): string {
  let s = (raw ?? "").replace(/[\s.\-()]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (/^84\d{9}$/.test(s)) s = "0" + s.slice(2);
  return s;
}

/** 7 số thuê bao là dãy tăng/giảm liên tiếp (1234567, 7654321, 3456789...). */
function isSequential(d: string): boolean {
  let up = true;
  let down = true;
  for (let i = 1; i < d.length; i++) {
    const diff = +d[i] - +d[i - 1];
    if (diff !== 1) up = false;
    if (diff !== -1) down = false;
  }
  return up || down;
}

/** Lỗi (tiếng Việt) nếu số không hợp lệ, null nếu dùng được. */
export function vnPhoneError(raw: string): string | null {
  const s = normalizeVnPhone(raw);
  if (!s) return "Vui lòng nhập số điện thoại.";
  if (!/^\d+$/.test(s)) return "Số điện thoại chỉ gồm chữ số.";
  if (s.length !== 10 || !s.startsWith("0")) return "Số điện thoại phải gồm 10 số, bắt đầu bằng 0.";
  if (!VN_MOBILE_RE.test(s)) return "Đầu số không phải số di động Việt Nam — vui lòng kiểm tra lại.";
  const sub = s.slice(3);
  // Toàn số chỉ có ≤2 chữ số khác nhau (0900000000, 0999999999) hoặc thuê bao là dãy liên tiếp.
  if (new Set(s).size <= 2 || isSequential(sub)) {
    return "Số điện thoại không hợp lệ — vui lòng nhập số thật của bạn (nhà cung cấp sẽ liên hệ qua Zalo/điện thoại).";
  }
  return null;
}

export function isValidVnPhone(raw: string): boolean {
  return vnPhoneError(raw) === null;
}
