import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/queries";
import { parseTrustPopup, TRUST_POPUP_KEY } from "@/lib/trust-popup";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cam kết minh bạch – điều khoản sử dụng dịch vụ",
  description:
    "Cam kết minh bạch của Tà Xùa Booking: chi trả tối đa 100 triệu nếu nhận tiền mà không cung cấp dịch vụ và không hoàn tiền, bồi thường 10 triệu nếu cố ý báo cao hơn giá niêm yết, cách xử lý sự cố và quy trình hoàn tiền.",
  alternates: { canonical: "/cam-ket/dieu-khoan" },
};

const INK = "oklch(0.3 0.02 160)";
const BRAND = "oklch(0.29 0.055 160)";
const OK = "oklch(0.42 0.11 155)";
const NO = "oklch(0.52 0.17 28)";
const NEED = "oklch(0.4 0.08 250)";

type Group = { h: string; c: string; mark: string; items: string[]; ordered?: boolean };
/** Một khối trong mục: đoạn văn (chuỗi, hỗ trợ **đậm**) hoặc nhóm gạch đầu dòng. */
type Block = string | Group;
type Section = { id: string; title: string; body: Block[] };

const ok = (items: string[], h = "ÁP DỤNG KHI"): Group => ({ h, c: OK, mark: "✓", items });
const no = (items: string[], h = "KHÔNG ÁP DỤNG KHI"): Group => ({ h, c: NO, mark: "×", items });
const need = (items: string[]): Group => ({ h: "BẰNG CHỨNG CẦN CÓ", c: NEED, mark: "•", items });
const list = (h: string, items: string[], ordered = false): Group => ({ h, c: BRAND, mark: "•", items, ordered });

const INTRO =
  "Tà Xùa Booking làm việc minh bạch với ba điều: đã nhận đơn là phục vụ đến nơi, giá không cao hơn giá niêm yết của chủ dịch vụ, và giá đã chốt thì không đổi. Nếu có sự cố ngoài ý muốn, tụi mình luôn có phương án thay thế hoặc hoàn tiền nhanh chóng để bạn yên tâm.";

const DEFINITIONS: string[] = [
  "**Lỗi từ phía Tà Xùa Booking:** Tà Xùa Booking biết mà vẫn làm, hoặc không xử lý khi đã được yêu cầu. Ví dụ: nhận tiền rồi không cung cấp dịch vụ và không hoàn tiền; báo giá cao hơn giá niêm yết mà tụi mình đã biết; tự ý thu thêm phí chưa báo.",
  "**Sự cố ngoài ý muốn:** việc xảy ra không do Tà Xùa Booking chủ động gây ra. Ví dụ: xe hỏng, homestay khoá nhầm phòng, nhà cung cấp đổi giá mà không báo, thiên tai, sạt lở, cấm đường.",
  "**Giá niêm yết:** giá công khai của chính nhà cung cấp (fanpage, website, bảng giá) cho cùng dịch vụ, đang tồn tại tại thời điểm chốt bill.",
  "**Kênh chính thức:** website taxuabooking.com / taxuabooking.vn, Zalo và hotline ghi ở cuối trang, tài khoản ngân hàng Bùi Danh An hoặc Tăng Mai Linh, và ví USDT do Tà Xùa Booking gửi qua Zalo chính thức.",
];

