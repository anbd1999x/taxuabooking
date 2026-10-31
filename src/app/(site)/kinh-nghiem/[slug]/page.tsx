import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getArticle } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { SITE } from "@/lib/site";

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

  return (
    <article className="container-page max-w-3xl py-8">
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
      <div className="mt-6 whitespace-pre-line leading-relaxed text-gray-700">
        {a.content}
      </div>
    </article>
  );
}
