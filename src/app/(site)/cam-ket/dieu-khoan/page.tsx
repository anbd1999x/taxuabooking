import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Điều khoản cam kết bảo vệ khách hàng",
  description:
    "Điều khoản cam kết của Tà Xùa Booking: chi trả tối đa 100 triệu nếu nhận tiền không cung cấp dịch vụ, đền 10 triệu nếu bán cao hơn giá gốc, quy trình xử lý bồi thường rõ ràng.",
  alternates: { canonical: "/cam-ket/dieu-khoan" },
};

const INK = "oklch(0.3 0.02 160)";
const BRAND = "oklch(0.29 0.055 160)";
const OK = "oklch(0.42 0.11 155)";
const NO = "oklch(0.52 0.17 28)";
const NEED = "oklch(0.4 0.08 250)";

type Group = { h: string; c: string; mark: string; items: string[] };
type Section = { id: string; title: string; lead?: string; groups: Group[] };

const ok = (items: string[]): Group => ({ h: "ÁP DỤNG KHI", c: OK, mark: "✓", items });
const no = (items: string[]): Group => ({ h: "KHÔNG ÁP DỤNG KHI", c: NO, mark: "×", items });
const need = (items: string[]): Group => ({ h: "BẰNG CHỨNG CẦN CÓ", c: NEED, mark: "•", items });

