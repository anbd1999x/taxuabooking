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
  return (
    <>
      <input type="hidden" name={name} value={raw} />
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={group(raw)}
        onChange={(e) => setRaw(e.target.value.replace(/\D/g, "").slice(0, 12))}
        placeholder={placeholder}
        className={className}
      />
    </>
  );
}
