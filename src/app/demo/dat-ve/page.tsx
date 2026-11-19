import { redirect } from "next/navigation";
import { getDemoSession } from "@/lib/fleet-demo";
import { ensureTicketDemo } from "@/lib/module-demo";
import { publicVenueCards } from "@/lib/ticket";
import { TicketList } from "@/components/ticket/TicketList";
import { DemoShell } from "@/components/demo/DemoShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bản demo · trang khách đặt vé", robots: { index: false, follow: false } };

/**
 * BẢN DEMO — màn "Trang khách": đúng giao diện khách thấy ở /ve nhưng chỉ liệt kê các địa điểm DEMO (vé cổng, show, nhà hàng)
 * và chỉ mở được khi đang trong bản demo. Các địa điểm này chưa mở bán nên không hiện ở trang /ve thật.
 */
export default async function DemoTicketListPage() {
  const session = await getDemoSession();
  if (!session) redirect("/hop-tac/demo?m=ticket");
  const demo = await ensureTicketDemo(false);
  if (demo.ownerId !== session.sub) redirect("/hop-tac/demo?m=ticket");
  const { days, cards } = await publicVenueCards(session.sub);
  return (
    <DemoShell module="ticket" title="Bản demo · trang khách đặt vé" note="Khách thấy các hạng vé, show và bàn như thế này. Đặt thử một đơn rồi qua “Vé & đặt bàn” để xem phía quán nhận đơn.">
      <div className="-m-4 lg:-m-6">
        <TicketList days={days} cards={cards} base="/demo/dat-ve" />
      </div>
    </DemoShell>
  );
}