const SECTIONS: Section[] = [
  {
    id: "c100",
    title: "Cam kết minh bạch — chi trả tối đa 100.000.000đ",
    lead:
      "Nếu Tà Xùa Booking đã xác nhận đơn, trực tiếp nhận tiền của bạn mà không cung cấp dịch vụ, bạn được hoàn 100% số tiền đã trả và bồi thường thêm. Tổng số tiền chi trả (hoàn tiền + bồi thường) tối đa 100.000.000 đồng cho một đơn hàng. Đây là cam kết tự nguyện của Tà Xùa Booking, không phải bảo hiểm hay bảo lãnh của ngân hàng.",
    groups: [
      ok([
        "Đơn hàng có mã do Tà Xùa Booking cấp và đã chốt bill qua Zalo chính thức.",
        "Bạn chuyển khoản vào đúng tài khoản Bùi An hoặc Tăng Linh được công bố trên taxuabooking.com / taxuabooking.vn.",
        "Tụi mình không cung cấp dịch vụ, không hoàn tiền và không đưa ra phương án thay thế mà bạn đồng ý.",
      ]),
      no([
        "Bạn thanh toán trực tiếp cho homestay, nhà xe. Khi đó tụi mình hỗ trợ làm việc với nhà cung cấp, và vẫn chịu trách nhiệm với sai sót của chính tụi mình (báo sai giá, sai ngày, sai dịch vụ).",
        "Giao dịch với trang, tài khoản hoặc số điện thoại giả mạo không thuộc danh sách chính thức.",
        "Bạn tự huỷ hoặc thay đổi theo chính sách huỷ đã báo khi chốt bill.",
      ]),
      need(["Mã đơn (ví dụ TX-Z8Y45U).", "Ảnh chụp đoạn chốt bill trên Zalo.", "Biên lai chuyển khoản."]),
    ],
  },
  {
    id: "c10",
    title: "Không bán cao hơn giá gốc — đền 10.000.000đ",
    lead:
      "Giá tụi mình báo và chốt với bạn không cao hơn giá niêm yết công khai của chính nhà xe, homestay cho cùng dịch vụ. Nếu cao hơn, dù ngay từ lần báo giá đầu hay sau khi chốt, bạn được hoàn phần chênh lệch và đền thêm 10.000.000 đồng.",
    groups: [
      ok([
        "Cùng nhà cung cấp, cùng loại phòng/vé, cùng ngày sử dụng, cùng số lượng và điều kiện dịch vụ.",
        "Giá niêm yết là giá công khai của chính nhà cung cấp (fanpage, website, bảng giá) và đang tồn tại tại thời điểm chốt bill.",
        "Có bằng chứng xác thực được về giá niêm yết đó.",
      ]),
      no([
        "So sánh với giá hiển thị trên website Tà Xùa Booking. Giá trên web chỉ để tham khảo, có thể chưa kịp cập nhật khi chủ dịch vụ vừa đổi giá.",
        "Giá khuyến mãi riêng, giá quen biết, giá thương lượng trực tiếp với chủ dịch vụ.",
        "Combo có thêm dịch vụ đi kèm (xe, trung chuyển, ăn uống) so với giá lẻ.",
      ]),
      need([
        "Ảnh chụp đoạn chốt bill trên Zalo.",
        "Ảnh chụp hoặc link giá niêm yết của nhà cung cấp, có ngày đăng hoặc ngày chụp.",
      ]),
    ],
  },
  {
    id: "chot",
    title: "Giá đã chốt là giá cuối cùng",
    lead: "Sau khi bạn xác nhận bill qua Zalo chính thức của Tà Xùa Booking:",
    groups: [
      {
        h: "TỤI MÌNH CAM KẾT",
        c: OK,
        mark: "✓",
        items: [
          "Không tự ý tăng giá.",
          "Không thêm phụ phí chưa được báo trước.",
          "Không tự ý đổi loại phòng, loại xe hoặc dịch vụ đã xác nhận.",
          "Mọi thay đổi đều được báo trước và chỉ thực hiện khi bạn đồng ý. Nếu không thể cung cấp đúng dịch vụ đã chốt, tụi mình báo ngay và đưa phương án xử lý: đổi dịch vụ tương đương hoặc hoàn tiền.",
        ],
      },
    ],
  },
  {
    id: "gia",
    title: "Giá trên website và giá chốt",
    groups: [
      {
        h: "NGUYÊN TẮC",
        c: BRAND,
        mark: "•",
        items: [
          "Giá trên website là giá tham khảo do chủ dịch vụ cung cấp.",
          "Khi bạn gửi yêu cầu, tụi mình liên hệ chủ dịch vụ để kiểm tra lại giá và tình trạng còn chỗ.",
          "Nếu giá khác so với web, tụi mình báo trước khi chốt. Bạn không đồng ý thì không đặt, không mất phí.",
          "Mỗi đơn được lưu lại giá chốt, nội dung xác nhận, thời gian và nhà cung cấp để đối chiếu khi cần.",
        ],
      },
    ],
  },
  {
    id: "bat-kha-khang",
    title: "Thiên tai, sạt lở, cấm đường",
    lead:
      "Tà Xùa hay gặp sạt lở, sương mù dày, cấm đường hoặc thời tiết xấu không thể di chuyển. Khi đó, tụi mình phối hợp với nhà cung cấp để hỗ trợ bạn đổi ngày, bảo lưu hoặc hoàn tiền theo thoả thuận, và báo rõ phương án xử lý trước khi thực hiện. Mỗi trường hợp được xem xét theo bản chất sự việc, không mặc nhiên miễn trách nhiệm.",
    groups: [],
  },
  {
    id: "quy-trinh",
    title: "Quy trình xử lý yêu cầu",
    groups: [
      {
        h: "CÁC BƯỚC",
        c: BRAND,
        mark: "→",
        items: [
          "Gửi mã đơn và bằng chứng qua Zalo hoặc email ở cuối trang.",
          "Trong 24 giờ: tụi mình xác nhận đã nhận và báo hồ sơ còn thiếu gì.",
          "Trong 7 ngày làm việc: đối chiếu với nhà cung cấp và trả lời kết quả bằng văn bản.",
          "Nếu đủ điều kiện: chuyển khoản bồi thường trong 3 ngày làm việc tiếp theo.",
        ],
      },
    ],
  },
  {
    id: "chung",
    title: "Điều kiện chung",
    groups: [
      {
        h: "LƯU Ý",
        c: "oklch(0.45 0.02 160)",
        mark: "•",
        items: [
          "Mỗi đơn hàng chỉ được chi trả một lần cho một sự việc.",
          "Thời hạn gửi yêu cầu: trong 30 ngày kể từ ngày dịch vụ dự kiến được cung cấp hoặc ngày bạn phát hiện vi phạm, tuỳ ngày nào đến sau.",
          "Mọi khoản chi trả chuyển vào tài khoản chính chủ của người đặt.",
          "Tụi mình có thể cập nhật điều khoản. Đơn đã chốt áp dụng điều khoản tại thời điểm chốt.",
        ],
      },
    ],
  },
];

