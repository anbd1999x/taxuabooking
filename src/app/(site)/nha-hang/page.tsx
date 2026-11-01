import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Nhà hàng & quán ăn Tà Xùa — danh sách đầy đủ",
  description:
    "Danh sách nhà hàng, quán ăn ngon ở Tà Xùa theo từng khu vực: trung tâm, Đỉnh Gió, Khe Cải, Sống lưng khủng long — kèm giá tham khảo, giờ mở và món nên gọi.",
  alternates: { canonical: "/nha-hang" },
};

const COVER =
  "https://images.unsplash.com/photo-1771784970791-2032a255709d?fm=jpg&q=75&w=1600&h=700&fit=crop";

interface Place {
  name: string;
  area: string;
  price?: string;
  hours?: string;
  tags: string[];
  desc?: string; // mô tả tự biên soạn
}

const PLACES: Place[] = [
  { name: "Nhà Hàng A Phủ – Tinh Hoa Ẩm Thực Tà Xùa", area: "Trung tâm", tags: ["Đặc sản Tây Bắc", "Nhóm đông"], desc: "Địa chỉ quen của các đoàn khách: gà đen, cá suối, trâu gác bếp đủ món, phục vụ nhanh kể cả cuối tuần đông." },
  { name: "Bếp ăn Xuân Thì Tà Xùa", area: "Trung tâm", price: "Từ 90.000đ", tags: ["Cơm suất", "Giá mềm"], desc: "Cơm phần nóng sốt giá dễ chịu — lựa chọn gọn nhẹ cho bữa trưa giữa lịch trình dày." },
  { name: "Nhà Hàng Đồi Mây", area: "Trung tâm", tags: ["View núi", "Lẩu nướng"], desc: "Vừa ăn vừa ngắm thung lũng; hợp bữa tối thong thả sau một ngày săn mây." },
  { name: "Tiệm lẩu nướng Trạm Mây", area: "Khe Cải", price: "Từ 200.000đ", tags: ["Lẩu nướng", "Buổi tối"], desc: "Bếp nướng than ấm sực cho tối lạnh Tà Xùa; set đồ nướng + lẩu cho nhóm 2–6 người." },
  { name: "Nhà hàng Hang Chú – Tà Xùa", area: "Khe Cải", tags: ["Đặc sản Tây Bắc", "Nhóm đông"], desc: "Không gian rộng, nhận đặt mâm cho đoàn — nên gọi trước vào cuối tuần." },
  { name: "Tiệm Mì Cay Tà Xùa", area: "Trung tâm", tags: ["Ăn nhanh", "Ấm bụng"], desc: "Bát mì cay nóng hổi 'cứu đói' lý tưởng buổi tối hoặc sau chuyến xe đêm." },
  { name: "Vua Lẩu – Nướng Tà Xùa", area: "Trung tâm", tags: ["Lẩu nướng"], desc: "Chuyên lẩu và nướng, nhiều lựa chọn nước lẩu; hợp nhóm bạn tụ tập." },
  { name: "Cơm nhà Namiya – Đỉnh Gió", area: "Đỉnh Gió", tags: ["Cơm nhà", "Gần điểm săn mây"], desc: "Mâm cơm kiểu gia đình ngay khu Đỉnh Gió — tiện cho ai ở homestay quanh đây." },
  { name: "Nhà Hàng – Coffee Gió Bản Tà Xùa", area: "Trung tâm", tags: ["Có cà phê", "View núi"], desc: "Ăn uống và cà phê trong cùng một điểm, tiện ghé bất kỳ khung giờ nào." },
  { name: "Nhà Hàng Bếp Việt", area: "Trung tâm", tags: ["Cơm Việt", "Gia đình"], desc: "Thực đơn cơm Việt quen vị — lựa chọn an toàn khi đi cùng trẻ nhỏ, người lớn tuổi." },
  { name: "Mùa Quán Tà Xùa", area: "Trung tâm", tags: ["Đồ nướng", "Không gian ấm"] },
  { name: "Trạm Mây Tà Xùa", area: "Khe Cải", price: "Từ 249.000đ", tags: ["Set món", "View mây"] },
  { name: "Nhà Hàng Phố Núi", area: "Sống lưng khủng long", tags: ["Gần điểm check-in"], desc: "Nằm hướng Háng Đồng — điểm nạp năng lượng hiếm hoi gần sống lưng khủng long." },
  { name: "Nhà hàng Sammu Tà Xùa", area: "Trung tâm", tags: ["Gần cổng chào"] },
  { name: "Tiệm Nướng Cánh Cam", area: "Trung tâm", tags: ["Đồ nướng", "Buổi tối"] },
];

