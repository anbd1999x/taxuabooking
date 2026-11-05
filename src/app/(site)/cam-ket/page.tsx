import type { Metadata } from "next";
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
            <PromisesBlock termsHref="#dieu-kien" />
            <FiveKhongBlock five={config.fiveRules} />
          </div>
        </div>

        {/* Điều kiện áp dụng */}
        <section id="dieu-kien" className="mx-auto mt-8 max-w-3xl scroll-mt-20">
          <h2 className="text-xl font-extrabold tracking-tight text-forest-800 sm:text-2xl">Điều kiện áp dụng</h2>
          <div className="mt-4 flex flex-col gap-4 text-[15px] leading-relaxed text-gray-700">
            <div className="rounded-2xl border border-black/5 bg-white p-5">
              <div className="font-bold text-forest-800">1. Bồi thường đến 100.000.000đ — cam kết minh bạch</div>
              <p className="mt-1.5">
                Áp dụng khi có bằng chứng Tà Xùa Booking (qua kênh chính thức) nhận tiền của khách mà{" "}
                <b>không cung cấp dịch vụ</b> đã thoả thuận và không hoàn lại tiền. Bằng chứng gồm: nội dung chốt đơn qua
                Zalo, biên lai/chuyển khoản, và mã đơn do hệ thống cấp.
              </p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-5">
              <div className="font-bold text-forest-800">2. Đền 10.000.000đ — không bán cao hơn giá gốc</div>
              <p className="mt-1.5">
                Áp dụng khi giá tụi mình <b>chốt bill qua Zalo</b> cao hơn <b>giá niêm yết của chính nhà xe/homestay</b>{" "}
                trong <b>cùng ngày</b> cho cùng loại phòng/vé. Giá chốt qua Zalo là giá cuối cùng, không tăng thêm sau khi
                bạn đồng ý. Giá hiển thị trên web chỉ để tham khảo, có thể chưa kịp cập nhật khi chủ dịch vụ vừa đổi giá.
              </p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-5">
              <div className="font-bold text-forest-800">3. Kênh chính thức</div>
              <p className="mt-1.5">
                Mọi cam kết chỉ áp dụng cho giao dịch qua website chính thức{" "}
                <b>{OFFICIAL_SITES.join(", ")}</b> và Zalo/điện thoại của hai người phụ trách ở trên. Ngoài các địa chỉ
                này đều là giả mạo, Tà Xùa Booking không chịu trách nhiệm.
              </p>
            </div>
            <p className="text-sm text-gray-500">
              Có thắc mắc về cam kết? Nhắn Zalo cho tụi mình ở phần trên — hai đứa trực tiếp trả lời.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
