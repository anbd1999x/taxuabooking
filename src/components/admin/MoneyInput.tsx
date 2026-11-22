"use client";

import { useEffect, useRef, useState } from "react";

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

/**
 * Biến thể ĐIỀU KHIỂN bằng state (form tự lưu, VD /admin/itinerary): cùng cách gõ như `MoneyInput` —
 * đang focus hiện số thô, rời ô mới thêm dấu chấm — nhưng báo số qua `onChange` mỗi lần gõ.
 * Giá trị đổi từ bên ngoài (khôi phục mặc định, đổi lịch trình) chỉ ghi vào ô khi ô KHÔNG được focus.
 */
export function MoneyValueInput({
  value,
  onChange,
  placeholder = "0",
  className,
  max = 50_000_000,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const want = value ? group(String(value)) : "";
    if (el.value !== want) el.value = want;
  }, [value]);
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      defaultValue={value ? group(String(value)) : ""}
      placeholder={placeholder}
      onInput={(e) => onChange(Math.min(max, Number(e.currentTarget.value.replace(/\D/g, "").slice(0, 12)) || 0))}
      onFocus={(e) => {
        const el = e.currentTarget;
        const digits = el.value.replace(/\D/g, "");
        if (el.value !== digits) el.value = digits;
      }}
      onBlur={(e) => {
        const el = e.currentTarget;
        const n = Math.min(max, Number(el.value.replace(/\D/g, "").slice(0, 12)) || 0);
        el.value = n ? group(String(n)) : "";
        if (n !== value) onChange(n);
      }}
      className={className}
    />
  );
}

/**
 * Biến thể giữ giá trị là CHUỖI số (state sẵn có kiểu string): cùng cách gõ — đang focus hiện số thô
 * (giá trị = đúng chữ khách gõ ⇒ React không ghi đè, con trỏ không nhảy), rời ô mới hiện dấu chấm.
 * Nhận mọi thuộc tính của <input> (name, style, className, onBlur…); `onChange` trả chuỗi chỉ gồm chữ số.
 */
export function MoneyTextInput({
  value,
  onChange,
  onFocus,
  onBlur,
  maxDigits = 12,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (digits: string) => void;
  maxDigits?: number;
}) {
  const [focused, setFocused] = useState(false);
  const raw = String(value ?? "").replace(/\D/g, "");
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      {...rest}
      value={focused ? raw : group(raw)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, maxDigits))}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
    />
  );
}
