import Link from "next/link";
import type { ServiceCategory } from "@prisma/client";
import { CATEGORY_LIST, CATEGORIES } from "@/lib/constants";
import { ServiceCreateWizard } from "@/components/admin/ServiceCreateWizard";

export const dynamic = "force-dynamic";

const VALID = new Set(CATEGORY_LIST.map((c) => c.key));

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function NewServicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const type = str(sp.type) as ServiceCategory | undefined;
  const category = type && VALID.has(type) ? type : null;

  return (
    <div className="max-w-4xl">
      <nav className="mb-3 text-sm text-gray-500">
        <Link href="/admin/services" className="hover:text-forest-700">Dịch vụ</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">Thêm mới</span>
      </nav>

      {!category ? (
        <>
          <h1 className="text-2xl font-bold text-ink">Thêm bài đăng — chọn loại</h1>
          <p className="mt-1 text-sm text-gray-500">Chọn loại dịch vụ để nhập form phù hợp (nhà xe kèm chuyến, homestay kèm hạng phòng...).</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CATEGORY_LIST.map((c) => (
              <Link
                key={c.key}
                href={`/admin/services/new?type=${c.key}`}
                className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="font-semibold text-ink">
                  {c.key === "CABIN" ? "Thêm nhà xe" : c.key === "MOTORBIKE" ? "Thêm bên cho thuê xe" : `Thêm ${c.shortLabel}`}
                </div>
                <div className="mt-1 text-xs text-gray-500">{c.tagline}</div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-ink">
              {category === "CABIN" ? "Thêm nhà xe" : category === "MOTORBIKE" ? "Thêm bên cho thuê xe" : `Thêm ${CATEGORIES[category].shortLabel}`}
            </h1>
            <Link href="/admin/services/new" className="text-sm font-medium text-forest-700 hover:underline">← Đổi loại</Link>
          </div>
          <p className="mb-5 mt-1 text-sm text-gray-500">{CATEGORIES[category].label}</p>
          <ServiceCreateWizard category={category} />
        </>
      )}
    </div>
  );
}
