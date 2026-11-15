import Link from "next/link";

/**
 * Ghi chú minh bạch vai trò trên trang chi tiết homestay/nhà xe: nêu tên đối tác và nói rõ
 * Tà Xùa Booking chỉ là đại lý đặt chỗ, để khách không hiểu nhầm đây là website của chính cơ sở đó.
 */
export function AgentNote({ name }: { name: string }) {
  return (
    <p className="mb-4 rounded-xl bg-forest-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-gray-700 ring-1 ring-forest-100">
      <b>Đối tác: {name}</b>
      <br />
      Tà Xùa Booking là đại lý đặt chỗ, dịch vụ do đối tác cung cấp. Hình ảnh do đối tác cung cấp.{" "}
      <Link href="/gioi-thieu" className="font-semibold text-forest-700 hover:underline">
        Về Tà Xùa Booking
      </Link>
    </p>
  );
}
