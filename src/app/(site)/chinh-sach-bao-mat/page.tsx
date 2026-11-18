import type { Metadata } from "next";
import { pageMeta } from "@/lib/og";
import Link from "@/components/Link";
import { getSettings } from "@/lib/queries";
import { SITE } from "@/lib/site";
import { formatPhone } from "@/lib/trust-popup";
import { getT } from "@/lib/i18n/server";
import { i18nMeta } from "@/lib/i18n/meta";

export const dynamic = "force-dynamic";

export const generateMetadata = () => i18nMeta({
  title: "Chính sách bảo mật",
  description: "Chính sách bảo mật và xử lý dữ liệu cá nhân của Tà Xùa Booking.",
  path: "/chinh-sach-bao-mat",
});

export default async function PrivacyPage() {
  const t = await getT();
  const settings = await getSettings();
  const phone = settings.contactPhone || SITE.defaultPhone;
  const email = SITE.email;
  const updated = "15/11/2026";

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mt-6">
      <h2 className="text-lg font-bold text-ink">{t(title)}</h2>
      <div className="mt-2 flex flex-col gap-2 text-[15px] leading-relaxed text-gray-700">{children}</div>
    </section>
  );

  return (
    <div className="container-page py-8">
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:text-forest-700">{t("Trang chủ")}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{t("Chính sách bảo mật")}</span>
      </nav>

      <div className="mx-auto max-w-3xl">
        <header>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t("Chính sách bảo mật")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("Cập nhật lần cuối: {0}", [t(updated)])}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-700">
            {t("Tà Xùa Booking (“chúng tôi”) tôn trọng quyền riêng tư của bạn. Chính sách này giải thích chúng tôi thu thập, sử dụng và bảo vệ thông tin cá nhân như thế nào khi bạn sử dụng website taxuabooking.com.")}
          </p>
        </header>

        <Section title={t("1. Thông tin chúng tôi thu thập")}>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>{t("Khi đặt dịch vụ:")}</b>{" "}{t("họ tên, số điện thoại, email (không bắt buộc, dùng để gửi thông tin và xác nhận đơn), ngày sử dụng, lựa chọn dịch vụ (phòng/vé/xe) và ghi chú bạn cung cấp.")}</li>
            <li><b>{t("Khi tạo tài khoản để đánh giá:")}</b>{" "}{t("số điện thoại và mật khẩu (mật khẩu được mã hoá, chúng tôi không lưu dạng gốc).")}</li>
            <li><b>{t("Khi đăng nhập bằng Google / Facebook:")}</b>{" "}{t("tên hiển thị và địa chỉ email từ tài khoản mạng xã hội của bạn (nếu bạn cho phép). Chúng tôi không lấy mật khẩu mạng xã hội của bạn.")}</li>
            <li><b>{t("Nội dung bạn đăng:")}</b>{" "}{t("số sao và nhận xét đánh giá dịch vụ.")}</li>
          </ul>
        </Section>

        <Section title={t("2. Mục đích sử dụng")}>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("Tiếp nhận và xác nhận yêu cầu đặt dịch vụ; liên hệ lại với bạn qua điện thoại/Zalo.")}</li>
            <li>{t("Cho phép bạn tra cứu tình trạng đơn và viết/chỉnh sửa đánh giá.")}</li>
            <li>{t("Hiển thị đánh giá công khai (tên hiển thị + nội dung) để hỗ trợ khách khác tham khảo.")}</li>
            <li>{t("Cải thiện chất lượng dịch vụ và vận hành website.")}</li>
          </ul>
        </Section>

        <Section title={t("3. Cookie & đăng nhập")}>
          <p>
            {t("Chúng tôi dùng cookie kỹ thuật để ghi nhớ phiên đăng nhập của bạn. Cookie này cần thiết để website hoạt động.")}
          </p>
          <p>
            {t("Website có gắn")}{" "}<b>Google Tag Manager / Google Ads</b>{" "}{t("để đo lường hiệu quả quảng cáo (ví dụ: ghi nhận khi một yêu cầu đặt dịch vụ được gửi thành công). Google có thể đặt cookie và thu thập dữ liệu sử dụng theo chính sách quyền riêng tư của Google. Chúng tôi không gửi họ tên, số điện thoại của bạn cho mục đích quảng cáo. Bạn có thể tắt quảng cáo cá nhân hoá tại")}{" "}
            <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700">adssettings.google.com</a>.
          </p>
        </Section>

        <Section title={t("4. Chia sẻ thông tin")}>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("Chúng tôi chia sẻ thông tin đặt chỗ (tên, SĐT, lựa chọn) cho")}{" "}<b>{t("chủ dịch vụ/nhà xe liên quan")}</b>{" "}{t("để xác nhận và phục vụ đơn của bạn.")}</li>
            <li>{t("Chúng tôi")}{" "}<b>{t("không bán")}</b>{" "}{t("dữ liệu cá nhân của bạn cho bên thứ ba vì mục đích quảng cáo.")}</li>
            <li>{t("Chúng tôi có thể tiết lộ thông tin nếu pháp luật yêu cầu.")}</li>
          </ul>
        </Section>

        <Section title={t("5. Lưu trữ & bảo mật")}>
          <p>
            {t("Dữ liệu được lưu trên máy chủ có kiểm soát truy cập. Mật khẩu được băm (hash). Chúng tôi giữ thông tin trong thời gian cần thiết để phục vụ đơn và nghĩa vụ liên quan, sau đó có thể xoá hoặc ẩn danh.")}
          </p>
        </Section>

        <Section title={t("6. Quyền của bạn")}>
          <p>
            {t("Bạn có thể yêu cầu xem, sửa, hoặc")}{" "}<b>{t("xoá tài khoản/đánh giá")}</b>{" "}{t("của mình, hoặc rút lại sự đồng ý đăng nhập mạng xã hội. Vui lòng liên hệ chúng tôi theo thông tin bên dưới để được hỗ trợ.")}
          </p>
        </Section>

        <Section title={t("7. Liên hệ")}>
          <p>
            {t("Mọi thắc mắc về quyền riêng tư, vui lòng liên hệ:")}
          </p>
          <ul className="list-none space-y-1">
            <li>{t("📞 Điện thoại/Zalo:")}{" "}<a href={`tel:${phone.replace(/\s/g, "")}`} className="font-semibold text-forest-700">{formatPhone(phone)}</a></li>
            {email && <li>✉️ Email: <a href={`mailto:${email}`} className="font-semibold text-forest-700">{t(email)}</a></li>}
            <li>🌐 Website: taxuabooking.com</li>
          </ul>
        </Section>

        <p className="mt-8 text-sm text-gray-400">
          {t("Chúng tôi có thể cập nhật chính sách này theo thời gian; phiên bản mới sẽ được đăng tại trang này.")}
        </p>
      </div>
    </div>
  );
}
