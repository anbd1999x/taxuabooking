import { notFound, redirect } from "next/navigation";
import { getDemoSession } from "@/lib/fleet-demo";
import { publicVenue } from "@/lib/ticket";
import { TicketBooking } from "@/components/ticket/TicketBooking";
import { DemoShell } from "@/components/demo/DemoShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bản demo · đặt vé", robots: { index: false, follow: false } };

/** BẢN DEMO — trang đặt vé / đặt bàn của một địa điểm demo (giao diện khách, đặt thử được; chỉ mở khi đang trong bản demo). */
export default async function DemoTicketBookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getDemoSession();
  if (!session) redirect("/hop-tac/demo?m=ticket");
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const data = await publicVenue(slug, session.sub);
  if (!data) notFound();
  const d = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : data.avail.today;
  return (
    <DemoShell module="ticket" title="Bản demo · trang khách đặt vé" note="Đặt thử thoải mái — đơn chỉ nằm trong dữ liệu demo, không gửi email.">
      <div className="-m-4 lg:-m-6">
        <TicketBooking venue={data.venue} avail={data.avail} initialDay={d} base="/demo/dat-ve" />
      </div>
    </DemoShell>
  );
}
