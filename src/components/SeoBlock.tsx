import Link from "@/components/Link";
import { getT } from "@/lib/i18n/server";
import { getComboDiscount } from "@/lib/combo";
import { formatPrice } from "@/lib/format";

/**
 * Khối nội dung SEO ở cuối trang danh sách (xe cabin / homestay / combo / thuê xe máy / xe ôm / taxi): đoạn giới thiệu có từ khoá,
 * liên kết sang bài hướng dẫn, và mục Câu hỏi thường gặp kèm dữ liệu có cấu trúc FAQPage cho Google.
 * Nội dung tĩnh, dựng phía server ⇒ Google đọc được ngay trong HTML.
 */
type Kind = "CABIN" | "HOMESTAY" | "COMBO" | "MOTORBIKE" | "XEOM" | "TAXI";

/**
 * Số liệu THẬT của trang (đếm / thấp nhất / cao nhất từ dữ liệu trang đã nạp), do `[category]/page.tsx` truyền vào.
 * Giá đã định dạng sẵn ("180.000đ" hoặc "180.000đ đến 280.000đ"). Thiếu khoá nào thì câu dùng khoá đó tự rút về
 * bản không có số (`alt`) hoặc bị bỏ: KHÔNG viết tay con số nào trong tệp này.
 */
export type SeoStats = Record<string, string | number | null | undefined>;

/** Câu có số: `k` = mẫu dùng tham số {0}, {1}… lấy theo thứ tự `need` từ SeoStats. */
interface Dyn {
  k: string;
  need: string[];
  /** Câu thay thế (không có số) khi thiếu dữ liệu; không khai ⇒ bỏ câu. */
  alt?: string;
}
type Part = string | Dyn;

interface Block {
  heading: string;
  /** Mỗi đoạn = một hoặc nhiều câu (nối bằng dấu cách). */
  intro: (Part | Part[])[];
  links: [string, string][];
  faq: [string, Part | Part[]][];
  /** Nối câu "rẻ hơn đặt lẻ {mức giảm combo}" vào cuối đoạn giới thiệu cuối (cấu hình ở /admin/popup; 0 ⇒ bỏ câu). */
  comboSave?: boolean;
}

const NOTE = "Giá là mức tham khảo, có thể thay đổi theo mùa và dịp lễ; giá chính xác hiện khi bạn chọn ngày.";

