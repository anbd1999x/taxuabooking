import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { hideReview, showReview, deleteReview } from "./actions";

export const dynamic = "force-dynamic";

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="whitespace-nowrap" aria-label={`${value} sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: value >= n ? "#f59e0b" : "#d1d5db" }}>★</span>
      ))}
    </span>
  );
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filter = str(sp.status); // "APPROVED" | "HIDDEN" | undefined (tất cả)

  const reviews = await prisma.review.findMany({
    where: filter === "APPROVED" || filter === "HIDDEN" ? { status: filter } : {},
    include: {
      service: { select: { title: true, slug: true, category: true } },
      customer: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const [total, approved, hidden] = await Promise.all([
    prisma.review.count(),
    prisma.review.count({ where: { status: "APPROVED" } }),
    prisma.review.count({ where: { status: "HIDDEN" } }),
  ]);

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "", label: "Tất cả", count: total },
    { key: "APPROVED", label: "Hiển thị", count: approved },
    { key: "HIDDEN", label: "Đã ẩn", count: hidden },
  ];

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Đánh giá dịch vụ</h1>
        <p className="mt-1 text-sm text-gray-500">Duyệt, ẩn hoặc xoá đánh giá của khách hàng.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const on = (filter ?? "") === t.key;
          return (
            <a
              key={t.key}
              href={t.key ? `/admin/reviews?status=${t.key}` : "/admin/reviews"}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ${on ? "bg-forest-600 text-white ring-forest-600" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"}`}
            >
              {t.label} ({t.count})
            </a>
          );
        })}
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center text-gray-500">
          Chưa có đánh giá nào.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((r) => (
            <div key={r.id} className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${r.status === "HIDDEN" ? "ring-red-200" : "ring-black/5"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} />
                    {r.status === "HIDDEN" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">Đã ẩn</span>}
                  </div>
                  <div className="mt-1 text-sm font-bold text-ink">{r.customer.name} · <span className="font-normal text-gray-500">{r.customer.phone}</span></div>
                  <div className="text-xs text-gray-400">Dịch vụ: {r.service.title} · {formatDate(r.createdAt)}</div>
                </div>
                <div className="flex flex-none gap-1">
                  {r.status === "HIDDEN" ? (
                    <form action={showReview}><input type="hidden" name="id" value={r.id} /><button className="rounded-lg border border-forest-200 px-3 py-1.5 text-sm font-semibold text-forest-700 hover:bg-forest-50">Hiện lại</button></form>
                  ) : (
                    <form action={hideReview}><input type="hidden" name="id" value={r.id} /><button className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Ẩn</button></form>
                  )}
                  <form action={deleteReview}><input type="hidden" name="id" value={r.id} /><button className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50">Xoá</button></form>
                </div>
              </div>
              {r.comment && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
