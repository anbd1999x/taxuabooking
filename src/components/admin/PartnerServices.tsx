import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";

/**
 * "Quản lý dịch vụ" của chủ homestay TỰ ĐĂNG KÝ: chỉ thấy homestay của mình, tạo mới / sửa giá / phòng như admin.
 * Trạng thái hiển thị do admin duyệt (Service.published) — chỉ ảnh hưởng việc hiện trên website.
 */
export async function PartnerServices({ ownerId }: { ownerId: string }) {
  const services = await prisma.service.findMany({
    where: { ownerId, category: { in: ["HOMESTAY", "BUNGALOW"] } },
    orderBy: { updatedAt: "desc" },
    include: {
      images: { where: { isCover: true }, take: 1, select: { url: true } },
      roomTypes: { select: { _count: { select: { rooms: true } } } },
    },
  });

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Homestay của tôi</h1>
          <p className="mt-1 text-sm text-gray-500">Tạo homestay, hạng phòng, phòng và giá. Mọi chức năng quản lý dùng được ngay; homestay hiện trên website sau khi Tà Xùa Booking duyệt.</p>
        </div>
        <Link href="/admin/services/new?type=HOMESTAY" className="rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">+ Thêm homestay</Link>
      </div>

      {services.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-forest-200 bg-white p-8 text-center">
          <div className="text-4xl">🏡</div>
          <div className="mt-2 text-lg font-bold text-ink">Bạn chưa có homestay nào</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">Tạo homestay đầu tiên: nhập thông tin, ảnh, hạng phòng và giá từng phòng. Sau đó bạn quản lý lịch phòng, tạo đơn và thu chi ở mục Quản lý phòng.</p>
          <Link href="/admin/services/new?type=HOMESTAY" className="mt-4 inline-block rounded-xl bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">Tạo homestay đầu tiên</Link>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {services.map((svc) => {
            const rooms = svc.roomTypes.reduce((n, t) => n + t._count.rooms, 0);
            const cover = svc.images[0]?.url;
            return (
              <div key={svc.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="relative h-16 w-16 flex-none overflow-hidden rounded-xl bg-gray-100">
                  {cover ? <Image src={cover} alt={svc.title} fill sizes="64px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-2xl">🏠</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/services/${svc.id}`} className="text-base font-bold text-forest-700 hover:underline">{svc.title}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {svc.published ? (
                      <span className="rounded-full bg-forest-50 px-2.5 py-1 font-bold text-forest-700">Đang hiển thị trên website</span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-700">Chờ duyệt hiển thị</span>
                    )}
                    <span className="text-gray-500">{rooms} phòng · {svc.basePrice ? `từ ${formatPrice(svc.basePrice)}` : "chưa có giá"}</span>
                    {svc.published && (
                      <Link href={`/${CATEGORIES[svc.category].slug}/${svc.slug}`} target="_blank" className="font-semibold text-forest-700 hover:underline">Xem trên website ↗</Link>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/services/${svc.id}`} className="rounded-xl bg-forest-100 px-3.5 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-200">Sửa · giá phòng</Link>
                  <Link href={`/admin/provider/phong?service=${svc.id}`} className="rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">Quản lý phòng</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
