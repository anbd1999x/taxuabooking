import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getArticle } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { SITE } from "@/lib/site";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) return {};
  return {
    title: a.title,
    description: a.excerpt ?? a.title,
    alternates: { canonical: `/kinh-nghiem/${a.slug}` },
    openGraph: {
      title: a.title,
      description: a.excerpt ?? a.title,
      url: `${SITE.url}/kinh-nghiem/${a.slug}`,
      images: a.coverImage ? [{ url: a.coverImage }] : undefined,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();

  // JSON-LD Article cho Google.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.excerpt ?? undefined,
    image: a.coverImage ? [`${SITE.url}${a.coverImage}`] : undefined,
    datePublished: a.createdAt.toISOString(),
    dateModified: a.updatedAt.toISOString(),
    inLanguage: "vi",
    mainEntityOfPage: `${SITE.url}/kinh-nghiem/${a.slug}`,
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
  };

  return (
    <article className="container-page max-w-3xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-4 text-sm text-gray-500">
        <a href="/kinh-nghiem" className="hover:text-forest-700">Kinh nghiệm</a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{a.title}</span>
      </nav>
      <p className="text-xs text-gray-400">{formatDate(a.createdAt)}</p>
      <h1 className="mt-1 text-3xl font-bold text-ink">{a.title}</h1>
      {a.coverImage && (
        <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-2xl">
          <Image src={a.coverImage} alt={a.title} fill priority sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
        </div>
      )}
      <div
        className="mt-6 leading-relaxed text-gray-700 [&_a]:font-semibold [&_a]:text-forest-700 [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-forest-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-ink [&_img]:my-5 [&_img]:w-full [&_img]:rounded-2xl [&_li]:my-1 [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-inside [&_ul]:list-disc"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(a.content) }}
      />
    </article>
  );
}
