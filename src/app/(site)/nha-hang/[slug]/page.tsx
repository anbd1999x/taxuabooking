import type { Metadata } from "next";
import { ogBlock } from "@/lib/og";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PlaceDetail } from "@/components/PlaceDetail";
import { getT, lp } from "@/lib/i18n/server";
import { i18nAlternates, i18nOg } from "@/lib/i18n/meta";
import { placeMeta } from "@/lib/place-meta";

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
  // Tiêu đề "<tên> Tà Xùa: menu / view / giá / giờ mở cửa" theo dữ liệu trang đang hiện + mô tả (xem placeMeta).
  const { title, description } = placeMeta(p, t);
  const metaTitle = title.length > 44 ? { absolute: title } : title;
  const path = `/nha-hang/${p.slug}`;
  return {
    title: metaTitle,
    description,
    alternates: await i18nAlternates(path),
    openGraph: await i18nOg({ title, description, path, image: p.coverImage, alt: t(p.name) }),
  };
}

export default async function NhaHangDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place) notFound();
  if (place.kind === "CHECKIN") redirect(await lp("/lich-trinh"));
  if (place.kind !== "RESTAURANT") redirect(await lp(`/cafe/${place.slug}`));
  return <PlaceDetail place={place} basePath="/nha-hang" />;
}
