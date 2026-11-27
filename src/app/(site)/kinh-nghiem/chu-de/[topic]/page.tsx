import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/Link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatPrice } from "@/lib/format";
import { ARTICLE_TOPICS, articleTopicLabel } from "@/lib/constants";
import { ARTICLE_HUBS, articleHubPath, isArticleTopic, type ArticleTopicKey } from "@/lib/article-hubs";
import { getCabinCompare, getHomestayTable, getTaxiRoutes, getXeomRoutes } from "@/lib/queries";
import { cabinBaseFares } from "@/components/data/CabinCompareTable";
import { getT } from "@/lib/i18n/server";
import { i18nMeta } from "@/lib/i18n/meta";
import { isVideoUrl } from "@/lib/utils";
import { ItemListLd } from "@/components/ItemListLd";
import { BreadcrumbLd } from "@/components/BreadcrumbLd";
import { ArticleTopicTabs } from "@/components/ArticleTopicTabs";
import { ArticleCards } from "@/components/ArticleCards";

export const dynamic = "force-dynamic";

type Params = Promise<{ topic: string }>;

const SELECT = { id: true, slug: true, title: true, excerpt: true, coverImage: true, topic: true, featuredOrder: true, createdAt: true, updatedAt: true } as const;

/** Bài của một chủ đề: "thứ tự trong chủ đề" (topicOrder) trước, rồi bài nổi bật, rồi bài mới. */
const topicArticles = (topic: string) =>
  prisma.article.findMany({
    where: { published: true, topic },
    orderBy: [{ topicOrder: "desc" }, { featuredOrder: "desc" }, { createdAt: "desc" }],
    select: SELECT,
  });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { topic } = await params;
  if (!isArticleTopic(topic)) return {};
  const hub = ARTICLE_HUBS[topic];
  const first = await prisma.article.findFirst({
    where: { published: true, topic, coverImage: { not: null } },
    orderBy: [{ topicOrder: "desc" }, { featuredOrder: "desc" }, { createdAt: "desc" }],
    select: { coverImage: true },
  });
  const image = first?.coverImage && !isVideoUrl(first.coverImage) ? first.coverImage : null;
  return i18nMeta({ title: hub.title, description: hub.description, path: articleHubPath(topic), image });
}

/** Câu dữ kiện của từng chủ đề, số đọc từ DB (lỗi đọc / thiếu dữ liệu ⇒ bỏ câu, không ghi số đoán). */
async function topicFact(topic: ArticleTopicKey, t: Awaited<ReturnType<typeof getT>>, reviewCount: number): Promise<string | null> {
  const money = (n: number) => formatPrice(n);
  try {
    if (topic === "di-chuyen" || topic === "lich-trinh" || topic === "cam-nang") {
      const [cabins, homes] = await Promise.all([getCabinCompare().catch(() => []), getHomestayTable().catch(() => [])]);
      const rounds = cabins.map((c) => cabinBaseFares(c).round).filter((n): n is number => typeof n === "number" && n > 0);
      const homePrices = homes.map((h) => h.priceFrom).filter((n): n is number => typeof n === "number" && n > 0);
      if (topic === "di-chuyen") {
        const [xeom, taxi] = await Promise.all([getXeomRoutes().catch(() => []), getTaxiRoutes().catch(() => [])]);
        if (!cabins.length || !rounds.length) return null;
        return t("{0} nhà xe cabin đang mở bán, vé khứ hồi từ Hà Nội từ {1}; {2} tài xế xe ôm và {3} xe taxi đang nhận chặng tại Tà Xùa.", [cabins.length, money(Math.min(...rounds)), xeom.length, taxi.length]);
      }
      if (topic === "lich-trinh") {
        if (!rounds.length || !homePrices.length) return null;
        return t("Giá đang bán: vé xe cabin khứ hồi Hà Nội – Tà Xùa từ {0}, phòng homestay từ {1} một đêm.", [money(Math.min(...rounds)), money(Math.min(...homePrices))]);
      }
      if (!homes.length || !cabins.length) return null;
      return t("Đang có {0} homestay và {1} nhà xe cabin mở bán trên Tà Xùa Booking.", [homes.length, cabins.length]);
    }
    if (topic === "review-homestay") {
      const homes = await getHomestayTable().catch(() => []);
      const prices = homes.map((h) => h.priceFrom).filter((n): n is number => typeof n === "number" && n > 0);
      if (!homes.length || !prices.length) return null;
      return t("{0} bài review trên tổng số {1} homestay đang đăng; giá phòng thấp nhất của từng nhà từ {2} đến {3} một đêm.", [reviewCount, homes.length, money(Math.min(...prices)), money(Math.max(...prices))]);
    }
    if (topic === "diem-den") {
      const n = await prisma.place.count({ where: { published: true, kind: "CHECKIN" } });
      return n ? t("{0} điểm check-in đang có trên bản đồ Tà Xùa của Tà Xùa Booking.", [n]) : null;
    }
    if (topic === "an-uong") {
      const [r, c] = await Promise.all([
        prisma.place.count({ where: { published: true, slug: { not: null }, kind: "RESTAURANT" } }),
        prisma.place.count({ where: { published: true, slug: { not: null }, kind: "CAFE" } }),
      ]);
      return r || c ? t("Tà Xùa Booking đang có {0} nhà hàng, quán ăn và {1} quán cà phê có trang riêng kèm giá tham khảo.", [r, c]) : null;
    }
  } catch {
    return null;
  }
  return null;
}

