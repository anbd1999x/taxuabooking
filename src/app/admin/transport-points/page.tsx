import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/admin/ActionForm";
import { deleteTransportPoint, saveTransportPoint } from "./actions";
import { Stt } from "@/components/admin/Stt";

export const dynamic = "force-dynamic";

const inp = "w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus:border-forest-500 focus:outline-none";

/** Danh sách ĐIỂM CỐ ĐỊNH ở Tà Xùa — điểm đón / điểm đến khách chọn khi đặt taxi, xe ôm. */
export default async function TransportPointsPage() {
  const points = await prisma.transportPoint.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { routesFrom: true, routesTo: true } } },
  });

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <header>
        <Link href="/admin/services" className="text-sm font-semibold text-forest-700 hover:underline">← Dịch vụ</Link>
        <h1 className="mt-1 text-xl font-bold text-ink sm:text-2xl">Điểm đón / điểm đến (taxi, xe ôm)</h1>
        <p className="mt-1 text-sm text-gray-500">
          Danh sách điểm cố định khách chọn khi đặt taxi / xe ôm. Mỗi bác tài khai giá theo chặng giữa các điểm này (ở trang sửa dịch vụ, mục
          “Bảng giá chặng”). Điểm không có trong danh sách ⇒ khách chọn “Điểm khác” và nhắn tin để được báo giá. Bỏ tick “Hiện” để ẩn điểm khỏi danh
          sách của khách mà vẫn giữ các chặng đã khai.
        </p>
      </header>

      <div className="space-y-2">
        {points.map((p, i) => {
          const used = p._count.routesFrom + p._count.routesTo;
          return (
            <ActionForm key={p.id} action={saveTransportPoint} className="grid grid-cols-2 items-end gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5 sm:grid-cols-12">
              <input type="hidden" name="id" value={p.id} />
              <label className="col-span-2 flex flex-col gap-1 sm:col-span-4">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500"><Stt n={i + 1} /> Tên điểm</span>
                <input name="name" defaultValue={p.name} className={inp} />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-3">
                <span className="text-xs font-semibold text-gray-500">Khu vực</span>
                <input name="area" defaultValue={p.area ?? ""} className={inp} />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-1">
                <span className="text-xs font-semibold text-gray-500">Thứ tự</span>
                <input name="sortOrder" type="number" defaultValue={p.sortOrder} className={inp} />
              </label>
              <label className="flex items-center gap-1.5 pb-2 text-sm font-semibold text-gray-600 sm:col-span-2">
                <input type="checkbox" name="active" defaultChecked={p.active} className="h-4 w-4 accent-forest-600" /> Hiện
                <span className="font-normal text-gray-400">· {used} chặng</span>
              </label>
              <div className="col-span-2 flex gap-1 sm:col-span-2">
                <button className="rounded-lg bg-forest-600 px-3 py-2 text-sm text-white">Lưu</button>
                {used === 0 && (
                  <button formAction={deleteTransportPoint} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                    Xoá
                  </button>
                )}
              </div>
            </ActionForm>
          );
        })}
      </div>

      <ActionForm action={saveTransportPoint} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-dashed border-forest-200 p-3 sm:grid-cols-12">
        <label className="col-span-2 flex flex-col gap-1 sm:col-span-5">
          <span className="text-xs font-semibold text-gray-500">Tên điểm mới</span>
          <input name="name" placeholder="VD: Đỉnh Gió, Bến xe Bắc Yên…" className={inp} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-4">
          <span className="text-xs font-semibold text-gray-500">Khu vực</span>
          <input name="area" placeholder="VD: Trung tâm" className={inp} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-1">
          <span className="text-xs font-semibold text-gray-500">Thứ tự</span>
          <input name="sortOrder" type="number" placeholder="tự động" className={inp} />
        </label>
        <div className="col-span-2 sm:col-span-2">
          <button className="w-full rounded-lg bg-forest-100 px-3 py-2 text-sm font-medium text-forest-700">+ Thêm điểm</button>
        </div>
      </ActionForm>
    </div>
  );
}
