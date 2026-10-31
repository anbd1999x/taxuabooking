import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { ActionForm } from "@/components/admin/ActionForm";
import { upsertCabinPrice, deleteCabinPrice } from "./actions";

export const dynamic = "force-dynamic";

const inp = "w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus:border-forest-500 focus:outline-none";

export default async function CabinPricesPage() {
  const rows = await prisma.cabinPriceRow.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ink">Bảng giá xe cabin</h1>
      <p className="mt-1 text-sm text-gray-500">
        Bảng này hiển thị ở đầu trang chủ. Thêm / sửa / xoá điểm đón và giá vé tuỳ ý.
      </p>

      <div className="mt-5 space-y-3">
        {rows.map((r) => (
          <ActionForm key={r.id} action={upsertCabinPrice} className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5 sm:grid-cols-12 sm:items-end">
            <input type="hidden" name="id" value={r.id} />
            <L label="Thứ tự" cls="sm:col-span-1"><input name="sortOrder" type="number" defaultValue={r.sortOrder} className={inp} /></L>
            <L label="Điểm đón" cls="sm:col-span-3"><input name="pickupPoint" defaultValue={r.pickupPoint} className={inp} /></L>
            <L label="Điểm đến" cls="sm:col-span-2"><input name="destination" defaultValue={r.destination} className={inp} /></L>
            <L label="Giá vé (đ)" cls="sm:col-span-2"><input name="price" type="number" defaultValue={toNumber(r.price) ?? 0} className={inp} /></L>
            <L label="Ghi chú" cls="sm:col-span-2"><input name="note" defaultValue={r.note ?? ""} className={inp} /></L>
            <div className="col-span-2 flex gap-1 sm:col-span-2">
              <button className="rounded-lg bg-forest-600 px-3 py-2 text-sm text-white">Lưu</button>
              <button formAction={deleteCabinPrice} formNoValidate className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">Xoá</button>
            </div>
          </ActionForm>
        ))}

        {/* Thêm mới */}
        <ActionForm action={upsertCabinPrice} className="grid grid-cols-2 gap-2 rounded-xl border border-dashed border-forest-300 p-3 sm:grid-cols-12 sm:items-end">
          <L label="Thứ tự" cls="sm:col-span-1"><input name="sortOrder" type="number" defaultValue={rows.length} className={inp} /></L>
          <L label="Điểm đón" cls="sm:col-span-3"><input name="pickupPoint" placeholder="VD: Hải Dương" className={inp} required /></L>
          <L label="Điểm đến" cls="sm:col-span-2"><input name="destination" defaultValue="Tà Xùa" className={inp} /></L>
          <L label="Giá vé (đ)" cls="sm:col-span-2"><input name="price" type="number" defaultValue={0} className={inp} /></L>
          <L label="Ghi chú" cls="sm:col-span-2"><input name="note" className={inp} /></L>
          <div className="col-span-2 sm:col-span-2">
            <button className="rounded-lg bg-forest-100 px-3 py-2 text-sm font-medium text-forest-700">+ Thêm</button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}

function L({ label, cls, children }: { label: string; cls?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${cls ?? ""}`}>
      <span className="mb-0.5 block text-[11px] font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}
