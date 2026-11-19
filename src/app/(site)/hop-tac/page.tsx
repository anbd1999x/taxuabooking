import { i18nMeta } from "@/lib/i18n/meta";
import { DEMO_MODULES, type DemoModule } from "@/lib/module-demo";
import { PartnerHub } from "@/components/partner/PartnerHub";

/** Menu "Hợp tác" → một trang giới thiệu các phần mềm cho chủ dịch vụ (xe máy · homestay · vé & show · gọi món QR), tiếng Việt. */
export const generateMetadata = () =>
  i18nMeta({
    title: "Hợp tác — phần mềm miễn phí cho chủ dịch vụ ở Tà Xùa",
    description: "Quản lý thuê xe máy, quản lý homestay, bán vé & đặt bàn, gọi món QR tại bàn. Miễn phí cho chủ dịch vụ ở Tà Xùa, có bản demo dùng thử ngay.",
    path: "/hop-tac",
  });

export default async function PartnerHubPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const m = (await searchParams).m;
  return <PartnerHub initial={DEMO_MODULES.find((k) => k === m) ?? ("qr" satisfies DemoModule)} />;
}
