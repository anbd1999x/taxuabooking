import { redirect } from "next/navigation";
import { getDemoSession } from "@/lib/fleet-demo";
import { ensureTicketDemo } from "@/lib/module-demo";
import { loadTicketData, scanStats, venuesFor } from "@/lib/ticket";
import { TicketManager } from "@/components/admin/ticket/TicketManager";
import { DemoShell } from "@/components/demo/DemoShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bản demo bán vé & đặt bàn", robots: { index: false, follow: false } };

/** BẢN DEMO Bán vé & đặt bàn (vé cổng · show có sơ đồ ghế · đặt bàn · soát vé) — vào qua /hop-tac/demo?m=ticket. */
export default async function TicketDemoPage() {
  const session = await getDemoSession();
  if (!session) redirect("/hop-tac/demo?m=ticket");
  const demo = await ensureTicketDemo(false);
  if (demo.ownerId !== session.sub) redirect("/hop-tac/demo?m=ticket");
  const venues = await venuesFor(session);
  const first = venues.find((v) => v.kind === "SHOW") ?? venues[0];
  const [initial, stats] = await Promise.all([first ? loadTicketData(first.id) : null, scanStats(session.sub)]);
  return (
    <DemoShell module="ticket" title="Bản demo bán vé & đặt bàn" note="Bán vé tại quầy, khoá ghế, ghi đã thu tiền, giữ bàn, gọi món QR… Dữ liệu tự dựng lại mỗi ngày.">
      <TicketManager venues={venues} initial={initial} initialTab="live" providers={[]} places={[]} isAdmin={false} who="Chủ địa điểm (demo)" scanStats={stats} />
    </DemoShell>
  );
}
