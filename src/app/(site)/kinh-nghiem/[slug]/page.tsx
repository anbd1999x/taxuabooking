import type { Metadata } from "next";
import { ogImages } from "@/lib/og";
import { notFound, permanentRedirect } from "next/navigation";
import { ARTICLE_REDIRECTS } from "@/lib/article-redirects";
import Image from "next/image";
import Link from "@/components/Link";
import { getArticle } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { ORG_ID, SITE, WEBSITE_ID } from "@/lib/site";
import { renderMarkdown, stripCoverImage } from "@/lib/markdown";
import { articleTopicLabel } from "@/lib/constants";
import { articleHubPath, isArticleTopic } from "@/lib/article-hubs";
import { getLocale, getT, lp, tLong } from "@/lib/i18n/server";
import { i18nAlternates } from "@/lib/i18n/meta";
import { LOCALE_META, localePath } from "@/lib/i18n/config";

/** URL tuyệt đối cho JSON-LD: ảnh bìa có thể đã là URL ngoài (Unsplash) — chỉ ghép domain khi là đường dẫn tương đối. */
const absUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `${SITE.url}${u.startsWith("/") ? "" : "/"}${u}`);
const escRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
      // og:url theo bản ngôn ngữ đang xem (không gộp link chia sẻ bản en/zh/ko về bản tiếng Việt).
      url: `${SITE.url}${localePath(`/kinh-nghiem/${a.slug}`, locale)}`,
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
  if (!a) {
    // Bài đã gộp / gỡ ⇒ 301 về bài giữ lại (xem ARTICLE_REDIRECTS).
    const to = ARTICLE_REDIRECTS[slug];
    if (to) permanentRedirect(await lp(to));
    notFound();
  }

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
  let related = [...sameTopic, ...fill];

  // ── Bài review homestay ↔ homestay (slug bài = "review-<slug nhà>[-ta-xua]") ──
  // • Bài review: khai `about` = cơ sở lưu trú trong JSON-LD, phần "đọc tiếp" là review các nhà CÙNG KHU trước.
  // • Bài khác có link /homestay/<slug>: liệt kê bài review của đúng các nhà đó (các bài review không còn mồ côi).
  const homeOfReview = (s: string) => { const b = s.replace(/^review-/, ""); return [b, b.replace(/-ta-xua$/, "")]; };
  const isReview = a.topic === "review-homestay";
  const linkedHomes = isReview ? [] : [...new Set([...a.content.matchAll(/\]\(\/(?:homestay|bungalow)\/([a-z0-9-]+)/g)].map((m) => m[1]))];
  let aboutHome: { slug: string; title: string; area: string | null } | null = null;
  let homeReviews: { slug: string; title: string }[] = [];
  if (isReview || linkedHomes.length) {
    const [homes, reviews] = await Promise.all([
      prisma.service.findMany({ where: { published: true, category: { in: ["HOMESTAY", "BUNGALOW"] } }, select: { slug: true, title: true, area: true } }),
      prisma.article.findMany({
        where: { published: true, topic: "review-homestay", id: { not: a.id } },
        orderBy: [{ topicOrder: "desc" }, { createdAt: "desc" }],
        select: { id: true, slug: true, title: true, excerpt: true, coverImage: true, topic: true, createdAt: true },
      }),
    ]);
    const homeBy = (s: string) => homes.find((h) => homeOfReview(s).includes(h.slug)) ?? null;
    if (isReview) {
      aboutHome = homeBy(a.slug);
      const area = aboutHome?.area ?? null;
      const same = area ? reviews.filter((r) => homeBy(r.slug)?.area === area) : [];
      related = [...same, ...reviews.filter((r) => !same.includes(r))].slice(0, 6);
    } else {
      // Giữ đúng thứ tự homestay xuất hiện trong bài.
      homeReviews = linkedHomes.flatMap((hs) => reviews.filter((r) => homeOfReview(r.slug).includes(hs)).slice(0, 1)).slice(0, 24);
    }
  }

  // JSON-LD phải khớp nội dung ĐANG HIỂN THỊ: bản en/zh/ko dùng tiêu đề + thân bài đã dịch.
  const locale = await getLocale();
  const title = tr(a.title);
  // Ảnh bìa đã hiện ở đầu trang ⇒ bỏ ảnh trùng bìa trong nội dung (không thì 2 ảnh đầu giống hệt nhau).
  const content = stripCoverImage(await tLong(a.content), a.coverImage);
  // Thân bài chưa có bản dịch ⇒ trang vẫn hiện tiếng Việt ⇒ khai inLanguage "vi" (không khai lệch "en").
  const shownLang = locale === "vi" || content !== a.content ? LOCALE_META[locale].htmlLang : LOCALE_META.vi.htmlLang;

  // Câu hỏi thường gặp trong bài (mục "## Câu hỏi thường gặp", mỗi câu là "### …") → dữ liệu FAQPage.
  // Bài đã dịch thì tiêu đề mục là bản dịch (Frequently asked questions / 常见问题 / 자주 묻는 질문 / FAQ…).
  const faqHeads = [...new Set(["Câu hỏi thường gặp", tr("Câu hỏi thường gặp"), "Frequently asked questions", "常见问题", "자주 묻는 질문", "FAQ"])];
  const faqRe = new RegExp(`^## (?:${faqHeads.map(escRe).join("|")}).*$`, "mi");
  const plain = (t: string) =>
    t.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`>#]/g, "").replace(/\s+/g, " ").trim();
  const faqPart = content.split(faqRe)[1]?.split(/^## /m)[0] ?? "";
  const faqs = faqPart
    .split(/^### /m)
    .slice(1)
    .map((b) => { const [q, ...rest] = b.split("\n"); return { q: plain(q), a: plain(rest.join(" ")) }; })
    .filter((x) => x.q && x.a);
  const pageUrl = `${SITE.url}${localePath(`/kinh-nghiem/${a.slug}`, locale)}`;
  // Trang chủ bản tiếng Việt: đúng SITE.url, không có dấu "/" cuối (thống nhất với BreadcrumbLd).
  const homeUrl = locale === "vi" ? SITE.url : `${SITE.url}${localePath("/", locale)}`;
  const extraLd = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: tr("Trang chủ"), item: homeUrl },
        { "@type": "ListItem", position: 2, name: tr("Kinh nghiệm Tà Xùa"), item: `${SITE.url}${localePath("/kinh-nghiem", locale)}` },
        // Tầng chủ đề = trang hub /kinh-nghiem/chu-de/<topic> (gom sức cho cụm bài).
        ...(isArticleTopic(a.topic)
          ? [{ "@type": "ListItem", position: 3, name: tr(articleTopicLabel(a.topic)), item: `${SITE.url}${localePath(articleHubPath(a.topic), locale)}` }]
          : []),
        { "@type": "ListItem", position: isArticleTopic(a.topic) ? 4 : 3, name: title, item: pageUrl },
      ],
    },
    ...(faqs.length >= 2
      ? [{ "@type": "FAQPage", mainEntity: faqs.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) }]
      : []),
  ];

  // JSON-LD Article cho Google.
  const topicLabel = articleTopicLabel(a.topic);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${pageUrl}#article`,
    headline: title,
    // Bài review: nói rõ bài viết VỀ cơ sở nào (trùng @id LodgingBusiness ở trang đặt phòng — @id luôn theo URL bản tiếng Việt).
    ...(aboutHome
      ? { about: { "@type": "LodgingBusiness", "@id": `${SITE.url}/homestay/${aboutHome.slug}#lodging`, name: tr(aboutHome.title), url: `${SITE.url}${localePath(`/homestay/${aboutHome.slug}`, locale)}` } }
      : {}),
    isPartOf: { "@id": WEBSITE_ID },
    ...(topicLabel ? { articleSection: tr(topicLabel) } : {}),
    description: (await tLong(a.excerpt)) ?? undefined,
    image: a.coverImage ? [absUrl(a.coverImage)] : undefined,
    datePublished: a.createdAt.toISOString(),
    dateModified: a.updatedAt.toISOString(),
    inLanguage: shownLang,
    mainEntityOfPage: pageUrl,
    // Trỏ về thực thể tổ chức khai ở layout gốc (@id) + logo: Google yêu cầu publisher có logo cho Article.
    author: { "@type": "Organization", "@id": ORG_ID, name: SITE.name, url: SITE.url },
    publisher: {
      "@type": "Organization",
      "@id": ORG_ID,
      name: SITE.name,
      url: SITE.url,
      logo: { "@type": "ImageObject", url: `${SITE.url}/icons/icon-512.png`, width: 512, height: 512 },
    },
  };
  // Bài có sửa sau ngày đăng ⇒ hiện rõ ngày cập nhật (tín hiệu "nội dung còn mới" cho người đọc, Google và công cụ AI).
  const updated = a.updatedAt.getTime() - a.createdAt.getTime() > 86400000 ? a.updatedAt : null;

  return (
    <article className="container-page max-w-3xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": extraLd }) }} />
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/kinh-nghiem" className="hover:text-forest-700">{tr("Kinh nghiệm")}</Link>
        <span className="mx-2">/</span>
        {isArticleTopic(a.topic) && (
          <>
            <Link href={articleHubPath(a.topic)} className="hover:text-forest-700">{tr(articleTopicLabel(a.topic))}</Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span className="text-gray-700">{tr(a.title)}</span>
      </nav>
      <p className="text-xs text-gray-400">
        <time dateTime={a.createdAt.toISOString()}>{formatDate(a.createdAt)}</time>
        {updated && (
          <>
            {" · "}<time dateTime={updated.toISOString()}>{tr("Cập nhật {0}", [formatDate(updated)])}</time>
          </>
        )}
      </p>
      <h1 className="mt-1 text-3xl font-bold text-ink">{tr(a.title)}</h1>
      {a.coverImage && (
        <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-2xl">
          <Image src={a.coverImage} alt={tr(a.title)} fill priority sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
        </div>
      )}
      <div
        className="mt-6 leading-relaxed text-gray-700 [&_a]:font-semibold [&_a]:text-forest-700 [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-forest-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-ink [&_img]:my-5 [&_img]:w-full [&_img]:rounded-2xl [&_li]:my-1 [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-inside [&_ul]:list-disc"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />

      {/* Bài review của các homestay được nhắc trong bài */}
      {homeReviews.length > 0 && (
        <section className="mt-12 border-t border-gray-200 pt-8">
          <h2 className="text-xl font-bold text-ink">{tr("Review chi tiết các homestay trong bài")}</h2>
          <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {homeReviews.map((r) => (
              <li key={r.slug} className="text-[15px]">
                <Link href={`/kinh-nghiem/${r.slug}`} className="font-semibold text-forest-700 underline underline-offset-2 hover:text-sunset-600">
                  {tr(r.title)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Bài viết cùng chủ đề */}
      {related.length > 0 && (
        <section className="mt-12 border-t border-gray-200 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-bold text-ink">
              {isReview ? tr("Review homestay khác ở Tà Xùa") : a.topic ? tr("Bài viết cùng chủ đề") : tr("Bài viết khác")}
            </h2>
            <Link
              href={isArticleTopic(a.topic) ? articleHubPath(a.topic) : "/kinh-nghiem"}
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
