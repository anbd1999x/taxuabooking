"use client";

import { useState } from "react";

/** Thêm dấu chấm phân cách nghìn: "1234567" → "1.234.567". */
function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Ô nhập tiền cho form admin: hiển thị có dấu chấm phân cách nghìn khi gõ,
 * submit về server dưới dạng số thuần qua input ẩn (giữ nguyên `name`).
 * Để trống = gửi chuỗi rỗng (các action hiểu là null, như input number cũ).
 */
export function MoneyInput({
  name,
  defaultValue,
  placeholder,
  className,
}: {
  name: string;
  defaultValue?: number | string | null;
  placeholder?: string;
  className?: string;
}) {
  const [raw, setRaw] = useState(() =>
    defaultValue == null || defaultValue === "" ? "" : String(defaultValue).replace(/\D/g, ""),
  );

  // Ô hiển thị KHÔNG được React điều khiển (chỉ defaultValue): format trực tiếp
  // trong onInput. Nếu để value={...} thì bàn phím điện thoại (IME) chèn lại cả
  // chuỗi đang gõ mỗi lần React ghi đè → số bị nhân đôi (vd 300000 → 33.300.000).
  function onInput(e: React.FormEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const digits = el.value.replace(/\D/g, "").slice(0, 12);
    const shown = group(digits);
    if (el.value !== shown) el.value = shown; // ghi đồng bộ, con trỏ về cuối
    setRaw(digits);
  }

  return (
    <>
      <input type="hidden" name={name} value={raw} />
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={group(raw)}
        onInput={onInput}
        placeholder={placeholder}
        className={className}
      />
    </>
  );
}
