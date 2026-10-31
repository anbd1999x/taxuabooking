"use client";

import Link from "next/link";
import { useState } from "react";
import type { ServiceCategory } from "@prisma/client";
import { CATEGORIES } from "@/lib/constants";
import type { ServiceCard as Data } from "@/lib/queries";
import { ServiceCard } from "../ServiceCard";

export function FeaturedGrid({ services }: { services: Data[] }) {
  const cats = Array.from(new Set(services.map((s) => s.category)));
  const [active, setActive] = useState<"ALL" | ServiceCategory>("ALL");
  const pills: { key: "ALL" | ServiceCategory; label: string }[] = [
    { key: "ALL", label: "Tất cả" },
    ...cats.map((c) => ({ key: c, label: CATEGORIES[c].shortLabel })),
  ];
  const shown = active === "ALL" ? services : services.filter((s) => s.category === active);

  return (
    <section className="container-page mt-20 flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">Homestay & dịch vụ nổi bật</h2>
          <p className="mt-2 text-sm text-gray-500">Chọn loại dịch vụ để lọc nhanh; chọn ngày ở thanh tìm kiếm phía trên để xem tình trạng.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pills.map((p) => {
            const a = p.key === active;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setActive(p.key)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  a ? "border-forest-700 bg-forest-700 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-forest-300"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-gray-300 py-12 text-center text-gray-500">
          Chưa có dịch vụ nào trong mục này.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
          {shown.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}

      <div className="flex justify-center">
        <Link href="/homestay" className="rounded-full border-[1.5px] border-forest-700 px-6 py-3 text-[15px] font-bold text-forest-700 transition hover:bg-forest-700 hover:text-white">
          Xem tất cả dịch vụ
        </Link>
      </div>
    </section>
  );
}
