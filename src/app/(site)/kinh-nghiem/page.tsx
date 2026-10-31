import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { ARTICLE_TOPICS, articleTopicLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kinh nghiệm du lịch Tà Xùa",
  description:
    "Tổng hợp kinh nghiệm, mẹo và lịch trình du lịch săn mây Tà Xùa mới nhất.",
  alternates: { canonical: "/kinh-nghiem" },
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.topic === "string" ? sp.topic : "";
  const topic = ARTICLE_TOPICS.some((t) => t.key === raw) ? raw : "";

  const articles = await prisma.article.findMany({
    where: { published: true, ...(topic ? { topic } : {}) },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">
        Kinh nghiệm du lịch Tà Xùa
      </h1>
      <p className="mt-1 text-gray-500">Mẹo và lịch trình cho chuyến săn mây trọn vẹn.</p>

      {/* Bộ lọc chủ đề */}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href="/kinh-nghiem"
          className={`flex-none whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
            !topic ? "bg-forest-700 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-forest-50"
          }`}
        >
          Tất cả
        </Link>
        {ARTICLE_TOPICS.map((t) => (
          <Link
            key={t.key}
            href={`/kinh-nghiem?topic=${t.key}`}
            className={`flex-none whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              topic === t.key ? "bg-forest-700 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-forest-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {articles.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-500">
          Chưa có bài viết nào trong chủ đề này.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <Link
              key={a.id}
              href={`/kinh-nghiem/${a.slug}`}
              className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
            >
              {a.coverImage && (
                <div className="relative aspect-[16/9]">
                  <Image src={a.coverImage} alt={a.title} fill sizes="(max-width:640px) 100vw, 360px" className="object-cover transition duration-500 group-hover:scale-105" />
                  {articleTopicLabel(a.topic) && (
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-forest-700">
                      {articleTopicLabel(a.topic)}
                    </span>
                  )}
                </div>
              )}
              <div className="p-4">
                <p className="text-xs text-gray-400">{formatDate(a.createdAt)}</p>
                <h2 className="mt-1 line-clamp-2 font-semibold text-ink group-hover:text-forest-700">{a.title}</h2>
                {a.excerpt && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{a.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
