import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Cafe Tà Xùa — danh sách quán cà phê săn mây",
  description:
    "Danh sách quán cafe Tà Xùa theo khu vực: Đỉnh Gió, Khe Cải, trung tâm, Sống lưng khủng long — quán view săn mây, giờ mở sớm cho buổi bình minh, giá tham khảo.",
  alternates: { canonical: "/cafe" },
};

const COVER =
  "https://images.pexels.com/photos/35195873/pexels-photo-35195873.jpeg?auto=compress&cs=tinysrgb&w=1600&h=700&fit=crop";

interface Place {
  name: string;
  area: string;
  price?: string;
  hours?: string;
  tags: string[];
  desc?: string; // mô tả tự biên soạn
}

const PLACES: Place[] = [
  { name: "Thào Coffee Tà Xùa", area: "Trung tâm", hours: "5:00–22:00", tags: ["View săn mây", "Mở sớm nhất"], desc: "Mở từ 5h sáng tới khuya — điểm hẹn của dân săn bình minh lẫn hội 'ngồi lì' buổi tối." },
  { name: "Tiệm Cà Phê Hoàng Hôn", area: "Khe Cải", hours: "6:00–19:00", tags: ["View săn mây", "Ngắm hoàng hôn"], desc: "Đúng như tên gọi: hướng ngồi đón trọn nắng chiều đổ xuống thung lũng mây." },
  { name: "Chill Cafe", area: "Đỉnh Gió", tags: ["View săn mây", "Có đồ ăn"], desc: "Ban công rộng hướng thung lũng, có đồ ăn nhẹ — ngồi được cả buổi không chán." },
  { name: "Panorama Coffee", area: "Đỉnh Gió", price: "Từ 40.000đ", hours: "6:00–18:00", tags: ["View săn mây", "Giá niêm yết"], desc: "Góc nhìn toàn cảnh đúng chất 'panorama'; giá đồ uống công khai dễ chọn." },
  { name: "Mị ơi Cafe", area: "Đỉnh Gió", price: "Từ 50.000đ", hours: "7:00–18:00", tags: ["View săn mây", "Decor xinh"], desc: "Nhiều góc chụp ảnh được chăm chút — hợp hội mê sống ảo." },
  { name: "Cà phê Bản – Sống Lưng Khủng Long", area: "Sống lưng khủng long", hours: "5:00–19:00", tags: ["View săn mây", "Gần điểm check-in"], desc: "Trạm dừng hiếm hoi ngay cung Háng Đồng — ghé sau buổi đi sống lưng khủng long là hợp lý nhất." },
  { name: "Sunset Clouds Coffee", area: "Sống lưng khủng long", tags: ["View săn mây", "Hoàng hôn"] },
  { name: "Cloud Coffee – Cloud Forest Tà Xùa", area: "Đỉnh Gió", tags: ["View săn mây"] },
  { name: "Mây Bay Coffee", area: "Đỉnh Gió", tags: ["View săn mây", "Có đồ ăn"] },
  { name: "An's Coffee – Tà Xùa", area: "Đỉnh Gió", tags: ["View săn mây", "Có đồ ăn"] },
  { name: "Cafe Làng Văn Hóa", area: "Đỉnh Gió", tags: ["View săn mây", "Có đồ ăn"] },
  { name: "Hiên", area: "Đỉnh Gió", tags: ["View săn mây", "Ngồi ngoài trời"] },
  { name: "Nhà Của An Homestay & Coffee", area: "Đỉnh Gió", tags: ["View săn mây", "Có homestay"] },
  { name: "Moong Homestay & Coffee", area: "Đỉnh Gió", tags: ["View săn mây", "Có homestay"] },
  { name: "Mi Ami Mountain Retreat – Cafe & Nhà hàng", area: "Đỉnh Gió", tags: ["View săn mây", "Có đồ ăn"] },
  { name: "Chillout Village – Nhà hàng & Cafe", area: "Khe Cải", tags: ["View săn mây", "Có đồ ăn"] },
  { name: "Lili Mountain – Tiệm cà phê Tử Tế", area: "Khe Cải", tags: ["View săn mây"] },
  { name: "Khe Cải Coffee (Ngày Nào Đó)", area: "Khe Cải", hours: "6:00–19:00", tags: ["View săn mây"] },
  { name: "Noong Ơi Homestay Coffee", area: "Khe Cải", tags: ["View săn mây", "Có homestay"] },
  { name: "Cà phê Tháng 10", area: "Trung tâm", tags: ["Ngồi ngoài trời"] },
  { name: "Nhà H'Mông", area: "Trung tâm", hours: "6:30–23:00", tags: ["Có đồ ăn", "Mở khuya"], desc: "Mở tới 23h — chỗ ngồi ấm cho buổi tối lạnh khi các quán khác đã đóng." },
  { name: "MẬN – The Cocktail Bar", area: "Trung tâm", tags: ["Cocktail", "Buổi tối"], desc: "Không phải cà phê mà là quán cocktail hiếm hoi trên núi — đổi gió cho buổi tối Tà Xùa." },
  { name: "Mây Bản Tà Xùa – Homestay & Coffee", area: "Mống Vài", tags: ["View săn mây", "Có homestay"] },
  { name: "Hiên Nhà trên Thảo Nguyên", area: "Thảo nguyên", tags: ["View săn mây", "Ngồi ngoài trời"] },
  { name: "Khèn Coffee House", area: "Làng Chếu", tags: ["View săn mây", "Có đồ ăn"] },
  { name: "Trạm Mây Tà Xùa", area: "Khe Cải", tags: ["View mây", "Có đồ ăn"] },
];

const AREAS = ["Tất cả", "Đỉnh Gió", "Khe Cải", "Trung tâm", "Sống lưng khủng long"];

export default async function CafePage({
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
          <Image src={COVER} alt="Ngồi cà phê ngắm biển mây Tà Xùa" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 20%, oklch(0.2 0.04 160 / .75))" }} />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">Cafe Tà Xùa — ngồi trên biển mây</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85 sm:text-base">
              {PLACES.length} quán cà phê theo từng khu vực — chọn quán mở sớm cho buổi bình minh hoặc quán hoàng hôn cho buổi chiều.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-gray-600">
        "Cà phê săn mây" là trải nghiệm riêng có của Tà Xùa: quán dựng ban công gỗ vươn ra sườn núi, sáng sớm mây dâng
        tới tận lan can. Giờ ngồi đẹp nhất là <b>5h30–9h</b> (mây dày) và <b>16h30–18h</b> (hoàng hôn); cuối tuần bàn mép
        ban công hết rất nhanh. Đọc thêm <Link href="/kinh-nghiem/ca-phe-san-may-ta-xua" className="font-semibold text-forest-700 underline underline-offset-2">kinh nghiệm cà phê săn mây</Link> trước khi chọn quán.
      </p>

      {/* Lọc khu vực */}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {AREAS.map((a) => (
          <Link
            key={a}
            href={a === "Tất cả" ? "/cafe" : `/cafe?khu=${encodeURIComponent(a)}`}
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
        <b>Lưu ý:</b> giá và giờ mở cửa do từng quán quy định, có thể thay đổi theo mùa — nên xác nhận trực tiếp.
        Muốn "săn mây tại giường" thay vì ra quán? Chọn <Link href="/homestay" className="font-semibold text-forest-700 underline underline-offset-2">homestay view mây</Link> khu
        Đỉnh Gió. Đói bụng? Xem thêm <Link href="/nha-hang" className="font-semibold text-forest-700 underline underline-offset-2">danh sách nhà hàng Tà Xùa</Link>.
      </div>
    </div>
  );
}
