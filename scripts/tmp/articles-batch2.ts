/**
 * Đăng 3 bài "Kinh nghiệm Tà Xùa" + KIỂM KÊ CHẤT LƯỢNG trước khi ghi. Có mục nào không đạt ⇒ không ghi bài nào.
 * Chạy: npx tsx scripts/tmp/articles-batch2.ts        (chỉ kiểm)
 *       npx tsx scripts/tmp/articles-batch2.ts --publish
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

interface Art { slug: string; title: string; excerpt: string; coverImage: string; topic: string; keyword: string; content: string }

const DISCLAIMER = "*Giá và giờ trong bài là mức tham khảo tại thời điểm cập nhật (tháng 11/2026), có thể thay đổi theo mùa và dịp lễ. Giá chính xác từng ngày xem trực tiếp ở trang đặt dịch vụ.*";

const A1: Art = {
  slug: "ban-do-du-lich-ta-xua-diem-check-in",
  title: "Bản đồ du lịch Tà Xùa: 13 điểm check-in và thứ tự nên đi",
  excerpt: "Bản đồ du lịch Tà Xùa chia theo 5 khu: điểm nào sát trung tâm, điểm nào phải đi cả buổi, vé bao nhiêu, giờ nào đẹp và nên gom điểm nào vào cùng một buổi.",
  coverImage: "/uploads/1794459485872-92ece395bfbc.jpg",
  topic: "diem-den",
  keyword: "bản đồ du lịch Tà Xùa",
  content: `Lần đầu mở bản đồ du lịch Tà Xùa, phần lớn mọi người mắc cùng một lỗi: thấy các điểm check-in nằm gần nhau trên màn hình nên xếp tất cả vào một buổi sáng. Thực tế các điểm chia thành những cụm nằm ở các hướng khác nhau, nối với nhau bằng đường đèo, và có cụm phải đi mất cả buổi. Bài này xếp 13 điểm check-in theo từng khu, kèm vé, giờ đẹp và cách gom điểm để không chạy đi chạy lại.

**Tóm tắt nhanh:**

- **Sát trung tâm, đi được trong 1 buổi:** Panorama Coffee, Hẻm Mây, Núi đôi thiếu nữ, Thác Mây (Đỉnh Gió), Amei Hill (Khe Cải), tiệm trà Kiên Nông Dân, xưởng Nhuộm Chàm.
- **Cụm phía đông, nên dành riêng 1 buổi sáng:** Thảo nguyên Tà Xùa, Mỏm cá heo, Cây cô đơn, Lán cô đơn.
- **Xa, đi riêng:** Sống lưng khủng long (khoảng 12 km), Trạm Mâm Xôi ở Xím Vàng (khoảng 15 km, chỉ đẹp mùa lúa).
- **Xem vị trí thật:** [bản đồ vệ tinh các điểm check-in](/ban-do) có đường đi từng ngày theo lịch trình.

![Mỏm cá heo nhô ra giữa biển mây Tà Xùa](/uploads/1794459485872-92ece395bfbc.jpg)

## Đọc bản đồ du lịch Tà Xùa thế nào cho đúng?

Mốc để tính mọi khoảng cách là **trung tâm xã Tà Xùa**, nơi có chợ, phần lớn homestay và quán ăn. Từ thị trấn Bắc Yên, nơi xe cabin dừng, lên tới đây là khoảng 15 km đường đèo. Từ trung tâm, các điểm check-in toả ra ba hướng chính:

- **Hướng tây và tây bắc (Đỉnh Gió, Làng Văn Hoá):** gần nhất, đường nhựa, toàn quán cà phê ngắm mây.
- **Hướng tây nam (Khe Cải):** sát trung tâm nhưng đường xuống vài điểm khá hẹp.
- **Hướng đông và đông bắc:** nơi có những cái tên nổi tiếng nhất, cũng là nơi tốn thời gian di chuyển nhất.

Hai điều nên nhớ khi xem bản đồ du lịch Tà Xùa. Một là khoảng cách đường chim bay ở vùng núi gần như vô nghĩa: hai điểm cách nhau 2 km trên bản đồ có thể mất 20 phút chạy xe vì phải vòng theo sườn núi. Hai là giờ đẹp của các điểm săn mây đều rơi vào khoảng 5h30 đến 9h sáng, nên mỗi sáng bạn chỉ kịp đi trọn **một cụm**.

## Khu 1: Đỉnh Gió và Làng Văn Hoá, gần trung tâm nhất

Đây là khu dành cho buổi sáng đầu tiên, khi vừa xuống xe còn mệt, hoặc cho buổi chiều ngắm hoàng hôn.

- **Panorama Coffee:** cách trung tâm khoảng 1,5 đến 2 km, là điểm săn mây gần nhất. Buổi sáng 5h30 đến 9h đông người đứng chờ mây, chiều lại là chỗ ngắm hoàng hôn. Không mất vé, chỉ cần gọi đồ uống.
- **Hẻm Mây:** nằm ngay gần Panorama, tiện ghé cùng lúc.
- **Núi đôi thiếu nữ:** điểm mới, lối vào phía sau quán Cafe Làng Văn Hoá. Có thu vé, khoảng 30.000đ nếu đi bộ và 40.000đ nếu đi xe ôm vào. Đi được cả sáng lẫn chiều, trời quang buổi tối còn ngắm được dải ngân hà.
- **Thác Mây (Khèn Coffee):** quán cà phê trên Đỉnh Gió, những hôm mây tràn qua sườn núi nhìn như một dòng thác trắng.

Cả bốn điểm nằm cùng một hướng nên đi liền một mạch được. Xem thêm bài [Đỉnh Gió Tà Xùa](/kinh-nghiem/dinh-gio-ta-xua) và [cà phê săn mây theo từng khu](/kinh-nghiem/quan-ca-phe-san-may-ta-xua-theo-khu).

## Khu 2: Khe Cải và quanh trung tâm

- **Amei Hill:** đồi check-in ở Khe Cải với nhiều tiểu cảnh. Đường xuống hẹp và dốc, tay lái yếu nên thuê xe ôm bản địa chở. Điểm này thường đông, đi giữa tuần sẽ dễ chụp hơn.
- **Tiệm trà Kiên Nông Dân:** cách trung tâm chưa tới 1 km, ghé uống trà Shan tuyết và mua trà mang về. Hợp với buổi sáng ngày cuối trước khi lên xe.
- **Xưởng Nhuộm Chàm Tà Xùa:** xem cách người Mông nhuộm vải chàm, hợp với khung giờ giữa buổi khi mây đã tan.
- **Hồ Mắt Ngọc:** điểm mới đang dần hoàn thiện, cách trung tâm khoảng 2 km về phía đông bắc, mở khoảng 7h đến 17h và hiện chưa thu vé. Hồ không nằm sát đường xe, đoạn cuối phải đi bộ.

![Cây cô đơn trên mỏm đồi, mây trôi dưới chân](/uploads/1794397664551-ff1569b2d6f4.jpg)

## Khu 3: cụm phía đông, Thảo nguyên, Mỏm cá heo, Cây cô đơn

Bốn điểm nổi tiếng nhất nằm thành một cụm ở phía đông, cách nhau chỉ khoảng 1 km:

- **Thảo nguyên Tà Xùa:** đồi cỏ thoai thoải, có chỗ thuê lều (khoảng 200.000đ) để ngủ lại ngắm sao và đón mây sớm. Đêm rất lạnh, phải mang áo ấm dày.
- **Mỏm cá heo:** mỏm đá nhô ra giữa biển mây, vé khoảng 20.000đ, đẹp nhất 6h đến 9h. Đoạn cuối là đường đất dốc, nên đi xe ôm bản địa.
- **Cây cô đơn:** cây đứng một mình trên mỏm đồi, mây trôi ngay dưới chân. Muốn có ảnh vắng người phải tới trước 6h.
- **Lán cô đơn:** căn lán nhỏ gần đó, thường được ghé cùng lượt với Cây cô đơn.

Cụm này xa trung tâm hơn hẳn khu Đỉnh Gió (riêng Mỏm cá heo khoảng 9 km), nên hãy dành trọn một buổi sáng và xuất phát từ lúc trời còn tối. Chi tiết từng điểm có ở bài [Mỏm cá heo và cây cô đơn](/kinh-nghiem/mom-ca-heo-cay-co-don-ta-xua).

## Khu 4: Sống lưng khủng long

**Sống lưng khủng long** nằm về phía đông bắc, cách trung tâm khoảng 12 km. Đây là sống núi hẹp, hai bên là vực, uốn lượn như lưng một con khủng long. Vé khoảng 20.000đ, giờ đẹp từ 6h đến 10h. Hai lưu ý không nên bỏ qua: **không đi khi mưa hoặc gió to**, và phải mang giày bám tốt.

Vì xa và phải đi bộ một đoạn trên sống núi, điểm này nên chiếm riêng một buổi sáng, thường là sáng ngày thứ hai. Xem bài [Sống lưng khủng long Tà Xùa](/kinh-nghiem/song-lung-khung-long-ta-xua) trước khi đi.

## Khu 5: Trạm Mâm Xôi ở Xím Vàng

**Trạm Mâm Xôi** thuộc xã Xím Vàng, cách trung tâm Tà Xùa khoảng 15 km. Điểm này chỉ đáng đi vào **mùa lúa, trước tháng 9**; sau khi lúa gặt thì cảnh không còn gì đặc biệt mà đường lại xa. Hợp với lịch 3 ngày 2 đêm hoặc chuyến phượt dài ngày, không nên nhét vào lịch 2 ngày 1 đêm. Tham khảo thêm bài [Xím Vàng mùa lúa chín](/kinh-nghiem/xim-vang-mua-lua-chin).

## Gom điểm thế nào cho đỡ chạy đi chạy lại?

Nguyên tắc: mỗi buổi sáng một cụm, buổi chiều dành cho các điểm sát trung tâm.

**Lịch 2 ngày 1 đêm:**

- **Sáng ngày 1:** cụm phía đông (Thảo nguyên, Mỏm cá heo, Cây cô đơn), ghé Hồ Mắt Ngọc trên đường nếu còn sức.
- **Chiều ngày 1:** nhận phòng, nghỉ, rồi ra Amei Hill hoặc Đỉnh Gió ngắm hoàng hôn.
- **Sáng ngày 2:** Sống lưng khủng long, về ghé xưởng Nhuộm Chàm hoặc tiệm trà rồi lên xe.

**Lịch 3 ngày 2 đêm:** giữ nguyên hai buổi sáng trên, thêm một buổi cho khu Đỉnh Gió và Núi đôi thiếu nữ, sáng cuối thong thả uống trà và mua quà. Lịch theo từng giờ xem ở trang [lịch trình Tà Xùa](/lich-trinh).

## Đi giữa các điểm bằng gì?

- **Xe máy thuê:** linh hoạt nhất, hợp với người quen đường đèo. Xem [kinh nghiệm thuê xe máy ở Tà Xùa](/kinh-nghiem/thue-xe-may-ta-xua).
- **Xe ôm bản địa:** nên dùng cho những đoạn khó như đường xuống Amei Hill hay đoạn đất vào Mỏm cá heo. Xem bài [xe ôm và taxi ở Tà Xùa](/kinh-nghiem/xe-om-taxi-ta-xua).
- **Taxi:** hợp với nhóm có người lớn tuổi hoặc trẻ nhỏ, đi được tới các điểm có đường nhựa.

## Câu hỏi thường gặp

### Một ngày đi hết các điểm check-in Tà Xùa được không?

Không nên. Các điểm săn mây đẹp trong cùng một khung giờ buổi sáng và nằm ở những hướng khác nhau. Cố đi hết trong một ngày thì phần lớn thời gian là ngồi trên xe, tới nơi mây đã tan.

### Điểm nào không mất vé?

Các quán cà phê ngắm mây như Panorama chỉ cần gọi đồ uống. Hồ Mắt Ngọc hiện chưa thu vé. Mỏm cá heo, Sống lưng khủng long và Núi đôi thiếu nữ có thu vé, khoảng 20.000 đến 40.000đ.

### Chỉ có một buổi sáng thì nên đi đâu?

Nếu muốn ảnh biểu tượng, chọn cụm phía đông. Nếu muốn nhẹ nhàng, ở lại khu Đỉnh Gió, ngồi một quán cà phê và chờ mây. Cách chọn theo sức và theo thời tiết có ở bài [săn mây Tà Xùa nên đi cung nào](/kinh-nghiem/san-may-ta-xua-cung-nao).

### Bản đồ trên điện thoại có dùng được ở Tà Xùa không?

Dùng được ở khu trung tâm, nhưng vài đoạn đường xa sóng yếu. Nên mở sẵn và lưu vị trí các điểm khi còn ở homestay.

## Lên kế hoạch

- Mở [bản đồ vệ tinh Tà Xùa](/ban-do) để xem vị trí thật và đường đi từng ngày.
- Chọn [homestay](/homestay) theo khu bạn định đi nhiều nhất.
- Đặt gọn xe và phòng một lần với [combo xe cabin + homestay](/combo).

${DISCLAIMER}
`,
};

const A2: Art = {
  slug: "kinh-nghiem-dat-phong-homestay-ta-xua",
  title: "Kinh nghiệm đặt phòng homestay Tà Xùa: cọc bao nhiêu là đủ?",
  excerpt: "Kinh nghiệm đặt phòng homestay Tà Xùa: đặt trước bao lâu, giá phòng thật, cọc bao nhiêu, những câu phải hỏi trước khi chuyển khoản và cách tránh mất tiền oan.",
  coverImage: "/hero-taxua.jpg",
  topic: "cam-nang",
  keyword: "đặt phòng homestay Tà Xùa",
  content: `Đặt phòng homestay Tà Xùa khác đặt khách sạn ở thành phố ở một điểm: phần lớn homestay nhỏ, chỉ vài phòng, nhận khách qua tin nhắn và giữ chỗ bằng tiền cọc chuyển khoản. Phòng view mây đẹp cuối tuần hết rất nhanh, còn người đặt thì hay lo nhất hai chuyện: chuyển cọc rồi có chắc có phòng không, và lên tới nơi có bị phụ thu thêm không. Bài này đi lần lượt từng bước, từ lúc chọn ngày tới lúc nhận phòng.

**Tóm tắt nhanh:**

- **Đặt trước bao lâu:** cuối tuần mùa mây nên đặt trước 1 đến 2 tuần, lễ Tết sớm hơn nữa; ngày thường thoải mái hơn nhiều.
- **Giá phòng:** phần lớn phòng riêng ở mức 650.000 đến 1.000.000đ một đêm; giường tập thể từ khoảng 150.000đ một người.
- **Tiền cọc:** mức phổ biến là 50% giá trị đơn, phần còn lại trả khi nhận phòng.
- **Trước khi chuyển khoản:** chốt bằng tin nhắn đủ 5 thứ: ngày, phòng, số người, tổng tiền, điều kiện hoàn cọc.

![Biển mây và ruộng bậc thang nhìn từ núi Tà Xùa](/hero-taxua.jpg)

## Nên đặt phòng homestay Tà Xùa trước bao lâu?

Tà Xùa có hai nhịp rất khác nhau. Từ chủ nhật đến thứ năm, phòng gần như lúc nào cũng có và giá mềm. Thứ sáu, thứ bảy mùa mây (tháng 11 đến tháng 3) thì ngược lại: những phòng có ban công nhìn thẳng ra thung lũng thường kín trước cả tuần.

- **Ngày thường:** đặt trước 2 đến 3 ngày là đủ, thậm chí hỏi trong ngày vẫn có phòng.
- **Cuối tuần mùa mây:** đặt trước 1 đến 2 tuần nếu muốn chọn phòng, chọn view.
- **Tết Dương lịch, Tết Nguyên đán, 30/4:** đặt trước càng sớm càng tốt, giá cũng cao hơn ngày thường. Mức chênh cụ thể xem bài [giá homestay Tà Xùa ngày thường, cuối tuần và lễ Tết](/kinh-nghiem/gia-homestay-ta-xua-ngay-thuong-cuoi-tuan-le).

Một mẹo đơn giản: nếu đổi được lịch, đi tối chủ nhật về tối thứ ba. Cùng căn phòng đó, bạn có giá tốt hơn, điểm check-in vắng hơn và xác suất gặp mây không hề kém.

## Chọn khu ở trước, chọn phòng sau

Người mới đi thường chọn theo ảnh phòng rồi mới để ý phòng nằm ở đâu. Nên làm ngược lại, vì khu ở quyết định mỗi sáng bạn phải chạy xe bao xa.

- **Trung tâm:** gần chợ, quán ăn, tiện cho người không tự lái xe. Nhiều lựa chọn giá nhất.
- **Đỉnh Gió:** cao và thoáng, nhiều nơi mở cửa phòng là thấy mây, nhưng gió mạnh và lạnh hơn.
- **Khe Cải:** yên tĩnh, nhìn xuống thung lũng, hợp với người muốn nghỉ ngơi.

So sánh kỹ hơn ở bài [ở Tà Xùa nên chọn khu nào](/kinh-nghiem/o-ta-xua-nen-chon-khu-nao). Danh sách phòng kèm giá và tình trạng theo ngày xem tại trang [homestay Tà Xùa](/homestay).

![Mây tràn qua sườn núi nhìn từ khu Đỉnh Gió, Tà Xùa](/uploads/1794397373248-ead2f1c0433b.jpg)

## Giá phòng thật là bao nhiêu?

Theo giá niêm yết của hơn 30 homestay đang có trên Tà Xùa Booking (gần 400 phòng):

- **Giường tập thể (dorm):** từ khoảng 150.000đ một người một đêm.
- **Phòng riêng phổ thông:** phần lớn ở mức 650.000 đến 1.000.000đ một đêm, mức giữa khoảng 750.000đ.
- **Phòng view đẹp, có bồn tắm hoặc bungalow riêng:** có thể lên tới khoảng 2.000.000đ một đêm.

Nhiều homestay tính giá thứ sáu, thứ bảy cao hơn ngày thường, nên khi so sánh hãy so đúng ngày bạn ở. Và luôn hỏi giá đó là **giá một phòng** hay **giá một người**, vì phòng tập thể thường tính theo đầu người.

## 7 câu phải hỏi trước khi chuyển cọc

1. **Giá đã gồm những gì?** Ăn sáng, sưởi, nước nóng có tính riêng không.
2. **Phòng ở tối đa mấy người, thêm người phụ thu bao nhiêu?** Đây là khoản phát sinh hay gặp nhất.
3. **Phòng có view mây thật không, hay phải ra sân chung?** Xin ảnh chụp từ đúng phòng đó.
4. **Có sưởi, chăn điện, nước nóng không?** Đêm mùa đông ở đây xuống 5 đến 10°C.
5. **Mấy giờ nhận và trả phòng?** Thông thường nhận từ 14h, trả trước 12h. Xe cabin tới nơi từ sáng sớm, nên hỏi luôn có chỗ gửi đồ không.
6. **Đường vào có dốc không, ô tô vào được không?** Quan trọng nếu đi cùng bố mẹ hoặc trẻ nhỏ.
7. **Điều kiện hoàn cọc khi đổi ngày hoặc huỷ?** Hỏi rõ mốc thời gian, đừng chấp nhận câu trả lời chung chung.

Nếu sáng sớm đã tới mà chưa có phòng, bài [xuống xe đêm, 14h mới nhận phòng thì làm gì](/kinh-nghiem/xuong-xe-dem-ta-xua-sang-som-lam-gi) có sẵn phương án.

## Đặt cọc thế nào cho an toàn?

Khi đặt phòng homestay Tà Xùa, mức cọc phổ biến là **50% giá trị đơn**, phần còn lại thanh toán khi nhận phòng. Cọc là để giữ chỗ cho cả hai bên, nên có mấy nguyên tắc sau:

- **Chốt bằng chữ trước khi chuyển tiền.** Tin nhắn xác nhận phải có đủ: ngày nhận và trả phòng, tên phòng, số người, tổng tiền, số tiền cọc và điều kiện hoàn cọc.
- **Kiểm tra tên chủ tài khoản.** Tên trên tài khoản nhận tiền phải khớp với người hoặc đơn vị bạn đang làm việc. Tài khoản đứng tên một người lạ là dấu hiệu nên dừng lại hỏi.
- **Ghi rõ nội dung chuyển khoản:** tên, ngày ở, tên phòng. Chụp lại màn hình giao dịch.
- **Giữ toàn bộ tin nhắn** cho tới khi trả phòng.
- **Đừng chuyển 100% trước** cho nơi bạn chưa từng ở, trừ khi có điều kiện hoàn tiền rõ ràng bằng văn bản.

Cũng nên hiểu chiều ngược lại: đơn chưa cọc thường chỉ được giữ trong một khoảng thời gian ngắn. Cuối tuần, phòng bạn đang phân vân có thể được người khác cọc trước chỉ sau vài giờ.

## Dấu hiệu nên cẩn thận

- Giá rẻ hơn hẳn mặt bằng cho đúng dịp lễ, kèm lời giục "còn đúng 1 phòng, chuyển ngay".
- Trang chỉ có ảnh đẹp, không có địa chỉ cụ thể, không ai nghe máy khi gọi.
- Không chịu xác nhận bằng tin nhắn những gì đã nói qua điện thoại.
- Đổi số tài khoản vào phút chót.
- Báo giá một kiểu, lúc tới nơi lại tính thêm khoản chưa từng nhắc tới.

Gặp một trong những dấu hiệu này không có nghĩa chắc chắn là lừa đảo, nhưng đủ để bạn hỏi lại cho rõ trước khi chuyển tiền.

## Đặt qua Tà Xùa Booking thì quy trình ra sao?

1. Chọn ngày trên trang [homestay](/homestay) hoặc [combo](/combo) để thấy phòng còn trống và giá của đúng ngày đó.
2. Gửi yêu cầu đặt. Chưa cần trả tiền ở bước này.
3. Nhân viên gọi lại xác nhận phòng và gửi tin nhắn ghi rõ dịch vụ, ngày giờ, tổng tiền và số tiền cọc.
4. Bạn chuyển cọc trong thời hạn ghi trong tin nhắn. Quá thời hạn mà chưa cọc, hoặc phòng đã có người khác đặt trước, đơn sẽ tự huỷ.
5. Phần còn lại thanh toán khi nhận phòng. Mã đơn tra lại được ở trang [tra cứu đơn hàng](/tra-cuu).

Các cam kết về giá và hoàn tiền được viết thành văn bản ở trang [cam kết minh bạch](/cam-ket): không đội giá, không phụ thu ẩn, và có mức bồi thường cụ thể nếu đã nhận tiền mà không cung cấp dịch vụ và không hoàn tiền.

## Câu hỏi thường gặp

### Không đặt trước, lên tới nơi mới tìm phòng được không?

Ngày thường thì được. Cuối tuần mùa mây và dịp lễ thì rủi ro cao: phòng còn lại thường là phòng không có view hoặc ở xa trung tâm, giá cũng khó mặc cả.

### Huỷ phòng có lấy lại được cọc không?

Tuỳ điều kiện từng nơi và thời điểm báo huỷ. Vì vậy phải hỏi và chốt điều kiện hoàn cọc bằng tin nhắn **trước** khi chuyển tiền.

### Đi nhóm đông nên đặt thế nào?

Từ 10 người trở lên nên hỏi thuê nguyên căn hoặc nhiều phòng cùng một homestay để tiện sinh hoạt chung. Xem bài [đi Tà Xùa nhóm đông, thuê nguyên homestay](/kinh-nghiem/di-ta-xua-nhom-dong-thue-nguyen-homestay).

### Đặt combo xe và phòng có lợi hơn đặt lẻ không?

Combo gom vé xe cabin khứ hồi và phòng vào một đơn, bớt được một lần đặt và có mức giá tốt hơn đặt lẻ. Chi tiết ở bài [combo xe cabin + homestay Tà Xùa](/kinh-nghiem/combo-xe-cabin-homestay-ta-xua).

${DISCLAIMER}
`,
};

const A3: Art = {
  slug: "di-ta-xua-co-nguy-hiem-khong",
  title: "Đi Tà Xùa có nguy hiểm không? 9 lưu ý an toàn cần biết",
  excerpt: "Đi Tà Xùa có nguy hiểm không? Đường đèo 15 km, sương mù, sống núi hẹp và cái lạnh ban đêm: những rủi ro thật và cách đi an toàn cho người lần đầu lên núi.",
  coverImage: "/uploads/1794459921891-896f8f99a5ee.jpg",
  topic: "cam-nang",
  keyword: "đi Tà Xùa có nguy hiểm không",
  content: `Câu hỏi "đi Tà Xùa có nguy hiểm không" thường đến từ người chưa quen đường núi, hoặc từ bố mẹ có con sắp đi. Câu trả lời thẳng: Tà Xùa **không phải điểm đến mạo hiểm**, mỗi cuối tuần có rất nhiều người đi và về bình thường, trong đó có cả gia đình có trẻ nhỏ và người lớn tuổi. Nhưng đây là vùng núi cao, có đường đèo dốc, sương mù và vài điểm check-in nằm sát vực. Rủi ro đến từ một số tình huống cụ thể, và hầu hết đều tránh được nếu biết trước.

**Tóm tắt nhanh:**

- **Rủi ro lớn nhất:** tự lái xe máy đổ đèo khi chưa quen, nhất là lúc trời mưa hoặc mù.
- **Điểm cần cẩn thận nhất:** Sống lưng khủng long và Mỏm cá heo, không đi khi mưa hoặc gió to.
- **Dễ bị coi nhẹ nhất:** cái lạnh. Đêm mùa đông 5 đến 10°C, sáng sớm đi săn mây còn lạnh hơn.
- **Cách giảm rủi ro nhanh nhất:** đi xe cabin thay vì tự lái từ Hà Nội, và thuê xe ôm bản địa cho những đoạn khó.

![Sống lưng khủng long Tà Xùa, sống núi hẹp hai bên là vực](/uploads/1794459921891-896f8f99a5ee.jpg)

## Đi Tà Xùa có nguy hiểm không nếu tự lái xe máy?

Đây là phần cần nói kỹ nhất. Từ thị trấn Bắc Yên lên trung tâm Tà Xùa là khoảng **15 km đường đèo** liên tục, nhiều khúc cua tay áo và dốc dài. Mặt đường nhựa nhìn chung đi được, nhưng có ba thứ làm nó khó hơn tưởng tượng:

- **Sương mù:** sáng sớm và chiều muộn mùa mây, có đoạn tầm nhìn chỉ còn vài mét.
- **Mặt đường ướt:** sương đọng làm đường trơn kể cả khi không mưa.
- **Xe ngược chiều:** xe khách, xe tải ôm cua rộng ở những khúc khuất tầm nhìn.

Nếu bạn chưa từng chạy đường đèo, đừng chọn Tà Xùa làm chuyến đầu tiên tự lái từ Hà Nội. Cách an toàn hơn là đi [xe cabin giường nằm](/xe-cabin) lên tới nơi, rồi mới thuê xe máy đi quanh trung tâm, nơi đường ngắn và dễ hơn nhiều.

## 9 lưu ý an toàn

### 1. Đổ đèo bằng số thấp, không rà phanh liên tục

Xe số về số 2 hoặc số 3 để máy ghìm xe. Xe ga thì nhả ga sớm, bóp phanh từng nhịp và dừng nghỉ nếu ngửi thấy mùi khét. Rà phanh liên tục trên dốc dài làm phanh nóng và mất tác dụng, đây là nguyên nhân phổ biến của tai nạn đường đèo.

### 2. Không chạy đèo ban đêm hoặc khi mù dày

Nếu tới Bắc Yên lúc trời tối, hãy dùng xe trung chuyển của nhà xe hoặc taxi thay vì tự chạy. Gặp mù dày giữa đường thì bật đèn, đi chậm sát lề phải, tìm chỗ rộng để dừng chờ chứ đừng cố.

### 3. Kiểm tra xe thuê trước khi nhận

Thử cả hai phanh, xem lốp còn gai không, đèn và còi có hoạt động không, đổ đầy xăng ở trung tâm. Chi tiết xem bài [kinh nghiệm thuê xe máy ở Tà Xùa](/kinh-nghiem/thue-xe-may-ta-xua).

### 4. Đoạn khó thì thuê xe ôm bản địa

Đường xuống **Amei Hill** hẹp và dốc. Đoạn cuối vào **Mỏm cá heo** là đường đất dốc. Người địa phương chạy những đoạn này hằng ngày, còn bạn thì chưa. Vài chục nghìn tiền xe ôm rẻ hơn rất nhiều so với một lần ngã xe. Xem bài [xe ôm và taxi ở Tà Xùa](/kinh-nghiem/xe-om-taxi-ta-xua).

### 5. Sống lưng khủng long: không đi khi mưa hoặc gió to

Đây là sống núi hẹp, hai bên là vực. Ngày khô ráo, đi chậm và mang giày bám tốt thì người có sức khoẻ bình thường đi được. Ngày mưa, đá và đất trơn; ngày gió to, đứng trên sống núi rất khó giữ thăng bằng. Gặp thời tiết như vậy thì bỏ điểm này, không có tấm ảnh nào đáng để liều. Xem bài [Sống lưng khủng long Tà Xùa](/kinh-nghiem/song-lung-khung-long-ta-xua).

### 6. Chụp ảnh ở mỏm đá: đứng lùi lại

Ở Mỏm cá heo và các mỏm núi khác, phần lớn chỗ không có lan can. Đá ướt sương rất trơn. Đừng bước lùi khi đang nhìn vào điện thoại, đừng nhảy tạo dáng ở mép, và đừng chen khi đông người đang xếp hàng.

### 7. Mặc ấm hơn bạn nghĩ

Đêm mùa đông ở trung tâm Tà Xùa xuống khoảng 5 đến 10°C, đi xe máy lúc 5h sáng thì gió làm lạnh buốt hơn nhiều. Cần áo giữ nhiệt, áo khoác chắn gió, găng tay, khăn và mũ. Lạnh không chỉ khó chịu mà còn làm tay cứng, phản xạ phanh chậm đi. Xem bài [Tà Xùa mùa đông lạnh cỡ nào, mặc gì](/kinh-nghiem/ta-xua-mua-dong-lanh-mac-gi).

### 8. Chuẩn bị cho say xe và sức khoẻ

Đoạn đèo quanh co dễ gây say xe, kể cả với người ít khi say. Mang thuốc chống say, ăn nhẹ trước khi đi, xem thêm [mẹo chống say xe đèo lên Tà Xùa](/kinh-nghiem/meo-chong-say-xe-deo-ta-xua). Ở trung tâm xã chỉ có cơ sở y tế cơ bản, nên ai có bệnh nền cần mang đủ thuốc đang dùng.

### 9. Báo lịch trình và giữ liên lạc

Sóng điện thoại ở trung tâm ổn, nhưng một số đoạn đường xa thì yếu. Trước khi đi điểm xa, nhắn cho người nhà hoặc chủ homestay biết bạn đi đâu và dự kiến mấy giờ về. Sạc đầy điện thoại và mang theo sạc dự phòng vì trời lạnh làm pin tụt nhanh. Thông tin cụ thể ở bài [sóng điện thoại, wifi, ATM ở Tà Xùa](/kinh-nghiem/song-dien-thoai-atm-wifi-ta-xua).

![Mỏm cá heo Tà Xùa, mỏm đá nhô ra không có lan can](/uploads/1794459485872-92ece395bfbc.jpg)

## Ai nên cân nhắc kỹ hơn?

- **Gia đình có trẻ nhỏ:** đi được, nhưng nên chọn các điểm sát trung tâm, bỏ sống núi và mỏm đá, và đi taxi thay vì xe máy. Xem bài [du lịch Tà Xùa cùng gia đình và trẻ nhỏ](/kinh-nghiem/du-lich-ta-xua-cung-gia-dinh-tre-nho).
- **Người lớn tuổi:** chọn homestay ở trung tâm, đường vào bằng phẳng, lịch trình nhẹ. Xem bài [đưa bố mẹ đi Tà Xùa](/kinh-nghiem/du-lich-ta-xua-cho-bo-me).
- **Người đi một mình:** an ninh ở Tà Xùa nhìn chung yên ổn, người dân hiền lành. Rủi ro chính vẫn là đường sá, nên đừng chạy xe một mình ở đoạn vắng lúc trời tối. Xem bài [du lịch Tà Xùa một mình](/kinh-nghiem/du-lich-ta-xua-mot-minh).
- **Người sợ độ cao:** bỏ Sống lưng khủng long, vẫn còn rất nhiều điểm ngắm mây an toàn từ ban công quán cà phê.

## Thời tiết xấu thì xử lý thế nào?

Câu hỏi đi Tà Xùa có nguy hiểm không còn phụ thuộc vào mùa. Mùa mưa (khoảng tháng 5 đến tháng 9) có những ngày mưa lớn, đường đất nhão và có nguy cơ sạt ở vài đoạn. Trước chuyến đi nên xem dự báo thời tiết của khu vực Bắc Yên. Nếu có cảnh báo mưa lớn kéo dài, cách làm đúng là dời ngày chứ không phải cố đi rồi tính.

Còn nếu chỉ là trời mù trắng, không thấy mây, thì đó là chuyện rất bình thường ở Tà Xùa và không có gì nguy hiểm, chỉ hơi tiếc. Bài [săn mây hụt thì làm gì](/kinh-nghiem/san-may-hut-o-ta-xua-lam-gi) có sẵn phương án cho những hôm như vậy.

## Câu hỏi thường gặp

### Con gái đi Tà Xùa một mình có an toàn không?

Nhiều bạn nữ vẫn đi một mình hoặc đi hai người. Nên ở homestay khu trung tâm, đi xe cabin thay vì tự lái đường dài, và tránh di chuyển một mình ở đoạn vắng sau khi trời tối.

### Chưa biết đi xe máy thì có đi Tà Xùa được không?

Được. Đi xe cabin lên, rồi dùng xe ôm hoặc taxi để tới các điểm. Chi phí cao hơn tự lái một chút nhưng an toàn và nhàn hơn nhiều.

### Sống lưng khủng long có nguy hiểm không?

Ngày khô ráo, đi chậm, mang giày bám tốt thì không quá khó. Nguy hiểm khi mưa, gió to, hoặc khi cố chụp ảnh ở chỗ hẹp. Trẻ nhỏ và người sợ độ cao không nên đi.

### Gặp sự cố trên đường thì gọi ai?

Gọi chủ homestay hoặc nhà xe trước, vì họ ở gần và biết đường. Trường hợp khẩn cấp gọi 115 (cấp cứu) hoặc 113 (công an).

## Lên kế hoạch cho chuyến đi an toàn

- Xem chỗ trống [xe cabin Hà Nội – Tà Xùa](/xe-cabin) để không phải tự lái đường dài.
- Chọn [homestay](/homestay) ở khu trung tâm nếu đi cùng người lớn tuổi hoặc trẻ nhỏ.
- Xem trước vị trí và đường tới các điểm trên [bản đồ vệ tinh Tà Xùa](/ban-do).
- Đọc bài tổng hợp [kinh nghiệm du lịch Tà Xùa từ A–Z](/kinh-nghiem/kinh-nghiem-du-lich-ta-xua-tu-a-z) nếu đây là lần đầu bạn đi.
`,
};

const ARTS = [A1, A2, A3];
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
