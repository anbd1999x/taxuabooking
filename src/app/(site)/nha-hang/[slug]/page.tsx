import type { Metadata } from "next";
import { ogBlock } from "@/lib/og";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PlaceDetail } from "@/components/PlaceDetail";

export const dynamic = "force-dynamic";

async function getPlace(slug: string) {
  return prisma.place.findFirst({
    where: { slug, published: true },
    include: { reviews: { where: { approved: true }, orderBy: { createdAt: "desc" } } },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPlace(slug);
  if (!p) return {};
  const title = `${p.name} — ${p.area}, Tà Xùa`;
  const description = p.desc ?? `${p.name} tại ${p.area}, Tà Xùa: thông tin giờ mở cửa, giá, vị trí và đánh giá thực tế.`;
  const path = `/nha-hang/${p.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: ogBlock({ title, description, path, image: p.coverImage, alt: p.name }),
  };
}

export default async function NhaHangDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place) notFound();
  if (place.kind === "CHECKIN") redirect("/lich-trinh");
  if (place.kind !== "RESTAURANT") redirect(`/cafe/${place.slug}`);
  return <PlaceDetail place={place} basePath="/nha-hang" />;
}
