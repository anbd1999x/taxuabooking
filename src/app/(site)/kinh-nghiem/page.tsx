import type { Metadata } from "next";
import { pageMeta } from "@/lib/og";
import { articleShareImage } from "@/lib/og-source";
import Link from "@/components/Link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { ARTICLE_TOPICS, articleTopicLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { i18nMeta } from "@/lib/i18n/meta";

export const dynamic = "force-dynamic";

const META = {
  title: "Kinh nghiệm du lịch Tà Xùa",
  description:
    "Kinh nghiệm du lịch Tà Xùa mới nhất: mùa mây, đặt xe cabin, chọn homestay, điểm check-in, lịch trình 2N1Đ, 3N2Đ, chi phí và mẹo đi lần đầu.",
  path: "/kinh-nghiem",
};

// Ảnh chia sẻ = ảnh bìa bài viết mới nhất (thiếu thì ảnh biển mây mặc định).
export async function generateMetadata(): Promise<Metadata> {
  return i18nMeta({ ...META, image: await articleShareImage() });
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tr = await getT();
  const sp = await searchParams;
  const raw = typeof sp.topic === "string" ? sp.topic : "";
  const topic = ARTICLE_TOPICS.some((t) => t.key === raw) ? raw : "";

  const articles = await prisma.article.findMany({
    where: { published: true, ...(topic ? { topic } : {}) },
    // Bài nổi bật (STT > 0) lên đầu theo STT to → bé, còn lại theo ngày đăng.
    orderBy: [{ featuredOrder: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">
        {tr("Kinh nghiệm du lịch Tà Xùa")}
      </h1>
      <p className="mt-1 text-gray-500">{tr("Mẹo và lịch trình cho chuyến săn mây trọn vẹn.")}</p>

      {/* Bộ lọc chủ đề */}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href="/kinh-nghiem"
          className={`flex-none whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
            !topic ? "bg-forest-700 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-forest-50"
          }`}
        >
          {tr("Tất cả")}
        </Link>
        {ARTICLE_TOPICS.map((t) => (
          <Link
            key={t.key}
            href={`/kinh-nghiem?topic=${t.key}`}
            className={`flex-none whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              topic === t.key ? "bg-forest-700 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-forest-50"
            }`}
          >
            {tr(t.label)}
          </Link>
        ))}
      </div>

      {articles.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-500">
          {tr("Chưa có bài viết nào trong chủ đề này.")}
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
                  <Image src={a.coverImage} alt={tr(a.title)} fill sizes="(max-width:640px) 100vw, 360px" className="object-cover transition duration-500 group-hover:scale-105" />
                  {articleTopicLabel(a.topic) && (
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-forest-700">
                      {tr(articleTopicLabel(a.topic))}
                    </span>
                  )}
                  {a.featuredOrder > 0 && (
                    <span className="absolute right-2.5 top-2.5 rounded-full bg-sunset-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                      ★ {tr("Nổi bật")}
                    </span>
                  )}
                </div>
              )}
              <div className="p-4">
                <p className="text-xs text-gray-400">
                  {!a.coverImage && a.featuredOrder > 0 && <span className="mr-1.5 font-bold text-sunset-600">★ {tr("Nổi bật")}</span>}
                  {formatDate(a.createdAt)}
                </p>
                <h2 className="mt-1 line-clamp-2 font-semibold text-ink group-hover:text-forest-700">{tr(a.title)}</h2>
                {a.excerpt && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{tr(a.excerpt)}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
