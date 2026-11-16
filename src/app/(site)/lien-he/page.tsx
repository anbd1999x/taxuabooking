import type { Metadata } from "next";
import { pageMeta } from "@/lib/og";
import { getSettings } from "@/lib/queries";
import { SITE } from "@/lib/site";
import { getT } from "@/lib/i18n/server";
import { i18nMeta } from "@/lib/i18n/meta";

export const dynamic = "force-dynamic";

export const generateMetadata = () => i18nMeta({
  title: "Liên hệ Tà Xùa Booking: hotline, Zalo đặt xe, đặt phòng",
  description: "Liên hệ Tà Xùa Booking qua hotline, Zalo để được tư vấn và đặt xe cabin, homestay, combo đi Tà Xùa. Hỗ trợ xem chỗ trống, báo giá và xác nhận đơn nhanh.",
  path: "/lien-he",
});

export default async function ContactPage() {
  const t = await getT();
  const s = await getSettings();
  const phone = s.contactPhone || SITE.defaultPhone;
  const zalo = s.contactZalo || SITE.defaultZalo;
  const email = SITE.email;
  const facebook = s.contactFacebook;
  const address = s.contactAddress || t("Tà Xùa, Bắc Yên, Sơn La");

  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t("Thông tin liên hệ")}</h1>
      <p className="mt-2 text-gray-600">
        {t("Chúng tôi luôn sẵn sàng hỗ trợ bạn đặt xe, phòng và combo du lịch Tà Xùa.")}
      </p>

      <div className="mt-6 space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p><span className="text-gray-500">{t("📞 Điện thoại:")}{" "}</span><a href={`tel:${phone.replace(/\s/g, "")}`} className="font-semibold text-forest-700">{t(phone)}</a></p>
        <p><span className="text-gray-500">{t("🕗 Giờ hoạt động:")}{" "}</span><span className="font-semibold text-ink">{t("{0} hằng ngày", [t(SITE.supportHours)])}</span> <span className="text-gray-500">{t("(đơn gửi ngoài giờ được xác nhận từ 8:00 hôm sau)")}</span></p>
        {zalo && <p><span className="text-gray-500">💬 Zalo: </span><a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700">{t(zalo)}</a></p>}
        {email && <p><span className="text-gray-500">✉️ Email: </span><a href={`mailto:${email}`} className="break-all font-semibold text-forest-700">{t(email)}</a></p>}
        {facebook && <p><span className="text-gray-500">📘 Facebook: </span><a href={facebook} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-forest-700">{t(facebook)}</a></p>}
        <p><span className="text-gray-500">{t("📍 Khu vực hoạt động:")}{" "}</span>{t(address)}</p>
        <p><span className="text-gray-500">{t("🏢 Đơn vị kinh doanh:")}{" "}</span>{t(s.legalName) || t(SITE.legalName)}</p>
        <p><span className="text-gray-500">{t("🧾 Mã số thuế:")}{" "}</span>{t(s.taxCode) || t(SITE.taxCode)}</p>
        <p><span className="text-gray-500">{t("🏠 Địa chỉ đăng ký:")}{" "}</span>{t(s.legalAddress) || t(SITE.legalAddress)}</p>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-600">
        {t("Tà Xùa Booking là đơn vị trung gian đặt dịch vụ du lịch tại Tà Xùa: chúng tôi tiếp nhận yêu cầu, xác nhận chỗ với chủ homestay/nhà xe rồi mới chốt đơn. Các cơ sở trên website do chính chủ cơ sở sở hữu và vận hành.")}
      </p>

      <div className="mt-4 flex gap-2">
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="rounded-xl bg-forest-600 px-5 py-3 font-semibold text-white hover:bg-forest-700">{t("Gọi ngay")}</a>
        {zalo && <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-sunset-500 px-5 py-3 font-semibold text-white hover:bg-sunset-600">Chat Zalo</a>}
      </div>
    </div>
  );
}
