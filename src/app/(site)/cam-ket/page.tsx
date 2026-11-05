import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/queries";
import { parseTrustPopup, TRUST_POPUP_KEY, OFFICIAL_SITES } from "@/lib/trust-popup";
import { CommitmentIntro, FiveKhongBlock, PeopleColumn, PromisesBlock } from "@/components/trust/parts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cam kết uy tín",
  description:
    "Cam kết uy tín của Tà Xùa Booking: website thật, người thật, không scam. Bồi thường đến 100 triệu nếu nhận tiền không cung cấp dịch vụ; đền 10 triệu nếu bán cao hơn giá gốc.",
  alternates: { canonical: "/cam-ket" },
};

export default async function CommitmentPage() {
  const settings = await getSettings();
  const config = parseTrustPopup(settings[TRUST_POPUP_KEY]);

  return (
    <div
      className="bg-forest-50/40"
      style={{ fontFamily: "'Be Vietnam Pro',system-ui,sans-serif", color: "oklch(0.22 0.03 160)" }}
    >
      <div className="container-page py-8 sm:py-12">
        {/* Thẻ chính: 2 cột như popup */}
        <div
          className="grid overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-[360px_minmax(0,1fr)]"
          style={{ boxShadow: "0 40px 80px -40px oklch(0.15 0.04 160 / .4)" }}
        >
          <PeopleColumn people={config.people} wide />
          <div className="flex flex-col gap-4 p-6 sm:p-9">
            <CommitmentIntro showSub />
            <PromisesBlock termsHref="/cam-ket/dieu-khoan" />
            <FiveKhongBlock five={config.fiveRules} />
          </div>
        </div>

        {/* Xem điều khoản đầy đủ */}
        <div className="mx-auto mt-6 flex max-w-3xl flex-col items-center gap-3 text-center">
          <Link
            href="/cam-ket/dieu-khoan"
            className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-forest-900"
          >
            Xem điều khoản cam kết đầy đủ →
          </Link>
          <p className="text-sm text-gray-500">
            Mọi cam kết chỉ áp dụng cho giao dịch qua website chính thức <b>{OFFICIAL_SITES.join(", ")}</b> và Zalo/điện
            thoại của hai người phụ trách ở trên. Ngoài các địa chỉ này đều là giả mạo.
          </p>
        </div>
      </div>
    </div>
  );
}
