import Link from "next/link";
import type { Prisma, ServiceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { toggleField } from "./actions";
import { STT_TH, STT_TD } from "@/components/admin/Stt";
import { PartnerServices } from "@/components/admin/PartnerServices";
import { servicePageAccess } from "@/lib/partner-access";

export const dynamic = "force-dynamic";

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Chủ homestay tự đăng ký: chỉ thấy homestay của mình (giao diện riêng).
  const access = await servicePageAccess();
  if (!access.isAdmin) return <PartnerServices ownerId={access.session.sub} />;

  const sp = await searchParams;
  const pendingOnly = str(sp.pending) === "1";
  const catSlug = str(sp.category);
  const q = str(sp.q);
  const cat = CATEGORY_LIST.find((c) => c.slug === catSlug);

  const where: Prisma.ServiceWhereInput = {};
  if (cat) where.category = cat.key as ServiceCategory;
  if (q) where.title = { contains: q, mode: "insensitive" };
  // Homestay của chủ tự đăng ký đang chờ duyệt hiển thị.
  // Chỉ homestay chờ duyệt (tiệm xe máy đối tác tự tạo chỉ để quản lý đội xe, không vào hàng chờ).
  const PENDING: Prisma.ServiceWhereInput = { published: false, category: { in: ["HOMESTAY", "BUNGALOW"] }, owner: { selfSignup: true } };
  if (pendingOnly) Object.assign(where, PENDING);
  const pendingCount = await prisma.service.count({ where: PENDING });

  const services = await prisma.service.findMany({
    where,
    // Như trang tìm kiếm: Nổi bật trước, trong đó số ưu tiên LỚN lên trước; còn lại theo sửa gần nhất.
    orderBy: [{ featured: "desc" }, { priorityOrder: "desc" }, { updatedAt: "desc" }],
    include: { _count: { select: { images: true } }, owner: { select: { name: true, selfSignup: true } } },
  });

  // Số lượng dịch vụ mỗi danh mục (theo bộ tìm kiếm hiện tại) để hiện trên tab.
  const countWhere: Prisma.ServiceWhereInput = {};
  if (q) countWhere.title = { contains: q, mode: "insensitive" };
  const grouped = await prisma.service.groupBy({ by: ["category"], where: countWhere, _count: { _all: true } });
  const countOf = (k: ServiceCategory) => grouped.find((g) => g.category === k)?._count._all ?? 0;
  const totalCount = grouped.reduce((n, g) => n + g._count._all, 0);

  // Thứ tự tab: Homestay → Cabin → Taxi → Xe ôm → Thuê xe máy → Combo.
  const TAB_ORDER: ServiceCategory[] = ["HOMESTAY", "CABIN", "TAXI", "XEOM", "MOTORBIKE", "COMBO"];
  const tabHref = (slug?: string) => {
    const p = new URLSearchParams();
    if (slug) p.set("category", slug);
    if (q) p.set("q", q);
    const s = p.toString();
    return `/admin/services${s ? `?${s}` : ""}`;
  };
  const tabCls = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
      active ? "bg-forest-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
    }`;

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

      {pendingCount > 0 && (
        <Link href={pendingOnly ? "/admin/services" : "/admin/services?pending=1"} className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100">
          <span>🕓 {pendingCount} homestay của chủ tự đăng ký đang chờ duyệt — bật “Hiện” để đăng lên website.</span>
          <span className="text-xs underline">{pendingOnly ? "Xem tất cả" : "Lọc chờ duyệt"}</span>
        </Link>
      )}

      {/* Tab danh mục */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={tabHref()} className={tabCls(!cat)}>
          Tất cả <span className="ml-0.5 opacity-70">{totalCount}</span>
        </Link>
        {TAB_ORDER.map((k) => {
          const meta = CATEGORIES[k];
          return (
            <Link key={k} href={tabHref(meta.slug)} className={tabCls(cat?.key === k)}>
              {meta.shortLabel} <span className="ml-0.5 opacity-70">{countOf(k)}</span>
            </Link>
          );
        })}
      </div>

      {/* Tìm kiếm (giữ nguyên tab đang chọn) */}
      <form className="mt-3 flex flex-wrap gap-2" action="/admin/services">
        {catSlug && <input type="hidden" name="category" value={catSlug} />}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Tìm theo tên..."
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
        <button className="rounded-xl bg-forest-100 px-4 py-2 text-sm font-medium text-forest-700">Tìm</button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className={STT_TH}>STT</th>
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
              <tr><td colSpan={7} className="py-10 text-center text-gray-500">Chưa có bài đăng nào.</td></tr>
            ) : (
              services.map((svc, i) => (
                <tr key={svc.id} className="hover:bg-gray-50">
                  <td className={STT_TD}>{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/services/${svc.id}`} className="font-medium text-forest-700 hover:underline">
                      {svc.title}
                    </Link>
                    <div className="text-xs text-gray-400">
                      {svc._count.images} ảnh · Chủ: {svc.owner ? svc.owner.name : <span className="text-amber-600">chưa gán</span>}
                      {svc.owner?.selfSignup && <span className="ml-1.5 rounded-full bg-sky-50 px-1.5 py-0.5 font-semibold text-sky-700">tự đăng ký</span>}
                      {svc.owner?.selfSignup && !svc.published && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">chờ duyệt</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">{CATEGORIES[svc.category].shortLabel}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{formatPrice(svc.basePrice)}</td>
                  <td className="px-4 py-3">
                    <ToggleBadge id={svc.id} field="published" on={svc.published} onText="Hiện" offText="Ẩn" />
                  </td>
                  <td className="px-4 py-3">
                    <ToggleBadge id={svc.id} field="featured" on={svc.featured} onText="Có" offText="Không" />
                    {svc.featured && (
                      <span className="ml-1.5 text-xs font-semibold text-gray-500" title="Số ưu tiên (lớn lên trước)">#{svc.priorityOrder}</span>
                    )}
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
