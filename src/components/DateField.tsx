"use client";

/**
 * Ô chọn ngày dùng chung cho các form tìm kiếm.
 * - Vẫn dùng picker NGÀY NATIVE của trình duyệt/điện thoại (UX tốt trên mobile).
 * - Hiển thị giá trị theo định dạng **dd/mm/yyyy** bất kể locale máy (lớp phủ đè
 *   lên, chữ gốc của input để trong suốt).
 * - KHÔNG tự blur khi đổi giá trị: trên iOS sự kiện change bắn ngay lúc mở picker
 *   (mặc định hôm nay) → blur sẽ đóng lịch & chọn nhầm hôm nay. Để người dùng tự
 *   đóng lịch sau khi chọn.
 *
 * Cách dùng: thay cho <input type="date" className=... value=... onChange=... />.
 * `className` = class của ô input (giữ nguyên như cũ); `displayClassName` = class
 * chữ hiển thị (khớp cỡ chữ/màu/padding với input để canh đúng).
 */
export function DateField({
  value,
  onChange,
  min,
  max,
  className = "",
  displayClassName = "",
  placeholder = "dd/mm/yyyy",
  ariaLabel,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  className?: string;
  displayClassName?: string;
  placeholder?: string;
  ariaLabel?: string;
  required?: boolean;
}) {
  const display = formatDMY(value);
  return (
    <span className="relative block w-full">
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        required={required}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.currentTarget.value)}
        className={`${className} w-full`}
        // Ẩn chữ gốc của input để lớp phủ dd/mm/yyyy hiển thị thay thế.
        style={{ color: "transparent", WebkitTextFillColor: "transparent", colorScheme: "light" }}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 flex items-center ${displayClassName} ${display ? "" : "!text-gray-400"}`}
      >
        {display || placeholder}
      </span>
    </span>
  );
}

function formatDMY(v: string): string {
  if (!v) return "";
  const [y, m, d] = v.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}
