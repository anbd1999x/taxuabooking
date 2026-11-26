import type { Metadata } from "next";
import Link from "@/components/Link";
import { pageMeta } from "@/lib/og";
import { getSettings } from "@/lib/queries";
import { ORG_ID, SITE, WEBSITE_ID } from "@/lib/site";
import { formatPhone, parseTrustPopup, TRUST_POPUP_KEY, visibleLegalNames } from "@/lib/trust-popup";
import { getT, lp } from "@/lib/i18n/server";
import { BreadcrumbLd } from "@/components/BreadcrumbLd";
import { i18nMeta } from "@/lib/i18n/meta";

export const dynamic = "force-dynamic";

export const generateMetadata = () => i18nMeta({
  title: "Giới thiệu: đại lý đặt xe, phòng Tà Xùa",
  description:
    "Tà Xùa Booking là ai: thông tin người chịu trách nhiệm, địa chỉ, số điện thoại, email và vai trò nền tảng trung gian đặt dịch vụ homestay, xe cabin tại Tà Xùa.",
  path: "/gioi-thieu",
});

export default async function AboutPage() {
  const t = await getT();
  const s = await getSettings();
  const owners = visibleLegalNames(parseTrustPopup(s[TRUST_POPUP_KEY]));
  const phone = s.contactPhone || SITE.defaultPhone;
  const zalo = s.contactZalo || SITE.defaultZalo;
  const email = SITE.email;
  const address = s.contactAddress || t("Tà Xùa, Bắc Yên, Sơn La");

  // Thông tin pháp lý: SiteSettings (legalName, taxCode, legalAddress) ghi đè mặc định trong SITE.
  const rows: [string, React.ReactNode][] = [
    [t("Đơn vị kinh doanh"), t(s.legalName || SITE.legalName)],
    [t("Người chịu trách nhiệm"), owners.join(", ")],
    [t("Mã số thuế"), s.taxCode || SITE.taxCode],
    [t("Địa chỉ đăng ký"), s.legalAddress || SITE.legalAddress],
    [t("Khu vực hoạt động"), address],
    [
      t("Điện thoại"),
      <a key="p" href={`tel:${phone.replace(/\s/g, "")}`} className="font-semibold text-forest-700">{formatPhone(phone)}</a>,
    ],
    ...(zalo
      ? ([[
          "Zalo",
          <a key="z" href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700">{formatPhone(zalo)}</a>,
        ]] as [string, React.ReactNode][])
      : []),
    ["Email", <a key="e" href={`mailto:${email}`} className="break-all font-semibold text-forest-700">{t(email)}</a>],
    [t("Giờ hoạt động"), t("{0} hằng ngày", [SITE.supportHours])],
    ["Website", "taxuabooking.com"],
  ];

  // JSON-LD: trang giới thiệu của tổ chức khai ở layout gốc (chỉ tham chiếu @id, không nhúng lại thông tin).
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    url: `${SITE.url}${await lp("/gioi-thieu")}`,
    name: t("Giới thiệu Tà Xùa Booking"),
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: { "@id": ORG_ID },
  };

  return (
    <div className="container-page py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageLd).replace(/</g, "\\u003c") }} />
      <BreadcrumbLd items={[{ name: t("Trang chủ"), path: "/" }, { name: t("Giới thiệu"), path: "/gioi-thieu" }]} />
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:text-forest-700">{t("Trang chủ")}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{t("Giới thiệu")}</span>
      </nav>

      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t("Giới thiệu Tà Xùa Booking")}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-700">
          {t("Tà Xùa Booking là")}{" "}<b>{t("nền tảng trung gian đặt dịch vụ du lịch tại Tà Xùa")}</b>{t(": homestay, xe cabin, thuê xe máy, xe ôm, taxi và combo. Chúng tôi")}{" "}<b>{t("không phải chủ homestay hay nhà xe")}</b>{t("; mọi dịch vụ trên website do các đối tác – chính chủ cơ sở – sở hữu, vận hành và trực tiếp cung cấp.")}
        </p>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-lg font-bold text-ink">{t("Thông tin đơn vị")}</h2>
          <dl className="mt-3 divide-y divide-gray-100 text-[15px]">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 py-2.5 sm:grid-cols-[190px_minmax(0,1fr)]">
                <dt className="text-gray-500">{t(k)}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-bold text-ink">{t("Chúng tôi làm gì")}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-gray-700">
            <li>{t("Tổng hợp giá và tình trạng còn chỗ theo ngày do đối tác cung cấp.")}</li>
            <li>{t("Tiếp nhận yêu cầu đặt của bạn, liên hệ đối tác để xác nhận chỗ và giá rồi mới chốt đơn.")}</li>
            <li>{t("Hỗ trợ bạn trước, trong và sau chuyến đi; làm việc với đối tác khi có sự cố.")}</li>
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-bold text-ink">{t("Chúng tôi không phải là")}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-gray-700">
            <li>{t("Chủ sở hữu hay website riêng của bất kỳ homestay, nhà xe nào được giới thiệu trên trang.")}</li>
            <li>{t("Đơn vị trực tiếp vận hành phòng nghỉ hay chuyến xe – dịch vụ do đối tác cung cấp.")}</li>
          </ul>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-700">
            {t("Tên, thương hiệu và hình ảnh của từng cơ sở thuộc về cơ sở đó. Hình ảnh trên website do đối tác cung cấp và cho phép sử dụng. Nếu bạn là chủ cơ sở và muốn chỉnh sửa hoặc gỡ thông tin, vui lòng liên hệ theo thông tin ở trên.")}
          </p>
        </section>

        <p className="mt-6 text-sm text-gray-600">
          {t("Xem thêm:")}{" "}
          <Link href="/cam-ket/dieu-khoan" className="font-semibold text-forest-700 hover:underline">{t("Điều khoản & hoàn tiền")}</Link>
          {" · "}
          <Link href="/chinh-sach-bao-mat" className="font-semibold text-forest-700 hover:underline">{t("Chính sách bảo mật")}</Link>
          {" · "}
          <Link href="/lien-he" className="font-semibold text-forest-700 hover:underline">{t("Liên hệ")}</Link>
        </p>
      </div>
    </div>
  );
}