const SECTIONS: Section[] = [
  {
    id: "c100",
    title: "Cam kết minh bạch — chi trả tối đa 100.000.000đ",
    body: [
      "Nếu Tà Xùa Booking đã xác nhận đơn và nhận tiền của bạn nhưng không cung cấp dịch vụ, **và** không hoàn tiền trong vòng 3 ngày làm việc kể từ khi bạn yêu cầu, bạn được hoàn 100% số tiền đã trả và bồi thường thêm gấp 5 lần số tiền đó. Tổng chi trả (hoàn tiền + bồi thường) tối đa 100.000.000đ cho một đơn hàng. Đây là cam kết tự nguyện của Tà Xùa Booking, không phải bảo hiểm hay bảo lãnh ngân hàng.",
      ok(
        [
          "Đơn hàng có mã do Tà Xùa Booking cấp và đã chốt bill qua Zalo chính thức.",
          "Bạn thanh toán qua kênh chính thức (tài khoản Bùi Danh An, Tăng Mai Linh, hoặc ví USDT do Tà Xùa Booking gửi qua Zalo chính thức).",
          "Dịch vụ không được cung cấp, bạn không đồng ý phương án thay thế nào, và Tà Xùa Booking không hoàn tiền trong thời hạn trên.",
        ],
        "ÁP DỤNG KHI CÓ ĐỦ CÁC ĐIỀU KIỆN SAU",
      ),
      no([
        "Tà Xùa Booking đã hoàn tiền đúng hạn, hoặc bạn đã đồng ý phương án thay thế.",
        "Sự cố ngoài ý muốn đã được xử lý theo mục 5 hoặc mục 6.",
        "Bạn thanh toán trực tiếp cho homestay, nhà xe. Khi đó tụi mình hỗ trợ làm việc với nhà cung cấp và vẫn chịu trách nhiệm với sai sót của chính tụi mình (báo sai giá, sai ngày, sai dịch vụ).",
        "Bạn giao dịch với trang, tài khoản, số điện thoại hoặc ví không thuộc kênh chính thức.",
        "Bạn tự huỷ, đổi lịch hoặc không đến (no-show). Trường hợp này theo chính sách huỷ đã báo khi chốt bill.",
      ]),
      need([
        "Mã đơn (ví dụ TX-Z8Y45U).",
        "Ảnh chụp đoạn chốt bill trên Zalo.",
        "Biên lai chuyển khoản hoặc mã giao dịch (TxID).",
        "Tin nhắn yêu cầu hoàn tiền có ghi ngày.",
      ]),
    ],
  },
  {
    id: "c10",
    title: "Đúng giá niêm yết — bồi thường 10.000.000đ",
    body: [
      "Giá tụi mình chốt với bạn không cao hơn giá niêm yết của chính nhà cung cấp tại thời điểm chốt bill. Nếu cao hơn:",
      list("HAI TRƯỜNG HỢP", [
        "**Do Tà Xùa Booking** (đã biết giá niêm yết thấp hơn mà vẫn báo giá cao hơn): bạn được hoàn phần chênh lệch và bồi thường thêm 10.000.000đ.",
        "**Do nhà cung cấp đổi giá mà không báo cho Tà Xùa Booking:** bạn được hoàn đủ phần chênh lệch trong vòng 3 ngày làm việc kể từ khi một bên phát hiện, hoặc trừ vào dịch vụ khác nếu bạn đồng ý. Khoản bồi thường 10.000.000đ không áp dụng vì đây là sự cố ngoài ý muốn.",
      ]),
      "Nếu nhà cung cấp giảm giá **sau** khi đã chốt bill, đó không phải vi phạm. Khi biết và nhà cung cấp áp dụng giá mới cho đơn của bạn, tụi mình sẽ chủ động báo và chuyển lại phần giảm cho bạn.",
      ok([
        "Cùng nhà cung cấp, cùng loại phòng/vé, cùng ngày sử dụng, cùng số lượng và điều kiện dịch vụ.",
        "Giá niêm yết là giá công khai của chính nhà cung cấp và đang tồn tại tại thời điểm chốt bill.",
        "Có bằng chứng xác thực được về giá đó và thời điểm đăng.",
      ]),
      no(
        [
          "Giá hiển thị trên website Tà Xùa Booking (chỉ để tham khảo, xem mục 4).",
          "Giá khuyến mãi riêng, giá quen biết, giá thương lượng trực tiếp với chủ dịch vụ, hoặc giá trên các nền tảng đặt phòng khác.",
          "Combo có thêm dịch vụ đi kèm (xe, trung chuyển, ăn uống, hỗ trợ ngôn ngữ) so với giá lẻ.",
          "Giá nhà cung cấp đăng sau thời điểm chốt bill.",
        ],
        "KHÔNG ÁP DỤNG KHI SO VỚI",
      ),
      need([
        "Ảnh chụp đoạn chốt bill trên Zalo.",
        "Ảnh chụp hoặc link giá niêm yết của nhà cung cấp có ngày đăng.",
      ]),
    ],
  },
  {
    id: "chot",
    title: "Giá đã chốt là giá cuối cùng",
    body: [
      "Sau khi bạn xác nhận bill qua Zalo chính thức, tụi mình cam kết:",
      ok(
        [
          "Không tự ý tăng giá.",
          "Không thu phụ phí chưa báo. Phụ phí hợp lệ là phụ phí đã ghi trong bill, hoặc bạn đồng ý bằng tin nhắn sau đó (ví dụ: check-in sớm, thêm người, xe đưa đón).",
          "Không tự ý đổi loại phòng, loại xe hoặc dịch vụ đã xác nhận.",
        ],
        "TỤI MÌNH CAM KẾT",
      ),
      "Nếu không thể cung cấp đúng dịch vụ đã chốt, tụi mình báo ngay và xử lý theo mục 5. Mọi thay đổi chỉ thực hiện khi bạn đồng ý.",
    ],
  },
  {
    id: "gia",
    title: "Giá trên website và giá chốt",
    body: [
      "Giá trên website chỉ để tham khảo; giá có hiệu lực là giá ghi trong bill đã chốt qua Zalo.",
      list("NGUYÊN TẮC", [
        "Giá trên website do chủ dịch vụ cung cấp và có thể chưa kịp cập nhật khi họ đổi giá hoặc chạy khuyến mãi.",
        "Khi bạn gửi yêu cầu, tụi mình liên hệ chủ dịch vụ để kiểm tra lại giá và tình trạng còn chỗ.",
        "Nếu giá khác so với web, tụi mình báo trước khi chốt. Bạn không đồng ý thì không đặt, không mất phí.",
        "Mỗi đơn được lưu lại giá chốt, nội dung xác nhận, thời gian và nhà cung cấp để đối chiếu khi cần.",
      ]),
    ],
  },
  {
    id: "su-co",
    title: "Sự cố từ nhà cung cấp",
    body: [
      "Xe hỏng, homestay khoá nhầm phòng, overbook hoặc sự cố tương tự không do Tà Xùa Booking cố ý được xử lý như sau:",
      list(
        "CÁCH XỬ LÝ",
        [
          "Tụi mình báo ngay cho bạn khi biết sự cố.",
          "Tụi mình đưa phương án thay thế tương đương hoặc tốt hơn, không tính thêm phí.",
          "Nếu bạn không đồng ý phương án thay thế, tụi mình hoàn 100% phần dịch vụ chưa sử dụng trong vòng 3 ngày làm việc.",
        ],
        true,
      ),
      "Khi đã xử lý theo mục này, sự cố không thuộc phạm vi bồi thường của mục 1 và mục 2. Trách nhiệm của Tà Xùa Booking tối đa bằng số tiền bạn đã trả cho phần dịch vụ bị ảnh hưởng.",
      "Nếu xảy ra sự cố trong lúc bạn đang sử dụng dịch vụ, vui lòng báo ngay qua Zalo hoặc hotline để tụi mình kịp xử lý tại chỗ.",
    ],
  },
  {
    id: "bat-kha-khang",
    title: "Thiên tai, sạt lở, cấm đường",
    body: [
      "Tà Xùa hay gặp sạt lở, sương mù dày, cấm đường hoặc thời tiết xấu không thể di chuyển. Khi đó:",
      list("CÁCH XỬ LÝ", [
        "Tụi mình phối hợp với nhà cung cấp để hỗ trợ bạn đổi ngày, bảo lưu hoặc hoàn tiền, và báo rõ phương án trước khi thực hiện.",
        "Nếu hoàn tiền: tụi mình chuyển lại toàn bộ số tiền nhà cung cấp hoàn cho đơn của bạn và không thu phí xử lý.",
        "Phần tiền nhà cung cấp không hoàn (nếu có) được báo rõ kèm lý do; tụi mình ưu tiên thương lượng để bảo lưu cho bạn dùng lần sau.",
      ]),
      "Thiên tai và sự kiện bất khả kháng không thuộc phạm vi bồi thường của mục 1 và mục 2.",
    ],
  },
  {
    id: "quy-trinh",
    title: "Quy trình xử lý yêu cầu",
    body: [
      list(
        "CÁC BƯỚC",
        [
          "Gửi mã đơn và bằng chứng qua Zalo hoặc email ở cuối trang.",
          "Trong 24 giờ: tụi mình xác nhận đã nhận và báo hồ sơ còn thiếu gì.",
          "Trong 7 ngày làm việc: đối chiếu với nhà cung cấp và trả lời kết quả bằng văn bản, nêu rõ trường hợp thuộc mục nào.",
          "Nếu đủ điều kiện: chuyển khoản hoàn tiền hoặc bồi thường trong 3 ngày làm việc tiếp theo.",
        ],
        true,
      ),
    ],
  },
  {
    id: "chung",
    title: "Điều kiện chung",
    body: [
      {
        h: "LƯU Ý",
        c: "oklch(0.45 0.02 160)",
        mark: "•",
        items: [
          "Mỗi đơn hàng được chi trả một lần cho một sự việc.",
          "Thời hạn gửi yêu cầu: trong 30 ngày kể từ ngày dịch vụ dự kiến được cung cấp.",
          "Tiền hoàn và bồi thường được chuyển vào tài khoản hoặc ví chính chủ của người đặt, theo đúng hình thức bạn đã thanh toán (VND hoặc USDT theo tỷ giá lúc thanh toán), trừ khi hai bên thống nhất khác.",
          "Cam kết không bao gồm các thiệt hại gián tiếp như lỡ chuyến đi, vé xe, vé máy bay hoặc chi phí phát sinh ngoài đơn hàng.",
          "Cam kết không áp dụng khi thông tin đặt chỗ bạn cung cấp không chính xác, khi bạn vi phạm nội quy của nhà cung cấp, hoặc khi bằng chứng không xác thực được.",
          "Tụi mình có thể cập nhật điều khoản. Đơn đã chốt áp dụng điều khoản tại thời điểm chốt.",
        ],
      },
    ],
  },
];

