import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PlaceDirectory } from "@/components/PlaceDirectory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nhà hàng & quán ăn Tà Xùa — danh sách đầy đủ",
  description:
    "Danh sách nhà hàng, quán ăn ngon ở Tà Xùa theo từng khu vực: trung tâm, Đỉnh Gió, Khe Cải, Sống lưng khủng long — kèm giá tham khảo, giờ mở và món nên gọi.",
  alternates: { canonical: "/nha-hang" },
};

const COVER =
  "https://images.unsplash.com/photo-1771784970791-2032a255709d?fm=jpg&q=75&w=1600&h=700&fit=crop";

export default async function NhaHangPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const area = typeof sp.khu === "string" ? sp.khu : undefined;

  return (
    <div className="container-page py-8">
      <div className="relative overflow-hidden rounded-[24px]">
        <div className="relative aspect-[16/7] sm:aspect-[16/5]">
          <Image src={COVER} alt="Tà Xùa về chiều — giờ lên đèn của các quán ăn" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 20%, oklch(0.2 0.04 160 / .75))" }} />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">Nhà hàng & quán ăn Tà Xùa</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85 sm:text-base">
              Địa chỉ ăn uống theo từng khu vực — từ cơm suất giá mềm tới lẩu nướng tối lạnh.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-gray-600">
        Ẩm thực Tà Xùa xoay quanh nguyên liệu bản địa: gà đen, cá suối, rau cải mèo, mắc khén. Buổi tối trời lạnh,
        lẩu và nướng than là lựa chọn được yêu thích nhất. Mẹo nhỏ: nhóm đông nên <b>đặt bàn/đặt mâm trước từ chiều</b>,
        và hỏi giá trước với các món tính theo cân. Xem thêm <Link href="/kinh-nghiem/an-gi-o-ta-xua" className="font-semibold text-forest-700 underline underline-offset-2">món gì nên thử ở Tà Xùa</Link>.
      </p>

      <PlaceDirectory kind="RESTAURANT" basePath="/nha-hang" selectedArea={area} />

      <div className="mt-8 rounded-2xl bg-forest-50 p-5 text-sm leading-relaxed text-gray-700">
        <b>Lưu ý:</b> thông tin tổng hợp từ thực tế và có thể thay đổi theo mùa vụ; giá và giờ mở cửa nên xác nhận trực tiếp tại quán.
        Cần gợi ý quán hợp lịch trình? Gọi Tà Xùa Booking — chúng tôi tư vấn miễn phí kèm <Link href="/homestay" className="font-semibold text-forest-700 underline underline-offset-2">đặt phòng</Link> và <Link href="/xe-cabin" className="font-semibold text-forest-700 underline underline-offset-2">vé xe cabin</Link>.
        Tìm chỗ ngồi ngắm mây uống cà phê? Xem <Link href="/cafe" className="font-semibold text-forest-700 underline underline-offset-2">danh sách cafe Tà Xùa</Link>.
      </div>
    </div>
  );
}
