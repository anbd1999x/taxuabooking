"use client";

import { useState } from "react";

/** Chuẩn hoá SĐT thành dạng zalo.me nhận được (chỉ giữ chữ số; +84 → 0). */
export function zaloDigits(phone: string | null | undefined): string {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("84") && d.length >= 11) d = "0" + d.slice(2);
  return d;
}

/**
 * Ô "SĐT liên hệ chủ dịch vụ" trong admin — KHÔNG hiển thị ra web công khai.
 * Nhập số hợp lệ → hiện nút mở chat Zalo với chủ dịch vụ.
 */
export function ContactPhoneField({ defaultValue, className }: { defaultValue?: string | null; className: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const digits = zaloDigits(value);
  const valid = digits.length >= 9;
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-600">SĐT chủ dịch vụ (nội bộ)</span>
      <div className="flex gap-2">
        <input
          name="contactPhone"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="tel"
          placeholder="VD: 0912 345 678"
          className={className}
        />
        {valid && (
          <a
            href={`https://zalo.me/${digits}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Chat Zalo với chủ dịch vụ"
            className="mt-1 inline-flex shrink-0 items-center rounded-xl bg-sky-600 px-3 text-sm font-bold text-white hover:bg-sky-700"
          >
            Chat Zalo
          </a>
        )}
      </div>
      <span className="mt-1 block text-xs text-gray-400">Không hiện ra web, chỉ để admin nhắn Zalo chủ dịch vụ.</span>
    </label>
  );
}