export default async function ArticleTopicHub({ params }: { params: Params }) {
  const { topic } = await params;
  if (!isArticleTopic(topic)) notFound();
  const hub = ARTICLE_HUBS[topic];
  const t = await getT();
  const articles = await topicArticles(topic);
  const heading = t(hub.h1);
  const label = t(articleTopicLabel(topic) ?? "");
  const latest = articles.reduce<Date | null>((m, a) => (!m || a.updatedAt > m ? a.updatedAt : m), null);
  const fact = await topicFact(topic, t, articles.length);
  const others = ARTICLE_TOPICS.filter((x) => x.key !== topic);

  return (
    <div className="container-page py-8">
      <BreadcrumbLd
        items={[
          { name: t("Trang chủ"), path: "/" },
          { name: t("Kinh nghiệm Tà Xùa"), path: "/kinh-nghiem" },
          { name: label, path: articleHubPath(topic) },
        ]}
      />
      <ItemListLd name={heading} items={articles.map((a) => ({ name: t(a.title), path: `/kinh-nghiem/${a.slug}`, image: a.coverImage }))} max={100} />

      <nav aria-label={t("Đường dẫn")} className="mb-3 text-sm text-gray-500">
        <Link href="/kinh-nghiem" className="hover:text-forest-700">{t("Kinh nghiệm Tà Xùa")}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{label}</span>
      </nav>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">{heading}</h1>
      <div className="mt-2 max-w-3xl space-y-1 text-gray-600">
        <p>{t(hub.lead)}</p>
        <p>
          {latest ? t("{0} bài viết, cập nhật gần nhất ngày {1}.", [articles.length, formatDate(latest)]) : t("{0} bài viết.", [articles.length])}
          {fact ? ` ${fact}` : ""}
        </p>
      </div>
      {hub.links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {hub.links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full bg-forest-50 px-3 py-1.5 font-semibold text-forest-700 hover:bg-forest-100">
              {t(l.label)}
            </Link>
          ))}
        </div>
      )}

      <ArticleTopicTabs active={topic} />
      <ArticleCards articles={articles} showTopic={false} />

      <section className="mt-10 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-bold text-ink">{t("Chủ đề khác")}</h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((x) => (
            <li key={x.key}>
              <Link href={articleHubPath(x.key)} className="font-semibold text-forest-700 underline-offset-2 hover:text-sunset-600 hover:underline">
                {t(ARTICLE_HUBS[x.key].h1)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
