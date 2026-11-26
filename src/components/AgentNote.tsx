import Link from "@/components/Link";
import { getT } from "@/lib/i18n/server";

/**
 * Ghi chú minh bạch vai trò trên trang chi tiết homestay/nhà xe: nêu tên đối tác và nói rõ
 * Tà Xùa Booking chỉ là nền tảng trung gian đặt dịch vụ, để khách không hiểu nhầm đây là website của chính cơ sở đó.
 */
export async function AgentNote({ name }: { name: string }) {
  const t = await getT();
  return (
    <p className="mb-4 rounded-xl bg-forest-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-gray-700 ring-1 ring-forest-100">
      <b>{t("Đối tác: {0}", [t(name)])}</b>
      <br />
      {t("Tà Xùa Booking là nền tảng trung gian đặt dịch vụ, dịch vụ do đối tác cung cấp. Hình ảnh do đối tác cung cấp.")}{" "}
      <Link href="/gioi-thieu" className="font-semibold text-forest-700 hover:underline">
        {t("Về Tà Xùa Booking")}
      </Link>
    </p>
  );
}
