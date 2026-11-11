import type { Metadata } from "next";
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
  return {
    title: `${p.name} — ${p.area}, Tà Xùa`,
    description: p.desc ?? `${p.name} tại ${p.area}, Tà Xùa: quán cà phê view săn mây — giờ mở cửa, giá, vị trí và đánh giá thực tế.`,
    alternates: { canonical: `/cafe/${p.slug}` },
  };
}

export default async function CafeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place) notFound();
  if (place.kind === "CHECKIN") redirect("/lich-trinh");
  if (place.kind !== "CAFE") redirect(`/nha-hang/${place.slug}`);
  return <PlaceDetail place={place} basePath="/cafe" />;
}
