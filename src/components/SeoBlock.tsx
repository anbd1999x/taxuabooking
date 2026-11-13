import Link from "next/link";

/**
 * Khối nội dung SEO ở cuối trang danh sách (xe cabin / homestay / combo): đoạn giới thiệu có từ khoá,
 * liên kết sang bài hướng dẫn, và mục Câu hỏi thường gặp kèm dữ liệu có cấu trúc FAQPage cho Google.
 * Nội dung tĩnh, dựng phía server ⇒ Google đọc được ngay trong HTML.
 */
type Kind = "CABIN" | "HOMESTAY" | "COMBO";

interface Block {
  heading: string;
  intro: string[];
  links: [string, string][];
  faq: [string, string][];
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
      ["Vé xe cabin Hà Nội đi Tà Xùa bao nhiêu tiền?", "Vé khứ hồi cabin đơn từ Hà Nội khoảng 500.000đ đến 650.000đ một người tuỳ nhà xe; vé một chiều bằng khoảng một nửa. " + NOTE],
      ["Xe cabin đi Tà Xùa chạy lúc mấy giờ?", "Chiều đi xe rời Hà Nội khoảng 21h đến 22h và tới trung tâm Tà Xùa khoảng 6h sáng hôm sau. Chiều về xe rời Tà Xùa khoảng 12h đến 13h, tới Hà Nội khoảng 19h."],
      ["Ở tỉnh khác có xe đón đi Tà Xùa không?", "Có. Các nhà xe có xe trung chuyển đón ở Bắc Ninh, Bắc Giang, Hải Dương, Hải Phòng, Hưng Yên, Thái Bình, Nam Định, Ninh Bình, Hà Nam, Thái Nguyên, Quảng Ninh, Vĩnh Phúc và sân bay Nội Bài. Giá khứ hồi khoảng 600.000đ đến 1.050.000đ, đã gồm trung chuyển."],
      ["Nên đặt vé xe đi Tà Xùa trước bao lâu?", "Ngày thường đặt trước 1 đến 2 ngày. Cuối tuần mùa mây (tháng 11 đến tháng 3) nên đặt trước 5 đến 7 ngày, dịp lễ Tết trước 2 đến 3 tuần."],
      ["Đặt vé có phải thanh toán online không?", "Không. Bạn gửi yêu cầu đặt chỗ trên website, sau đó được liên hệ xác nhận và hướng dẫn đặt cọc bằng chuyển khoản."],
    ],
  },
  HOMESTAY: {
    heading: "Đặt homestay Tà Xùa: xem giá và phòng trống theo ngày",
    intro: [
      "Tà Xùa Booking tổng hợp hơn 30 homestay và bungalow ở Tà Xùa, chia theo các khu: trung tâm xã, Đỉnh Gió, Khe Cải, Mống Vàng và Chung Trinh. Mỗi phòng có ảnh riêng, sức chứa, tiện ích (view mây, bồn tắm, ăn sáng, sưởi) và giá từng đêm.",
      "Chọn ngày nhận phòng và trả phòng để chỉ hiện những phòng còn trống đúng những đêm đó, kèm giá thật của ngày thường, thứ Bảy hay dịp lễ. Bạn có thể chọn nhiều phòng cùng một homestay trong một đơn cho đoàn đông. Gửi yêu cầu là có người liên hệ xác nhận, không cần thanh toán online.",
    ],
    links: [
      ["/kinh-nghiem/o-ta-xua-nen-chon-khu-nao", "Ở Tà Xùa nên chọn khu nào?"],
      ["/kinh-nghiem/kinh-nghiem-dat-phong-homestay-ta-xua", "Kinh nghiệm đặt phòng, đặt cọc"],
      ["/kinh-nghiem/gia-homestay-ta-xua-ngay-thuong-cuoi-tuan-le", "Giá homestay ngày thường, cuối tuần, lễ"],
      ["/combo", "Combo xe cabin + homestay"],
    ],
    faq: [
      ["Giá homestay Tà Xùa bao nhiêu một đêm?", "Phòng riêng phổ biến ở mức 650.000đ đến 1.000.000đ một đêm; giường phòng cộng đồng từ khoảng 150.000đ một người; phòng có bồn tắm hoặc view mây đẹp có thể tới khoảng 2.200.000đ. " + NOTE],
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
      "Ngày đi là đêm bạn lên xe, phòng được tính từ sáng hôm sau, nên không lo lệch ngày giữa xe và phòng. Giá combo mỗi người rẻ hơn đặt lẻ 25.000đ.",
    ],
    links: [
      ["/kinh-nghiem/combo-xe-cabin-homestay-ta-xua", "Combo xe cabin + homestay có lợi gì?"],
      ["/lich-trinh", "Lịch trình Tà Xùa 2N1Đ, 3N2Đ"],
      ["/xe-cabin", "Chỉ đặt xe cabin"],
      ["/homestay", "Chỉ đặt homestay"],
    ],
    faq: [
      ["Combo Tà Xùa 2 ngày 1 đêm giá bao nhiêu?", "Tuỳ phòng và nhà xe, combo xe cabin khứ hồi từ Hà Nội kèm một đêm homestay thường khoảng 800.000đ đến 1.150.000đ một người khi đi 2 người. " + NOTE],
      ["Combo gồm những gì?", "Gồm vé xe cabin khứ hồi (cả xe trung chuyển lên Tà Xùa) và phòng homestay cho các đêm lưu trú. Ăn uống, vé điểm check-in và xe đi lại tại chỗ chưa gồm trong giá."],
      ["Chọn ngày đi, ngày về thế nào cho đúng?", "Ngày đi là đêm lên xe, ngày về là ngày xe chạy chiều về và cũng là ngày trả phòng. Ví dụ muốn ở đêm thứ Bảy thì chọn ngày đi thứ Sáu, ngày về Chủ nhật."],
      ["Đi từ tỉnh khác có đặt combo được không?", "Được. Chọn điểm xuất phát ở ô tìm kiếm, giá vé sẽ tính theo bảng giá chặng của nhà xe có đón ở tỉnh đó."],
    ],
  },
};

export function SeoBlock({ kind }: { kind: Kind }) {
  const b = BLOCKS[kind];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: b.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return (
    <section className="container-page pb-14 pt-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="rounded-[22px] border border-gray-200 bg-white p-5 sm:p-8">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-ink sm:text-2xl">{b.heading}</h2>
        <div className="mt-3 flex max-w-3xl flex-col gap-3 text-[15px] leading-relaxed text-gray-600">
          {b.intro.map((p) => <p key={p}>{p}</p>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {b.links.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-full bg-forest-50 px-3.5 py-2 text-sm font-semibold text-forest-700 ring-1 ring-forest-200 hover:bg-forest-100">{label}</Link>
          ))}
        </div>
        <h2 className="mt-8 text-lg font-extrabold tracking-[-0.02em] text-ink sm:text-xl">Câu hỏi thường gặp</h2>
        <div className="mt-3 max-w-3xl divide-y divide-gray-200 border-y border-gray-200">
          {b.faq.map(([q, a]) => (
            <details key={q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                <h3 className="m-0 text-[15px] font-bold">{q}</h3>
                <span aria-hidden className="text-gray-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-600">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