const LEGAL: [string, string][] = [
  ["Đơn vị vận hành", "[Tên cá nhân / hộ kinh doanh]"],
  ["Người chịu trách nhiệm", "Bùi An"],
  ["Địa chỉ", "[Địa chỉ hoạt động]"],
  ["Mã số thuế", "[Nếu có]"],
  ["Hotline", "0397 943 155 · 0357 452 952"],
  ["Email", "anbd.dev@gmail.com"],
  ["Website", "taxuabooking.com · taxuabooking.vn"],
];

const TOC = [
  ...SECTIONS.map((s) => ({ id: s.id, name: s.title.split(" — ")[0] })),
  { id: "phap-ly", name: "Bên cam kết" },
  { id: "lien-he", name: "Gửi yêu cầu bồi thường" },
];

export default function TermsPage() {
  return (
    <div
      style={{
        background: "oklch(0.975 0.01 150)",
        fontFamily: "'Be Vietnam Pro',system-ui,sans-serif",
        color: "oklch(0.22 0.03 160)",
      }}
    >
      <div
        className="mx-auto grid w-full items-start gap-7 px-4 py-7 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8"
        style={{ maxWidth: 1120 }}
      >
        {/* Mục lục (desktop) */}
        <nav
          className="sticky top-20 hidden flex-col gap-0.5 rounded-[18px] border bg-white p-3 lg:flex"
          style={{ borderColor: "oklch(0.92 0.01 160)" }}
        >
          <div
            className="px-2.5 py-1.5"
            style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "oklch(0.5 0.02 160)" }}
          >
            Mục lục
          </div>
          {TOC.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="rounded-[10px] px-2.5 py-2 transition-colors hover:bg-[oklch(0.96_0.02_155)]"
              style={{ fontSize: 14, fontWeight: 600, color: "oklch(0.3 0.03 160)" }}
            >
              {t.name}
            </a>
          ))}
        </nav>

        <article className="flex min-w-0 flex-col gap-[18px]">
          <div>
            <Link href="/cam-ket" style={{ fontSize: 14, fontWeight: 700, color: "oklch(0.4 0.08 160)" }}>
              ← Quay lại
            </Link>
            <h1
              style={{
                margin: "10px 0 0",
                fontSize: "clamp(28px,4vw,40px)",
                fontWeight: 800,
                letterSpacing: "-.03em",
                lineHeight: 1.1,
              }}
            >
              Điều khoản cam kết bảo vệ khách hàng
            </h1>
            <div style={{ fontSize: 14, color: "oklch(0.48 0.02 160)", marginTop: 8 }}>
              Áp dụng từ 01/11/2026 · Cập nhật lần cuối 06/11/2026
            </div>
          </div>

          {/* 2 thẻ cam kết tiền */}
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))" }}>
            <a
              href="#c100"
              style={{ padding: 18, borderRadius: 18, background: "oklch(0.97 0.03 70)", border: "1.5px solid oklch(0.88 0.08 65)", color: "inherit" }}
            >
              <div style={{ fontSize: 26, fontWeight: 800, color: "oklch(0.58 0.18 42)", letterSpacing: "-.03em" }}>100 triệu</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>Cam kết minh bạch</div>
              <div style={{ fontSize: 13, color: "oklch(0.45 0.03 60)", marginTop: 2 }}>Tổng chi trả tối đa / đơn hàng</div>
            </a>
            <a
              href="#c10"
              style={{ padding: 18, borderRadius: 18, background: "oklch(0.97 0.02 155)", border: "1.5px solid oklch(0.86 0.06 155)", color: "inherit" }}
            >
              <div style={{ fontSize: 26, fontWeight: 800, color: "oklch(0.42 0.11 155)", letterSpacing: "-.03em" }}>10 triệu</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>Không bán cao hơn giá gốc</div>
              <div style={{ fontSize: 13, color: "oklch(0.4 0.04 155)", marginTop: 2 }}>Giá chốt Zalo cao hơn giá niêm yết</div>
            </a>
          </div>

          {/* Các mục điều khoản */}
          {SECTIONS.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              className="flex scroll-mt-20 flex-col gap-3 rounded-[20px] border bg-white"
              style={{ padding: "22px clamp(16px,2.5vw,26px)", borderColor: "oklch(0.92 0.01 160)" }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  style={{
                    width: 28,
                    height: 28,
                    flex: "none",
                    borderRadius: "50%",
                    background: BRAND,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {i + 1}
                </span>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-.015em" }}>{s.title}</h2>
              </div>
              {s.lead && <div style={{ fontSize: 15, lineHeight: 1.65, color: INK }}>{s.lead}</div>}
              {s.groups.map((g, gi) => (
                <div key={gi} className="flex flex-col gap-1.5">
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", color: g.c }}>{g.h}</div>
                  {g.items.map((item, ii) => (
                    <div
                      key={ii}
                      style={{ display: "grid", gridTemplateColumns: "18px minmax(0,1fr)", gap: 8, fontSize: 15, lineHeight: 1.6, color: INK }}
                    >
                      <span style={{ color: g.c, fontWeight: 800 }}>{g.mark}</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ))}

          {/* Bên cam kết */}
          <section
            id="phap-ly"
            className="flex scroll-mt-20 flex-col gap-3 rounded-[20px] border bg-white"
            style={{ padding: "22px clamp(16px,2.5vw,26px)", borderColor: "oklch(0.92 0.01 160)" }}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-.015em" }}>Bên cam kết</h2>
            <div className="flex flex-col">
              {LEGAL.map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(120px,190px) minmax(0,1fr)",
                    gap: 12,
                    padding: "10px 0",
                    borderTop: "1px solid oklch(0.94 0.01 160)",
                    fontSize: 15,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ fontWeight: 700, color: "oklch(0.45 0.02 160)" }}>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "oklch(0.5 0.02 160)" }}>
              Điều khoản được xây dựng trên tinh thần Luật Bảo vệ quyền lợi người tiêu dùng 2023.
            </div>
          </section>

          {/* Gửi yêu cầu bồi thường */}
          <section
            id="lien-he"
            className="flex scroll-mt-20 flex-col gap-3 rounded-[20px]"
            style={{ padding: "22px clamp(16px,2.5vw,26px)", background: BRAND, color: "white" }}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Gửi yêu cầu bồi thường</h2>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "oklch(0.88 0.03 160)" }}>
              Gửi bằng chứng qua Zalo hoặc email. Tụi mình phản hồi trong 24 giờ và giải quyết xong trong tối đa 7 ngày làm việc.
            </div>
            <Link href="/tra-cuu" style={{ fontSize: 14, fontWeight: 700, color: "oklch(0.85 0.1 70)" }}>
              Tra cứu đơn bằng mã đơn →
            </Link>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://zalo.me/0397943155"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 14, fontWeight: 800, padding: "11px 16px", borderRadius: 999, background: "white", color: BRAND, whiteSpace: "nowrap" }}
              >
                Zalo 0397 943 155
              </a>
              <a
                href="https://zalo.me/0357452952"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 14, fontWeight: 800, padding: "11px 16px", borderRadius: 999, background: "white", color: BRAND, whiteSpace: "nowrap" }}
              >
                Zalo 0357 452 952
              </a>
              <a
                href="mailto:anbd.dev@gmail.com"
                style={{ fontSize: 14, fontWeight: 800, padding: "11px 16px", borderRadius: 999, border: "1.5px solid oklch(1 0 0 / .4)", color: "white", whiteSpace: "nowrap" }}
              >
                anbd.dev@gmail.com
              </a>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
