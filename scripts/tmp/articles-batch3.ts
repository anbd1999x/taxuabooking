/**
 * Đăng 2 bài "Kinh nghiệm Tà Xùa" (đặt xe + review tổng hợp) + KIỂM KÊ CHẤT LƯỢNG trước khi ghi.
 * Chạy: npx tsx scripts/tmp/articles-batch3.ts        (chỉ kiểm)
 *       npx tsx scripts/tmp/articles-batch3.ts --publish
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

interface Art { slug: string; title: string; excerpt: string; coverImage: string; topic: string; keyword: string; content: string }

const DISCLAIMER = "*Giá và giờ trong bài là mức tham khảo tại thời điểm cập nhật (tháng 11/2026), lấy từ bảng giá các nhà xe và homestay đang mở bán trên Tà Xùa Booking, có thể thay đổi theo mùa và dịp lễ. Giá chính xác từng ngày xem trực tiếp ở trang đặt dịch vụ.*";

const A1: Art = {
  slug: "dat-xe-di-ta-xua",
  title: "Đặt xe đi Tà Xùa: giá vé, giờ chạy và cách đặt chỗ từ A–Z",
  excerpt: "Hướng dẫn đặt xe đi Tà Xùa từ Hà Nội và các tỉnh: giá vé khứ hồi từng điểm đón, giờ xe chạy, cabin đơn hay đôi, cách đặt chỗ online và các lỗi hay gặp.",
  coverImage: "/uploads/1793518540349-3ef221d28de8.jpg",
  topic: "di-chuyen",
  keyword: "đặt xe đi Tà Xùa",
  content: `Muốn đặt xe đi Tà Xùa, câu trả lời ngắn gọn là: phần lớn khách đi **xe giường nằm cabin chạy đêm từ Hà Nội**, vé khứ hồi khoảng 500.000đ đến 650.000đ một người, lên xe lúc 21h đến 22h và có mặt ở Tà Xùa khoảng 6h sáng hôm sau. Bài này gom đủ những gì cần biết trước khi đặt: có những loại xe nào, giá từng điểm đón, giờ chạy, cách đặt chỗ và những lỗi khiến nhiều người lỡ chuyến.

**Tóm tắt nhanh:**

- **Loại xe phổ biến nhất:** xe giường nằm cabin chạy đêm, mỗi khách một khoang riêng có rèm.
- **Giá vé khứ hồi từ Hà Nội:** khoảng 500.000đ đến 650.000đ một người tuỳ nhà xe.
- **Giá từ các tỉnh khác:** khoảng 600.000đ đến 1.050.000đ khứ hồi, đã gồm xe trung chuyển.
- **Giờ chạy:** đi 21h đến 22h, tới Tà Xùa khoảng 6h sáng; về 12h đến 13h, tới Hà Nội khoảng 19h.
- **Đặt ở đâu:** xem chỗ trống theo ngày và gửi yêu cầu ở trang [xe cabin Hà Nội – Tà Xùa](/xe-cabin).
- **Đặt trước bao lâu:** cuối tuần mùa mây nên đặt trước 5 đến 7 ngày, lễ Tết trước 2 đến 3 tuần.

![Xe giường nằm cabin đi Tà Xùa đón khách ban đêm ở Hà Nội](/uploads/1793518540349-3ef221d28de8.jpg)

## Đi Tà Xùa bằng xe gì? So sánh nhanh 4 cách

Tà Xùa thuộc tỉnh Sơn La, cách Hà Nội khoảng 240 km, đoạn cuối là khoảng 15 km đèo dốc từ Bắc Yên lên trung tâm xã. Có bốn cách đi chính:

- **Xe giường nằm cabin chạy đêm:** ngủ một giấc là tới, không mất ngày phép, không phải tự lái đèo. Đây là lựa chọn của đa số khách đi 2 ngày 1 đêm.
- **Xe khách ban ngày tới Bắc Yên:** rẻ hơn một chút nhưng mất trọn một ngày ngồi xe, tới nơi còn phải tự tìm xe lên Tà Xùa.
- **Ô tô tự lái:** chủ động giờ giấc, hợp với gia đình có trẻ nhỏ. Người lái cần quen đường đèo và sương mù.
- **Xe máy phượt từ Hà Nội:** chỉ hợp với người đã chạy đường dài nhiều lần, mất khoảng 6 đến 7 tiếng và khá mệt.

Nếu đây là lần đầu, hoặc bạn không muốn lái xe đường núi ban đêm, xe cabin là cách an toàn và nhàn nhất. Chi tiết từng tuyến đường tự lái có ở bài [đường đi Tà Xùa từ Hà Nội](/kinh-nghiem/duong-di-ta-xua-tu-ha-noi).

## Giá vé khi đặt xe đi Tà Xùa là bao nhiêu?

Bảng giá dưới đây là **vé khứ hồi một người, cabin đơn**, tổng hợp từ 5 nhà xe đang mở bán trên Tà Xùa Booking (Khánh Châu, Thành Mỹ, Xuân Trường, Tiến Thành, Quang Nghĩa):

- **Hà Nội:** 500.000đ đến 650.000đ
- **Sân bay Nội Bài:** khoảng 800.000đ
- **Vĩnh Phúc:** khoảng 600.000đ
- **Thái Nguyên:** khoảng 700.000đ
- **Bắc Ninh, Hưng Yên:** 700.000đ đến 1.000.000đ
- **Bắc Giang, Hải Dương:** 800.000đ đến 1.000.000đ
- **Hà Nam, Ninh Bình:** 850.000đ đến 1.000.000đ
- **Thái Bình:** 900.000đ đến 950.000đ
- **Hải Phòng, Quảng Ninh:** 950.000đ đến 1.050.000đ
- **Nam Định:** khoảng 1.000.000đ

Giá từ các tỉnh cao hơn Hà Nội vì đã gồm **xe trung chuyển** đưa bạn về điểm tập kết để lên xe cabin. Mỗi nhà xe chỉ đón một số tỉnh nhất định, nên cùng một điểm đón có thể chỉ có một hoặc hai nhà xe phục vụ. Danh sách điểm đón cụ thể xem ở bài [xe cabin đi Tà Xùa đón ở đâu](/kinh-nghiem/diem-don-xe-cabin-cac-tinh).

Vé một chiều thường bằng khoảng một nửa vé khứ hồi. Cabin đôi (hai người nằm chung một khoang rộng) có giá riêng, hiển thị khi bạn chọn ngày.

## Xe chạy giờ nào, mất bao lâu?

Lịch chạy của các nhà xe khá giống nhau:

- **Chiều đi:** xe rời Hà Nội khoảng 21h đến 22h. Khoảng 4h sáng xe tới khu vực Bắc Yên, khách chuyển sang xe nhỏ để lên đèo, và tới trung tâm Tà Xùa khoảng 6h sáng.
- **Chiều về:** xe rời Tà Xùa khoảng 12h đến 13h, về tới Hà Nội khoảng 19h.

Giờ tới 6h sáng trùng với khung giờ săn mây đẹp nhất, nhưng phòng homestay thường 14h mới nhận. Khoảng trống này nên làm gì thì xem bài [xuống xe đêm ở Tà Xùa lúc 6h sáng](/kinh-nghiem/xuong-xe-dem-ta-xua-sang-som-lam-gi).

Một điểm nhiều người hiểu sai: **ngày đi là đêm bạn lên xe**, còn ngày nhận phòng là sáng hôm sau. Ví dụ lên xe tối thứ Sáu thì nhận phòng thứ Bảy, về trưa Chủ nhật là trọn lịch 2 ngày 1 đêm.

![Bên trong khoang cabin riêng có chăn gối và rèm che trên xe đi Tà Xùa](/uploads/1793442945574-3636c341eef1.jpg)

## Cabin đơn hay cabin đôi, nằm tầng nào?

- **Cabin đơn:** một người một khoang, có rèm kín, chăn gối, cửa gió điều hoà. Hợp với người đi một mình hoặc nhóm bạn muốn ngủ riêng.
- **Cabin đôi:** khoang rộng cho hai người nằm chung, hợp với cặp đôi hoặc mẹ đi cùng con nhỏ.
- **Tầng dưới:** ít lắc hơn khi vào cua, lên xuống dễ, nên chọn nếu bạn hay say xe.
- **Tầng trên:** riêng tư hơn, ít người đi qua, nhưng lắc hơn ở đoạn đèo.

Người dễ say nên chọn khoang ở giữa xe, tầng dưới, và đọc thêm [mẹo chống say xe đèo lên Tà Xùa](/kinh-nghiem/meo-chong-say-xe-deo-ta-xua). Trải nghiệm thực tế một đêm trên xe có ở bài [một đêm trên xe cabin đi Tà Xùa](/kinh-nghiem/trai-nghiem-xe-cabin-di-ta-xua).

## Các bước đặt xe đi Tà Xùa online

Tà Xùa Booking (taxuabooking.com) là website đặt xe cabin, homestay và combo đi Tà Xùa, cho xem giá và chỗ trống theo từng ngày. Đặt xe gồm 4 bước:

1. Mở trang [xe cabin](/xe-cabin), chọn **ngày đi** và **ngày về**.
2. Xem danh sách nhà xe còn chỗ kèm giá vé, bấm vào nhà xe muốn đi.
3. Chọn số vé cabin đơn hoặc đôi cho từng chiều, chọn điểm đón và điểm trả.
4. Điền tên, số điện thoại rồi gửi yêu cầu. Một yêu cầu gồm cả chiều đi lẫn chiều về.

Website không thu tiền online. Sau khi gửi yêu cầu, bạn được liên hệ để xác nhận chỗ và hướng dẫn đặt cọc. Mã đơn dùng để xem lại tình trạng ở trang [tra cứu đơn](/tra-cuu). Đơn chưa đặt cọc chỉ được giữ trong thời gian ngắn, nên khi đã chốt lịch thì đừng để quá lâu.

## Đặt xe kèm phòng: khi nào nên chọn combo?

Nếu bạn cần cả xe lẫn chỗ ở, hãy thử trang [combo xe cabin + homestay](/combo). Bạn nhập điểm xuất phát, ngày đi, ngày về, số người và mức giá mong muốn; hệ thống ghép sẵn vé khứ hồi với phòng còn trống đúng những ngày đó và tính ra giá trọn gói cho mỗi người.

Combo rẻ hơn đặt lẻ 25.000đ mỗi người, nhưng lợi ích chính là **không bị lệch ngày**: phòng tự động tính từ sáng hôm sau đêm lên xe. Đoàn đông cũng được gợi ý sẵn cách chia phòng. Xem thêm bài [combo xe cabin + homestay Tà Xùa](/kinh-nghiem/combo-xe-cabin-homestay-ta-xua).

## 6 lỗi hay gặp khi đặt xe

- **Đặt sát ngày vào cuối tuần mùa mây.** Tháng 11 đến tháng 3 các chuyến tối thứ Sáu hết chỗ rất sớm.
- **Nhầm ngày đi với ngày nhận phòng.** Lên xe tối nào thì phòng tính từ sáng hôm sau.
- **Không hỏi rõ điểm đón.** Ở Hà Nội mỗi nhà xe có điểm đón riêng; ở tỉnh, giờ xe trung chuyển tới sớm hơn giờ xe cabin chạy.
- **Chỉ đặt chiều đi.** Chiều về trưa Chủ nhật thường hết chỗ trước, nên đặt khứ hồi ngay từ đầu.
- **Mang vali quá to.** Khoang cabin để vừa balo và vali nhỏ; đồ cồng kềnh phải gửi dưới gầm xe.
- **Không lưu số nhà xe.** Lưu số điện thoại để gọi khi xe trung chuyển tới trễ hoặc bạn tới điểm đón muộn.

## Tới Tà Xùa rồi đi lại bằng gì?

Xe cabin chỉ đưa bạn tới trung tâm. Để tới các điểm săn mây, bạn có ba lựa chọn:

- **Thuê xe máy:** từ khoảng 180.000đ một ngày, hợp với người lái vững. Xem bài [thuê xe máy ở Tà Xùa](/kinh-nghiem/thue-xe-may-ta-xua).
- **Xe ôm bản địa:** nên dùng cho các điểm đường đất dốc như Mỏm cá heo, Sống lưng khủng long.
- **Taxi, xe 7 chỗ:** hợp với nhóm có người lớn tuổi hoặc trẻ nhỏ. Xem bài [xe ôm và taxi ở Tà Xùa](/kinh-nghiem/xe-om-taxi-ta-xua).

Vị trí các điểm và đường đi từng ngày có trên [bản đồ vệ tinh Tà Xùa](/ban-do).

${DISCLAIMER}

## Câu hỏi thường gặp

### Đặt xe đi Tà Xùa trước bao lâu là vừa?

Ngày thường đặt trước 1 đến 2 ngày vẫn có chỗ. Cuối tuần trong mùa mây (tháng 11 đến tháng 3) nên đặt trước 5 đến 7 ngày, dịp lễ Tết nên đặt trước 2 đến 3 tuần.

### Vé xe cabin Hà Nội đi Tà Xùa bao nhiêu tiền?

Vé khứ hồi cabin đơn từ Hà Nội khoảng 500.000đ đến 650.000đ một người tuỳ nhà xe. Vé một chiều bằng khoảng một nửa.

### Ở tỉnh khác có đặt xe đi Tà Xùa được không?

Được. Các nhà xe có xe trung chuyển đón ở Bắc Ninh, Bắc Giang, Hải Dương, Hải Phòng, Hưng Yên, Thái Bình, Nam Định, Ninh Bình, Hà Nam, Thái Nguyên, Quảng Ninh, Vĩnh Phúc và sân bay Nội Bài. Giá khứ hồi khoảng 600.000đ đến 1.050.000đ.

### Xe có đưa lên tận trung tâm Tà Xùa không?

Có. Xe cabin lớn dừng ở khu vực Bắc Yên, khách chuyển sang xe nhỏ đi nốt khoảng 15 km đèo lên trung tâm Tà Xùa. Chặng trung chuyển này đã nằm trong lịch chạy của nhà xe.

### Có phải thanh toán online khi đặt không?

Không. Bạn gửi yêu cầu đặt chỗ trên website, sau đó được liên hệ xác nhận và hướng dẫn đặt cọc bằng chuyển khoản. Không có bước nhập thẻ hay ví điện tử.

### Trẻ em đi xe cabin có phải mua vé không?

Trẻ nhỏ nằm chung khoang với bố mẹ thường không cần vé riêng, nhưng mỗi nhà xe quy định độ tuổi khác nhau. Hãy ghi rõ số trẻ và tuổi vào ghi chú khi đặt để được báo chính xác.

## Bắt đầu đặt chỗ

- Xem chỗ trống và giá theo ngày ở trang [xe cabin Hà Nội – Tà Xùa](/xe-cabin).
- Cần cả phòng: tìm [combo xe + homestay](/combo) theo ngân sách.
- Chưa có lịch: tham khảo [lịch trình Tà Xùa theo từng giờ](/lich-trinh).
- Lần đầu đi: đọc [kinh nghiệm du lịch Tà Xùa từ A–Z](/kinh-nghiem/kinh-nghiem-du-lich-ta-xua-tu-a-z).
`,
};

const A2: Art = {
  slug: "review-ta-xua-tat-tan-tat",
  title: "Review Tà Xùa tất tần tật 2026–2027: đi, ở, ăn, chơi, chi phí",
  excerpt: "Review Tà Xùa đầy đủ cho người đi lần đầu: mùa nào có mây, đi xe gì, ở khu nào, 13 điểm check-in, ăn gì, chi phí 2 ngày 1 đêm và những điểm trừ nên biết trước.",
  coverImage: "/uploads/1794461285231-5449d3ea20d0.jpg",
  topic: "cam-nang",
  keyword: "review Tà Xùa",
  content: `Bài review Tà Xùa này viết cho người đang tìm hiểu trước chuyến đi và muốn có một câu trả lời thẳng: Tà Xùa có đáng đi không, đi thế nào, ở đâu, tốn bao nhiêu. Nói ngắn gọn, Tà Xùa là điểm săn mây nổi tiếng nhất miền Bắc, hợp với chuyến 2 ngày 1 đêm từ Hà Nội, chi phí khoảng 1,5 đến 2,5 triệu đồng một người. Cảnh đẹp thật, nhưng mây không phải hôm nào cũng có và đường đèo không dành cho người lái yếu.

**Tóm tắt nhanh:**

- **Tà Xùa ở đâu:** xã vùng cao thuộc tỉnh Sơn La (địa bàn huyện Bắc Yên cũ), cách Hà Nội khoảng 240 km.
- **Nổi tiếng vì:** biển mây, Sống lưng khủng long, Mỏm cá heo, Cây cô đơn, trà Shan tuyết cổ thụ.
- **Mùa đẹp nhất:** tháng 11 đến tháng 3 là mùa mây; mùa hè mát, vắng khách.
- **Đi bằng gì:** xe giường nằm cabin chạy đêm, vé khứ hồi từ Hà Nội khoảng 500.000đ đến 650.000đ.
- **Ở đâu:** homestay, giá phòng phổ biến 650.000đ đến 1.000.000đ một đêm.
- **Đi mấy ngày:** 2 ngày 1 đêm là vừa, 3 ngày 2 đêm thì thong thả.
- **Đặt dịch vụ:** [xe cabin](/xe-cabin), [homestay](/homestay) hoặc [combo xe + phòng](/combo) trên Tà Xùa Booking.

![Thác mây tràn qua sườn núi nhìn từ quán cà phê trên Đỉnh Gió Tà Xùa](/uploads/1794461285231-5449d3ea20d0.jpg)

## Tà Xùa ở đâu, có gì mà nhiều người đi?

Tà Xùa là một xã vùng cao của tỉnh Sơn La, nằm trên dãy núi cùng tên, phần lớn dân bản địa là người Mông. Từ Hà Nội lên khoảng 240 km; từ Bắc Yên còn khoảng 15 km đèo dốc nữa mới tới trung tâm xã. Chi tiết quãng đường có ở bài [Tà Xùa ở đâu, cách Hà Nội bao nhiêu km](/kinh-nghiem/ta-xua-o-dau-cach-ha-noi-bao-nhieu-km).

Lý do chính khiến người ta lên đây là **biển mây**. Vào những sáng đủ điều kiện, mây lấp đầy thung lũng phía dưới, các sống núi nổi lên như đảo. Ngoài mây, Tà Xùa có những quả đồi cỏ, sống núi hẹp để đi bộ, rừng chè Shan tuyết cổ thụ và nhịp sống bản làng còn khá nguyên vẹn.

## Review Tà Xùa theo mùa: tháng nào nên đi?

- **Tháng 11 đến tháng 3 (mùa mây):** khả năng gặp biển mây cao nhất, trời lạnh, có hôm dưới 5 độ. Cuối tuần và dịp Tết rất đông, giá phòng cao hơn.
- **Tháng 12 đến tháng 2 (mùa hoa):** hoa tớ dày, hoa mận, hoa đào lần lượt nở. Xem bài [mùa hoa Tà Xùa](/kinh-nghiem/mua-hoa-ta-xua).
- **Tháng 4 đến tháng 5:** trời ấm dần, vẫn có những đợt mây sau mưa, khách thưa hơn.
- **Tháng 6 đến tháng 8:** mát khoảng 20 độ, vắng, giá mềm, nhưng hay mưa rào và đường trơn.
- **Tháng 9 đến tháng 10:** lúa chín ở Xím Vàng, đầu mùa mây.

Điều cần nói thật: **không ai đảm bảo được mây**. Mây phụ thuộc độ ẩm, gió và nhiệt độ từng đêm. Muốn tăng cơ hội, hãy ở lại ít nhất một đêm để có hai buổi sáng. Xem thêm [Tà Xùa mùa nào đẹp nhất](/kinh-nghiem/ta-xua-mua-nao-dep-nhat) và [săn mây hụt thì làm gì](/kinh-nghiem/san-may-hut-o-ta-xua-lam-gi).

## Đi Tà Xùa bằng gì?

Đa số khách đi **xe giường nằm cabin chạy đêm**: lên xe ở Hà Nội khoảng 21h đến 22h, tới Tà Xùa khoảng 6h sáng; chiều về xe chạy khoảng 12h đến 13h, tới Hà Nội khoảng 19h. Vé khứ hồi cabin đơn từ Hà Nội khoảng 500.000đ đến 650.000đ, từ các tỉnh lân cận khoảng 600.000đ đến 1.050.000đ đã gồm xe trung chuyển.

Ô tô tự lái và xe máy phượt cũng đi được, nhưng 15 km đèo cuối có nhiều cua gấp và hay có sương mù. Giá từng điểm đón, cách chọn khoang và các bước đặt chỗ có trong bài [đặt xe đi Tà Xùa](/kinh-nghiem/dat-xe-di-ta-xua).

## Ở đâu? Review các khu homestay

Tà Xùa không có khách sạn lớn; chỗ ở chủ yếu là homestay và bungalow. Trên Tà Xùa Booking hiện có hơn 30 cơ sở, chia theo các khu:

- **Trung tâm Tà Xùa:** gần chợ, quán ăn, điểm xe đỗ. Tiện nhất cho người đi lần đầu, người lớn tuổi, trẻ nhỏ.
- **Đỉnh Gió:** cao và thoáng, nhiều phòng nhìn thẳng ra biển mây, gió mạnh và lạnh hơn.
- **Khe Cải:** yên tĩnh, view thung lũng, vài đoạn đường xuống hẹp.
- **Mống Vàng, Chung Trinh:** xa trung tâm hơn, hợp với người thích vắng.

Về giá, phòng riêng phổ biến ở mức **650.000đ đến 1.000.000đ một đêm**; giường phòng cộng đồng từ khoảng 150.000đ một người; phòng có bồn tắm hoặc view mây đẹp có thể tới khoảng 2.200.000đ. Thứ Bảy và dịp lễ giá cao hơn ngày thường.

![Phòng homestay Tà Xùa có vách kính nhìn thẳng ra biển mây](/uploads/1793637189999-1ef26ce29264.jpg)

Chọn khu nào xem bài [ở Tà Xùa nên chọn khu nào](/kinh-nghiem/o-ta-xua-nen-chon-khu-nao); chuyện đặt cọc và giữ phòng xem bài [kinh nghiệm đặt phòng homestay Tà Xùa](/kinh-nghiem/kinh-nghiem-dat-phong-homestay-ta-xua).

## Chơi gì? Những điểm check-in đáng đi

- **Sống lưng khủng long:** sống núi hẹp hai bên là vực, cách trung tâm khoảng 12 km, vé khoảng 20.000đ, đẹp nhất 6h đến 10h. Không đi khi mưa hoặc gió to.
- **Mỏm cá heo:** mỏm đá nhô ra giữa biển mây, vé khoảng 20.000đ, đoạn cuối đường đất dốc.
- **Cây cô đơn và Lán cô đơn:** muốn có ảnh vắng người phải tới trước 6h.
- **Thảo nguyên Tà Xùa:** đồi cỏ thoải, có chỗ thuê lều ngủ lại ngắm sao.
- **Đỉnh Gió, Panorama Coffee, Hẻm Mây, Thác Mây:** cụm quán cà phê săn mây gần trung tâm nhất.
- **Núi đôi thiếu nữ:** điểm mới, vé khoảng 30.000đ đến 40.000đ.
- **Amei Hill (Khe Cải):** đồi nhiều tiểu cảnh, cuối tuần đông.
- **Tiệm trà, xưởng nhuộm chàm:** hợp với lúc mây đã tan.

Các điểm chia thành nhiều cụm ở các hướng khác nhau, mỗi buổi sáng chỉ nên đi một cụm. Thứ tự đi hợp lý có trong bài [bản đồ du lịch Tà Xùa](/kinh-nghiem/ban-do-du-lich-ta-xua-diem-check-in) và trên [bản đồ vệ tinh](/ban-do).

## Ăn gì ở Tà Xùa?

Đồ ăn ở đây đơn giản, thiên về món vùng cao: gà đen, lợn bản, cá suối, rau cải mèo, măng, lẩu và đồ nướng buổi tối. Nhiều homestay nhận nấu lẩu hoặc BBQ ngay tại chỗ nếu báo trước. Buổi sáng có phở, bún, bánh mì quanh khu trung tâm. Đặc sản mang về là trà Shan tuyết, táo mèo và mật ong. Gợi ý cụ thể có ở bài [ăn gì ở Tà Xùa](/kinh-nghiem/an-gi-o-ta-xua).

## Chi phí đi Tà Xùa 2 ngày 1 đêm

Ước tính cho một người, đi nhóm 2 người, xuất phát từ Hà Nội:

- **Xe cabin khứ hồi:** 500.000đ đến 650.000đ
- **Phòng (chia đôi):** 325.000đ đến 500.000đ
- **Ăn uống, cà phê:** 400.000đ đến 600.000đ
- **Thuê xe máy, xăng, xe ôm vào điểm khó:** 150.000đ đến 300.000đ
- **Vé các điểm check-in:** 50.000đ đến 100.000đ

**Tổng khoảng 1.500.000đ đến 2.200.000đ một người.** Ở giường cộng đồng và ăn đơn giản thì thấp hơn; chọn phòng có bồn tắm view mây hoặc đi dịp lễ thì cao hơn. Lịch đi theo từng giờ xem ở trang [lịch trình Tà Xùa](/lich-trinh).

## Điểm trừ của Tà Xùa nên biết trước

Một bài review Tà Xùa tử tế phải nói cả mặt chưa hay:

- **Mây thất thường.** Có đoàn lên hai ngày chỉ gặp sương trắng xoá.
- **Đường đèo dốc và nhiều sương.** Người lái yếu không nên tự chạy xe máy.
- **Lạnh và ẩm vào mùa đông.** Quần áo phơi không khô, cần áo ấm dày và giày kín.
- **Cuối tuần mùa mây rất đông.** Điểm chụp ảnh phải xếp hàng, phòng đẹp hết sớm.
- **Dịch vụ còn giản dị.** Ít máy rút tiền, nên mang tiền mặt và sạc dự phòng.
- **Tới sớm, nhận phòng muộn.** Xe tới khoảng 6h nhưng 14h mới nhận phòng.

## Tà Xùa hợp với ai, không hợp với ai?

**Hợp:** người thích núi, thích chụp ảnh, nhóm bạn, cặp đôi, dân văn phòng chỉ có hai ngày cuối tuần. **Cần cân nhắc:** gia đình có trẻ dưới 3 tuổi, người có vấn đề tim mạch hoặc xương khớp, người mong đợi dịch vụ kiểu khu nghỉ dưỡng. Đi cùng bố mẹ lớn tuổi vẫn được nếu ở khu trung tâm và dùng taxi; xem bài [đưa bố mẹ đi Tà Xùa](/kinh-nghiem/du-lich-ta-xua-cho-bo-me).

## Đặt xe, đặt phòng Tà Xùa ở đâu?

Tà Xùa Booking (taxuabooking.com) là website đặt dịch vụ riêng cho Tà Xùa: xe cabin, homestay và combo xe kèm phòng. Bạn chọn ngày là thấy giá và chỗ còn trống, gửi yêu cầu đặt, sau đó được liên hệ xác nhận và hướng dẫn đặt cọc. Website không thu tiền online. Mã đơn dùng để xem lại ở trang [tra cứu đơn](/tra-cuu). Hotline hỗ trợ: 0357 452 952.

${DISCLAIMER}

## Câu hỏi thường gặp

### Tà Xùa có đáng đi không?

Đáng, nếu bạn thích cảnh núi và chấp nhận rằng mây là chuyện may rủi. Ngay cả hôm không có biển mây, đồi cỏ, sống núi và bản làng vẫn đủ cho một chuyến hai ngày.

### Đi Tà Xùa mấy ngày là đủ?

2 ngày 1 đêm là đủ cho các điểm chính. 3 ngày 2 đêm cho bạn thêm một buổi sáng săn mây và thời gian đi Xím Vàng hoặc nghỉ ngơi.

### Đi Tà Xùa hết bao nhiêu tiền?

Khoảng 1.500.000đ đến 2.200.000đ một người cho 2 ngày 1 đêm từ Hà Nội, gồm xe cabin khứ hồi, phòng chia đôi, ăn uống và đi lại tại chỗ.

### Tháng nào đi Tà Xùa có mây?

Mùa mây kéo dài từ khoảng tháng 11 đến tháng 3, nhiều nhất từ tháng 12 đến tháng 3. Các tháng khác vẫn có mây sau những đợt mưa nhưng thưa hơn.

### Tà Xùa có nguy hiểm không?

Không nguy hiểm nếu đi xe cabin, không tự lái đèo khi chưa quen và không ra Sống lưng khủng long lúc mưa gió. Xem bài [đi Tà Xùa có nguy hiểm không](/kinh-nghiem/di-ta-xua-co-nguy-hiem-khong).

### Nên đặt xe và phòng riêng hay đặt combo?

Nếu cần cả hai, combo tiện hơn vì ngày xe và ngày phòng được ghép khớp sẵn, giá mỗi người rẻ hơn đặt lẻ 25.000đ. Nếu đã có xe riêng thì chỉ cần đặt phòng.

## Lên kế hoạch ngay

- Xem chỗ trống [xe cabin Hà Nội – Tà Xùa](/xe-cabin) theo ngày bạn định đi.
- Lọc [homestay Tà Xùa](/homestay) theo ngày và khoảng giá.
- Tìm [combo xe + phòng](/combo) theo ngân sách.
- Đọc bản đầy đủ hơn: [kinh nghiệm du lịch Tà Xùa từ A–Z](/kinh-nghiem/kinh-nghiem-du-lich-ta-xua-tu-a-z).
`,
};

const ARTS = [A1, A2];
const SITE = "https://taxuabooking.com";
const norm = (s: string) => s.toLowerCase().normalize("NFC");

async function main() {
  const publish = process.argv.includes("--publish");
  const existing = await prisma.article.findMany({ select: { slug: true, title: true } });
  const slugs = new Set([...existing.map((a) => a.slug), ...ARTS.map((a) => a.slug)]);
  let allOk = true;
  for (const a of ARTS) {
    const text = a.content;
    const plain = text.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\]\([^)]*\)/g, "]").replace(/[#*\[\]>`_-]/g, " ");
    const words = plain.split(/\s+/).filter(Boolean).length;
    const h2 = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    const h3 = [...text.matchAll(/^### (.+)$/gm)].length;
    const first = norm(plain.split(/\s+/).slice(0, 110).join(" "));
    const artLinks = [...text.matchAll(/\]\(\/kinh-nghiem\/([a-z0-9-]+)\)/g)].map((m) => m[1]);
    const pageLinks = [...new Set([...text.matchAll(/\]\((\/[a-z-]*)\)/g)].map((m) => m[1]))];
    const imgs = [...text.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map((m) => ({ alt: m[1], src: m[2] }));
    const kwCount = norm(plain).split(norm(a.keyword)).length - 1;
    const status = async (p: string) => { try { return (await fetch(SITE + p, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(20000) })).status; } catch { return 0; } };
    const imgStatus = await Promise.all([a.coverImage, ...imgs.map((i) => i.src)].map(status));
    const pageStatus = await Promise.all(pageLinks.map(status));
    const paras = text.split(/\n\n+/).filter((p) => !/^[#!\-*0-9]/.test(p.trim()));
    const longest = Math.max(...paras.map((p) => p.split(/\s+/).length));
    const dupTitle = existing.some((e) => e.slug !== a.slug && norm(e.title) === norm(a.title));
    const checks: [string, boolean, string][] = [
      ["Tiêu đề 45–65 ký tự", a.title.length >= 45 && a.title.length <= 65, `${a.title.length}`],
      ["Mô tả 130–165 ký tự", a.excerpt.length >= 130 && a.excerpt.length <= 165, `${a.excerpt.length}`],
      ["Từ khoá chính trong tiêu đề", norm(a.title).includes(norm(a.keyword)), a.keyword],
      ["Từ khoá chính trong mô tả", norm(a.excerpt).includes(norm(a.keyword)), ""],
      ["Từ khoá chính trong 100 từ đầu", first.includes(norm(a.keyword)), ""],
      ["Từ khoá chính trong ít nhất 1 tiêu đề mục", h2.some((h) => norm(h).includes(norm(a.keyword))), ""],
      ["Từ khoá xuất hiện 3–12 lần (không nhồi)", kwCount >= 3 && kwCount <= 12, `${kwCount}`],
      ["Độ dài ≥ 1.200 từ", words >= 1200, `${words}`],
      ["≥ 6 mục lớn (H2)", h2.length >= 6, `${h2.length}`],
      ["Có khối tóm tắt nhanh ở đầu", text.includes("**Tóm tắt nhanh:**"), ""],
      ["Có mục Câu hỏi thường gặp ≥ 3 câu", text.includes("## Câu hỏi thường gặp") && h3 >= 3, `${h3} H3`],
      ["≥ 5 link tới bài khác, mọi link đều tồn tại", new Set(artLinks).size >= 5 && artLinks.every((s) => slugs.has(s)), `${new Set(artLinks).size} bài; thiếu: ${[...new Set(artLinks.filter((s) => !slugs.has(s)))].join(",") || "không"}`],
      ["Link tới trang dịch vụ đều mở được (200)", pageLinks.length >= 2 && pageStatus.every((s) => s === 200), pageLinks.map((p, i) => `${p}:${pageStatus[i]}`).join(" ")],
      ["≥ 2 ảnh trong bài, có mô tả ảnh", imgs.length >= 2 && imgs.every((i) => i.alt.length >= 15), `${imgs.length}`],
      ["Ảnh bìa và ảnh trong bài tải được (200)", imgStatus.every((s) => s === 200), imgStatus.join(",")],
      ["Đoạn văn dài nhất ≤ 110 từ", longest <= 110, `${longest}`],
      ["Không trùng đường dẫn/tiêu đề bài khác", !dupTitle && existing.filter((e) => e.slug === a.slug).length <= 1, ""],
      ["Không dùng 'tụi mình' / gạch dài", !/tụi mình|—/.test(text + a.title + a.excerpt), ""],
      ["Có ghi chú giá tham khảo khi bài nêu giá", !/\d{2,3}\.000đ/.test(text) || text.includes("mức tham khảo"), ""],
    ];
    console.log(`\n=== ${a.slug}\n    ${a.title}`);
    for (const [name, ok, info] of checks) { console.log(`  ${ok ? "ĐẠT " : "LỖI "} ${name}${info ? `  [${info}]` : ""}`); if (!ok) allOk = false; }
  }
  if (!allOk) { console.log("\nCÓ MỤC CHƯA ĐẠT ⇒ không ghi bài nào."); return; }
  if (!publish) { console.log("\nTất cả đạt. Chạy lại với --publish để đăng."); return; }
  for (const a of ARTS) {
    const r = await prisma.article.upsert({
      where: { slug: a.slug },
      create: { slug: a.slug, title: a.title, excerpt: a.excerpt, content: a.content, coverImage: a.coverImage, topic: a.topic, published: true },
      update: { title: a.title, excerpt: a.excerpt, content: a.content, coverImage: a.coverImage, topic: a.topic },
    });
    console.log("ĐÃ ĐĂNG", r.slug);
  }
}
main().finally(() => prisma.$disconnect());
