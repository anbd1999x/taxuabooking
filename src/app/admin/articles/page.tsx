import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { deleteArticle, toggleArticlePublished } from "./actions";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const articles = await prisma.article.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Bài viết kinh nghiệm</h1>
          <p className="mt-1 text-sm text-gray-500">
            Bài viết chuẩn SEO giúp Google tìm thấy website qua từ khoá "kinh nghiệm Tà Xùa, homestay Tà Xùa…".
          </p>
        </div>
        <Link href="/admin/articles/new" className="rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">
          ✍️ Viết bài mới
        </Link>
      </div>

      <div className="mt-5 space-y-2.5">
        {articles.length === 0 && (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center text-gray-500">
            Chưa có bài viết nào. Bấm "Viết bài mới" để bắt đầu.
          </p>
        )}
        {articles.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <div className="relative h-14 w-24 flex-none overflow-hidden rounded-lg bg-gray-100">
              {a.coverImage ? (
                <Image src={a.coverImage} alt={a.title} fill sizes="96px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-lg">📝</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/admin/articles/${a.id}`} className="block truncate font-bold text-ink hover:text-forest-700">
                {a.title}
              </Link>
              <p className="truncate text-xs text-gray-500">/kinh-nghiem/{a.slug} · {formatDate(a.createdAt)}</p>
            </div>
            <form action={toggleArticlePublished}>
              <input type="hidden" name="id" value={a.id} />
              <button
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${a.published ? "bg-forest-100 text-forest-700" : "bg-gray-100 text-gray-500"}`}
                title="Bấm để đổi trạng thái hiển thị"
              >
                {a.published ? "Đang hiện" : "Đang ẩn"}
              </button>
            </form>
            <Link href={`/kinh-nghiem/${a.slug}`} target="_blank" className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              Xem ↗
            </Link>
            <Link href={`/admin/articles/${a.id}`} className="rounded-lg bg-forest-50 px-3 py-1.5 text-xs font-semibold text-forest-700 hover:bg-forest-100">
              Sửa
            </Link>
            <form action={deleteArticle}>
              <input type="hidden" name="id" value={a.id} />
              <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Xoá</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
