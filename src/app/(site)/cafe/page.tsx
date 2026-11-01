import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PlaceDirectory } from "@/components/PlaceDirectory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cafe Tà Xùa — danh sách quán cà phê săn mây",
  description:
    "Danh sách quán cafe Tà Xùa theo khu vực: Đỉnh Gió, Khe Cải, trung tâm, Sống lưng khủng long — quán view săn mây, giờ mở sớm cho buổi bình minh, giá tham khảo.",
  alternates: { canonical: "/cafe" },
};

const COVER =
  "https://images.pexels.com/photos/35195873/pexels-photo-35195873.jpeg?auto=compress&cs=tinysrgb&w=1600&h=700&fit=crop";

export default async function CafePage({
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
          <Image src={COVER} alt="Ngồi cà phê ngắm biển mây Tà Xùa" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 20%, oklch(0.2 0.04 160 / .75))" }} />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">Cafe Tà Xùa — ngồi trên biển mây</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85 sm:text-base">
              Quán cà phê theo từng khu vực — chọn quán mở sớm cho buổi bình minh hoặc quán hoàng hôn cho buổi chiều.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-gray-600">
        "Cà phê săn mây" là trải nghiệm riêng có của Tà Xùa: quán dựng ban công gỗ vươn ra sườn núi, sáng sớm mây dâng
        tới tận lan can. Giờ ngồi đẹp nhất là <b>5h30–9h</b> (mây dày) và <b>16h30–18h</b> (hoàng hôn); cuối tuần bàn mép
        ban công hết rất nhanh. Đọc thêm <Link href="/kinh-nghiem/ca-phe-san-may-ta-xua" className="font-semibold text-forest-700 underline underline-offset-2">kinh nghiệm cà phê săn mây</Link> trước khi chọn quán.
      </p>

      <PlaceDirectory kind="CAFE" basePath="/cafe" selectedArea={area} />

      <div className="mt-8 rounded-2xl bg-forest-50 p-5 text-sm leading-relaxed text-gray-700">
        <b>Lưu ý:</b> giá và giờ mở cửa do từng quán quy định, có thể thay đổi theo mùa — nên xác nhận trực tiếp.
        Muốn "săn mây tại giường" thay vì ra quán? Chọn <Link href="/homestay" className="font-semibold text-forest-700 underline underline-offset-2">homestay view mây</Link> khu
        Đỉnh Gió. Đói bụng? Xem thêm <Link href="/nha-hang" className="font-semibold text-forest-700 underline underline-offset-2">danh sách nhà hàng Tà Xùa</Link>.
      </div>
    </div>
  );
}
