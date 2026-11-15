import type { Metadata } from "next";
import { ogBlock } from "@/lib/og";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PlaceDetail } from "@/components/PlaceDetail";
import { getT, lp } from "@/lib/i18n/server";
import { i18nAlternates, i18nOg } from "@/lib/i18n/meta";

export const dynamic = "force-dynamic";

async function getPlace(slug: string) {
  return prisma.place.findFirst({
    where: { slug, published: true },
    include: { reviews: { where: { approved: true }, orderBy: { createdAt: "desc" } } },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const t = await getT();
  const { slug } = await params;
  const p = await getPlace(slug);
  if (!p) return {};
  const title = t("{0} — {1}, Tà Xùa", [t(p.name), t(p.area)]);
  const description = t(p.desc) ?? t("{0} tại {1}, Tà Xùa: quán cà phê view săn mây — giờ mở cửa, giá, vị trí và đánh giá thực tế.", [t(p.name), t(p.area)]);
  const path = `/cafe/${p.slug}`;
  return {
    title,
    description,
    alternates: await i18nAlternates(path),
    openGraph: await i18nOg({ title, description, path, image: p.coverImage, alt: t(p.name) }),
  };
}

export default async function CafeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place) notFound();
  if (place.kind === "CHECKIN") redirect(await lp("/lich-trinh"));
  if (place.kind !== "CAFE") redirect(await lp(`/nha-hang/${place.slug}`));
  return <PlaceDetail place={place} basePath="/cafe" />;
}
