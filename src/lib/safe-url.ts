import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Chống SSRF cho các link do người dùng nhập mà SERVER sẽ tự tải (nguồn iCal OTA, API lịch…): chủ homestay tự đăng ký
 * (ai có Google cũng tạo được) không được bắt server gọi vào localhost / mạng Docker nội bộ (db, app, web) / metadata.
 */

function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fe80:") || v.startsWith("fc") || v.startsWith("fd")) return true;
    const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return m ? privateIp(m[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  );
}

/** null = được phép; chuỗi = lý do từ chối. requireHttps cho link người dùng nhập. */
export async function publicUrlError(raw: string, opts: { requireHttps?: boolean } = {}): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "Link không hợp lệ.";
  }
  if (u.protocol !== "https:" && (opts.requireHttps || u.protocol !== "http:")) return "Link phải bắt đầu bằng https://";
  if (u.username || u.password) return "Link không hợp lệ.";
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return "Link không được trỏ vào máy nội bộ.";
  if (isIP(host)) return privateIp(host) ? "Link không được trỏ vào máy nội bộ." : null;
  if (!host.includes(".")) return "Link không được trỏ vào máy nội bộ."; // tên dịch vụ Docker (db, app, web…)
  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => privateIp(a.address))) return "Link không được trỏ vào máy nội bộ.";
  } catch {
    return "Không tìm thấy tên miền của link.";
  }
  return null;
}

/** fetch theo từng bước chuyển hướng, mỗi bước đều phải là địa chỉ công khai (tối đa 5 lần chuyển). */
export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let cur = url;
  for (let hop = 0; hop <= 5; hop++) {
    const err = await publicUrlError(cur);
    if (err) throw new Error(err);
    const res = await fetch(cur, { ...init, redirect: "manual" });
    const loc = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!loc) return res;
    cur = new URL(loc, cur).toString();
  }
  throw new Error("Link chuyển hướng quá nhiều lần.");
}
