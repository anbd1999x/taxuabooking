import { redirect } from "next/navigation";
import { getDemoSession } from "@/lib/fleet-demo";
import { ensureTicketDemo } from "@/lib/module-demo";
import { loadTicketData, venuesFor } from "@/lib/ticket";
import { TicketManager } from "@/components/admin/ticket/TicketManager";
import { DemoShell } from "@/components/demo/DemoShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bản demo gọi món QR tại bàn", robots: { index: false, follow: false } };

/** BẢN DEMO Gọi món QR: màn hình quán của nhà hàng mẫu — vào qua /hop-tac/demo?m=qr. Điện thoại khách: bấm "Thử quét" ở tab Bàn & mã QR. */
export default async function DineDemoPage() {
  const session = await getDemoSession();
  if (!session) redirect("/hop-tac/demo?m=qr");
  const demo = await ensureTicketDemo(false);
  if (demo.ownerId !== session.sub) redirect("/hop-tac/demo?m=qr");
  const venues = (await venuesFor(session)).filter((v) => v.kind === "RESTAURANT");
  const initial = venues[0] ? await loadTicketData(venues[0].id) : null;
  return (
    <DemoShell module="qr" title="Bản demo gọi món QR" note="Màn hình của quán. Thử phía khách: tab Bàn & mã QR → Thử quét.">
      <TicketManager venues={venues} initial={initial} initialTab="qr" providers={[]} places={[]} isAdmin={false} who="Chủ quán (demo)" scanStats={{ checked: 0, total: 0 }} only={["qr", "rest", "setup"]} />
    </DemoShell>
  );
}
