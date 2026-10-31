import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/admin/ActionForm";
import { ARTICLE_TOPICS } from "@/lib/constants";
import { CoverImagePicker } from "@/components/admin/CoverImagePicker";
import { upsertArticle } from "../actions";

export const dynamic = "force-dynamic";

const inp =
  "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200";

export default async function ArticleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  const article = isNew ? null : await prisma.article.findUnique({ where: { id } });
  if (!isNew && !article) notFound();

  return (
    <div className="max-w-3xl">
      <nav className="text-sm text-gray-500">
        <Link href="/admin/articles" className="hover:text-forest-700">Bài viết</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{isNew ? "Viết bài mới" : article!.title}</span>
      </nav>
      <h1 className="mt-1 text-2xl font-bold text-ink">{isNew ? "✍️ Viết bài mới" : "Sửa bài viết"}</h1>

      {/* Checklist SEO */}
      <div className="mt-4 rounded-2xl bg-sky-50 p-4 text-[13px] leading-relaxed text-sky-900 ring-1 ring-sky-100">
        <p className="font-bold">📈 Checklist bài chuẩn SEO</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li><b>Tiêu đề</b> ≤ 65 ký tự, chứa từ khoá (vd "Kinh nghiệm săn mây Tà Xùa tháng 12/2026").</li>
          <li><b>Mô tả SEO</b> 120–155 ký tự — là đoạn hiện dưới tiêu đề trên Google.</li>
          <li>Chia bài bằng tiêu đề mục: gõ <code className="rounded bg-white px-1">## Tiêu đề mục</code> và <code className="rounded bg-white px-1">### Mục nhỏ</code>, mỗi mục chứa từ khoá phụ.</li>
          <li>Chèn link nội bộ: <code className="rounded bg-white px-1">[homestay Tà Xùa](/homestay)</code>, <code className="rounded bg-white px-1">[xe cabin](/xe-cabin)</code>.</li>
          <li>Chèn ảnh trong bài: <code className="rounded bg-white px-1">![mô tả ảnh](/uploads/ten-anh.jpg)</code> (mô tả ảnh cũng được Google đọc).</li>
          <li>Bài ≥ 600 chữ, có ảnh bìa, trả lời đúng câu hỏi người tìm kiếm.</li>
        </ul>
      </div>

      <ActionForm action={upsertArticle} className="mt-5 space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        {article && <input type="hidden" name="id" value={article.id} />}

        <label className="block">
          <span className="text-sm font-medium text-gray-600">Tiêu đề bài viết * <span className="text-xs text-gray-400">(≤ 65 ký tự, chứa từ khoá)</span></span>
          <input name="title" defaultValue={article?.title ?? ""} required maxLength={120} className={inp} placeholder="VD: Kinh nghiệm săn mây Tà Xùa từ A–Z (cập nhật 2026)" />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-600">Đường dẫn (slug) <span className="text-xs text-gray-400">— để trống sẽ tự tạo từ tiêu đề</span></span>
          <div className="mt-1 flex items-center gap-1">
            <span className="whitespace-nowrap text-sm text-gray-400">/kinh-nghiem/</span>
            <input name="slug" defaultValue={article?.slug ?? ""} className={`${inp} mt-0`} placeholder="kinh-nghiem-san-may-ta-xua" />
          </div>
        </label>

        <label className="block sm:max-w-xs">
          <span className="text-sm font-medium text-gray-600">Chủ đề <span className="text-xs text-gray-400">— dùng cho bộ lọc & gợi ý bài liên quan</span></span>
          <select name="topic" defaultValue={article?.topic ?? ""} className={inp}>
            <option value="">— Chưa phân loại —</option>
            {ARTICLE_TOPICS.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-600">Mô tả SEO (meta description) <span className="text-xs text-gray-400">— 120–155 ký tự, hiện trên Google</span></span>
          <textarea name="excerpt" defaultValue={article?.excerpt ?? ""} rows={2} maxLength={300} className={inp} placeholder="VD: Hướng dẫn chi tiết thời điểm săn mây đẹp nhất, cách di chuyển bằng xe cabin, homestay view mây và chi phí trọn chuyến Tà Xùa." />
        </label>

        <div>
          <span className="text-sm font-medium text-gray-600">Ảnh bìa</span>
          <div className="mt-2">
            <CoverImagePicker initial={article?.coverImage} />
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-600">Nội dung bài viết *</span>
          <textarea
            name="content"
            defaultValue={article?.content ?? ""}
            required
            rows={22}
            className={`${inp} font-mono text-[13px] leading-relaxed`}
            placeholder={`Mở bài: 2–3 câu giới thiệu có chứa từ khoá chính.\n\n## Thời điểm săn mây đẹp nhất\nNội dung đoạn...\n\n## Di chuyển: xe cabin Hà Nội – Tà Xùa\nĐặt vé tại [xe cabin Tà Xùa](/xe-cabin)...\n\n### Giá vé tham khảo\n- Khứ hồi: 500.000đ/người\n- Một chiều: 250.000đ/người\n\n![Biển mây Tà Xùa lúc bình minh](/uploads/ten-anh.jpg)\n\n## Ở đâu? Homestay view mây\nXem danh sách [homestay Tà Xùa](/homestay)...`}
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="published" defaultChecked={article?.published ?? true} className="h-4 w-4 accent-forest-600" />
            <span className="text-sm text-gray-700">Hiển thị trên website</span>
          </label>
          <button className="rounded-xl bg-forest-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">
            {isNew ? "Đăng bài" : "Lưu thay đổi"}
          </button>
        </div>
      </ActionForm>
    </div>
  );
}
