import type { Metadata } from "next";
import { pageMeta } from "@/lib/og";
import Link from "next/link";
import { getSettings } from "@/lib/queries";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Hướng dẫn đặt dịch vụ",
  description: "Hướng dẫn chi tiết cách đặt xe cabin, homestay, thuê xe máy, combo và tra cứu đơn tại Tà Xùa Booking.",
  path: "/huong-dan",
});

export default async function GuidePage() {
  const settings = await getSettings();
  const phone = settings.contactPhone || SITE.defaultPhone;
  const zalo = settings.contactZalo || SITE.defaultZalo;
  const tel = phone.replace(/\s/g, "");

  const steps: { icon: string; title: string; href: string; body: string[] }[] = [
    {
      icon: "🚐",
      title: "Đặt xe cabin",
      href: "/xe-cabin",
      body: [
        "Vào mục Xe cabin, chọn Ngày đi (và Ngày về nếu đi khứ hồi), bấm Tìm.",
        "Chọn nhà xe còn chỗ → chọn số vé (cabin đơn/đôi), điểm đón/trả, rồi điền thông tin liên hệ.",
        "Gửi yêu cầu → nhận mã đơn (VD: TX-ABC123). Nhà xe sẽ gọi xác nhận.",
      ],
    },
    {
      icon: "🏠",
      title: "Đặt homestay / bungalow",
      href: "/homestay",
      body: [
        "Vào mục Homestay, chọn ngày Nhận/Trả phòng để xem phòng trống và giá theo kỳ.",
        "Mở một homestay → chọn phòng phù hợp → điền số khách và thông tin liên hệ.",
        "Gửi yêu cầu → nhận mã đơn. Chủ homestay gọi xác nhận phòng & giá.",
      ],
    },
    {
      icon: "🏍️",
      title: "Thuê xe máy",
      href: "/thue-xe-may",
      body: [
        "Vào mục Thuê xe máy, chọn ngày nhận/trả xe.",
        "Chọn loại xe → điền thông tin. Khi nhận xe cần mang CCCD hoặc bằng lái.",
      ],
    },
    {
      icon: "🎒",
      title: "Đặt combo (xe + phòng)",
      href: "/combo",
      body: [
        "Vào mục Combo, chọn Ngày đi và Ngày về, số người, mức giá mong muốn (nếu có).",
        "Lưu ý: ngày đi là đêm lên xe, hôm sau nhận phòng — nên ngày về cách ngày đi tối thiểu 2 ngày.",
        "Chọn combo phù hợp → điền thông tin → gửi yêu cầu.",
      ],
    },
    {
      icon: "🛵",
      title: "Xe ôm & taxi",
      href: "/xe-om",
      body: [
        "Vào mục Xe ôm hoặc Taxi, xem các tuyến & giá tham khảo.",
        "Gửi yêu cầu hoặc gọi trực tiếp tổng đài để được điều xe.",
      ],
    },
  ];

  return (
    <div className="container-page py-8">
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:text-forest-700">Trang chủ</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">Hướng dẫn</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Hướng dẫn đặt dịch vụ</h1>
        <p className="mt-1 max-w-2xl text-gray-500">
          Tà Xùa Booking giúp bạn xem giá, tình trạng còn chỗ theo ngày và gửi yêu cầu đặt nhanh.
          Không cần thanh toán online — chủ dịch vụ sẽ gọi xác nhận trước.
        </p>
      </header>

      {/* 4 bước tổng quan */}
      <ol className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["1", "Chọn dịch vụ & ngày", "Tìm theo ngày để xem giá và chỗ trống chính xác."],
          ["2", "Chọn & điền thông tin", "Chọn phòng/vé/xe rồi điền tên + số điện thoại."],
          ["3", "Nhận mã đơn", "Hệ thống tạo mã đơn (VD: TX-ABC123) sau khi gửi."],
          ["4", "Xác nhận qua điện thoại", "Chủ dịch vụ gọi chốt giá & giữ chỗ cho bạn."],
        ].map(([n, t, d]) => (
          <li key={n} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-600 text-sm font-bold text-white">{n}</div>
            <div className="mt-2 font-bold text-ink">{t}</div>
            <div className="mt-0.5 text-sm text-gray-500">{d}</div>
          </li>
        ))}
      </ol>

      {/* Hướng dẫn từng dịch vụ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {steps.map((s) => (
          <section key={s.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{s.icon}</span>
              <h2 className="text-lg font-bold text-ink">{s.title}</h2>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm leading-relaxed text-gray-600">
              {s.body.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-[2px] text-forest-600">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <Link href={s.href} className="mt-3 inline-block rounded-lg bg-forest-50 px-4 py-2 text-sm font-semibold text-forest-700 ring-1 ring-forest-100 hover:bg-forest-100">
              Đến {s.title.toLowerCase()} →
            </Link>
          </section>
        ))}
      </div>

      {/* Tra cứu đơn */}
      <section className="mt-6 rounded-2xl bg-forest-50 p-5 ring-1 ring-forest-100">
        <h2 className="text-lg font-bold text-forest-800">🧾 Tra cứu tình trạng đơn</h2>
        <p className="mt-1 text-sm text-gray-700">
          Sau khi đặt, bạn nhận được <b>mã đơn</b>. Vào trang tra cứu, nhập <b>số điện thoại</b> đã đặt
          (hoặc mã đơn) để xem tình trạng: Mới → Đang liên hệ → Đã xác nhận → Hoàn thành.
        </p>
        <Link href="/tra-cuu" className="mt-3 inline-block rounded-lg bg-forest-600 px-4 py-2 text-sm font-bold text-white hover:bg-forest-700">
          Tra cứu đơn của tôi →
        </Link>
      </section>

      {/* Liên hệ */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold text-ink">Cần hỗ trợ?</h2>
        <p className="mt-1 text-sm text-gray-600">Liên hệ trực tiếp để được tư vấn và đặt nhanh.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`tel:${tel}`} className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">📞 {phone}</a>
          {zalo && <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-sunset-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sunset-600">💬 Chat Zalo</a>}
          <Link href="/lien-he" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Trang liên hệ</Link>
        </div>
      </section>
    </div>
  );
}
