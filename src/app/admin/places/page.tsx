import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { ActionForm } from "@/components/admin/ActionForm";
import { CoverImagePicker } from "@/components/admin/CoverImagePicker";
import { PlaceImagesInput } from "@/components/admin/PlaceImagesInput";
import { upsertPlace, deletePlace, approvePlaceReview, deletePlaceReview } from "./actions";

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

type PlaceRow = {
  id: string; kind: string; slug: string | null; name: string; area: string;
  address: string | null; phone: string | null; price: string | null; hours: string | null;
  tags: string | null; desc: string | null; content: string | null;
  coverImage: string | null; images: string | null; mapUrl: string | null;
  sortOrder: number; published: boolean;
};

/** Tách "6:00–19:00" (hoặc 6:00-19:00) thành [mở, đóng] dạng HH:MM cho input time. */
function parseHours(hours: string | null | undefined): [string, string] {
  const m = (hours ?? "").match(/(\d{1,2}):(\d{2})\s*[–\-~đếnto ]+\s*(\d{1,2}):(\d{2})/i);
  if (!m) return ["", ""];
  const pad = (h: string) => h.padStart(2, "0");
  return [`${pad(m[1])}:${m[2]}`, `${pad(m[3])}:${m[4]}`];
}

function PlaceFields({ kind, place, sortDefault }: { kind: "RESTAURANT" | "CAFE"; place?: PlaceRow; sortDefault?: number }) {
  const [openTime, closeTime] = parseHours(place?.hours);
  return (
    <ActionForm action={upsertPlace} className="grid grid-cols-2 gap-2.5 sm:grid-cols-12 sm:items-end">
      <input type="hidden" name="kind" value={kind} />
      {place && <input type="hidden" name="id" value={place.id} />}
      <L label="TT" cls="sm:col-span-1"><input name="sortOrder" type="number" defaultValue={place?.sortOrder ?? sortDefault ?? 0} className={inp} /></L>
      <L label="Tên quán *" cls="col-span-2 sm:col-span-5"><input name="name" defaultValue={place?.name ?? ""} required className={inp} /></L>
      <L label="Khu vực *" cls="sm:col-span-3"><input name="area" defaultValue={place?.area ?? ""} placeholder="Trung tâm / Đỉnh Gió..." required className={inp} list="place-areas" /></L>
      <L label="SĐT" cls="sm:col-span-3"><input name="phone" defaultValue={place?.phone ?? ""} placeholder="(nếu có)" className={inp} /></L>
      <L label="Đường dẫn (slug)" cls="col-span-2 sm:col-span-4"><input name="slug" defaultValue={place?.slug ?? ""} placeholder="tự tạo từ tên nếu trống" className={inp} /></L>
      <L label="Giá" cls="sm:col-span-2"><input name="price" defaultValue={place?.price ?? ""} placeholder="Từ 40.000đ" className={inp} /></L>
      <L label="Mở cửa" cls="sm:col-span-1"><input name="openTime" type="time" defaultValue={openTime} className={inp} /></L>
      <L label="Đóng cửa" cls="sm:col-span-1"><input name="closeTime" type="time" defaultValue={closeTime} className={inp} /></L>
      <L label="Địa chỉ chi tiết" cls="col-span-2 sm:col-span-4"><input name="address" defaultValue={place?.address ?? ""} className={inp} /></L>
      <L label="Link Google Maps" cls="col-span-2 sm:col-span-6"><input name="mapUrl" defaultValue={place?.mapUrl ?? ""} placeholder="Dán link chia sẻ (để trống = tự tìm theo tên)" className={inp} /></L>
      <L label="Đặc điểm (phẩy)" cls="col-span-2 sm:col-span-6"><input name="tags" defaultValue={place?.tags ?? ""} placeholder="View săn mây, Có đồ ăn" className={inp} /></L>
      <L label="Mô tả ngắn (hiện ở thẻ quán + meta SEO)" cls="col-span-2 sm:col-span-12"><input name="desc" defaultValue={place?.desc ?? ""} className={inp} /></L>

      <div className="col-span-2 sm:col-span-12">
        <span className="mb-1 block text-[10px] font-medium text-gray-500">Ảnh bìa + ảnh khác (hiện ở trang chi tiết)</span>
        <div className="flex flex-wrap items-start gap-4">
          <CoverImagePicker initial={place?.coverImage} />
          <PlaceImagesInput initial={place?.images} />
        </div>
      </div>

      <L label="Mô tả CHI TIẾT (markdown: ## tiêu đề, - gạch đầu dòng... — để trống sẽ tự dựng từ thông tin trên)" cls="col-span-2 sm:col-span-12">
        <textarea name="content" defaultValue={place?.content ?? ""} rows={6} className={`${inp} font-mono text-[13px]`} placeholder={"## Không gian & món nên gọi\nMô tả quán...\n\n- Món 1 — 50.000đ\n- Món 2 — 80.000đ"} />
      </L>

      <label className="flex items-center gap-1.5 sm:col-span-2">
        <input type="checkbox" name="published" defaultChecked={place?.published ?? true} className="h-4 w-4 accent-forest-600" />
        <span className="text-xs text-gray-600">Hiện trên web</span>
      </label>
      <div className="flex gap-1 sm:col-span-4">
        <button className={`rounded-lg px-4 py-2 text-sm font-medium ${place ? "bg-forest-600 text-white" : "bg-forest-100 text-forest-700"}`}>
          {place ? "Lưu" : "+ Thêm quán"}
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
  const [places, areas, pendingReviews] = await Promise.all([
    prisma.place.findMany({ where: { kind: tab }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.place.findMany({ select: { area: true }, distinct: ["area"] }),
    prisma.placeReview.findMany({
      where: { approved: false },
      orderBy: { createdAt: "desc" },
      include: { place: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Nhà hàng & Cafe</h1>
          <p className="mt-1 text-sm text-gray-500">
            Hiển thị ở <Link href="/nha-hang" target="_blank" className="font-semibold text-forest-700 hover:underline">/nha-hang</Link> và{" "}
            <Link href="/cafe" target="_blank" className="font-semibold text-forest-700 hover:underline">/cafe</Link>. Bấm tên quán để mở form sửa; mỗi quán có trang chi tiết riêng.
          </p>
        </div>
        <div className="inline-flex gap-1 rounded-xl bg-gray-100 p-1">
          <Link href="/admin/places" className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "RESTAURANT" ? "bg-white text-forest-800 shadow-sm" : "text-gray-500"}`}>
            🍲 Nhà hàng
          </Link>
          <Link href="/admin/places?tab=cafe" className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "CAFE" ? "bg-white text-forest-800 shadow-sm" : "text-gray-500"}`}>
            ☕ Cafe
          </Link>
        </div>
      </div>

      {/* Đánh giá chờ duyệt */}
      {pendingReviews.length > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-extrabold text-amber-800">🔔 {pendingReviews.length} đánh giá chờ duyệt</div>
          <div className="mt-2.5 space-y-2">
            {pendingReviews.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2.5 rounded-xl bg-white p-3 ring-1 ring-black/5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <b>{r.name}</b> · {"⭐".repeat(r.rating)} · <span className="text-gray-500">{r.place.name}</span>{" "}
                    <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-700">{r.content}</p>
                </div>
                <form action={approvePlaceReview}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="rounded-lg bg-forest-600 px-3 py-1.5 text-xs font-bold text-white">Duyệt</button>
                </form>
                <form action={deletePlaceReview}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">Xoá</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      <datalist id="place-areas">
        {areas.map((a) => (
          <option key={a.area} value={a.area} />
        ))}
      </datalist>

      <div className="mt-5 space-y-2.5">
        {places.map((p) => (
          <details key={p.id} className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
              <span className="w-7 text-center text-xs font-bold text-gray-400">{p.sortOrder}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink">{p.name}</span>
                <span className="text-xs text-gray-500">📍 {p.area}{p.phone ? ` · 📞 ${p.phone}` : ""} · /{p.kind === "CAFE" ? "cafe" : "nha-hang"}/{p.slug}</span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${p.published ? "bg-forest-100 text-forest-700" : "bg-gray-100 text-gray-500"}`}>
                {p.published ? "Đang hiện" : "Đang ẩn"}
              </span>
              <Link href={`/${p.kind === "CAFE" ? "cafe" : "nha-hang"}/${p.slug}`} target="_blank" className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                Xem ↗
              </Link>
              <span className="text-gray-400 transition group-open:rotate-90">›</span>
            </summary>
            <div className="border-t border-gray-100 bg-gray-50/60 p-4">
              <PlaceFields kind={tab} place={p} />
            </div>
          </details>
        ))}

        <details className="overflow-hidden rounded-2xl border border-dashed border-forest-300">
          <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-bold text-forest-700 hover:bg-forest-50 [&::-webkit-details-marker]:hidden">
            + Thêm {tab === "CAFE" ? "quán cafe" : "nhà hàng"} mới
          </summary>
          <div className="border-t border-forest-100 p-4">
            <PlaceFields kind={tab} sortDefault={places.length} />
          </div>
        </details>
      </div>
    </div>
  );
}