const BLOCKS: Record<Kind, Block> = {
  CABIN: {
    heading: "Đặt xe cabin Hà Nội – Tà Xùa trên Tà Xùa Booking",
    intro: [
      "Xe giường nằm cabin chạy đêm là cách đi Tà Xùa phổ biến nhất: lên xe ở Hà Nội khoảng 21h đến 22h, ngủ một giấc và có mặt ở trung tâm Tà Xùa khoảng 6h sáng, đúng giờ săn mây. Chiều về xe rời Tà Xùa khoảng 12h đến 13h, tới Hà Nội khoảng 19h.",
      "Trang này tổng hợp các nhà xe cabin đang mở bán tuyến Hà Nội – Tà Xùa và các tỉnh lân cận. Chọn ngày đi, ngày về để xem nhà xe còn chỗ, giá vé cabin đơn và cabin đôi, điểm đón trả, rồi gửi yêu cầu đặt vé cho cả hai chiều trong một lần. Không cần thanh toán online.",
    ],
    links: [
      ["/kinh-nghiem/dat-xe-di-ta-xua", "Hướng dẫn đặt xe đi Tà Xùa từ A–Z"],
      ["/kinh-nghiem/diem-don-xe-cabin-cac-tinh", "Xe cabin đón ở đâu?"],
      ["/kinh-nghiem/trai-nghiem-xe-cabin-di-ta-xua", "Một đêm trên xe cabin"],
      ["/combo", "Combo xe cabin + homestay"],
    ],
    faq: [
      ["Vé xe cabin Hà Nội đi Tà Xùa bao nhiêu tiền?", [
        { k: "Vé khứ hồi từ Hà Nội của {0} nhà xe đang đăng hiện ở mức {1} một người.", need: ["n", "rt"], alt: "Giá vé tuỳ nhà xe; chọn ngày đi và ngày về để xem giá từng nhà xe." },
        { k: "Vé một chiều từ Hà Nội: {0}.", need: ["ow"] },
        NOTE,
      ]],
      ["Xe cabin đi Tà Xùa chạy lúc mấy giờ?", "Chiều đi xe rời Hà Nội khoảng 21h đến 22h và tới trung tâm Tà Xùa khoảng 6h sáng hôm sau. Chiều về xe rời Tà Xùa khoảng 12h đến 13h, tới Hà Nội khoảng 19h."],
      ["Ở tỉnh khác có xe đón đi Tà Xùa không?", [
        { k: "Có. Bảng giá của các nhà xe đang có {0} điểm đón ngoài Hà Nội: {1}.", need: ["nPickups", "pickups"], alt: "Có. Nhiều nhà xe có xe trung chuyển đón ở các tỉnh quanh Hà Nội; chọn điểm đón ở ô tìm kiếm để xem nhà xe nhận đón và giá vé." },
        { k: "Vé khứ hồi từ các điểm này hiện ở mức {0} một người.", need: ["rtOther"] },
      ]],
      ["Nên đặt vé xe đi Tà Xùa trước bao lâu?", "Ngày thường đặt trước 1 đến 2 ngày. Cuối tuần mùa mây (tháng 11 đến tháng 3) nên đặt trước 5 đến 7 ngày, dịp lễ Tết trước 2 đến 3 tuần."],
      ["Đặt vé có phải thanh toán online không?", "Không. Bạn gửi yêu cầu đặt chỗ trên website, sau đó được liên hệ xác nhận và hướng dẫn đặt cọc bằng chuyển khoản."],
    ],
  },
  HOMESTAY: {
    heading: "Đặt homestay Tà Xùa: xem giá và phòng trống theo ngày",
    intro: [
      [
        { k: "Tà Xùa Booking đang đăng {0} homestay và bungalow ở Tà Xùa với {1} phòng, chia theo các khu: trung tâm xã, Đỉnh Gió, Khe Cải, Mống Vàng và Chung Trinh.", need: ["n", "rooms"], alt: "Tà Xùa Booking tổng hợp homestay và bungalow ở Tà Xùa, chia theo các khu: trung tâm xã, Đỉnh Gió, Khe Cải, Mống Vàng và Chung Trinh." },
        "Mỗi phòng có ảnh riêng, sức chứa, tiện ích (view mây, bồn tắm, ăn sáng, sưởi) và giá từng đêm.",
      ],
      "Chọn ngày nhận phòng và trả phòng để chỉ hiện những phòng còn trống đúng những đêm đó, kèm giá thật của ngày thường, thứ Bảy hay dịp lễ. Bạn có thể chọn nhiều phòng cùng một homestay trong một đơn cho đoàn đông. Gửi yêu cầu là có người liên hệ xác nhận, không cần thanh toán online.",
    ],
    links: [
      ["/kinh-nghiem/o-ta-xua-nen-chon-khu-nao", "Ở Tà Xùa nên chọn khu nào?"],
      ["/kinh-nghiem/kinh-nghiem-dat-phong-homestay-ta-xua", "Kinh nghiệm đặt phòng, đặt cọc"],
      ["/kinh-nghiem/gia-homestay-ta-xua-ngay-thuong-cuoi-tuan-le", "Giá homestay ngày thường, cuối tuần, lễ"],
      ["/combo", "Combo xe cabin + homestay"],
    ],
    faq: [
      ["Giá homestay Tà Xùa bao nhiêu một đêm?", [
        { k: "Tính theo đêm rẻ nhất trong tuần của từng phòng, {0} phòng đang đăng có giá {1} một đêm; một nửa số phòng có giá từ {2} trở xuống.", need: ["priced", "range", "median"], alt: "Giá tuỳ phòng và ngày ở; chọn ngày nhận phòng, trả phòng để xem giá từng phòng." },
        { k: "Giường phòng cộng đồng từ {0} một người.", need: ["dormMin"] },
        NOTE,
      ]],
      ["Nên ở khu nào ở Tà Xùa?", "Đi lần đầu, đi cùng người lớn tuổi hoặc trẻ nhỏ nên ở khu trung tâm vì gần quán ăn và điểm xe đỗ. Muốn mở cửa là thấy biển mây thì chọn Đỉnh Gió. Thích yên tĩnh thì chọn Khe Cải hoặc Mống Vàng."],
      ["Mấy giờ nhận phòng và trả phòng?", "Phần lớn homestay nhận phòng từ 14h và trả phòng trước 12h. Xe cabin thường tới lúc 6h sáng; bạn có thể gửi đồ ở homestay rồi đi săn mây trước khi nhận phòng."],
      ["Đặt homestay Tà Xùa trước bao lâu?", "Cuối tuần trong mùa mây (tháng 11 đến tháng 3) nên đặt trước 1 đến 2 tuần, dịp lễ Tết nên đặt trước 3 đến 4 tuần. Ngày thường có thể đặt sát ngày."],
      ["Đi đoàn đông có đặt nhiều phòng một lần được không?", "Được. Ở trang từng homestay bạn chọn nhiều phòng trong cùng một đơn; hệ thống tính lại giá từng phòng và phụ thu nếu ở ghép."],
    ],
  },
  COMBO: {
    heading: "Combo Tà Xùa: xe cabin khứ hồi + homestay trọn gói",
    intro: [
      "Combo Tà Xùa ghép sẵn vé xe cabin khứ hồi với phòng homestay còn trống đúng ngày bạn đi. Bạn nhập điểm xuất phát, ngày đi, ngày về, số người và mức giá mong muốn; hệ thống tính ra giá trọn gói cho mỗi người và gợi ý cách chia phòng cho cả đoàn.",
      "Ngày đi là đêm bạn lên xe, phòng được tính từ sáng hôm sau, nên không lo lệch ngày giữa xe và phòng.",
    ],
    comboSave: true,
    links: [
      ["/kinh-nghiem/combo-xe-cabin-homestay-ta-xua", "Combo xe cabin + homestay có lợi gì?"],
      ["/lich-trinh", "Lịch trình Tà Xùa 2N1Đ, 3N2Đ"],
      ["/xe-cabin", "Chỉ đặt xe cabin"],
      ["/homestay", "Chỉ đặt homestay"],
    ],
    faq: [
      ["Combo Tà Xùa 2 ngày 1 đêm giá bao nhiêu?", [
        { k: "Ví dụ đang hiện trên trang (đi {0}, về {1}, {2} người lớn): combo rẻ nhất của từng homestay ở mức {3} một người, gồm vé xe cabin khứ hồi và phòng.", need: ["from", "to", "adults", "range"], alt: "Tuỳ phòng, nhà xe và ngày đi. Nhập ngày đi, ngày về và số người ở ô tìm kiếm để xem giá trọn gói mỗi người của từng phương án." },
        NOTE,
      ]],
      ["Combo gồm những gì?", "Gồm vé xe cabin khứ hồi (cả xe trung chuyển lên Tà Xùa) và phòng homestay cho các đêm lưu trú. Ăn uống, vé điểm check-in và xe đi lại tại chỗ chưa gồm trong giá."],
      ["Chọn ngày đi, ngày về thế nào cho đúng?", "Ngày đi là đêm lên xe, ngày về là ngày xe chạy chiều về và cũng là ngày trả phòng. Ví dụ muốn ở đêm thứ Bảy thì chọn ngày đi thứ Sáu, ngày về Chủ nhật."],
      ["Đi từ tỉnh khác có đặt combo được không?", "Được. Chọn điểm xuất phát ở ô tìm kiếm, giá vé sẽ tính theo bảng giá chặng của nhà xe có đón ở tỉnh đó."],
    ],
  },
  MOTORBIKE: {
    heading: "Thuê xe máy ở Tà Xùa: giá, loại xe và lưu ý",
    intro: [
      [
        "Thuê xe máy là cách tự do nhất để đi các điểm gần trung tâm Tà Xùa như Đỉnh Gió, Khe Cải, quán cà phê săn mây.",
        { k: "Các tiệm trên Tà Xùa Booking đang cho thuê {0} loại xe, giá {1} một ngày.", need: ["types", "range"] },
      ],
      "Chọn ngày nhận và ngày trả xe để xem tiệm còn xe đúng những ngày đó, rồi gửi yêu cầu đặt; không cần thanh toán online. Các đoạn đường đất dốc như vào Mỏm cá heo hay Sống lưng khủng long, người chưa quen đèo nên đi xe ôm bản địa.",
    ],
    links: [
      ["/kinh-nghiem/thue-xe-may-ta-xua", "Kinh nghiệm thuê xe máy Tà Xùa"],
      ["/kinh-nghiem/di-ta-xua-co-nguy-hiem-khong", "Đi Tà Xùa có nguy hiểm không?"],
      ["/xe-om", "Xe ôm bản địa theo tuyến"],
      ["/ban-do", "Bản đồ các điểm check-in"],
    ],
    faq: [
      ["Thuê xe máy ở Tà Xùa bao nhiêu tiền một ngày?", [
        { k: "Giá thuê hiện ở mức {0} một ngày tuỳ loại xe: {1}.", need: ["range", "list"], alt: "Giá tuỳ loại xe và tiệm; xem giá từng xe ở danh sách phía trên." },
        NOTE,
      ]],
      ["Thuê xe máy ở Tà Xùa có cần bằng lái không?", "Nên mang theo bằng lái xe máy và giấy tờ tuỳ thân; tiệm có thể giữ giấy tờ hoặc thu tiền cọc khi giao xe. Hỏi rõ điều kiện khi đặt."],
      ["Xe máy đi được những điểm nào ở Tà Xùa?", "Đường nhựa tới trung tâm, Đỉnh Gió, Khe Cải và phần lớn quán cà phê săn mây. Đoạn cuối vào Mỏm cá heo và Sống lưng khủng long là đường đất dốc, trơn khi mưa, người chưa quen nên đi xe ôm."],
      ["Có giao xe tận homestay không?", "Tuỳ tiệm. Hỏi khi đặt; nhiều tiệm giao nhận ở trung tâm hoặc tại homestay gần trung tâm."],
      ["Nên đặt xe máy trước bao lâu?", "Ngày thường có thể đặt sát ngày. Cuối tuần mùa mây và dịp lễ nên đặt trước vài ngày vì xe PG1 hay hết sớm."],
    ],
  },
  XEOM: {
    heading: "Xe ôm Tà Xùa: tài xế bản địa, giá theo tuyến",
    intro: [
      "Xe ôm bản địa là cách an toàn để tới các điểm đường khó như Sống lưng khủng long, Mỏm cá heo, Hồ Mắt Ngọc, nhất là lúc 5h sáng khi trời còn tối và nhiều sương. Tài xế là người địa phương, quen đường và biết giờ mây đẹp.",
      [
        "Giá tính theo từng chặng một chiều, có mức cho 1 khách và 2 khách đi chung xe.",
        { k: "Hiện có {0} chặng đã có giá, 1 khách {1} một chiều; xem bảng giá từng chặng ngay phía trên.", need: ["legs", "one"] },
      ],
    ],
    links: [
      ["/kinh-nghiem/gia-xe-om-taxi-ta-xua", "Bảng giá xe ôm, taxi từng chặng"],
      ["/kinh-nghiem/song-lung-khung-long-ta-xua", "Đi Sống lưng khủng long"],
      ["/kinh-nghiem/mom-ca-heo-cay-co-don-ta-xua", "Đi Mỏm cá heo, cây cô đơn"],
      ["/taxi", "Taxi 4–7 chỗ cho gia đình"],
    ],
    faq: [
      ["Xe ôm từ trung tâm Tà Xùa lên Sống lưng khủng long bao nhiêu tiền?", [
        { k: "Các chặng tới Sống lưng khủng long hiện có giá {0} một chiều cho 1 khách, tuỳ điểm đón.", need: ["spine1"], alt: "Giá tuỳ điểm đón; xem chặng tới Sống lưng khủng long trong bảng giá phía trên hoặc chọn điểm đón, điểm đến ở ô tìm kiếm." },
        { k: "Đi 2 khách chung xe: {0}.", need: ["spine2"] },
        NOTE,
      ]],
      ["Xe ôm đi Mỏm cá heo, Cây cô đơn giá bao nhiêu?", [
        { k: "Các chặng tới Mỏm cá heo hiện có giá {0} một chiều cho 1 khách, tuỳ điểm đón.", need: ["dolphin1"], alt: "Giá tuỳ điểm đón; xem chặng tới Mỏm cá heo trong bảng giá phía trên hoặc chọn điểm đón, điểm đến ở ô tìm kiếm." },
        { k: "Đi 2 khách chung xe: {0}.", need: ["dolphin2"] },
        NOTE,
      ]],
      ["Có nên đi xe ôm thay vì tự lái xe máy không?", "Nếu chưa quen đường đèo, đường đất dốc hay đi lúc sáng sớm nhiều sương thì nên đi xe ôm bản địa; tài xế biết chỗ đỗ, chỗ đứng chụp an toàn và giờ mây đẹp."],
      ["Có cần đặt xe ôm trước không?", "Nên đặt từ tối hôm trước cho buổi săn mây sáng sớm, nhất là cuối tuần và dịp lễ."],
      ["Có thuê xe ôm cả ngày được không?", "Được, một số tài xế nhận chạy nguyên ngày. Xem giá ở trang từng tài xế hoặc hỏi khi đặt."],
    ],
  },
  TAXI: {
    heading: "Taxi Tà Xùa: xe 4–7 chỗ thuê theo ngày",
    intro: [
      [
        "Taxi bản địa hợp với gia đình có người lớn tuổi, trẻ nhỏ hoặc nhóm 4 đến 7 người muốn đi các điểm có đường ô tô mà không phải tự lái đèo.",
        { k: "Giá chạy nguyên ngày của các xe trên Tà Xùa Booking hiện ở mức {0} một xe.", need: ["day"] },
      ],
      "Nhiều tài xế kiêm dẫn tour, biết điểm chụp và giờ mây, một số nhận đưa đón Hà Nội – Tà Xùa. Lưu ý ô tô chỉ tới được chỗ đỗ, đoạn cuối vào Mỏm cá heo hay Sống lưng khủng long vẫn phải đi bộ hoặc chuyển sang xe ôm.",
    ],
    links: [
      ["/kinh-nghiem/gia-xe-om-taxi-ta-xua", "Bảng giá xe ôm, taxi từng chặng"],
      ["/kinh-nghiem/di-ta-xua-bang-o-to-tu-lai", "Tự lái ô tô lên Tà Xùa"],
      ["/kinh-nghiem/du-lich-ta-xua-cho-bo-me", "Đưa bố mẹ đi Tà Xùa"],
      ["/xe-om", "Xe ôm cho đoạn đường khó"],
    ],
    faq: [
      ["Thuê taxi Tà Xùa cả ngày bao nhiêu tiền?", [
        { k: "Giá chạy nguyên ngày hiện ở mức {0} một xe, chia theo số người trong nhóm.", need: ["day"], alt: "Giá tuỳ xe và lịch trình; xem giá từng xe ở danh sách phía trên hoặc hỏi khi đặt." },
        NOTE,
      ]],
      ["Taxi có đi được Sống lưng khủng long, Mỏm cá heo không?", "Ô tô chỉ tới được chỗ đỗ gần các điểm này; đoạn cuối phải đi bộ hoặc chuyển sang xe ôm bản địa."],
      ["Có taxi đưa đón Hà Nội – Tà Xùa không?", "Có. Một số tài xế nhận đưa đón Hà Nội và các tỉnh miền Bắc; hỏi giá khi đặt."],
      ["Taxi hay xe ôm thì hợp hơn?", "Đi 4 người trở lên, có người lớn tuổi hoặc trẻ nhỏ thì taxi thoải mái hơn và chia đầu người không đắt hơn nhiều. Đi 1 đến 2 người tới điểm đường đất thì xe ôm tiện hơn."],
      ["Đặt taxi Tà Xùa thế nào?", "Chọn xe và ngày đi trên Tà Xùa Booking rồi gửi yêu cầu; bạn được liên hệ xác nhận, không cần thanh toán online."],
    ],
  },
};

