import { pageMeta } from "@/lib/og";
import { DEMO_MODULES, type DemoModule } from "@/lib/module-demo";
import { PartnerHub } from "@/components/partner/PartnerHub";

/** Menu "Tiện ích" (tên cũ "Hợp tác") → một trang giới thiệu các phần mềm cho chủ dịch vụ (xe máy · homestay · vé & show · gọi món QR), tiếng Việt. */
// Trang CHỈ tiếng Việt ⇒ canonical luôn về bản vi, không khai hreflang en/zh/ko (bản /en/hop-tac vẫn là nội dung tiếng Việt).
export const generateMetadata = () =>
  pageMeta({
    title: "Tiện ích — phần mềm miễn phí cho chủ dịch vụ ở Tà Xùa",
    description: "Quản lý thuê xe máy, quản lý homestay, bán vé & đặt bàn, gọi món QR tại bàn. Miễn phí cho chủ dịch vụ ở Tà Xùa, có bản demo dùng thử ngay.",
    path: "/hop-tac",
  });

export default async function PartnerHubPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const m = (await searchParams).m;
  return <PartnerHub initial={DEMO_MODULES.find((k) => k === m) ?? ("qr" satisfies DemoModule)} />;
}
