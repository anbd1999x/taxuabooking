"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ô nhập số lượng (số người/số vé...): cho phép xoá trắng khi đang gõ
 * (quan trọng trên mobile), chỉ kẹp về min..max khi rời ô.
 * Parent giữ state dạng number; onChange chỉ nhận giá trị hợp lệ đã kẹp.
 */
export function QtyInput({
  value,
  onChange,
  min = 1,
  max = 20,
  className,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  // Đồng bộ khi parent đổi giá trị từ bên ngoài (không đè lúc đang gõ)
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      aria-label={ariaLabel}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = Number(t);
        if (t !== "" && Number.isFinite(n)) onChange(clamp(n));
      }}
      onBlur={() => {
        focused.current = false;
        const n = Number(text);
        const v = text === "" || !Number.isFinite(n) ? value : clamp(n);
        onChange(v);
        setText(String(v));
      }}
      className={className}
    />
  );
}
