import Link from "next/link";
import type { Prisma, ServiceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { toggleField } from "./actions";

export const dynamic = "force-dynamic";

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const catSlug = str(sp.category);
  const q = str(sp.q);
  const cat = CATEGORY_LIST.find((c) => c.slug === catSlug);

  const where: Prisma.ServiceWhereInput = {};
  if (cat) where.category = cat.key as ServiceCategory;
  if (q) where.title = { contains: q, mode: "insensitive" };

  const services = await prisma.service.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { images: true } }, owner: { select: { name: true } } },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Quản lý dịch vụ</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/services/new?type=CABIN" className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-700 hover:bg-forest-200">+ Nhà xe</Link>
          <Link href="/admin/services/new?type=HOMESTAY" className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-semibold text-forest-700 hover:bg-forest-200">+ Homestay</Link>
          <Link href="/admin/services/new" className="rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">+ Thêm bài đăng</Link>
        </div>
      </div>

      {/* Bộ lọc */}
      <form className="mt-4 flex flex-wrap gap-2" action="/admin/services">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Tìm theo tên..."
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
        <select name="category" defaultValue={catSlug ?? ""} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
          <option value="">Tất cả danh mục</option>
          {CATEGORY_LIST.map((c) => (
            <option key={c.slug} value={c.slug}>{c.shortLabel}</option>
          ))}
        </select>
        <button className="rounded-xl bg-forest-100 px-4 py-2 text-sm font-medium text-forest-700">Lọc</button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Dịch vụ</th>
              <th className="px-4 py-3 hidden sm:table-cell">Danh mục</th>
              <th className="px-4 py-3 hidden md:table-cell">Giá</th>
              <th className="px-4 py-3">Hiển thị</th>
              <th className="px-4 py-3">Nổi bật</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {services.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-gray-500">Chưa có bài đăng nào.</td></tr>
            ) : (
              services.map((svc) => (
                <tr key={svc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/services/${svc.id}`} className="font-medium text-forest-700 hover:underline">
                      {svc.title}
                    </Link>
                    <div className="text-xs text-gray-400">
                      {svc._count.images} ảnh · Chủ: {svc.owner ? svc.owner.name : <span className="text-amber-600">chưa gán</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">{CATEGORIES[svc.category].shortLabel}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{formatPrice(svc.basePrice)}</td>
                  <td className="px-4 py-3">
                    <ToggleBadge id={svc.id} field="published" on={svc.published} onText="Hiện" offText="Ẩn" />
                  </td>
                  <td className="px-4 py-3">
                    <ToggleBadge id={svc.id} field="featured" on={svc.featured} onText="Có" offText="Không" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/services/${svc.id}`} className="text-sm font-medium text-forest-700 hover:underline">Sửa</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToggleBadge({
  id,
  field,
  on,
  onText,
  offText,
}: {
  id: string;
  field: string;
  on: boolean;
  onText: string;
  offText: string;
}) {
  return (
    <form action={toggleField}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <button
        type="submit"
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          on ? "bg-forest-100 text-forest-700" : "bg-gray-100 text-gray-500"
        }`}
      >
        {on ? onText : offText}
      </button>
    </form>
  );
}
