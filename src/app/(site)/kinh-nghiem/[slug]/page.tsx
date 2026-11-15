import type { Metadata } from "next";
import { ogImages } from "@/lib/og";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "@/components/Link";
import { getArticle } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { SITE } from "@/lib/site";
import { renderMarkdown } from "@/lib/markdown";
import { articleTopicLabel } from "@/lib/constants";
import { getLocale, getT, tLong } from "@/lib/i18n/server";
import { i18nAlternates } from "@/lib/i18n/meta";
import { LOCALE_META } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const raw = await getArticle(slug);
  if (!raw) return {};
  // Tiêu đề/mô tả theo ngôn ngữ đang xem (bản dịch admin nhập; thiếu thì tiếng Việt).
  const a = { ...raw, title: await tLong(raw.title), excerpt: await tLong(raw.excerpt) };
  const locale = await getLocale();
  return {
    // Tiêu đề đã dài thì không nối thêm "| Tà Xùa Booking" (Google cắt ở ~60 ký tự).
    title: a.title.length > 48 ? { absolute: a.title } : a.title,
    description: a.excerpt ?? a.title,
    alternates: await i18nAlternates(`/kinh-nghiem/${a.slug}`),
    openGraph: {
      type: "article",
      locale: LOCALE_META[locale].og,
      siteName: SITE.name,
      publishedTime: a.createdAt.toISOString(),
      modifiedTime: a.updatedAt.toISOString(),
      title: a.title,
      description: a.excerpt ?? a.title,
      url: `${SITE.url}/kinh-nghiem/${a.slug}`,
      images: ogImages(a.coverImage, a.title),
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const tr = await getT();
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();

  // Bài cùng chủ đề (thiếu thì bù bài mới nhất khác chủ đề) — đọc tiếp không cần back.
  const sameTopic = a.topic
    ? await prisma.article.findMany({
        where: { published: true, topic: a.topic, id: { not: a.id } },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, slug: true, title: true, excerpt: true, coverImage: true, topic: true, createdAt: true },
      })
    : [];
  const fill =
    sameTopic.length < 3
      ? await prisma.article.findMany({
          where: { published: true, id: { notIn: [a.id, ...sameTopic.map((x) => x.id)] } },
          orderBy: { createdAt: "desc" },
          take: 3 - sameTopic.length,
          select: { id: true, slug: true, title: true, excerpt: true, coverImage: true, topic: true, createdAt: true },
        })
      : [];
  const related = [...sameTopic, ...fill];

  // Câu hỏi thường gặp trong bài (mục "## Câu hỏi thường gặp", mỗi câu là "### …") → dữ liệu FAQPage.
  const plain = (t: string) =>
    t.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`>#]/g, "").replace(/\s+/g, " ").trim();
  const faqPart = a.content.split(/^## Câu hỏi thường gặp.*$/m)[1]?.split(/^## /m)[0] ?? "";
  const faqs = faqPart
    .split(/^### /m)
    .slice(1)
    .map((b) => { const [q, ...rest] = b.split("\n"); return { q: plain(q), a: plain(rest.join(" ")) }; })
    .filter((x) => x.q && x.a);
  const pageUrl = `${SITE.url}/kinh-nghiem/${a.slug}`;
  const extraLd = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: tr("Trang chủ"), item: SITE.url },
        { "@type": "ListItem", position: 2, name: tr("Kinh nghiệm Tà Xùa"), item: `${SITE.url}/kinh-nghiem` },
        { "@type": "ListItem", position: 3, name: a.title, item: pageUrl },
      ],
    },
    ...(faqs.length >= 2
      ? [{ "@type": "FAQPage", mainEntity: faqs.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) }]
      : []),
  ];

  // JSON-LD Article cho Google.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.excerpt ?? undefined,
    image: a.coverImage ? [`${SITE.url}${a.coverImage}`] : undefined,
    datePublished: a.createdAt.toISOString(),
    dateModified: a.updatedAt.toISOString(),
    inLanguage: LOCALE_META[await getLocale()].htmlLang,
    mainEntityOfPage: `${SITE.url}/kinh-nghiem/${a.slug}`,
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
  };

  return (
    <article className="container-page max-w-3xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": extraLd }) }} />
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/kinh-nghiem" className="hover:text-forest-700">{tr("Kinh nghiệm")}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{tr(a.title)}</span>
      </nav>
      <p className="text-xs text-gray-400">{formatDate(a.createdAt)}</p>
      <h1 className="mt-1 text-3xl font-bold text-ink">{tr(a.title)}</h1>
      {a.coverImage && (
        <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-2xl">
          <Image src={a.coverImage} alt={tr(a.title)} fill priority sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
        </div>
      )}
      <div
        className="mt-6 leading-relaxed text-gray-700 [&_a]:font-semibold [&_a]:text-forest-700 [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-forest-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-ink [&_img]:my-5 [&_img]:w-full [&_img]:rounded-2xl [&_li]:my-1 [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-inside [&_ul]:list-disc"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(await tLong(a.content)) }}
      />

      {/* Bài viết cùng chủ đề */}
      {related.length > 0 && (
        <section className="mt-12 border-t border-gray-200 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-bold text-ink">
              {a.topic ? tr("Bài viết cùng chủ đề") : tr("Bài viết khác")}
            </h2>
            <Link
              href={a.topic ? `/kinh-nghiem?topic=${a.topic}` : "/kinh-nghiem"}
              className="text-sm font-bold text-forest-700 hover:text-sunset-600"
            >
              {tr("Xem tất cả →")}
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/kinh-nghiem/${r.slug}`}
                className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
              >
                {r.coverImage && (
                  <div className="relative aspect-[16/9]">
                    <Image src={r.coverImage} alt={tr(r.title)} fill sizes="(max-width:640px) 100vw, 240px" className="object-cover transition duration-500 group-hover:scale-105" />
                    {articleTopicLabel(r.topic) && (
                      <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-forest-700">
                        {tr(articleTopicLabel(r.topic))}
                      </span>
                    )}
                  </div>
                )}
                <div className="p-3.5">
                  <p className="text-xs text-gray-400">{formatDate(r.createdAt)}</p>
                  <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold text-ink group-hover:text-forest-700">{tr(r.title)}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
