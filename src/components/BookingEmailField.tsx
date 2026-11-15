"use client";

/** Email hợp lệ ở mức cơ bản (server kiểm tra lại bằng zod). Trống = hợp lệ vì không bắt buộc. */
export function emailLooksValid(v: string): boolean {
  const s = v.trim();
  return s === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Ô email (không bắt buộc) dùng chung cho mọi form đặt: homestay, xe cabin, combo, xe máy / xe ôm / taxi.
 * Có email ⇒ thông tin đơn gửi qua email; không điền ⇒ báo qua Zalo.
 */
export function BookingEmailField({
  value,
  onChange,
  inputClassName,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  inputClassName: string;
  error?: string | null;
}) {
  const bad = !emailLooksValid(value);
  return (
    <div className="flex flex-col gap-1">
      <input
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="email"
        autoComplete="email"
        placeholder="Email (không bắt buộc)"
        aria-label="Email (không bắt buộc)"
        className={`${inputClassName} ${bad || error ? "!border-red-400" : ""}`}
      />
      {(bad || error) && <span className="text-xs text-red-600">{error || "Email không hợp lệ."}</span>}
      <span className="text-[11.5px] leading-snug text-gray-500">
        Có điền email: thông tin đơn sẽ được gửi qua email. Không điền: chúng tôi báo qua Zalo.
      </span>
    </div>
  );
}
