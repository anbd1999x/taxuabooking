import type { Metadata } from "next";
import { pageMeta } from "@/lib/og";
import Link from "@/components/Link";
import { getSettings } from "@/lib/queries";
import { SITE } from "@/lib/site";
import { getT } from "@/lib/i18n/server";
import { i18nMeta } from "@/lib/i18n/meta";

export const dynamic = "force-dynamic";

export const generateMetadata = () => i18nMeta({
  title: "Hướng dẫn đặt dịch vụ",
  description: "Hướng dẫn chi tiết cách đặt xe cabin, homestay, thuê xe máy, combo và tra cứu đơn tại Tà Xùa Booking.",
  path: "/huong-dan",
});

export default async function GuidePage() {
  const tr = await getT();
  const settings = await getSettings();
  const phone = settings.contactPhone || SITE.defaultPhone;
  const zalo = settings.contactZalo || SITE.defaultZalo;
  const tel = phone.replace(/\s/g, "");

  const steps: { icon: string; title: string; href: string; body: string[] }[] = [
    {
      icon: "🚐",
      title: tr("Đặt xe cabin"),
      href: "/xe-cabin",
      body: [
        tr("Vào mục Xe cabin, chọn Ngày đi (và Ngày về nếu đi khứ hồi), bấm Tìm."),
        tr("Chọn nhà xe còn chỗ → chọn số vé (cabin đơn/đôi), điểm đón/trả, rồi điền thông tin liên hệ."),
        tr("Gửi yêu cầu → nhận mã đơn (VD: TX-XC-AB23K). Nhà xe sẽ gọi xác nhận."),
      ],
    },
    {
      icon: "🏠",
      title: tr("Đặt homestay / bungalow"),
      href: "/homestay",
      body: [
        tr("Vào mục Homestay, chọn ngày Nhận/Trả phòng để xem phòng trống và giá theo kỳ."),
        tr("Mở một homestay → chọn phòng phù hợp → điền số khách và thông tin liên hệ."),
        tr("Gửi yêu cầu → nhận mã đơn. Chủ homestay gọi xác nhận phòng & giá."),
      ],
    },
    {
      icon: "🏍️",
      title: tr("Thuê xe máy"),
      href: "/thue-xe-may",
      body: [
        tr("Vào mục Thuê xe máy, chọn ngày nhận/trả xe."),
        tr("Chọn loại xe → điền thông tin. Khi nhận xe cần mang CCCD hoặc bằng lái."),
      ],
    },
    {
      icon: "🎒",
      title: tr("Đặt combo (xe + phòng)"),
      href: "/combo",
      body: [
        tr("Vào mục Combo, chọn Ngày đi và Ngày về, số người, mức giá mong muốn (nếu có)."),
        tr("Lưu ý: ngày đi là đêm lên xe, hôm sau nhận phòng — nên ngày về cách ngày đi tối thiểu 2 ngày."),
        tr("Chọn combo phù hợp → điền thông tin → gửi yêu cầu."),
      ],
    },
    {
      icon: "🛵",
      title: tr("Xe ôm & taxi"),
      href: "/xe-om",
      body: [
        tr("Vào mục Xe ôm hoặc Taxi, xem các tuyến & giá tham khảo."),
        tr("Gửi yêu cầu hoặc gọi trực tiếp tổng đài để được điều xe."),
      ],
    },
  ];

  return (
    <div className="container-page py-8">
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:text-forest-700">{tr("Trang chủ")}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{tr("Hướng dẫn")}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{tr("Hướng dẫn đặt dịch vụ")}</h1>
        <p className="mt-1 max-w-2xl text-gray-500">
          {tr("Tà Xùa Booking giúp bạn xem giá, tình trạng còn chỗ theo ngày và gửi yêu cầu đặt nhanh. Không cần thanh toán online — chủ dịch vụ sẽ gọi xác nhận trước.")}
        </p>
      </header>

      {/* 4 bước tổng quan */}
      <ol className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["1", tr("Chọn dịch vụ & ngày"), tr("Tìm theo ngày để xem giá và chỗ trống chính xác.")],
          ["2", tr("Chọn & điền thông tin"), tr("Chọn phòng/vé/xe rồi điền tên + số điện thoại.")],
          ["3", tr("Nhận mã đơn"), tr("Hệ thống tạo mã đơn (VD: TX-HT-AB23K) sau khi gửi.")],
          ["4", tr("Xác nhận qua điện thoại"), tr("Chủ dịch vụ gọi chốt giá & giữ chỗ cho bạn.")],
        ].map(([n, t, d]) => (
          <li key={n} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-600 text-sm font-bold text-white">{tr(n)}</div>
            <div className="mt-2 font-bold text-ink">{tr(t)}</div>
            <div className="mt-0.5 text-sm text-gray-500">{tr(d)}</div>
          </li>
        ))}
      </ol>

      {/* Hướng dẫn từng dịch vụ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {steps.map((s) => (
          <section key={s.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{tr(s.icon)}</span>
              <h2 className="text-lg font-bold text-ink">{tr(s.title)}</h2>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm leading-relaxed text-gray-600">
              {s.body.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-[2px] text-forest-600">✓</span>
                  <span>{tr(line)}</span>
                </li>
              ))}
            </ul>
            <Link href={s.href} className="mt-3 inline-block rounded-lg bg-forest-50 px-4 py-2 text-sm font-semibold text-forest-700 ring-1 ring-forest-100 hover:bg-forest-100">
              {tr("Đến {0} →", [tr(s.title.toLowerCase())])}
            </Link>
          </section>
        ))}
      </div>

      {/* Tra cứu đơn */}
      <section className="mt-6 rounded-2xl bg-forest-50 p-5 ring-1 ring-forest-100">
        <h2 className="text-lg font-bold text-forest-800">{tr("🧾 Tra cứu tình trạng đơn")}</h2>
        <p className="mt-1 text-sm text-gray-700">
          {tr("Sau khi đặt, bạn nhận được")}{" "}<b>{tr("mã đơn")}</b>{tr(". Vào trang tra cứu, nhập")}{" "}<b>{tr("số điện thoại")}</b>{" "}{tr("đã đặt (hoặc mã đơn) để xem tình trạng: Mới → Đang liên hệ → Đã xác nhận → Hoàn thành.")}
        </p>
        <Link href="/tra-cuu" className="mt-3 inline-block rounded-lg bg-forest-600 px-4 py-2 text-sm font-bold text-white hover:bg-forest-700">
          {tr("Tra cứu đơn của tôi →")}
        </Link>
      </section>

      {/* Liên hệ */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold text-ink">{tr("Cần hỗ trợ?")}</h2>
        <p className="mt-1 text-sm text-gray-600">{tr("Liên hệ trực tiếp để được tư vấn và đặt nhanh.")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`tel:${tel}`} className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">📞 {tr(phone)}</a>
          {zalo && <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-sunset-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sunset-600">💬 Chat Zalo</a>}
          <Link href="/lien-he" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{tr("Trang liên hệ")}</Link>
        </div>
      </section>
    </div>
  );
}
