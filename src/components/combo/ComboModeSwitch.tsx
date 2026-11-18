"use client";

import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocaleRouter, useT } from "@/components/i18n/I18nProvider";
import { PushSwitch } from "@/components/home/PushSwitch";

/**
 * Nút chuyển 2 chế độ combo — dùng chung công tắc gọn "người tí hon đẩy núm" của trang homestay
 * (`PushSwitch`). Đổi chế độ = điều hướng sang URL `?mode=` (trang dựng phía server).
 *
 * Công tắc phải nằm CÙNG HÀNG với bộ lọc kết quả, mà hàng đó thuộc `ComboResults` / `ComboCustom` —
 * hai cây khác nhau, đổi chế độ là React dựng lại ⇒ hoạt cảnh đẩy núm sẽ bị cắt giữa chừng. Vì vậy
 * công tắc được dựng MỘT LẦN ở cấp trang vào một thẻ div riêng (portal), rồi thẻ đó được dời vào
 * `<ComboModeSlot />` đang có trên trang sau mỗi lần dựng: công tắc không bị tạo lại, hoạt cảnh chạy liền.
 */

type Mode = "sug" | "custom";
const SLOT = "data-combo-mode-slot";
const noSub = () => () => {};

/** Chỗ đặt công tắc (mỗi trạng thái trang dựng đúng một slot). Giữ sẵn chiều cao để khỏi giật bố cục. */
export function ComboModeSlot({ className = "" }: { className?: string }) {
  return <div {...{ [SLOT]: "" }} className={`h-[58px] w-full sm:w-[400px] sm:flex-none ${className}`} />;
}

export function ComboModeSwitch({
  mode: modeProp,
  sugHref,
  customHref,
  sugCount,
}: {
  mode: Mode;
  sugHref: string;
  customHref: string;
  /** Số phương án combo gợi ý (null = chưa có kết quả). */
  sugCount: number | null;
}) {
  const t = useT();
  const router = useLocaleRouter();
  const [mode, setMode] = useState<Mode>(modeProp);
  // URL đổi từ bên ngoài (nút Back, link "← phương án gợi ý"…) ⇒ theo URL.
  const [seenProp, setSeenProp] = useState(modeProp);
  if (seenProp !== modeProp) {
    setSeenProp(modeProp);
    setMode(modeProp);
  }

  // Thẻ chứa công tắc: chỉ tạo ở trình duyệt (sau hydrate), một lần, tồn tại suốt vòng đời trang.
  const mounted = useSyncExternalStore(noSub, () => true, () => false);
  const host = useMemo(() => {
    if (!mounted) return null;
    const d = document.createElement("div");
    d.className = "w-full";
    return d;
  }, [mounted]);
  useEffect(() => () => host?.remove(), [host]);
  // Sau MỖI lần dựng: dời thẻ vào slot hiện có (slot cũ bị gỡ khi đổi chế độ).
  useLayoutEffect(() => {
    if (!host) return;
    const place = () => {
      const slot = document.querySelector(`[${SLOT}]`);
      if (slot && host.parentNode !== slot) slot.appendChild(host);
      return Boolean(slot);
    };
    if (place()) return;
    const id = requestAnimationFrame(place);
    return () => cancelAnimationFrame(id);
  });

  if (!host) return null;
  return createPortal(
    <PushSwitch<Mode>
      value={mode}
      onChange={(to) => {
        setMode(to);
        router.push(to === "custom" ? customHref : sugHref, { scroll: false });
      }}
      left={{ k: "sug", name: t("Combo gợi ý"), n: sugCount ?? "…" }}
      right={{ k: "custom", name: t("Combo tự chọn"), n: t("Tuỳ ý") }}
      ariaLabel={t("Chế độ combo")}
      flag={t("Đi Tà Xùa thôi!")}
      pushLabel={t("ĐẨY")}
      tip={(name) => t("Đẩy sang {0}", [name])}
    />,
    host,
  );
}
