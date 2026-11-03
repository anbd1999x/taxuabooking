/**
 * Đăng 5 bài viết kinh nghiệm dùng ẢNH THẬT từ kho /uploads (ảnh homestay/cabin
 * đã đồng bộ từ các cơ sở ở Tà Xùa). Bỏ qua bài có slug đã tồn tại.
 * Chạy: npx tsx scripts/tmp-articles-real.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

interface Art {
  slug: string;
  title: string;
  excerpt: string;
  topic: string;
  coverImage: string;
  content: string;
}

const ARTICLES: Art[] = [
  // ───────────────────────── 1. Bồn tắm view biển mây ─────────────────────────
  {
    slug: "bon-tam-view-bien-may-ta-xua",
    title: "Bồn tắm view biển mây Tà Xùa: trải nghiệm đáng tiền nhất 2026",
    excerpt:
      "Ngâm mình trong bồn tắm nước nóng, trước mặt là cả thung lũng mây trắng — trải nghiệm đang khiến Tà Xùa 'sốt' trở lại. Phòng nào có bồn, giá bao nhiêu, đặt thế nào?",
    topic: "diem-den",
    coverImage: "/uploads/1793637227451-3654f565213c.jpg",
    content: `Nếu như 2–3 năm trước, người ta lên Tà Xùa chỉ để săn mây ở sống lưng khủng long hay mỏm cá heo, thì bây giờ dân mê xê dịch còn truyền tai nhau một trải nghiệm khác: **ngâm bồn tắm nước nóng trong phòng kính, trước mặt là cả một thung lũng mây**. Không cần dậy từ 4h sáng, không cần leo dốc — mây ở ngay cửa sổ phòng tắm.

## Vì sao bồn tắm view mây lại "gây sốt"?

Tà Xùa nằm ở độ cao khoảng 1.500–1.800m, mùa mây (tháng 10 đến tháng 4) nhiệt độ đêm thường chỉ 8–15°C. Sau một ngày chạy xe máy lượn đèo lạnh cóng tay, được thả mình vào bồn nước ấm, nhìn ra ngoài là mây cuộn dưới thung lũng — cảm giác đúng nghĩa "tiền nào cũng đáng".

Một lý do nữa rất thực tế: **ảnh chụp cực kỳ ăn hình**. Bồn tắm trắng + khung cửa kính + biển mây là công thức lên hình không cần chỉnh nhiều, nên các phòng có bồn tắm ở Tà Xùa gần như luôn hết trước những phòng khác vào cuối tuần.

![Bồn tắm đặt sát cửa kính nhìn thẳng xuống thung lũng núi ở Tà Xùa](/uploads/1793637227451-3654f565213c.jpg)

## Phòng bồn tắm ở Tà Xùa trông thế nào?

Đa số là **phòng đơn 2 khách, tường kính 2–3 mặt**, giường đặt sát cửa kính và bồn tắm nằm ở góc kính riêng. Buổi sáng kéo rèm ra là mây tràn vào tận giường — theo đúng nghĩa đen, vì những hôm mây dày, cả căn phòng lọt thỏm trong mây trắng.

![Phòng kính ở Bếp Nhà Táo với giường sát cửa sổ, mây trắng phủ kín bên ngoài](/uploads/1793637187325-d95bfdaaac8f.jpg)

Ví dụ thực tế ở **Bếp Nhà Táo** (khu Khe Cải — cách trung tâm Tà Xùa chừng vài km, cùng hệ thống với Đồi Mây và Tà Xùa Hill): homestay có 13 phòng thì 6 phòng có bồn tắm, gồm 5 phòng đơn (Phòng 6, 7, 9, 10, 13) và 1 phòng 3 giường (Phòng 8). Giá phòng đơn có bồn **800.000đ/đêm ngày thường, 1.000.000đ tối thứ 7, lễ Tết 1.200.000đ** — tức là chỉ nhỉnh hơn phòng thường chút ít, thậm chí bằng giá, nên gần như không có lý do gì để không chọn phòng có bồn nếu còn trống.

![Phòng kính 3 mặt với ghế thư giãn cạnh cửa sổ mây ở Tà Xùa](/uploads/1793637360001-8db1c2ed79b2.jpg)

## Kinh nghiệm đặt phòng bồn tắm không bị "hớ"

- **Đặt sớm ít nhất 1–2 tuần cho cuối tuần.** Phòng bồn tắm là loại hết đầu tiên; mùa mây tháng 11–3 thì tối thứ 7 gần như kín trước cả tuần.
- **Hỏi rõ bồn đặt ở đâu.** Có home bồn nằm trong phòng tắm kín (không view); phòng đáng tiền phải là bồn cạnh cửa kính. Xem kỹ ảnh từng phòng trước khi chốt.
- **Ngày thường giá mềm hơn hẳn thứ 7** (chênh 200.000đ/đêm trở lên) và vắng hơn nhiều — nếu nghỉ được giữa tuần, bạn vừa rẻ vừa yên tĩnh.
- **Kiểm tra nước nóng và máy sưởi.** Mùa đông trên núi 5–10°C, tắm bồn mà thiếu đệm sưởi, điều hòa 2 chiều là dễ cảm lạnh. Các phòng ở Bếp Nhà Táo đều có điều hòa + đệm sưởi.
- **Phòng kính = sáng sớm rất chói.** Nếu muốn ngủ nướng, nhớ kéo rèm; còn muốn đón bình minh trên mây thì... cứ để rèm mở, 5h30 sáng thiên nhiên tự gọi dậy.

> Mẹo nhỏ: trên [trang homestay của Tà Xùa Booking](/homestay) có bộ lọc riêng cho tiện ích **bồn tắm**, kèm tình trạng trống/đã đặt theo từng ngày được đồng bộ từ sổ phòng của chủ nhà — nhìn thấy phòng nào còn ngày nào, đỡ phải nhắn hỏi từng nơi.

## Giá tham khảo nhanh (cập nhật 11/2026)

- Phòng đơn có bồn tắm 2 khách: **800.000–1.000.000đ/đêm** (lễ 1.200.000đ)
- Phòng 3 giường có bồn tắm 6 khách: **1.200.000–1.500.000đ/đêm** (lễ 1.700.000đ)
- Phụ thu ngủ ghép từ 6 tuổi: khoảng **200.000đ/người/đêm**

Nếu đi từ Hà Nội mà chưa gọi được xe, thử [ghép combo xe cabin + phòng homestay](/combo) — hệ thống tự ghép chuyến xe khứ hồi với phòng còn trống đúng ngày bạn đi, tiết kiệm hơn đặt lẻ.

Còn băn khoăn nên đi tháng nào cho chắc mây? Đọc thêm [kinh nghiệm săn mây Tà Xùa từ A–Z](/kinh-nghiem/kinh-nghiem-san-may-ta-xua).`,
  },

  // ───────────────────────── 2. Săn mây hụt ─────────────────────────
  {
    slug: "san-may-hut-o-ta-xua-lam-gi",
    title: "Săn mây hụt ở Tà Xùa: trời trắng xóa thì làm gì cho đáng chuyến đi?",
    excerpt:
      "Không ai nói trước được mây. Lên Tà Xùa đúng hôm sương mù trắng xóa hay trời quang không một gợn mây thì chơi gì, ăn gì, chụp gì để chuyến đi vẫn đáng? Kinh nghiệm thật ở đây.",
    topic: "cam-nang",
    coverImage: "/uploads/1793636909568-e59915404418.jpg",
    content: `Chuyện thật của rất nhiều người: hào hứng đặt phòng, dậy từ 4h30 sáng, ôm máy ảnh ra ban công… và trước mặt là **một màn trắng xóa không nhìn thấy gì quá 10 mét**, hoặc ngược lại — trời quang vắt, nhìn thấu xuống tận thung lũng nhưng không một gợn mây. Đó là "săn mây hụt", và ở Tà Xùa chuyện này xảy ra với bất kỳ ai, kể cả người đi lần thứ năm.

Bài này không an ủi suông. Đây là những việc thực sự đáng làm khi mây không về, để chuyến đi vẫn trọn vẹn.

## Trước hết: hiểu vì sao hụt

Biển mây hình thành khi hơi ẩm bị nén dưới thung lũng gặp đêm lạnh và sáng hửng nắng. Ba kiểu "hụt" thường gặp:

- **Sương mù phủ đỉnh** (cả homestay trong mây): thường do mưa hoặc ẩm quá cao. Chịu khó chờ — nhiều hôm 8–9h sáng nắng lên là mây tụt xuống thành biển rất đẹp.
- **Trời quang không mây**: hay gặp khi gió mạnh hoặc hanh khô kéo dài. Hôm đó khó có mây, nhưng bù lại hoàng hôn và trời sao sẽ rất rực.
- **Mây mỏng tan nhanh**: dậy muộn 15 phút là lỡ. Rút kinh nghiệm: có mặt ở điểm ngắm trước bình minh 30–45 phút.

> Kinh nghiệm xương máu: đừng dồn hết kỳ vọng vào MỘT buổi sáng. Đi 2 đêm thì bạn có 2–3 "cửa" săn mây (sáng sớm cả hai ngày + chiều tối hôm giữa), xác suất trúng cao hơn hẳn đi 1 đêm.

## 7 việc đáng làm khi mây không về

### 1. Ngồi lì ở quán cafe view thung lũng

Nghe có vẻ "thua cuộc" nhưng thật ra là nước đi khôn: sương mù trên đỉnh có thể tan bất kỳ lúc nào, và nơi tốt nhất để chờ là một chỗ ấm, có trà nóng, nhìn thẳng ra hướng thung lũng. Khoảnh khắc sương bất ngờ rút xuống luôn đẹp hơn mọi tấm ảnh lên kế hoạch.

![Bình minh ửng hồng sau rặng đào đá bên tường rào đá ở Tà Xùa](/uploads/1793636901353-c93660f17d52.jpg)

### 2. Đi đồi chè và rừng chè cổ thụ

Sương mù lại là "filter" đẹp nhất cho [đồi chè và rừng chè cổ thụ Tà Xùa](/kinh-nghiem/doi-che-rung-che-co-thu-ta-xua). Những gốc chè Shan Tuyết trăm tuổi trong sương mờ ảo hơn hẳn trời nắng gắt. Tiện thể mua trà Shan Tuyết về làm quà — đặc sản thật sự của vùng này chứ không phải đồ bày bán hình thức.

### 3. Chạy xe sang Xím Vàng, Háng Đồng

Trời không mây thì tầm nhìn xa lại cực tốt — hợp để chạy cung [Xím Vàng](/kinh-nghiem/xim-vang-mua-lua-chin) hoặc [Háng Đồng](/kinh-nghiem/ban-hang-dong-ta-xua): đường đèo uốn giữa ruộng bậc thang, bản làng người Mông, thi thoảng gặp thác nước nhỏ. Thuê xe máy ở trung tâm khoảng 200.000đ/ngày.

### 4. Ăn một bữa cho ra ăn

Mẹt nướng Tây Bắc, lẩu gà đồi, cá suối, rượu táo mèo… Tà Xùa bây giờ không thiếu quán ăn tử tế quanh trung tâm và khu Khe Cải. Trời lạnh + sương mù + bếp nướng than hoa là combo không cần mây vẫn đáng nhớ. Gợi ý ở bài [tối ở Tà Xùa ăn gì](/kinh-nghiem/bbq-lau-nuong-toi-homestay-ta-xua).

### 5. Chụp bộ ảnh "trong mây" thay vì "trên mây"

Sương mù dày là bối cảnh chụp chân dung rất điện ảnh: đèn dây vàng của homestay, bóng cây mờ, áo khoác dáng dài… Nhiều bộ ảnh viral của Tà Xùa thực chất chụp trong những hôm "săn mây hụt" đấy — thử xem [7 mẹo chụp ảnh bằng điện thoại](/kinh-nghiem/meo-chup-anh-san-may-bang-dien-thoai).

### 6. Chờ hoàng hôn và trời sao

Hôm nào trời quang không mây, đừng ngủ sớm: hoàng hôn Tà Xùa những hôm hanh khô rực như cháy trời, và đêm đó gần như chắc chắn thấy **dải ngân hà** — thứ mà hôm nhiều mây bạn không bao giờ thấy. Xem [điểm ngắm hoàng hôn đẹp nhất](/kinh-nghiem/ngam-hoang-hon-ta-xua).

![Vườn hoa cúc và lối đá của homestay trên núi lúc hoàng hôn ở Tà Xùa](/uploads/1793636868332-cc4408e65d0c.jpg)

### 7. Ngủ thêm một đêm nếu xếp được lịch

Nghe đơn giản mà hiệu quả nhất: mây Tà Xùa có "nhịp" — sau một ngày mưa/sương thường là một sáng biển mây rất dày. Nếu công việc cho phép, đổi lịch về muộn thêm một ngày; phòng ngày thường (Chủ nhật–thứ 6) rẻ hơn tối thứ 7 kha khá, xem tình trạng trống theo ngày ngay trên [trang homestay](/homestay).

## Chốt lại

Săn mây là xổ số, nhưng Tà Xùa không chỉ có mây. Chuyến đi "hụt" nhiều khi lại là chuyến nhớ lâu nhất — vì bữa nướng ngon hơn, ảnh lạ hơn, và vì bạn có lý do chính đáng để… quay lại lần nữa.

Lên kế hoạch cho lần tới chắc tay hơn với bài [thời tiết Tà Xùa theo tháng](/kinh-nghiem/thoi-tiet-ta-xua-theo-thang) và [Tà Xùa mùa nào đẹp nhất](/kinh-nghiem/ta-xua-mua-nao-dep-nhat).`,
  },

  // ───────────────────────── 3. Combo cabin + homestay ─────────────────────────
  {
    slug: "combo-xe-cabin-homestay-ta-xua",
    title: "Combo xe cabin + homestay Tà Xùa: ngủ một giấc tới nơi, tiết kiệm cả triệu",
    excerpt:
      "Đi Tà Xùa không tự lái: lên xe cabin 22h ở Hà Nội, ngủ một giấc, 4–5h sáng mở mắt đã ở cổng homestay. Cách ghép vé khứ hồi + phòng sao cho rẻ và khớp lịch nhất.",
    topic: "di-chuyen",
    coverImage: "/uploads/1793636876020-085769247055.jpg",
    content: `Chặng Hà Nội – Tà Xùa khoảng 230km, trong đó 15km cuối là đèo dốc liên tục. Tự lái xe máy đi về hết gần như trọn 2 ngày chỉ để… ngồi trên xe. Vì thế mà 1–2 năm nay, **xe giường cabin chạy đêm** trở thành cách đi Tà Xùa được ưa chuộng nhất với dân văn phòng: lên xe tối thứ 6, ngủ một giấc, mở mắt ra là núi.

## Xe cabin đi Tà Xùa hoạt động thế nào?

- **Giờ chạy**: các nhà xe (Tiến Thành, Khánh Châu, Xuân Trường…) xuất bến Hà Nội khoảng 21h30–22h30, đến trung tâm Tà Xùa tầm 3h30–5h sáng. Chiều về thường rời Tà Xùa 12h–14h, về Hà Nội đầu giờ tối.
- **Cabin đơn/đôi**: mỗi khách một khoang nằm riêng có rèm, chăn, nước uống; một số xe có **cabin đôi** nằm được 2 người — hợp cặp đôi hoặc đi cùng trẻ nhỏ.
- **Giá vé khứ hồi Hà Nội – Tà Xùa: 500.000–600.000đ/người** tùy nhà xe. Đón ở các tỉnh khác (Bắc Ninh, Hải Phòng, Thái Bình, Thái Nguyên…) khoảng 700.000–1.050.000đ khứ hồi. Chi tiết từng điểm đón trong bài [xe cabin đón ở đâu](/kinh-nghiem/diem-don-xe-cabin-cac-tinh).

![Khoang nằm xe cabin đi Tà Xùa với đệm, chăn và rèm riêng tư](/uploads/1793442945574-3636c341eef1.jpg)

Đến nơi lúc 4–5h sáng nghe có vẻ "dở hơi", nhưng thật ra là **đặc quyền**: đó chính xác là giờ vàng săn mây. Nhiều homestay quen đón khách xe đêm, cho gửi đồ và ngồi uống trà chờ bình minh, nhận phòng sớm nếu trống (có thể phụ thu nhẹ).

## Combo cabin + homestay: ghép thế nào cho khớp?

Cái khó nhất khi tự đặt lẻ là **khớp lịch**: vé xe còn chỗ thì phòng hết, phòng còn thì xe kín — nhất là tối thứ 6. Nguyên tắc ghép chuẩn:

- **Đêm lên xe = "ngày đi"**. Lên xe tối thứ 6 → check-in homestay trưa/chiều thứ 7 → ngủ đêm thứ 7 → trưa Chủ nhật lên xe về. Tức là đi "2 ngày cuối tuần" thực chất chỉ cần **1 đêm phòng + 1 vé khứ hồi**.
- **Đặt xe trước, phòng ngay sau đó** — vé cabin tối thứ 6 mùa mây hết nhanh hơn phòng.
- Đi 2 người trở lên thì tính tiền phòng **chia đầu người** rồi cộng vé: ví dụ phòng đơn 800.000đ chia 2 người + vé khứ hồi 500.000đ = khoảng **900.000đ/người** cho cả chuyến (chưa tính ăn).

Trên [trang combo của Tà Xùa Booking](/combo) việc ghép này được làm tự động: chọn ngày đi – ngày về, số người và mức giá mong muốn, hệ thống tự tìm **chuyến xe khứ hồi còn chỗ + phòng còn trống đúng những đêm đó**, kèm tiêu chí lọc như bồn tắm, view mây, ăn sáng, đường dễ đi — và mỗi khách còn được **giảm 50.000đ** so với đặt lẻ từng thứ.

![Bungalow gỗ bám sườn núi nhìn xuống thung lũng ở khu Khe Cải, Tà Xùa](/uploads/1793636865557-b4b4f4c2c64e.jpg)

## Chi phí thật một chuyến cuối tuần 2 người (tham khảo)

- Vé cabin khứ hồi: 500.000đ × 2 = **1.000.000đ**
- 1 đêm phòng đơn ngày thứ 7 (có bồn tắm): **1.000.000đ**
- Ăn uống 2 ngày (ăn sáng, trưa, mẹt nướng tối, cafe): ~**600.000đ**
- Xe ôm/thuê xe máy đi các điểm: ~**250.000đ**

Tổng: khoảng **2.800.000đ cho 2 người**, tức 1.400.000đ/người — ngang một bữa buffet khách sạn ở Hà Nội mà đổi lại là hai ngày trên mây. Đi ngày thường (phòng 800.000đ) còn rẻ hơn nữa.

## Lưu ý nhỏ nhưng quan trọng

- Say xe đèo? Đọc trước [mẹo vượt 15km dốc nhẹ nhàng](/kinh-nghiem/meo-chong-say-xe-deo-ta-xua) — uống thuốc trước khi xe vào đèo 30 phút, chọn cabin tầng dưới gần giữa xe.
- Xe đêm lạnh, mang theo áo khoác mỏng dù xe có chăn.
- Cuối tuần lễ Tết nên đặt trước **1–2 tuần**; một số homestay yêu cầu ở cặp đêm T6+T7 hoặc T7+CN dịp cao điểm.
- Về chiều Chủ nhật hay tắc nhẹ đoạn gần Hà Nội — đừng hẹn việc quan trọng tối đó.

Muốn so sánh với các cách đi khác (xe máy, ô tô tự lái, xe khách thường), xem bài tổng hợp [đường đi Tà Xùa từ Hà Nội](/kinh-nghiem/duong-di-ta-xua-tu-ha-noi).`,
  },

  // ───────────────────────── 4. 48 giờ ở Tà Xùa ─────────────────────────
  {
    slug: "48-gio-o-ta-xua-nhat-ky",
    title: "48 giờ ở Tà Xùa: nhật ký chuyến đi 'chữa lành' của dân văn phòng",
    excerpt:
      "Tối thứ 6 còn ngồi deadline ở Hà Nội, 5h sáng thứ 7 đã đứng trên biển mây. Nhật ký 48 giờ ở Tà Xùa — từng mốc giờ, từng bữa ăn, từng khoảnh khắc đáng tiền.",
    topic: "lich-trinh",
    coverImage: "/uploads/1793636914648-ad329e3e2b82.jpg",
    content: `Chuyến đi này bắt đầu bằng một câu rủ rê lúc 16h chiều thứ 6: "Tối nay lên Tà Xùa không? Còn 2 cabin". 21h30 có mặt ở điểm đón, và 48 giờ sau đó hóa ra là cuối tuần đáng nhớ nhất của cả năm. Ghi lại từng mốc giờ, cho những ai đang cần một cái cớ để đi.

## Thứ 6 — 22h00: Lên xe, tắt điện thoại

Xe cabin rời Hà Nội lúc 22h. Mỗi người một khoang, rèm kéo kín, chăn dày, xe chạy êm hơn tưởng tượng. Lời khuyên chân thành: **uống thuốc say xe trước khi xe vào đèo** (khoảng 2h sáng) dù bạn tự tin đến đâu — 15km cuối là dốc cua liên tục.

## Thứ 7 — 4h45: Mở mắt ra là núi

Xe thả khách ở trung tâm Tà Xùa khi trời còn tối om, 11°C. Homestay đã nhắn trước "cứ lên nhà uống trà chờ sáng". Ba lô quẳng góc nhà, tay ôm cốc trà Shan Tuyết nóng, ngồi ở sân nhìn về phía thung lũng — và rồi trời rạng dần.

![Nắng sớm rọi xuống biển mây trắng nhìn từ sân homestay ở Tà Xùa](/uploads/1793636914648-ad329e3e2b82.jpg)

5h30, cả thung lũng dưới chân là **một biển mây thật**, dày và trắng như ai đổ sữa vào giữa núi. Không cần đi đâu cả — đứng ngay sân homestay. Hóa ra "săn mây" nhiều khi chỉ là… thức dậy đúng chỗ.

## Thứ 7 — 8h00: Ăn sáng, nhận phòng sớm

Mỳ tôm trứng bò núi 35k, thêm cốc cafe muối ngồi mép vực. Homestay còn phòng nên cho nhận sớm. Phòng kính 3 mặt, giường sát cửa sổ — kiểu phòng mà bạn sẽ tiếc từng phút ngủ nướng.

![Ngồi ghế dã ngoại thư giãn trên đài ngắm mây tròn giữa biển mây Tà Xùa](/uploads/1793636863449-8fe29536d4b6.jpg)

## Thứ 7 — 10h00–17h00: Sống lưng khủng long, đồi chè, mỏm cá heo

Thuê xe máy 200k/ngày chạy [sống lưng khủng long](/kinh-nghiem/song-lung-khung-long-ta-xua) (đi sớm đỡ đông, mua vé vào cổng), ghé [rừng chè cổ thụ](/kinh-nghiem/doi-che-rung-che-co-thu-ta-xua), chiều quay về [mỏm cá heo và cây táo mèo cô đơn](/kinh-nghiem/mom-ca-heo-cay-co-don-ta-xua) chờ hoàng hôn. Đường không khó nhưng nhiều đoạn dốc gắt — ai tay lái yếu cứ gọi xe ôm bản địa cho lành, xem bài [xe ôm & taxi ở Tà Xùa](/kinh-nghiem/xe-om-taxi-ta-xua).

## Thứ 7 — 18h30: Hoàng hôn + mẹt nướng

Hoàng hôn hôm đó cháy rực sau dãy núi, cả homestay ra sân đứng im như xem pháo hoa. Tối ăn **mẹt nướng Tây Bắc** (ba chỉ cuốn cải mèo, cánh gà, cơm lam, khoai bản) quanh bếp than — kiểu bữa ăn mà ở Hà Nội có tiền cũng không mua được đúng không khí này.

![Hoàng hôn đỏ rực sau dãy núi nhìn từ vườn hoa homestay Tà Xùa](/uploads/1793636873670-a66795ee384c.jpg)

22h, trời quang, ngửa cổ lên là **trời sao dày đặc**. Ngồi thêm tiếng nữa chỉ để... không làm gì cả. Đúng nghĩa chữa lành, không phải kiểu nói cho sang.

## Chủ nhật — 5h15: Săn mây hiệp hai

Sáng thứ hai mây mỏng hơn nhưng lại có **mây luồn** — những dải mây chảy qua khe núi như dòng sông. Mỗi sáng ở Tà Xùa là một "phiên bản" mây khác nhau, đó là lý do người ta đi mãi không chán.

9h ăn sáng, trả phòng, gửi đồ ở homestay rồi đi cafe. 12h30 lên xe về. 18h30 có mặt Hà Nội, kịp ăn tối ở nhà, sẵn pin đầy cho thứ 2.

## Tổng kết chi phí (1 người, đi 2 người chia phòng)

- Vé cabin khứ hồi: **500.000đ**
- Phòng 1 đêm (chia đôi): **500.000đ**
- Ăn + cafe 2 ngày: **350.000đ**
- Xe máy + xăng + vé cổng: **180.000đ**

**Tổng: ~1.530.000đ** — cho 48 giờ đổi hẳn không khí. Không cần nghỉ phép ngày nào.

Muốn đi đúng lịch này? Ghép vé xe + phòng còn trống theo ngày ngay tại [trang combo](/combo), hoặc xem phiên bản chi tiết hơn ở [lịch trình 2 ngày 1 đêm](/kinh-nghiem/lich-trinh-ta-xua-2-ngay-1-dem). Đi lần đầu nên đọc thêm [8 sai lầm thường gặp](/kinh-nghiem/sai-lam-lan-dau-di-ta-xua) — toàn lỗi mình suýt mắc đủ.`,
  },

  // ───────────────────────── 5. Giá homestay Tà Xùa ─────────────────────────
  {
    slug: "gia-homestay-ta-xua-ngay-thuong-cuoi-tuan-le",
    title: "Giá homestay Tà Xùa 2026–2027: ngày thường, thứ 7 và lễ Tết chênh bao nhiêu?",
    excerpt:
      "Cùng một phòng ở Tà Xùa có thể chênh 400–600k giữa ngày thường và tối thứ 7. Bảng giá thật theo từng hạng phòng, các khoản phụ thu và mẹo đặt đúng giá, tránh bị hớ.",
    topic: "cam-nang",
    coverImage: "/uploads/1793637189999-1ef26ce29264.jpg",
    content: `"Sao tuần trước bạn mình ở có 600k mà mình hỏi lại báo 950k?" — câu hỏi kinh điển của người lần đầu đặt phòng Tà Xùa. Không ai "chặt chém" bạn cả: **giá homestay ở đây chạy theo ngày trong tuần**, và chênh lệch giữa ngày thường với tối thứ 7, lễ Tết là rất lớn. Bài này tổng hợp mặt bằng giá thật (khảo sát tháng 11/2026 từ bảng giá các homestay đang niêm yết trên Tà Xùa Booking) để bạn tự tính được chuyến đi của mình.

## Quy luật giá: 3 mức cho cùng 1 phòng

Hầu hết homestay Tà Xùa niêm yết theo 3 mức:

- **Ngày thường** (thường tính Chủ nhật đến thứ 6): mức rẻ nhất.
- **Tối thứ 7**: cao hơn ngày thường **200.000–500.000đ/phòng**, vì gần như cả Tà Xùa chỉ "sống" bằng khách cuối tuần.
- **Lễ, Tết**: cao nhất, thường gấp rưỡi ngày thường, và nhiều nơi **không nhận hoàn/hủy/dời** với phòng lễ.

Một số home còn yêu cầu **cuối tuần ở theo cặp đêm** (thứ 6+7 hoặc 7+CN), không bán lẻ đêm thứ 7 — đi 1 đêm đúng tối thứ 7 sẽ khó đặt vào mùa cao điểm.

## Mặt bằng giá theo hạng phòng (cập nhật 11/2026)

- **Phòng đơn 2 khách** (wc khép kín): ngày thường **600.000–800.000đ**, thứ 7 **950.000–1.000.000đ**, lễ **1.200.000đ**
- **Phòng đơn có bồn tắm view núi**: ngày thường **800.000đ**, thứ 7 **1.000.000đ**, lễ **1.200.000đ**
- **Phòng đôi 2 giường / gia đình 4 khách**: ngày thường **900.000–1.000.000đ**, thứ 7 **1.300.000–1.400.000đ**, lễ **1.500.000–1.600.000đ**
- **Phòng 3 giường 6 khách**: ngày thường **1.200.000đ**, thứ 7 **1.500.000đ**, lễ **1.700.000đ**
- **Bungalow VIP kính 1–2 mặt**: ngày thường **800.000–900.000đ**, thứ 7 **1.200.000–1.400.000đ**, lễ **1.500.000–1.600.000đ**

![Phòng bungalow kính nhìn thẳng ra thung lũng mây ở Tà Xùa](/uploads/1793637189999-1ef26ce29264.jpg)

Nhìn chung: **đi ngày thường rẻ hơn tối thứ 7 khoảng 30–40%**, phòng vắng, săn mây vẫn đẹp như nhau — nếu xin nghỉ được 1 ngày giữa tuần thì đó là "deal" tốt nhất ở Tà Xùa, không mã giảm giá nào bằng.

## Các khoản phụ thu cần biết trước

- **Ngủ ghép quá tiêu chuẩn**: ~**200.000đ/người/đêm** (lễ có nơi 300.000đ). Trẻ dưới 6 tuổi thường miễn phí 1 bé/phòng.
- **Nhận phòng sớm / trả muộn**: tính theo khung giờ, khoảng 30–50% giá niêm yết tùy mốc (chuẩn chung: check-in 14h, check-out 12h). Khách đi xe cabin đêm đến lúc 4–5h sáng nên hỏi trước chính sách này.
- **Decor sinh nhật/honeymoon**: ~100.000đ/phòng nếu nhờ homestay chuẩn bị.
- **Đặt cọc**: phổ biến **50% khi chốt phòng**, phần còn lại thanh toán lúc nhận phòng. Quy định hoàn/hủy mỗi nơi một khác — đọc kỹ, đặc biệt phòng lễ Tết.

![Phòng kính với ghế bập bênh và view mây sát giường ở homestay Tà Xùa](/uploads/1793637360001-8db1c2ed79b2.jpg)

## 5 mẹo đặt phòng đúng giá, tránh bị hớ

- **So giá theo đúng NGÀY bạn đi**, đừng so "giá từ". Trên [trang homestay của Tà Xùa Booking](/homestay), chọn ngày nhận – trả phòng là giá từng phòng hiện đúng đêm đó, kèm tình trạng còn trống đồng bộ từ sổ phòng chủ nhà.
- **Giá niêm yết là giá chuẩn** — các homestay ở đây quản rất chặt chuyện cộng tác viên bán chênh giá, phát hiện là hủy phòng. Thấy ai báo cao hơn hẳn bảng giá thì nên hỏi lại.
- **Đặt combo xe + phòng** nếu đi từ Hà Nội không tự lái: [trang combo](/combo) tự ghép vé cabin khứ hồi với phòng trống, mỗi khách rẻ hơn 50.000đ so với đặt lẻ.
- **Đi nhóm đông** nên nhắm phòng 3 giường/phòng gia đình: tính đầu người rẻ hơn thuê nhiều phòng đơn. Nhóm 10–20 người xem bài [thuê nguyên homestay](/kinh-nghiem/di-ta-xua-nhom-dong-thue-nguyen-homestay).
- **Ước tổng chi phí cả chuyến** (xe + phòng + ăn) trước khi đi bằng bài [chi phí du lịch Tà Xùa tự túc](/kinh-nghiem/chi-phi-du-lich-ta-xua-tu-tuc) — 1 triệu/người vẫn đi được nếu khéo chọn ngày.

## Câu hỏi nhanh

**Giá trên đã gồm ăn sáng chưa?** Đa số chưa — ăn sáng ở Tà Xùa thường gọi riêng (mỳ tôm trứng ~35k) hoặc ra quán, xem [ăn sáng ở Tà Xùa](/kinh-nghiem/an-sang-ta-xua-quan-mo-som).

**Mùa nào giá tốt?** Giá niêm yết ít đổi theo mùa, nhưng mùa hè (5–8) vắng khách, dễ xin nhận phòng sớm, ở ngày thường thoải mái. Mùa mây 11–3 nên đặt trước 1–2 tuần cho cuối tuần.

**Ở đâu xem được phòng trống theo ngày mà không phải nhắn từng home?** Chính là [taxuabooking.com/homestay](/homestay) — lịch trống của từng phòng được cập nhật hằng ngày từ chủ nhà, chọn ngày là thấy ngay còn phòng nào, giá bao nhiêu.`,
  },
];

async function main() {
  for (const a of ARTICLES) {
    const exists = await prisma.article.findUnique({ where: { slug: a.slug } });
    if (exists) {
      console.log(`Bỏ qua (đã có): ${a.slug}`);
      continue;
    }
    await prisma.article.create({
      data: {
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        content: a.content,
        coverImage: a.coverImage,
        topic: a.topic,
        published: true,
      },
    });
    console.log(`Đã đăng: ${a.title}`);
  }
  console.log("Xong.");
}
main().finally(() => prisma.$disconnect());
