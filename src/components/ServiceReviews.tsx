import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCustomer } from "@/lib/customer";
import { toDateKey } from "@/lib/dates";
import { ReviewForm } from "./ReviewForm";

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" style={{ fontSize: size, lineHeight: 1 }} aria-label={`${value} sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: value >= n ? "#f59e0b" : "#d1d5db" }}>★</span>
      ))}
    </span>
  );
}

function fmtDate(d: Date): string {
  const [y, m, day] = toDateKey(d).split("-");
  return `${day}/${m}/${y}`;
}

export async function ServiceReviews({ serviceId, path }: { serviceId: string; path: string }) {
  const [reviews, customer] = await Promise.all([
    prisma.review.findMany({
      where: { serviceId, status: "APPROVED" },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    getCustomer(),
  ]);
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  const mine = customer ? reviews.find((r) => r.customerId === customer.id) : null;

  return (
    <section className="mt-10 border-t border-gray-200 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-ink">Đánh giá</h2>
        {count > 0 ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Stars value={Math.round(avg)} />
            <span><b className="text-ink">{avg.toFixed(1)}</b>/5 · {count} đánh giá</span>
          </div>
        ) : (
          <span className="text-sm text-gray-500">Chưa có đánh giá nào.</span>
        )}
      </div>

      <div className="mt-4">
        {customer ? (
          <ReviewForm serviceId={serviceId} path={path} initialRating={mine?.rating ?? 0} initialComment={mine?.comment ?? ""} />
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600">
            <Link href={`/tai-khoan?next=${encodeURIComponent(path)}`} className="font-bold text-forest-700">Đăng nhập</Link>{" "}
            (hoặc tạo tài khoản bằng số điện thoại) để viết đánh giá cho dịch vụ này.
          </div>
        )}
      </div>

      {count > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-ink">{r.customer.name}</div>
                <div className="text-xs text-gray-400">{fmtDate(r.createdAt)}</div>
              </div>
              <div className="mt-0.5"><Stars value={r.rating} /></div>
              {r.comment && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
