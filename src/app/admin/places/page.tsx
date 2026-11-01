import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/admin/ActionForm";
import { upsertPlace, deletePlace } from "./actions";

export const dynamic = "force-dynamic";

const inp = "w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus:border-forest-500 focus:outline-none";

function L({ label, cls, children }: { label: string; cls?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${cls ?? ""}`}>
      <span className="mb-0.5 block text-[10px] font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function PlaceForm({
  kind,
  place,
  sortDefault,
}: {
  kind: "RESTAURANT" | "CAFE";
  place?: {
    id: string; name: string; area: string; address: string | null; phone: string | null;
    price: string | null; hours: string | null; tags: string | null; desc: string | null;
    sortOrder: number; published: boolean;
  };
  sortDefault?: number;
}) {
  return (
    <ActionForm
      action={upsertPlace}
      className={`grid grid-cols-2 gap-2 rounded-xl p-3 sm:grid-cols-12 sm:items-end ${place ? "bg-white shadow-sm ring-1 ring-black/5" : "border border-dashed border-forest-300"}`}
    >
      <input type="hidden" name="kind" value={kind} />
      {place && <input type="hidden" name="id" value={place.id} />}
      <L label="TT" cls="sm:col-span-1"><input name="sortOrder" type="number" defaultValue={place?.sortOrder ?? sortDefault ?? 0} className={inp} /></L>
      <L label="Tên quán *" cls="col-span-2 sm:col-span-3"><input name="name" defaultValue={place?.name ?? ""} required className={inp} /></L>
      <L label="Khu vực *" cls="sm:col-span-2"><input name="area" defaultValue={place?.area ?? ""} placeholder="Trung tâm / Đỉnh Gió..." required className={inp} list="place-areas" /></L>
      <L label="SĐT" cls="sm:col-span-2"><input name="phone" defaultValue={place?.phone ?? ""} placeholder="(nếu có)" className={inp} /></L>
      <L label="Giá" cls="sm:col-span-2"><input name="price" defaultValue={place?.price ?? ""} placeholder="Từ 40.000đ" className={inp} /></L>
      <L label="Giờ mở" cls="sm:col-span-2"><input name="hours" defaultValue={place?.hours ?? ""} placeholder="6:00–19:00" className={inp} /></L>
      <L label="Địa chỉ chi tiết" cls="col-span-2 sm:col-span-4"><input name="address" defaultValue={place?.address ?? ""} className={inp} /></L>
      <L label="Đặc điểm (phẩy)" cls="col-span-2 sm:col-span-4"><input name="tags" defaultValue={place?.tags ?? ""} placeholder="View săn mây, Có đồ ăn" className={inp} /></L>
      <L label="Mô tả ngắn" cls="col-span-2 sm:col-span-8"><input name="desc" defaultValue={place?.desc ?? ""} className={inp} /></L>
      <label className="flex items-center gap-1.5 sm:col-span-2">
        <input type="checkbox" name="published" defaultChecked={place?.published ?? true} className="h-4 w-4 accent-forest-600" />
        <span className="text-xs text-gray-600">Hiện</span>
      </label>
      <div className="flex gap-1 sm:col-span-2">
        <button className={`rounded-lg px-3 py-2 text-sm font-medium ${place ? "bg-forest-600 text-white" : "bg-forest-100 text-forest-700"}`}>
          {place ? "Lưu" : "+ Thêm"}
        </button>
        {place && (
          <button formAction={deletePlace} formNoValidate className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            Xoá
          </button>
        )}
      </div>
    </ActionForm>
  );
}

export default async function PlacesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "cafe" ? "CAFE" : "RESTAURANT";
  const [places, areas] = await Promise.all([
    prisma.place.findMany({ where: { kind: tab }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.place.findMany({ select: { area: true }, distinct: ["area"] }),
  ]);

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Nhà hàng & Cafe</h1>
          <p className="mt-1 text-sm text-gray-500">
            Quản lý danh sách hiển thị ở trang <Link href="/nha-hang" target="_blank" className="font-semibold text-forest-700 hover:underline">/nha-hang</Link> và{" "}
            <Link href="/cafe" target="_blank" className="font-semibold text-forest-700 hover:underline">/cafe</Link>. Thứ tự nhỏ → lớn.
          </p>
        </div>
        <div className="inline-flex gap-1 rounded-xl bg-gray-100 p-1">
          <Link href="/admin/places" className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "RESTAURANT" ? "bg-white text-forest-800 shadow-sm" : "text-gray-500"}`}>
            🍲 Nhà hàng ({tab === "RESTAURANT" ? places.length : "…"})
          </Link>
          <Link href="/admin/places?tab=cafe" className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "CAFE" ? "bg-white text-forest-800 shadow-sm" : "text-gray-500"}`}>
            ☕ Cafe ({tab === "CAFE" ? places.length : "…"})
          </Link>
        </div>
      </div>

      <datalist id="place-areas">
        {areas.map((a) => (
          <option key={a.area} value={a.area} />
        ))}
      </datalist>

      <div className="mt-5 space-y-2.5">
        {places.map((p) => (
          <PlaceForm key={p.id} kind={tab} place={p} />
        ))}
        <PlaceForm kind={tab} sortDefault={places.length} />
      </div>
    </div>
  );
}
