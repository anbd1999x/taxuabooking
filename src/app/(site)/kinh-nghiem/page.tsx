import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { articleShareImage } from "@/lib/og-source";
import { prisma } from "@/lib/prisma";
import { articleHubPath, isArticleTopic } from "@/lib/article-hubs";
import { getT, lp } from "@/lib/i18n/server";
import { i18nMeta } from "@/lib/i18n/meta";
import { ItemListLd } from "@/components/ItemListLd";
import { BreadcrumbLd } from "@/components/BreadcrumbLd";
import { ArticleTopicTabs } from "@/components/ArticleTopicTabs";
import { ArticleCards } from "@/components/ArticleCards";

export const dynamic = "force-dynamic";

const META = {
  title: "Kinh nghiệm du lịch Tà Xùa",
  description:
    "Kinh nghiệm du lịch Tà Xùa mới nhất: mùa mây, đặt xe cabin, chọn homestay, điểm check-in, lịch trình 2N1Đ, 3N2Đ, chi phí và mẹo đi lần đầu.",
  path: "/kinh-nghiem",
};

type SP = Promise<Record<string, string | string[] | undefined>>;

// Ảnh chia sẻ = ảnh bìa bài viết mới nhất (thiếu thì ảnh biển mây mặc định).
// Lọc chủ đề nay là trang hub tĩnh /kinh-nghiem/chu-de/<topic>; link cũ ?topic=… chuyển 308 sang đó (xem trang dưới).
export async function generateMetadata(): Promise<Metadata> {
  return i18nMeta({ ...META, image: await articleShareImage() });
}

export default async function ArticlesPage({ searchParams }: { searchParams: SP }) {
  const topic = (await searchParams).topic;
  if (isArticleTopic(topic)) permanentRedirect(await lp(articleHubPath(topic)));

  const tr = await getT();
  const heading = tr("Kinh nghiệm du lịch Tà Xùa");
  const articles = await prisma.article.findMany({
    where: { published: true },
    // Bài nổi bật (STT > 0) lên đầu theo STT to → bé, còn lại theo ngày đăng.
    orderBy: [{ featuredOrder: "desc" }, { createdAt: "desc" }],
    // Chỉ lấy cột thẻ cần: không kéo `content` (cả thân bài) của 100+ bài về mỗi lần mở trang danh sách.
    select: { id: true, slug: true, title: true, excerpt: true, coverImage: true, topic: true, featuredOrder: true, createdAt: true },
  });

  return (
    <div className="container-page py-8">
      <BreadcrumbLd
        items={[
          { name: tr("Trang chủ"), path: "/" },
          { name: tr("Kinh nghiệm Tà Xùa"), path: "/kinh-nghiem" },
        ]}
      />
      <ItemListLd name={heading} items={articles.map((a) => ({ name: tr(a.title), path: `/kinh-nghiem/${a.slug}`, image: a.coverImage }))} />
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">{heading}</h1>
      <p className="mt-1 text-gray-500">{tr("Mẹo và lịch trình cho chuyến săn mây trọn vẹn.")}</p>

      <ArticleTopicTabs active={null} />
      <ArticleCards articles={articles} />
    </div>
  );
}
