import Link from "@/components/Link";
import { ARTICLE_TOPICS } from "@/lib/constants";
import { articleHubPath } from "@/lib/article-hubs";
import { getT } from "@/lib/i18n/server";

/** Thanh chủ đề bài kinh nghiệm: "Tất cả" = /kinh-nghiem, mỗi chủ đề = trang hub tĩnh /kinh-nghiem/chu-de/<topic>. */
export async function ArticleTopicTabs({ active }: { active: string | null }) {
  const t = await getT();
  const cls = (on: boolean) =>
    `flex-none whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
      on ? "bg-forest-700 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-forest-50"
    }`;
  return (
    <nav
      aria-label={t("Chủ đề bài viết")}
      className="mt-5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <Link href="/kinh-nghiem" className={cls(!active)} aria-current={!active ? "page" : undefined}>
        {t("Tất cả")}
      </Link>
      {ARTICLE_TOPICS.map((x) => (
        <Link key={x.key} href={articleHubPath(x.key)} className={cls(active === x.key)} aria-current={active === x.key ? "page" : undefined}>
          {t(x.label)}
        </Link>
      ))}
    </nav>
  );
}