/** Chuỗi có **đậm** → nút React. */
function rich(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>,
  );
}

const LEGAL: [string, string][] = [
  ["Người chịu trách nhiệm", "Bùi Danh An"],
  ["Hotline", "0397 943 155 · 0357 452 952"],
  ["Email", "lienhe@taxuabooking.com"],
  ["Website", "taxuabooking.com · taxuabooking.vn"],
];

const TOC = [
  { id: "dinh-nghia", name: "Định nghĩa" },
  ...SECTIONS.map((s) => ({ id: s.id, name: s.title.split(" — ")[0] })),
  { id: "phap-ly", name: "Bên cam kết" },
  { id: "lien-he", name: "Gửi yêu cầu hoàn tiền, bồi thường" },
];

export default async function TermsPage() {
  // admin tắt phần cam kết (/admin/popup) ⇒ ẩn cả trang điều khoản
  if (!parseTrustPopup((await getSettings())[TRUST_POPUP_KEY]).enabled) notFound();
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
              Cam kết minh bạch – Tà Xùa Booking
            </h1>
            <div style={{ fontSize: 14, color: "oklch(0.48 0.02 160)", marginTop: 8 }}>
              Áp dụng từ 01/11/2026 · Cập nhật lần cuối 12/11/2026
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.65, color: INK }}>{INTRO}</p>
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
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>Đúng giá niêm yết</div>
              <div style={{ fontSize: 13, color: "oklch(0.4 0.04 155)", marginTop: 2 }}>Bồi thường nếu cố ý báo cao hơn giá niêm yết</div>
            </a>
          </div>

          {/* Định nghĩa */}
          <section
            id="dinh-nghia"
            className="flex scroll-mt-20 flex-col gap-3 rounded-[20px] border bg-white"
            style={{ padding: "22px clamp(16px,2.5vw,26px)", borderColor: "oklch(0.92 0.01 160)" }}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-.015em" }}>Định nghĩa</h2>
            {DEFINITIONS.map((d, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "18px minmax(0,1fr)", gap: 8, fontSize: 15, lineHeight: 1.6, color: INK }}>
                <span style={{ color: BRAND, fontWeight: 800 }}>•</span>
                <span>{rich(d)}</span>
              </div>
            ))}
          </section>

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
              {s.body.map((blk, bi) =>
                typeof blk === "string" ? (
                  <div key={bi} style={{ fontSize: 15, lineHeight: 1.65, color: INK }}>{rich(blk)}</div>
                ) : (
                  <div key={bi} className="flex flex-col gap-1.5">
                    <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", color: blk.c }}>{blk.h}</div>
                    {blk.items.map((item, ii) => (
                      <div
                        key={ii}
                        style={{ display: "grid", gridTemplateColumns: "18px minmax(0,1fr)", gap: 8, fontSize: 15, lineHeight: 1.6, color: INK }}
                      >
                        <span style={{ color: blk.c, fontWeight: 800 }}>{blk.ordered ? `${ii + 1}.` : blk.mark}</span>
                        <span>{rich(item)}</span>
                      </div>
                    ))}
                  </div>
                ),
              )}
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
              Điều khoản được xây dựng trên tinh thần Luật Bảo vệ quyền lợi người tiêu dùng 2023. Cảm ơn bạn đã tin tưởng Tà Xùa Booking.
            </div>
          </section>

          {/* Gửi yêu cầu bồi thường */}
          <section
            id="lien-he"
            className="flex scroll-mt-20 flex-col gap-3 rounded-[20px]"
            style={{ padding: "22px clamp(16px,2.5vw,26px)", background: BRAND, color: "white" }}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Gửi yêu cầu hoàn tiền, bồi thường</h2>
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
                href="mailto:lienhe@taxuabooking.com"
                style={{ fontSize: 14, fontWeight: 800, padding: "11px 16px", borderRadius: 999, border: "1.5px solid oklch(1 0 0 / .4)", color: "white", whiteSpace: "nowrap" }}
              >
                lienhe@taxuabooking.com
              </a>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
