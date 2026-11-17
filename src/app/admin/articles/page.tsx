import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { deleteArticle, setArticleFeaturedOrder, toggleArticlePublished } from "./actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { Stt } from "@/components/admin/Stt";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  // Cùng thứ tự với trang khách: bài nổi bật (STT to → bé) trước, còn lại theo ngày đăng.
  const articles = await prisma.article.findMany({ orderBy: [{ featuredOrder: "desc" }, { createdAt: "desc" }] });

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Bài viết kinh nghiệm</h1>
          <p className="mt-1 text-sm text-gray-500">
            Bài viết chuẩn SEO giúp Google tìm thấy website qua từ khoá "kinh nghiệm Tà Xùa, homestay Tà Xùa…".
            <br />
            <b>Bài nổi bật</b>: nhập ★ STT lớn hơn 0 rồi bấm Lưu — bài xếp lên đầu theo số to → bé; 0 = bài thường.
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
        {articles.map((a, i) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <div className="relative h-14 w-24 flex-none overflow-hidden rounded-lg bg-gray-100">
              {a.coverImage ? (
                <Image src={a.coverImage} alt={a.title} fill sizes="96px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-lg">📝</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/admin/articles/${a.id}`} className="flex min-w-0 items-center gap-1.5 font-bold text-ink hover:text-forest-700">
                <Stt n={i + 1} />
                <span className="truncate">{a.title}</span>
              </Link>
              <p className="truncate text-xs text-gray-500">/kinh-nghiem/{a.slug} · {formatDate(a.createdAt)}</p>
            </div>
            <ActionForm action={setArticleFeaturedOrder} className="flex items-center gap-1" >
              <input type="hidden" name="id" value={a.id} />
              <span className={`text-xs font-bold ${a.featuredOrder > 0 ? "text-sunset-600" : "text-gray-400"}`}>★ STT</span>
              <input
                type="number"
                name="featuredOrder"
                min={0}
                max={9999}
                defaultValue={a.featuredOrder}
                title="STT nổi bật: số lớn xếp trước, 0 = bài thường"
                className={`w-16 rounded-lg border px-2 py-1.5 text-center text-xs font-bold ${a.featuredOrder > 0 ? "border-sunset-300 bg-sunset-50 text-sunset-700" : "border-gray-200 text-gray-500"}`}
              />
              <button className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">Lưu</button>
            </ActionForm>
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
