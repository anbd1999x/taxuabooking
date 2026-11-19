import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTicketData, scanStats, ticketOwnerOf, venuesFor } from "@/lib/ticket";
import type { VenueKind } from "@/lib/ticket-core";
import { TicketManager, type Tab } from "@/components/admin/ticket/TicketManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vé & đặt bàn" };

const TAB_KIND: Partial<Record<Tab, VenueKind>> = { gate: "GATE", live: "SHOW", rest: "RESTAURANT", qr: "RESTAURANT", build: "SHOW" };
const KIND_TAB: Record<VenueKind, Tab> = { GATE: "gate", SHOW: "live", RESTAURANT: "rest" };
const TABS: Tab[] = ["gate", "live", "rest", "qr", "build", "scan", "setup"];

/** Vé & đặt bàn (vé cổng / show / nhà hàng): chủ địa điểm quản lý địa điểm của mình, admin thấy tất cả. */
export default async function TicketPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const session = (await getSession())!;
  const owner = await ticketOwnerOf(session);
  const venues = await venuesFor(session);
  const isAdmin = session.role === "ADMIN";

  // Chưa có địa điểm: chủ dịch vụ vẫn vào được tab Thiết lập để tự tạo (gửi admin duyệt); nhân viên thì không.
  if (!venues.length && !isAdmin && session.role !== "PROVIDER") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-forest-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-ink">Vé &amp; đặt bàn</h1>
        <p className="mt-2 text-sm text-gray-600">
          Chủ địa điểm chưa có địa điểm bán vé / nhận đặt bàn nào.
        </p>
      </div>
    );
  }

  const wantTab = TABS.find((t) => t === sp.tab);
  const wantVenue = venues.find((v) => v.id === sp.venue);
  const kind = wantTab ? TAB_KIND[wantTab] : undefined;
  const venue = (wantVenue && (!kind || wantVenue.kind === kind) ? wantVenue : undefined) ?? (kind ? venues.find((v) => v.kind === kind) : undefined) ?? wantVenue ?? venues[0];
  const tab: Tab = wantTab ?? (venue ? KIND_TAB[venue.kind] : "setup");

  const [initial, providers, stats, places] = await Promise.all([
    venue ? loadTicketData(venue.id) : null,
    isAdmin ? prisma.adminUser.findMany({ where: { role: "PROVIDER", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
    owner ? scanStats(owner) : { checked: 0, total: 0 },
    // Quán ở danh mục Nhà hàng / Cafe / Check-in — để gắn địa điểm bán vé với trang quán.
    prisma.place.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true, kind: true } }),
  ]);

  // key: tạo / xoá địa điểm điều hướng lại trang ⇒ dựng lại state theo dữ liệu mới.
  return <TicketManager key={`${venues.length}:${venue?.id ?? ""}`} venues={venues} initial={initial} initialTab={tab} providers={providers} places={places} isAdmin={isAdmin} who={session.name || session.username} scanStats={stats} />;
}