export async function SeoBlock({ kind, stats = {} }: { kind: Kind; stats?: SeoStats }) {
  const t = await getT();
  const b = BLOCKS[kind];
  const comboDiscount = b.comboSave ? await getComboDiscount() : 0;
  const saveLine = comboDiscount > 0 ? " " + t("Giá combo mỗi người rẻ hơn đặt lẻ {0}.", [formatPrice(comboDiscount)]) : "";
  /** Một câu: chuỗi tĩnh, hoặc câu có số (đủ dữ liệu ⇒ điền số; thiếu ⇒ câu thay thế / bỏ). Khoá từ điển là TỪNG câu. */
  const one = (p: Part): string => {
    if (typeof p === "string") return t(p);
    const vals = p.need.map((n) => stats[n]);
    if (vals.every((v) => v != null && v !== "")) return t(p.k, vals as (string | number)[]);
    return p.alt ? t(p.alt) : "";
  };
  const text = (x: Part | Part[]) => (Array.isArray(x) ? x : [x]).map(one).filter(Boolean).join(" ");
  const tP = (p: Part | Part[], i: number) => text(p) + (i === b.intro.length - 1 ? saveLine : "");
  const tA = text;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: b.faq.map(([q, a]) => ({ "@type": "Question", name: t(q), acceptedAnswer: { "@type": "Answer", text: tA(a) } })),
  };
  return (
    <section className="container-page pb-14 pt-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Desktop: 2 cột (giới thiệu + link | câu hỏi thường gặp) để lấp đầy bề ngang thẻ. */}
      <div className="rounded-[22px] border border-gray-200 bg-white p-5 sm:p-8 lg:grid lg:grid-cols-2 lg:gap-x-12">
        <div>
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-ink sm:text-2xl">{t(b.heading)}</h2>
        <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-gray-600">
          {b.intro.map((p, i) => <p key={i}>{tP(p, i)}</p>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {b.links.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-full bg-forest-50 px-3.5 py-2 text-sm font-semibold text-forest-700 ring-1 ring-forest-200 hover:bg-forest-100">{t(label)}</Link>
          ))}
        </div>
        </div>
        <div>
        <h2 className="mt-8 text-lg font-extrabold tracking-[-0.02em] text-ink sm:text-xl lg:mt-0">{t("Câu hỏi thường gặp")}</h2>
        <div className="mt-3 divide-y divide-gray-200 border-y border-gray-200">
          {b.faq.map(([q, a]) => (
            <details key={q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                <h3 className="m-0 text-[15px] font-bold">{t(q)}</h3>
                <span aria-hidden className="text-gray-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-600">{tA(a)}</p>
            </details>
          ))}
        </div>
        </div>
      </div>
    </section>
  );
}
