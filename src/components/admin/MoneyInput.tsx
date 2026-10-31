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

  // TUYỆT ĐỐI không ghi đè ô trong lúc đang gõ: bàn phím điện thoại (IME/gợi ý)
  // sẽ chèn lại cụm số đang gõ mỗi lần giá trị bị thay → số nhân đôi
  // (vd 400000 → 4.400.000). Vì vậy: lúc focus hiện số thô để gõ tự do,
  // rời ô (blur) mới format dấu chấm phân cách.
  function onInput(e: React.FormEvent<HTMLInputElement>) {
    setRaw(e.currentTarget.value.replace(/\D/g, "").slice(0, 12));
  }
  function onFocus(e: React.FocusEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const digits = el.value.replace(/\D/g, "");
    if (el.value !== digits) el.value = digits;
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const digits = el.value.replace(/\D/g, "").slice(0, 12);
    el.value = group(digits);
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
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className={className}
      />
    </>
  );
}
