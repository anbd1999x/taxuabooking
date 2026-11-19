import { i18nMeta } from "@/lib/i18n/meta";
import { publicVenueCards } from "@/lib/ticket";
import { TicketList } from "@/components/ticket/TicketList";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return i18nMeta({
    title: "Vé tham quan, show và đặt bàn ở Tà Xùa",
    description: "Mua vé vào cổng điểm check-in, vé show ca nhạc chọn ghế và đặt bàn nhà hàng ở Tà Xùa. Xem còn chỗ theo ngày, đặt sẵn đồ ăn uống, nhận vé QR.",
    path: "/ve",
  });
}

/** Vé & đặt bàn: danh sách điểm check-in / show / nhà hàng đang mở bán (mẫu claude.ai/design "Ban ve - Khach"). */
export default async function TicketListPage() {
  const { days, cards } = await publicVenueCards();
  return <TicketList days={days} cards={cards} />;
}
