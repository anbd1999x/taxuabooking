import Image from "next/image";
import Link from "@/components/Link";
import { formatDate } from "@/lib/format";
import { articleTopicLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";

export interface ArticleCardItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  topic: string | null;
  featuredOrder: number;
  createdAt: Date;
}

/** Lưới thẻ bài kinh nghiệm (dựng server): dùng ở /kinh-nghiem và các trang hub chủ đề. */
export async function ArticleCards({ articles, showTopic = true }: { articles: ArticleCardItem[]; showTopic?: boolean }) {
  const tr = await getT();
  if (!articles.length) {
    return (
      <p className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-500">
        {tr("Chưa có bài viết nào trong chủ đề này.")}
      </p>
    );
  }
  return (
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
              {showTopic && articleTopicLabel(a.topic) && (
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
  );
}
