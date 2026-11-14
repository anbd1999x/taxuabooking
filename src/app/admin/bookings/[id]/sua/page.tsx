import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { loadBookingEdit } from "@/lib/booking-edit";
import AdminCreateBooking from "@/components/admin/AdminCreateBooking";

export const dynamic = "force-dynamic";

/**
 * SỬA ĐƠN (admin) — cùng form "Tạo đơn hộ khách", nạp sẵn dữ liệu đơn: đổi được danh mục,
 * homestay, phòng, nhà xe, chuyến, cách nằm, tuyến đón, ngày, số khách, khách, CTV, tiền.
 * Bình thường admin sửa bằng POPUP (EditBookingPopup) ngay trên trang đang xem; trang này là
 * đường dẫn dự phòng (link cũ / mở tab mới).
 */
export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const d = await loadBookingEdit(id);
  if (!d) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/admin/bookings/${id}`} className="text-sm font-semibold text-gray-500 hover:text-ink">
          ← Đơn {d.code}
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Sửa đơn {d.code}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Đổi được mọi thông tin: dịch vụ, homestay &amp; phòng, nhà xe &amp; chuyến, cách nằm, tuyến đón, ngày, số khách,
          khách hàng, CTV, tiền. Mọi thay đổi được ghi vào lịch sử đơn.
        </p>
      </div>
      <AdminCreateBooking categories={d.categories} services={d.services} ctvs={d.ctvs} todayKey={d.todayKey} comboDiscount={d.comboDiscount} edit={d.edit} />
    </div>
  );
}