const AREAS = ["Tất cả", "Trung tâm", "Đỉnh Gió", "Khe Cải", "Sống lưng khủng long"];

export default async function NhaHangPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const area = typeof sp.khu === "string" && AREAS.includes(sp.khu) ? sp.khu : "Tất cả";
  const list = area === "Tất cả" ? PLACES : PLACES.filter((p) => p.area === area);

  return (
    <div className="container-page py-8">
      <div className="relative overflow-hidden rounded-[24px]">
        <div className="relative aspect-[16/7] sm:aspect-[16/5]">
          <Image src={COVER} alt="Tà Xùa về chiều — giờ lên đèn của các quán ăn" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 20%, oklch(0.2 0.04 160 / .75))" }} />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">Nhà hàng & quán ăn Tà Xùa</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85 sm:text-base">
              {PLACES.length} địa chỉ ăn uống theo từng khu vực — từ cơm suất giá mềm tới lẩu nướng tối lạnh.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-gray-600">
        Ẩm thực Tà Xùa xoay quanh nguyên liệu bản địa: gà đen, cá suối, rau cải mèo, mắc khén. Buổi tối trời lạnh,
        lẩu và nướng than là lựa chọn được yêu thích nhất. Mẹo nhỏ: nhóm đông nên <b>đặt bàn/đặt mâm trước từ chiều</b>,
        và hỏi giá trước với các món tính theo cân. Xem thêm <Link href="/kinh-nghiem/an-gi-o-ta-xua" className="font-semibold text-forest-700 underline underline-offset-2">món gì nên thử ở Tà Xùa</Link>.
      </p>

      {/* Lọc khu vực */}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {AREAS.map((a) => (
          <Link
            key={a}
            href={a === "Tất cả" ? "/nha-hang" : `/nha-hang?khu=${encodeURIComponent(a)}`}
            className={`flex-none whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              area === a ? "bg-forest-700 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-forest-50"
            }`}
          >
            {a}
          </Link>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <div key={p.name} className="flex flex-col gap-2.5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-[16px] font-extrabold leading-snug text-ink">{p.name}</h2>
              {p.price && <span className="flex-none whitespace-nowrap rounded-full bg-sunset-50 px-2.5 py-1 text-xs font-bold text-sunset-600">{p.price}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-500">
              <span>📍 {p.area}, Tà Xùa</span>
              {p.hours && <span>🕐 {p.hours}</span>}
            </div>
            {p.desc && <p className="text-[13.5px] leading-relaxed text-gray-600">{p.desc}</p>}
            <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
              {p.tags.map((t) => (
                <span key={t} className="rounded-full bg-forest-50 px-2.5 py-1 text-[11px] font-semibold text-forest-700">{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl bg-forest-50 p-5 text-sm leading-relaxed text-gray-700">
        <b>Lưu ý:</b> thông tin tổng hợp từ thực tế và có thể thay đổi theo mùa vụ; giá và giờ mở cửa nên xác nhận trực tiếp tại quán.
        Cần gợi ý quán hợp lịch trình? Gọi Tà Xùa Booking — chúng tôi tư vấn miễn phí kèm <Link href="/homestay" className="font-semibold text-forest-700 underline underline-offset-2">đặt phòng</Link> và <Link href="/xe-cabin" className="font-semibold text-forest-700 underline underline-offset-2">vé xe cabin</Link>.
        Tìm chỗ ngồi ngắm mây uống cà phê? Xem <Link href="/cafe" className="font-semibold text-forest-700 underline underline-offset-2">danh sách cafe Tà Xùa</Link>.
      </div>
    </div>
  );
}
