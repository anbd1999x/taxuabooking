"use client";

import Link from "@/components/Link";
import { useT } from "@/components/i18n/I18nProvider";

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
  const t = useT();
  const bad = !emailLooksValid(value);
  return (
    <div className="flex flex-col gap-1">
      <input
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="email"
        autoComplete="email"
        placeholder={t("Email (không bắt buộc)")}
        aria-label={t("Email (không bắt buộc)")}
        className={`${inputClassName} ${bad || error ? "!border-red-400" : ""}`}
      />
      {(bad || error) && <span className="text-xs text-red-600">{t(error) || t("Email không hợp lệ.")}</span>}
      <span className="text-[11.5px] leading-snug text-gray-500">
        {t("Có điền email: thông tin đơn sẽ được gửi qua email. Không điền: chúng tôi báo qua Zalo.")}
      </span>
      {/* Thông báo quyền riêng tư ngay tại form (yêu cầu của Google Ads về thu thập thông tin người dùng). */}
      <span className="mt-0.5 flex items-start gap-2.5 rounded-xl bg-forest-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-gray-700 ring-1 ring-forest-100">
        {/* Khiên có dấu tích (nét mảnh, màu thương hiệu) thay cho emoji ổ khoá. */}
        <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-[1px] flex-none text-forest-600">
          <path d="M12 3 5 6v5.5c0 4.2 2.9 7.9 7 9.5 4.1-1.6 7-5.3 7-9.5V6l-7-3Z" />
          <path d="m9 12 2.2 2.2L15.2 10" />
        </svg>
        <span>
          {t("Tên, số điện thoại và email chỉ dùng để Tà Xùa Booking liên hệ xác nhận đơn, chỉ chia sẻ với cơ sở bạn đặt để giữ chỗ. Không thu mật khẩu hay thông tin thẻ.")}{" "}
          <Link href="/chinh-sach-bao-mat" target="_blank" className="whitespace-nowrap font-semibold text-forest-700 underline underline-offset-2">
            {t("Chính sách bảo mật")}
          </Link>
        </span>
      </span>
    </div>
  );
}
