/**
 * 2 bài kinh nghiệm giọng người đi thật (ngôi thứ nhất). Số liệu giá / giờ xe / chính sách
 * nhận phòng sớm lấy từ dữ liệu trên hệ thống (11/2026); ảnh là ảnh thật trong kho /uploads
 * của các homestay, quán. Bỏ qua bài có slug đã tồn tại.
 * Chạy: npx tsx scripts/tmp-articles-traveler2.ts            (đăng)
 *       npx tsx scripts/tmp-articles-traveler2.ts --dry      (chỉ in ra, không ghi DB)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export interface Art {
  slug: string;
  title: string;
  excerpt: string;
  topic: string;
  coverImage: string;
  content: string;
}

export const ARTICLES: Art[] = [
  // ───────────── 1. Xuống xe đêm lúc sáng sớm ─────────────
  {
    slug: "xuong-xe-dem-ta-xua-sang-som-lam-gi",
    title: "Xuống xe đêm ở Tà Xùa lúc 6h sáng, 14h mới nhận phòng: 8 tiếng đó làm gì?",
    excerpt:
      "Xe cabin thả khách ở Tà Xùa khoảng 6h sáng, còn homestay 14h mới cho nhận phòng. Mình gom lại chính sách nhận phòng sớm của từng home, giá thật, và cách tiêu 8 tiếng đó để khỏi ngồi ôm balo ngoài trời lạnh.",
    topic: "cam-nang",
    coverImage: "/uploads/1793641137117-b186d21f16a0.jpg",
    content: `Chuyến Tà Xùa đầu tiên, mình lên kế hoạch kỹ đủ thứ: đặt xe, đặt phòng, xem dự báo mây. Chỉ quên đúng một chi tiết nhỏ là xe đêm tới nơi lúc trời còn chưa sáng hẳn, còn phòng thì **14h chiều** mới nhận. Thế là sáng hôm đó ba đứa đứng co ro ven đường, balo trên vai, gió lùa vào cổ, nhìn nhau hỏi: giờ đi đâu?

Lần sau đi lại, mình tìm hiểu kỹ hơn. Bài này ghi lại hết cho ai sắp đi xe đêm lần đầu.

## Khoảng trống 8 tiếng đến từ đâu

Lấy lộ trình các nhà xe cabin đang chạy tuyến Hà Nội – Tà Xùa trên hệ thống làm ví dụ:

- **21h00 – 22h00**: xuất phát ở Hà Nội (Mạc Thái Tông, Mễ Trì, Đình Núp… tuỳ nhà xe).
- **Khoảng 2h**: nghỉ ở Phú Thọ.
- **Khoảng 4h**: tới Bắc Yên, nghỉ thêm một nhịp rồi lên dốc.
- **Khoảng 6h**: tới Tà Xùa, đúng giờ mây đẹp nhất nếu hôm đó có mây.

Trong khi đó, gần như home nào cũng ghi **nhận phòng 14h, trả phòng 12h** (vài nơi như [Haus Meej](/homestay/haus-meej-ta-xua), [Happy Town](/homestay/happy-town-ta-xua) là 13h nhận, 11h trả). Từ 6h tới 14h là 8 tiếng. Ngồi không thì dài, mà lạnh: sáng sớm trên này thường chỉ hơn 10 độ.

![Quán Nhà H'Mông lúc sương mù phủ kín núi phía sau, buổi sáng ở trung tâm Tà Xùa](/uploads/1793641137117-b186d21f16a0.jpg)

## Cách 1: trả thêm tiền nhận phòng sớm

Nhiều người không biết là khá nhiều homestay có **bảng phí nhận phòng sớm** rõ ràng, chỉ là không ai nói nếu mình không hỏi. Mình gom lại chính sách vài home đang đăng trên Tà Xùa Booking:

- **[Mon's House](/homestay/mons-house-ta-xua), [Lang Thang Homestay](/homestay/lang-thang-homestay)**: nhận trước 6h tính 50% giá niêm yết, 7h – 10h tính 30%, sau 10h miễn phí.
- **[Noong ơi Homestay](/homestay/noong-oi-homestay)** (Khe Cải): trước 6h phụ thu 200.000đ/phòng, 7h – 10h là 150.000đ/phòng, sau 10h miễn phí.
- **[La Chếu Homestay](/homestay/la-cheu-homestay)** (Đỉnh Gió): nhận trước 10h phụ thu 200.000đ/phòng, sau 10h miễn phí.
- **[Khèn Coffee House](/homestay/khen-coffee-house-ta-xua)** (Đỉnh Gió): nhận sớm từ 6h phụ thu 200.000đ.
- **Haus Meej, Happy Town** (Đỉnh Gió): nhận sớm 7h – 10h phụ thu 200.000đ/phòng.
- **[Mống Vàng Retreat](/homestay/mong-vang-retreat)**: nếu phòng không có khách thì cho nhận sau 10h.
- **[Chung Chinh Homestay](/homestay/chung-chinh-homestay)** (bản Chung Trinh): ngày trong tuần, còn phòng thì nhận sớm, trả muộn miễn phí nếu ăn ít nhất một bữa chính ở home.
- **[Cloud Forest](/homestay/cloud-forest-ta-xua)** (Đỉnh Gió): có khung giờ cho khách trải nghiệm trong ngày từ 6h30 tới 18h30, cần chỗ nghỉ ban ngày thì hỏi home giá.

Có một điều kiện chung ở tất cả các nơi: **phải còn phòng trống**. Mà sáng thứ 7 thì phòng thường đang có khách của đêm thứ 6, 12h họ mới trả. Nên nếu bạn đi đêm thứ 6 như số đông, đừng trông nhiều vào chuyện nhận sớm. Đi giữa tuần thì dễ hơn hẳn.

Tính thử cho dễ hình dung: phòng 700.000đ/đêm, nhận lúc 8h sáng theo mức 30% là thêm 210.000đ. Chia hai người thì mỗi người hơn 100.000đ để được tắm nước nóng và ngủ bù vài tiếng. Với mình, sau một đêm trên xe, khoản này đáng tiền. Còn nếu vẫn tỉnh táo thì cứ đi chơi tới sau 10h rồi nhận, không mất đồng nào.

## Cách 2: đặt thêm luôn đêm hôm trước

Cách này hay được rỉ tai: đặt phòng từ đêm bạn còn đang ngồi trên xe, sáng tới là vào phòng luôn, không phải xin xỏ ai.

Nghe thì gọn, nhưng tính ra thường đắt. Ví dụ [Nhà của An](/homestay/nha-cua-an-ta-xua) để giá thứ 6 là 900.000đ, tức là bạn trả trọn một đêm cho cái giường chỉ dùng từ 6h sáng. Trong khi mức 50% "nhận trước 6h" ở mấy home phía trên rẻ hơn khá nhiều. Mình chỉ thấy cách này hợp khi đi đông người, có trẻ nhỏ hoặc người lớn tuổi, cần chắc chắn có chỗ nằm ngay, nhất là sáng thứ 7.

## Cách 3: không trả gì, gửi balo rồi đi chơi

Lần thứ hai mình chọn cách này. Từ hôm trước mình nhắn home báo giờ xe tới và xin gửi balo. Hỏi trước vẫn hơn là sáng ra mới gõ cửa.

Lịch mình đi hôm đó, ai muốn có thể chép lại:

**6h – 7h30: ngồi một chỗ có mái che, uống gì đó nóng và chờ mây.** Giờ này ít quán mở. [Thào Coffee](/cafe/thao-coffee-ta-xua) ở trung tâm mở từ 5h sáng, [Cà phê Bản](/cafe/ca-phe-ban-song-lung-khung-long) trên cung sống lưng khủng long cũng mở từ 5h, [Nhà H'Mông](/cafe/nha-h-mong) mở từ 6h30. Hôm nào có mây thì ngồi đây là xem được luôn, khỏi chạy đi đâu.

![Cổng Thào Coffee ở trung tâm Tà Xùa lúc trời tối, quán mở từ 5h sáng](/uploads/1793629254190-c8d8a7e5b030.jpg)

**7h30 – 8h30: ăn sáng.** Một bát phở hay bát mì nóng là đủ ấm người. Bữa sáng kèm phòng (nếu có) thường tính cho sáng hôm sau, nên sáng đầu tiên coi như tự lo.

![Phở bò buổi sáng ở một homestay khu Đỉnh Gió, Tà Xùa](/uploads/1794215341051-0dcb831682d0.jpg)

**8h30 – 11h: thuê xe máy đi sống lưng khủng long.** Đi sớm đường vắng, chụp ảnh không phải chờ lượt. Xe số thuê trên hệ thống khoảng 180.000đ/ngày ([anh Đạt Tà Xùa](/thue-xe-may/anh-dat-ta-xua)). Tay lái chưa quen đèo thì gọi xe ôm, đừng cố.

**11h – 12h30: ăn trưa.** Muốn nhanh gọn thì có cơm suất ở [Bếp ăn Xuân Thì](/nha-hang/bep-an-xuan-thi-ta-xua), từ 90.000đ. Muốn tìm chỗ ngồi lâu cho đỡ buồn ngủ thì ghé [Tiệm Mì Cay](/nha-hang/tiem-mi-cay-ta-xua), có góc cửa kính nhìn ra núi.

![Góc bàn cạnh cửa kính nhìn ra núi ở Tiệm Mì Cay, trung tâm Tà Xùa](/uploads/1793641178915-646c11c04fe7.jpg)

**Sau 13h: về home.** Nhiều hôm 13h đã có phòng, nhất là ngày thường. Tắm xong, ngủ một giấc tới 16h là vừa kịp dậy đi ngắm hoàng hôn.

## Mấy thứ nhỏ nhưng mình ước biết sớm hơn

- **Mặc áo ấm ngay từ trên xe**, đừng nhét hết vào đáy balo. Lúc xuống xe không có chỗ nào để lục đồ.
- **Sạc đầy pin trên xe.** Khoang cabin có cổng sạc, sáng ra sẽ cần điện thoại để chụp, gọi xe, tìm đường.
- **Để riêng một túi nhỏ** gồm khăn, bàn chải, sạc, áo mỏng. Gửi balo lớn ở home rồi chỉ cầm túi này đi chơi.
- **Nhắn chủ home từ tối hôm trước** báo giờ xe dự kiến tới. Còn phòng trống thì nhiều nơi tự gọi cho nhận sớm.
- **Chiều về thì khớp giờ**: xe trung chuyển các nhà xe thường gom khách ở trung tâm khoảng 12h, đúng giờ trả phòng. Home trả phòng 11h thì còn dư một tiếng ngồi cafe.

## Tóm lại

Đi đêm thứ 6, phòng gần như chắc chắn không có trước trưa, nên tính sẵn lịch đi chơi buổi sáng, gửi đồ là xong. Đi giữa tuần thì cứ hỏi nhận sớm, nhiều nơi sau 10h là miễn phí.

Đỡ phải khớp ngày giờ nhất là đặt [combo xe cabin + homestay](/combo), xe và phòng ghép sẵn đúng ngày. Ai thích tự chọn thì xem [homestay còn trống theo ngày](/homestay) và [lịch xe cabin](/xe-cabin). Đi lần đầu thì đọc thêm [kinh nghiệm một đêm trên xe cabin](/kinh-nghiem/trai-nghiem-xe-cabin-di-ta-xua) và [mẹo chống say xe đèo Tà Xùa](/kinh-nghiem/meo-chong-say-xe-deo-ta-xua).

*Giá và chính sách nhận phòng sớm lấy theo thông tin các homestay đăng trên Tà Xùa Booking, cập nhật tháng 11/2026; nên hỏi lại chủ nhà trước ngày đi. Ảnh trong bài là ảnh thật từ thư viện ảnh của các quán, homestay ở Tà Xùa.*`,
  },

  // ───────────── 2. Tà Xùa tháng 11 ─────────────
  {
    slug: "ta-xua-thang-11",
    title: "Tà Xùa tháng 11: đầu mùa mây, chưa vào mùa lễ, đi lúc này có đáng không?",
    excerpt:
      "Tháng 11 là lúc Tà Xùa bắt đầu lạnh khô, mây về nhiều hơn mà giá phòng chưa bị đẩy lên như dịp Tết Dương lịch. Ghi chép thật về thời tiết, giá phòng ngày thường và thứ 7, đồ mặc và những thứ nên biết trước khi đi.",
    topic: "diem-den",
    coverImage: "/uploads/1794222929569-a48d0990994a.jpg",
    content: `Hỏi mười người hay đi Tà Xùa nên đi tháng nào, chắc sáu bảy người nói tháng 12, tháng 1. Mình thì nghiêng về **tháng 11** hơn. Lý do rất đời thường: trời đã lạnh đủ để có mây, mà chưa có ngày lễ nào kéo cả Hà Nội lên núi cùng lúc.

Đây là những gì mình ghi lại sau các chuyến đi vào thời điểm này.

![Mặt trời mọc trên biển mây nhìn qua vách kính phòng ở Haus Meej, khu Đỉnh Gió](/uploads/1794222929569-a48d0990994a.jpg)

## Thời tiết tháng 11 trên Tà Xùa

Tháng 11 là lúc trên này chuyển hẳn sang mùa khô lạnh. Ban ngày khoảng **10 – 16 độ**, nắng hanh, ngồi ngoài trời rất dễ chịu. Đêm và sáng sớm thì lạnh thật, có hôm xuống dưới 10 độ, gió trên các mỏm cao như Đỉnh Gió còn làm cảm giác lạnh hơn nhiệt kế.

Trời khô, ít mưa nên đường lên đẹp, xe máy đi lại dễ hơn hẳn mùa hè. Chỉ có điều da và môi khô rất nhanh, nhớ mang son dưỡng và kem dưỡng.

Về mây: tháng 11 – 2 là mùa mây chính, nhưng **không ai hứa trước được**. Mình từng gặp một sáng mây phủ kín thung lũng, sáng hôm sau trời trong vắt nhìn thấu xuống chân núi. Muốn tăng cơ hội thì ở ít nhất 2 đêm, để có 2 buổi sáng. Hụt mây cũng đừng buồn, đọc thêm bài [săn mây hụt thì làm gì](/kinh-nghiem/san-may-hut-o-ta-xua-lam-gi).

## Giá phòng: tháng 11 dễ chịu hơn hẳn mùa lễ

Đây là lý do lớn nhất khiến mình chọn tháng 11. Tháng này không có ngày nghỉ lễ nào, nên các home chỉ áp **giá ngày thường và giá cuối tuần**, chưa dùng tới bảng giá lễ Tết.

Để dễ so, đây là giá một vài home đang đăng trên hệ thống (giá phòng/đêm):

- **[Nhà của An](/homestay/nha-cua-an-ta-xua)**: thứ 2 – thứ 5 là 700.000đ, thứ 6 và chủ nhật 900.000đ, thứ 7 1.100.000đ.
- **[Haus Meej](/homestay/haus-meej-ta-xua)** (Đỉnh Gió, phòng nhìn ra biển mây như ảnh trên): ngày trong tuần 700.000 – 1.200.000đ, thứ 6 – 7 900.000 – 1.400.000đ.
- **[Bếp Nhà Táo](/homestay/bep-nha-tao)** (Khe Cải): ngày thường 750.000 – 1.150.000đ, thứ 7 950.000 – 1.450.000đ.
- **[Mống Vàng Retreat](/homestay/mong-vang-retreat)**: ngày thường 650.000 – 1.150.000đ, thứ 7 1.200.000 – 1.950.000đ.
- **[Tà Xùa Hill](/homestay/ta-xua-hill)**: căn Đồi Mây bán 800.000đ ngày trong tuần suốt tháng 11 – 1, giá lễ Tết là 1.200.000đ.

Còn khi sang dịp Tết Dương lịch, ví dụ [Thác Mây Tà Xùa](/homestay/thac-may-ta-xua) để phòng VIP 2.500.000đ và căn Lux 3.500.000đ/đêm cho ngày 1 – 2/1/2027, cao hơn nhiều so với ngày thường (từ 1.300.000đ). Cùng một căn phòng, cùng một biển mây, chênh nhau cả triệu.

Nhìn mấy bảng giá trên sẽ thấy **ngày thường rẻ hơn thứ 7 ít nhất 200.000đ/đêm**, có nơi chênh tới 500.000 – 800.000đ, mà lại vắng hơn rất nhiều. Xin nghỉ được một ngày giữa tuần thì đi tối thứ 3 hoặc thứ 4 là "lời" nhất, vừa rẻ vừa dễ được nhận phòng sớm.

## Chi phí một chuyến tháng 11, tính kiểu người đi thật

Hai người, đi giữa tuần, ở phòng 700.000đ/đêm, đi xe cabin khứ hồi từ Hà Nội (giá khứ hồi các nhà xe trên hệ thống từ 500.000 – 650.000đ/người):

- Tiền phòng mỗi người: 350.000đ/đêm.
- Vé xe khứ hồi: từ 500.000đ.
- Đặt [combo xe + phòng](/combo) thì đa số phòng được trừ thêm 25.000đ/người, tức khoảng **825.000đ/người** cho xe khứ hồi và 1 đêm phòng.

Ăn uống, thuê xe máy (khoảng 180.000đ/ngày), vé vào sống lưng khủng long thì tuỳ người, mình thường để dư 500.000 – 700.000đ cho 2 ngày.

## Mặc gì cho đúng

Tháng 11 chưa phải rét đậm như tháng 1, nhưng đừng coi thường. Mình mặc kiểu nhiều lớp:

- Áo giữ nhiệt bên trong, áo len hoặc nỉ ở giữa, ngoài cùng là áo khoác gió hoặc áo phao mỏng.
- Quần dài dày, tất, giày kín mũi. Đi xe máy buổi sáng thì thêm găng tay, khăn quàng cổ.
- Mũ len cho buổi sáng đi săn mây và buổi tối ngồi ngoài trời.

Trưa nắng lên có thể cởi bớt còn áo mỏng, nên đừng mặc một cái áo phao dày rồi bên trong chỉ có áo cộc. Danh sách đầy đủ hơn ở bài [Tà Xùa mùa đông mặc gì](/kinh-nghiem/ta-xua-mua-dong-lanh-mac-gi).

## Tối lạnh thì làm gì

Trời tối nhanh, khoảng 17h30 đã nhá nhem. Buổi tối tháng 11 hợp nhất với một nồi lẩu hay bếp nướng. Ở Khe Cải có [Tiệm lẩu nướng Trạm Mây](/nha-hang/tiem-lau-nuong-tram-may), set lẩu nướng cho nhóm 2 – 6 người từ 200.000đ.

![Nồi lẩu và đĩa thịt, rau ăn kèm cho bữa tối lạnh ở Tà Xùa](/uploads/1793641171142-24f5b658d23d.jpg)

Không thích ăn nhiều thì ngồi cafe với một cốc cacao nóng. Vài quán ở Đỉnh Gió như [Mây Bay Coffee](/cafe/may-bay-coffee) có đồ ăn nhẹ, ngồi được lâu.

![Cốc cacao nóng với kẹo marshmallow ở Mây Bay Coffee, Đỉnh Gió](/uploads/1793641086710-634c602e6cad.jpg)

Hôm nào trời quang thì tắt đèn ra sân ngắm sao. Trời tháng 11 khô, ít mây đêm nên sao nhìn rõ hơn hẳn mùa hè.

## Vài lưu ý riêng cho tháng 11

- **Đặt phòng thứ 7 sớm ít nhất 1 tuần.** Tháng 11 chưa lễ nhưng cuối tuần vẫn đông vì là đầu mùa mây. Phòng view đẹp, phòng có bồn tắm hết trước.
- **Chọn phòng có sưởi hoặc điều hoà 2 chiều.** Đêm dưới 10 độ mà phòng chỉ có chăn thì khó ngủ. Lúc đặt nhớ xem phần tiện ích của từng phòng.
- **Sáng đi săn mây khoảng 5h30 – 6h**, mặt trời mọc tầm 6h – 6h15. Đi sớm quá thì đứng chờ trong gió lạnh.
- **Ở 2 đêm nếu được.** Một đêm thì chỉ có một buổi sáng để cược với mây, 2 đêm là gấp đôi cơ hội.

## Vậy có đáng không?

Với mình là có. Tháng 11 không phải tháng chắc mây nhất, nhưng là tháng dễ chịu nhất về giá, lượng khách và thời tiết khô ráo. Nếu bạn sợ đông và không muốn trả giá lễ thì đây là lúc nên đi.

Xem [homestay Tà Xùa còn trống theo ngày](/homestay) để chọn đêm còn phòng, hoặc ghép luôn [xe cabin và phòng thành combo](/combo) cho đỡ phải tính. Muốn so với các tháng khác thì có bài [thời tiết Tà Xùa theo tháng](/kinh-nghiem/thoi-tiet-ta-xua-theo-thang).

*Giá phòng, giá vé lấy theo bảng giá các homestay và nhà xe đăng trên Tà Xùa Booking, cập nhật tháng 11/2026; có thể thay đổi, nên xem lại khi đặt. Ảnh trong bài là ảnh thật từ thư viện ảnh của các homestay, quán ở Tà Xùa.*`,
  },
];

async function main() {
  const dry = process.argv.includes("--dry");
  for (const a of ARTICLES) {
    const exists = await prisma.article.findUnique({ where: { slug: a.slug }, select: { id: true } });
    if (exists) {
      if (process.argv.includes("--update")) { await prisma.article.update({ where: { slug: a.slug }, data: { title: a.title, excerpt: a.excerpt, content: a.content, coverImage: a.coverImage, topic: a.topic } }); console.log("đã cập nhật:", a.slug); }
      else console.log("skip (đã có):", a.slug);
      continue;
    }
    if (dry) { console.log("dry:", a.slug, a.content.length, "ký tự"); continue; }
    await prisma.article.create({ data: { ...a, published: true } });
    console.log("đã đăng:", a.slug);
  }
}
if (require.main === module) main().finally(() => prisma.$disconnect());
