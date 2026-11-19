import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { i18nAlternates } from "@/lib/i18n/meta";
import { publicVenue } from "@/lib/ticket";
import { TicketBooking } from "@/components/ticket/TicketBooking";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await publicVenue(slug);
  if (!data) return { robots: { index: false } };
  const t = await getT();
  const v = data.venue;
  const title = `${t(v.name)} · ${t(v.kind === "RESTAURANT" ? "Đặt bàn" : "Mua vé")}`;
  return { title, description: v.description ? t(v.description) : title, alternates: await i18nAlternates(`/ve/${v.slug}`), openGraph: v.coverImage ? { images: [v.coverImage] } : undefined };
}

/** Trang đặt vé / đặt bàn của một địa điểm đang mở bán. `?d=yyyy-mm-dd` = ngày khách chọn ở trang danh sách. */
export default async function TicketBookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const data = await publicVenue(slug);
  if (!data) notFound();
  const d = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : data.avail.today;
  return <TicketBooking venue={data.venue} avail={data.avail} initialDay={d} />;
}
