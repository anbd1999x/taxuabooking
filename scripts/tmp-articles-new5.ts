/**
 * Đăng 5 bài viết kinh nghiệm MỚI (dùng ẢNH THẬT từ kho /uploads của các cơ sở
 * ở Tà Xùa). Bỏ qua bài có slug đã tồn tại. Chạy: npx tsx scripts/tmp-articles-new5.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

interface Art { slug: string; title: string; excerpt: string; topic: string; coverImage: string; content: string; }

const ARTICLES: Art[] = [
  // ───────────────────────── 1. Quà / đặc sản Tà Xùa ─────────────────────────
  {
    slug: "qua-ta-xua-mua-gi-lam-qua",
    title: "Mua gì làm quà ở Tà Xùa? 7 đặc sản xách về được lòng cả nhà (2026)",
    excerpt:
      "Lên Tà Xùa ngoài săn mây thì về tay không hơi phí. Đây là 7 món đặc sản đáng mua làm quà, mua ở đâu, giá bao nhiêu và cách chọn để không bị 'hớ'.",
    topic: "an-uong",
    coverImage: "/uploads/1793629288095-c7760bcba177.jpg",
    content: `Chuyến nào lên Tà Xùa tôi cũng tự nhủ "đi chơi thôi, mua gì cho mệt", rồi lúc về vẫn lỉnh kỉnh một túi quà. Lý do đơn giản: đồ ở đây **ngon thật, rẻ thật, và nhiều món dưới xuôi không có**. Nếu bạn cũng sắp đi, đây là danh sách 7 món tôi thấy đáng xách về nhất, kèm chỗ mua và vài mẹo chọn để khỏi mua nhầm.

## 1. Trà Shan Tuyết cổ thụ — "đặc sản số 1" của Tà Xùa

Nếu chỉ được mua một món, tôi chọn **trà Shan Tuyết**. Lá trà hái từ những cây chè cổ thụ hàng trăm năm trên núi cao, búp phủ lớp lông trắng như tuyết (nên mới có tên "Shan Tuyết"). Pha ra nước vàng óng, vị chát nhẹ rồi ngọt hậu rất lâu, uống một lần là nhớ.

![Không gian quán cà phê – trà ở trung tâm Tà Xùa](/uploads/1793629253775-62077fb693d6.jpg)

- **Nên mua loại nào:** trà búp (đắt hơn, ngon nhất), trà khô đóng gói hút chân không để tặng cho lịch sự. Giá dao động vài trăm nghìn/kg tuỳ loại.
- **Mẹo chọn:** xin thử pha trước khi mua, ngửi mùi (thơm cốm, không hắc), nhìn búp còn nguyên và có lông trắng. Mua ở quán/hộ có thương hiệu rõ ràng thay vì hàng rong.
- Muốn hiểu kỹ hơn, đọc riêng bài [Trà Shan Tuyết cổ thụ Tà Xùa](/kinh-nghiem/tra-shan-tuyet-ta-xua).

## 2. Táo mèo & rượu táo mèo

[Táo mèo](/kinh-nghiem/tao-meo-ta-xua) (sơn tra) là quả đặc trưng vùng này — chua chát, giòn. Người ta ngâm đường làm nước giải khát, ngâm rượu, hoặc sấy dẻo. **Rượu táo mèo** và **táo mèo ngâm mật** là món quà biếu các bác lớn tuổi rất hợp.

- **Mùa quả:** khoảng tháng 8–10, mua tươi được. Ngoài mùa thì mua dạng ngâm sẵn, sấy dẻo, siro.
- **Mẹo:** hỏi rõ ngâm bao lâu, đường hay mật; nếm thử vị trước khi lấy can to.

## 3. Thịt trâu / thịt lợn gác bếp

Món "ăn là nghiện" của Tây Bắc: thịt tẩm mắc khén, hạt dổi rồi gác bếp hun khói. Xé ra chấm chẳm chéo, nhâm nhi là hết ý. Mua chân không mang về được xa.

![Món ăn truyền thống Tây Bắc tại nhà hàng ở Tà Xùa](/uploads/1793641957150-3b3201dd9775.jpg)

- **Ăn thử trước khi mua** ở các quán như [Nhà Hàng A Phủ](/nha-hang/nha-hang-a-phu-tinh-hoa-am-thuc-ta-xua) hay các [nhà hàng Tà Xùa](/nha-hang) rồi mới quyết mua mang về.
- **Mẹo:** chọn miếng khô vừa, thớ thịt đỏ nâu tự nhiên; tránh miếng quá đen (hun cháy) hoặc còn ướt (dễ mốc khi mang xa).

## 4. Mật ong rừng & mắc khén, hạt dổi

- **Mật ong rừng** vùng núi cao sánh, thơm — nhớ hỏi mật rừng hay mật nuôi.
- **Mắc khén, hạt dổi** là "linh hồn" gia vị Tây Bắc, nhẹ, rẻ, dễ mang. Mua về ướp đồ nướng là bữa cơm nhà thơm hẳn.

## 5. Măng khô, nấm hương rừng

Đồ khô gọn nhẹ, để được lâu, hợp làm quà cho mẹ và các bác nội trợ. Măng khô Tây Bắc dày, ngọt; nấm hương rừng thơm đậm hơn nấm trồng.

## 6. Thổ cẩm H'Mông: khăn, túi, ví

Muốn quà "có chất vùng cao" mà không phải đồ ăn thì chọn **đồ thổ cẩm** thêu tay của người H'Mông — khăn, túi, ví nhỏ. Vừa đẹp, vừa ủng hộ bà con bản địa.

## 7. Cà phê Arabica vùng cao

Nhiều quán ở Tà Xùa tự rang xay, có bán cà phê hạt/bột đóng gói mang về. Vừa nhâm nhi lúc săn mây, vừa mua một gói làm quà cho hội "nghiện cà phê" ở cơ quan. Gợi ý vài quán trong bài [cà phê săn mây Tà Xùa](/kinh-nghiem/ca-phe-san-may-ta-xua).

![Khung cảnh núi đồi Tà Xùa nhìn từ homestay](/uploads/1793855540301-d3c403997f37.jpg)

## Mẹo mua quà ở Tà Xùa không bị "hớ"

- **Hỏi giá trước, nếm thử trước.** Đồ ăn đặc sản gần như quán nào cũng cho thử.
- **Ưu tiên mua ở homestay/quán quen** nơi bạn ở — chủ nhà thường chỉ mối uy tín, đôi khi gói hộ, gửi hộ.
- **Đồ khô để cuối hành trình mới mua** cho đỡ phải xách theo cả chuyến.
- **Đi xe cabin thì nhắn tài xế** chừa chỗ để đồ; mua can rượu/chai mật nhớ bọc kỹ.

> Mẹo nhỏ: nếu đặt phòng và xe qua [Tà Xùa Booking](/homestay), bạn có thể nhắn Zalo hỏi luôn chủ homestay món nào nên mua ở khu mình ở — đỡ phải dò giá từng nơi.

Về đến nhà, pha ấm trà Shan Tuyết mời bố mẹ, bày đĩa thịt gác bếp hôm liên hoan — tự nhiên chuyến đi Tà Xùa như được "kéo dài" thêm vài ngày. Đó mới là giá trị thật của một món quà vùng cao.`,
  },

  // ───────────────────────── 2. Mùa đông mặc gì ─────────────────────────
  {
    slug: "ta-xua-mua-dong-lanh-mac-gi",
    title: "Tà Xùa mùa đông lạnh cỡ nào? Mặc gì, có băng giá không (2026–2027)",
    excerpt:
      "Mùa đông là mùa mây đẹp nhất Tà Xùa nhưng cũng lạnh nhất. Nhiệt độ bao nhiêu, có băng giá không, mặc gì và chọn phòng thế nào để vừa săn mây vừa không run cầm cập.",
    topic: "cam-nang",
    coverImage: "/uploads/1793632908664-dbe15c23f9e5.png",
    content: `Lần đầu lên Tà Xùa giữa tháng 12, tôi mặc đúng một chiếc áo phao mỏng kiểu "đi Đà Lạt" — và hối hận ngay đêm đầu. Trên này độ cao 1.500–1.800m, đêm mùa đông lạnh hơn dưới xuôi rất nhiều. Bài này tôi tổng hợp lại để bạn không mắc sai lầm như tôi.

## Tà Xùa mùa đông lạnh cỡ nào?

Mùa đông ở Tà Xùa kéo dài khoảng **tháng 11 đến tháng 2**, cũng chính là **mùa săn mây đẹp nhất năm**.

- **Ban ngày:** thường 10–18°C, có nắng thì ấm áp dễ chịu.
- **Ban đêm và sáng sớm:** hay xuống **5–10°C**, những đợt rét đậm có thể còn **2–5°C**, đỉnh núi lạnh hơn.
- **Gió:** đây mới là "kẻ thù" thật sự. Đứng trên sống lưng khủng long hay đỉnh gió lúc 5–6h sáng, gió buốt làm cảm giác lạnh hơn nhiệt độ thực vài độ.

Xem thêm dự báo chi tiết trong bài [thời tiết Tà Xùa theo tháng](/kinh-nghiem/thoi-tiet-ta-xua-theo-thang).

## Có băng giá, sương muối không?

Có — nhưng không phải lúc nào cũng gặp. Vào những **đợt rét đậm, rét hại** (thường tháng 12–1), Tà Xùa có thể xuất hiện **sương muối, băng giá** đọng trên cỏ và lá cây vào sáng sớm, đẹp lạ nhưng đi lại trơn trượt. Băng tuyết dày thì hiếm và không đoán trước được. Nếu "săn" được băng giá là may mắn, còn mục tiêu chính vẫn nên là biển mây.

![Phòng kính nhìn ra biển mây mùa đông ở Tà Xùa](/uploads/1793635752150-611bfc9f2be5.jpg)

## Mặc gì để vừa ấm vừa gọn? (nguyên tắc 3 lớp)

Bí quyết không phải mặc thật dày một lớp, mà là **mặc nhiều lớp mỏng** để cởi/khoác linh hoạt theo nắng–gió:

- **Lớp trong (giữ nhiệt):** áo giữ nhiệt (heat-tech), quần legging/giữ nhiệt mặc trong quần dài.
- **Lớp giữa (giữ ấm):** áo len/nỉ hoặc áo lông cừu.
- **Lớp ngoài (chắn gió, chống nước):** áo phao hoặc áo khoác gió dày — **quan trọng nhất**, vì gió mới là thứ làm bạn lạnh.
- **Phụ kiện đừng quên:** **mũ len, khăn, găng tay, tất dày**. 70% nhiệt mất qua đầu – cổ – tay, giữ ấm mấy chỗ này là ăn thua.
- **Giày:** giày thể thao/giày bệt bám tốt. Săn mây phải đi bộ, leo mỏm đá — tránh dép và giày trơn.

Xem thêm [checklist đồ cần chuẩn bị khi đi Tà Xùa](/kinh-nghiem/chuan-bi-gi-khi-di-ta-xua).

## Chọn phòng mùa đông: ấm mới là quan trọng

Nhiều bạn chỉ mê phòng kính view mây mà quên hỏi về sưởi — tối ngủ run là mất vui. Khi đặt phòng mùa đông, nhớ hỏi:

- **Có đệm sưởi / chăn điện / điều hoà 2 chiều không?** Đây là thứ quyết định giấc ngủ ngon trên núi.
- **Nước nóng mạnh không?** Tắm nước nóng tối mùa đông là "cứu cánh".
- **Phòng kín gió không?** Phòng kính đẹp nhưng nếu hở gió thì đêm lạnh buốt.

![Phòng gỗ ấm cúng có ban công ở Tà Xùa](/uploads/1793634651804-c4e219ae6338.png)

Gợi ý: các homestay như [Bản Mây Tà Xùa Retreat](/homestay/ban-may-ta-xua-retreat), [Mống Vàng Retreat](/homestay/mong-vang-retreat) (phòng full gỗ ấm), hay [Chung Chinh](/homestay/chung-chinh-homestay) (nhà sàn kính) đều có phòng giữ ấm tốt. Sang hơn thì chọn **phòng bồn tắm** — tối mùa đông ngâm bồn nước nóng nhìn ra mây là trải nghiệm đáng tiền.

![Phòng bồn tắm nước nóng view mây mùa đông](/uploads/1793633016458-d19dfcbdb7e8.png)

Trên [trang homestay](/homestay) có bộ lọc tiện ích (bồn tắm, view mây…) kèm tình trạng phòng theo ngày — lọc nhanh phòng còn trống đúng dịp bạn đi.

## Mấy lưu ý nhỏ cho chuyến mùa đông

- **Sạc đầy pin, mang sạc dự phòng.** Trời lạnh làm pin điện thoại tụt rất nhanh — đúng lúc săn mây lại hết pin thì tiếc.
- **Dán miếng giữ nhiệt (miếng dán nóng)** bỏ vào túi áo/giày, rẻ mà hiệu quả lúc đứng chờ bình minh.
- **Son dưỡng, kem dưỡng ẩm:** hanh khô dễ nứt môi, khô da.
- **Đi xe máy đổ đèo lạnh** thì càng phải chắn gió kỹ, đeo găng — đọc thêm bài [thuê xe máy ở Tà Xùa](/kinh-nghiem/thue-xe-may-ta-xua).

> Lạnh thì có lạnh, nhưng chính cái rét ngọt, hơi thở thành khói và ly cà phê nóng giữa biển mây mới làm mùa đông Tà Xùa đáng nhớ. Cứ chuẩn bị đủ ấm, phần còn lại để thiên nhiên lo.`,
  },

  // ───────────────────────── 3. Chọn cung săn mây nào ─────────────────────────
  {
    slug: "san-may-ta-xua-cung-nao",
    title: "Săn mây Tà Xùa nên đi cung nào? Sống lưng khủng long, Đỉnh Gió hay Mỏm cá heo",
    excerpt:
      "Tà Xùa có nhiều điểm săn mây nhưng không phải ai cũng hợp đi hết. So sánh 4 cung phổ biến theo độ khó, thời gian, góc ảnh để bạn chọn đúng điểm cho chuyến của mình.",
    topic: "diem-den",
    coverImage: "/uploads/1793635752150-611bfc9f2be5.jpg",
    content: `"Lên Tà Xùa nên săn mây ở đâu?" là câu tôi được hỏi nhiều nhất. Vấn đề là mỗi người một kiểu: người thích đi bộ ngắm trọn biển mây, người ngại leo chỉ muốn ngồi cà phê vẫn thấy mây, người đi cùng bố mẹ cần điểm gần và dễ. Bài này tôi so sánh thẳng để bạn chọn đúng cung hợp với mình.

## Trước tiên: săn mây Tà Xùa cần gì?

Mây "lên" đẹp nhất vào **sáng sớm (khoảng 5h–8h)** mùa khô (tháng 10–4), sau một đêm trời quang và lạnh. Bí quyết và cách xem thời tiết tôi gom trong bài [kinh nghiệm săn mây Tà Xùa](/kinh-nghiem/kinh-nghiem-san-may-ta-xua). Còn dưới đây là chuyện **chọn chỗ đứng**.

![Biển mây trắng cuộn dưới thung lũng nhìn từ Tà Xùa](/uploads/1793855540301-d3c403997f37.jpg)

## 1. Sống lưng khủng long — biểu tượng, nhưng cần sức

Dải núi hẹp chạy dài giữa hai bên là vực mây — đứng giữa "sống lưng" thấy mây hai bên là khung hình kinh điển của Tà Xùa.

- **Độ khó:** trung bình–khó. Phải đi bộ trên đường mòn hẹp, có đoạn dốc; gió mạnh, cần cẩn thận.
- **Hợp với:** người khoẻ, mê ảnh "để đời", không ngại dậy sớm và đi bộ.
- **Lưu ý:** đi giày bám tốt, không chen lấn ở đoạn hẹp. Chi tiết đường đi trong bài [sống lưng khủng long Tà Xùa](/kinh-nghiem/song-lung-khung-long-ta-xua).

![Quán cà phê view mây ở khu Sống lưng khủng long](/uploads/1793642586370-036b44365d16.webp)

Gần đó có vài quán như [Cà phê Bản – Sống Lưng Khủng Long](/cafe/ca-phe-ban-song-lung-khung-long), mở sớm 5h, ngồi nghỉ chân và vẫn ngắm mây được.

## 2. Đỉnh Gió — săn mây "dễ thở" nhất, gần trung tâm

Nếu ngại leo, [Đỉnh Gió](/kinh-nghiem/dinh-gio-ta-xua) là lựa chọn an toàn: gần trung tâm, lên bằng xe máy/ô tô tới sát nơi, có cả cụm quán cà phê view mây.

- **Độ khó:** dễ. Gần như không phải leo nhiều.
- **Hợp với:** người mới, nhóm có người lớn tuổi/trẻ nhỏ, ai muốn vừa nhâm nhi cà phê vừa ngắm mây.
- **Góc ảnh:** thoáng, rộng, dễ bắt cả bình minh lẫn biển mây.

![Quán cà phê săn mây ở khu Đỉnh Gió Tà Xùa](/uploads/1793631816945-0cd5911bee08.jpg)

Khu này dày đặc quán đẹp như Panorama Coffee, Cloud Coffee, Chill Coffee… tôi liệt kê riêng trong bài [cà phê săn mây theo từng khu](/kinh-nghiem/quan-ca-phe-san-may-ta-xua-theo-khu).

## 3. Mỏm cá heo & cây táo mèo cô đơn — "sống ảo" nhẹ nhàng

Mỏm đá nhô ra như lưng cá heo và cây táo mèo đứng một mình giữa đồi là hai điểm chụp ảnh được yêu thích, không đòi hỏi thể lực nhiều.

- **Độ khó:** dễ–trung bình. Đi bộ ngắn.
- **Hợp với:** cặp đôi, nhóm bạn thích ảnh nghệ, ai muốn điểm "lạ" ngoài sống lưng khủng long.
- Chi tiết trong bài [mỏm cá heo & cây táo mèo cô đơn](/kinh-nghiem/mom-ca-heo-cay-co-don-ta-xua).

## 4. Ngắm mây ngay tại homestay — "lười" mà vẫn đẹp

Thật ra nhiều hôm mây dày, bạn **chẳng cần đi đâu cả**: mở rèm phòng kính hoặc ra ban công homestay là mây đã tràn tới cửa. Đây là lựa chọn số 1 cho người lười dậy sớm hoặc trời quá lạnh.

- **Hợp với:** gia đình, người cần nghỉ ngơi, ai ở phòng view mây/phòng kính.
- Chọn phòng hướng thung lũng ở các homestay như [Chung Chinh](/homestay/chung-chinh-homestay), [Dốc Mơ](/homestay/doc-mo-homestay), [Bản Mây Retreat](/homestay/ban-may-ta-xua-retreat) hay [Mống Vàng](/homestay/mong-vang-retreat).

## Bảng chọn nhanh theo nhu cầu

- **Khoẻ, mê ảnh để đời:** Sống lưng khủng long.
- **Ngại leo / đi cùng bố mẹ, trẻ nhỏ:** Đỉnh Gió hoặc ngắm tại homestay.
- **Cặp đôi, thích góc lạ:** Mỏm cá heo, cây táo mèo cô đơn.
- **Trời quá lạnh / dậy muộn:** ban công homestay + quán cà phê gần đó.

> Gợi ý thật lòng: đừng tham đi hết trong một sáng. Chọn 1 điểm chính, dậy sớm, đứng yên đủ lâu để mây "diễn" — như thế đáng nhớ hơn là chạy vội 3 nơi rồi về tay không. Cần đặt phòng đúng khu để tiện săn mây, xem thêm [ở Tà Xùa nên chọn khu nào](/kinh-nghiem/o-ta-xua-nen-chon-khu-nao).`,
  },

  // ───────────────────────── 4. Đưa bố mẹ / người lớn tuổi ─────────────────────────
  {
    slug: "du-lich-ta-xua-cho-bo-me",
    title: "Đưa bố mẹ đi Tà Xùa: chọn homestay & lịch trình nhẹ nhàng cho người lớn tuổi",
    excerpt:
      "Tà Xùa đẹp nhưng đường đèo và dậy sớm săn mây không phải ai cũng hợp. Kinh nghiệm đưa bố mẹ, ông bà đi Tà Xùa an toàn, thoải mái mà vẫn ngắm được biển mây.",
    topic: "lich-trinh",
    coverImage: "/uploads/1793630512943-2e7be1a4032a.jpg",
    content: `Năm ngoái tôi đưa bố mẹ lên Tà Xùa, hơi lo vì bố say xe còn mẹ ngại leo trèo. Kết quả lại là chuyến đi cả nhà nhớ mãi — bí quyết nằm ở chỗ **chọn đúng cách đi, đúng phòng và đi thật chậm**. Nếu bạn cũng đang tính đưa bố mẹ, ông bà đi, bài này dành cho bạn.

## Đi lại: ưu tiên êm và ít say xe

Đoạn dễ mệt nhất là **15km đèo cuối** từ ngã ba lên trung tâm Tà Xùa, nhiều khúc cua.

- **Xe cabin (giường nằm):** êm và đỡ mệt nhất cho người lớn tuổi — lên xe tối ở Hà Nội, ngủ một giấc là tới. Chọn tầng dưới cho bố mẹ dễ lên xuống. Xem [trải nghiệm xe cabin đi Tà Xùa](/kinh-nghiem/trai-nghiem-xe-cabin-di-ta-xua) và [giá vé](/xe-cabin).
- **Ô tô riêng:** chủ động, dừng nghỉ được, nhưng tài xế phải quen đường đèo.
- **Chống say xe:** uống thuốc trước 30 phút, ngồi ghế trước, mang theo nước gừng, dầu gió. Chi tiết trong bài [mẹo chống say xe đèo lên Tà Xùa](/kinh-nghiem/meo-chong-say-xe-deo-ta-xua).

**Gợi ý tiện nhất:** đặt [combo xe cabin + homestay](/combo) để đi một mạch tới nơi, không phải trung chuyển nhiều lần — đỡ mệt cho người lớn tuổi.

## Chọn homestay: gần trung tâm, ít bậc thang, ấm

Với bố mẹ, tôi ưu tiên **ở gần trung tâm** để gần quán ăn, gần chỗ đỗ xe, cần gì cũng tiện.

- **Phòng ở tầng thấp, ít bậc thang, lối đi phẳng.** Hỏi kỹ chủ nhà trước khi đặt.
- **Phòng ấm, nước nóng mạnh, có sưởi** — quan trọng với người lớn tuổi, nhất là mùa đông.
- **Nhà vệ sinh khép kín, có tay vịn càng tốt.**

![Homestay ấm cúng ở trung tâm Tà Xùa](/uploads/1793634399286-8d481ac14060.jpg)

Gợi ý vài nơi gần trung tâm, phòng rộng dễ đi như [Cỏ Lạ Homestay](/homestay/co-la-homestay), [Lang Thang Homestay](/homestay/lang-thang-homestay), hay các homestay có **phòng family** cho cả nhà ở chung. Trên [trang homestay](/homestay) lọc theo khu "Trung tâm" và chọn phòng nhiều giường là nhanh nhất; xem thêm [ở Tà Xùa nên chọn khu nào](/kinh-nghiem/o-ta-xua-nen-chon-khu-nao).

## Săn mây kiểu "nhẹ nhàng" — không cần leo

Tin vui: bố mẹ **không cần leo sống lưng khủng long** vẫn ngắm được mây.

- **Ngay tại homestay:** chọn phòng view thung lũng/phòng kính, sáng mở rèm là thấy mây — khỏe re.
- **Đỉnh Gió:** lên tận nơi bằng ô tô/xe máy, gần như không phải đi bộ, lại có quán cà phê để ngồi. Đây là điểm hợp nhất cho người lớn tuổi (đọc [Đỉnh Gió Tà Xùa](/kinh-nghiem/dinh-gio-ta-xua)).
- **Quán cà phê view mây:** ngồi ban công nhâm nhi, ấm áp mà vẫn "săn" được mây.

![Quán cà phê có view mây, lối vào dễ đi ở Tà Xùa](/uploads/1793631390648-6c0806c2adf5.jpg)

## Lịch trình gợi ý 2 ngày 1 đêm "chậm mà chất"

**Ngày 1:** Xe cabin tối hôm trước → sáng tới Tà Xùa, về homestay nghỉ ngơi, ăn sáng nóng. Trưa ăn cơm, chiều đi dạo trung tâm, uống cà phê ngắm hoàng hôn. Tối ăn lẩu/đồ nướng ấm bụng tại homestay hoặc [nhà hàng gần đó](/nha-hang).

**Ngày 2:** Dậy thong thả (không cần 4h sáng), ngắm mây ngay tại homestay hoặc ghé Đỉnh Gió. Ăn sáng, mua chút [đặc sản làm quà](/kinh-nghiem/qua-ta-xua-mua-gi-lam-qua) rồi lên xe chiều về.

Nếu muốn nhàn hơn nữa, tham khảo [lịch trình Tà Xùa 2 ngày 1 đêm](/kinh-nghiem/lich-trinh-ta-xua-2-ngay-1-dem) và [du lịch cùng gia đình & trẻ nhỏ](/kinh-nghiem/du-lich-ta-xua-cung-gia-dinh-tre-nho).

## Vài lưu ý sức khỏe

- **Độ cao 1.500m+** nên người huyết áp, tim mạch đi lại thong thả, nghỉ nhiều, giữ ấm.
- **Mang theo thuốc cá nhân** đầy đủ — Tà Xùa có hiệu thuốc nhỏ nhưng không đầy đủ như dưới xuôi.
- **Đi giày bệt bám tốt**, tránh dép khi ra các điểm ngắm mây.
- **Giữ ấm sáng sớm** nếu dậy săn mây.

> Với bố mẹ, thứ quý nhất không phải check-in được bao nhiêu điểm, mà là cả nhà có một buổi sáng ngồi bên nhau nhìn mây trôi, uống ngụm trà nóng. Cứ đi chậm lại, Tà Xùa sẽ dịu dàng với người lớn tuổi hơn bạn nghĩ.`,
  },

  // ───────────────────────── 5. Cà phê săn mây theo khu ─────────────────────────
  {
    slug: "quan-ca-phe-san-may-ta-xua-theo-khu",
    title: "Cà phê săn mây Tà Xùa theo từng khu: Đỉnh Gió, Khe Cải, Sống lưng khủng long",
    excerpt:
      "Không cần leo núi vẫn ngắm được biển mây — chỉ cần chọn đúng quán cà phê. Danh sách quán cà phê view mây đẹp ở Tà Xùa, chia theo từng khu để bạn dễ ghé.",
    topic: "an-uong",
    coverImage: "/uploads/1793642719009-eb5261858448.jpg",
    content: `Có một sự thật dễ chịu: ở Tà Xùa, bạn **không nhất thiết phải leo sống lưng khủng long** mới thấy mây. Rất nhiều quán cà phê nằm ngay rìa thung lũng, chỉ cần kéo ghế ra ban công là mây cuộn ngay dưới chân. Dưới đây là các quán tôi thấy đáng ngồi nhất, chia theo từng khu để bạn tiện ghé theo lịch trình.

Tổng quan trải nghiệm "ngồi ban công chạm vào mây" tôi viết trong bài [cà phê săn mây Tà Xùa](/kinh-nghiem/ca-phe-san-may-ta-xua) — còn đây là danh sách cụ thể theo khu.

## Khu Đỉnh Gió — "thủ phủ" cà phê săn mây

[Đỉnh Gió](/kinh-nghiem/dinh-gio-ta-xua) gần trung tâm, lên tận nơi bằng xe, view thoáng — nên tập trung dày đặc quán đẹp. Nếu chỉ có một buổi, cứ lên đây là chắc ăn.

![Quán cà phê view rừng mây ở khu Đỉnh Gió Tà Xùa](/uploads/1793642744980-1baf2236da73.jpg)

- **[Panorama Coffee](/cafe/panorama-coffee)** — view rộng đúng như tên, đồ uống từ 40.000đ, mở 6h–18h.
- **[Cloud Coffee – Cloud Forest](/cafe/cloud-coffee-cloud-forest-ta-xua)** — không gian "rừng mây" nên thơ.
- **[Chill Coffee](/cafe/chill-cafe)**, **[Mây Bay Coffee](/cafe/may-bay-coffee)**, **[An's Coffee](/cafe/an-s-coffee-ta-xua)**, **[Hiên](/cafe/hien)** — cùng cụm, dễ đi bộ qua lại chọn góc ưng ý.
- **[Mị ơi Cafe](/cafe/mi-oi-cafe)** — đồ uống từ 50.000đ, mở 7h–18h.

## Khu Khe Cải — yên tĩnh, "chill" đúng nghĩa

Khe Cải cách trung tâm một quãng, vắng và tĩnh hơn, hợp để ngồi lâu đọc sách, nhâm nhi cả buổi sáng.

![Không gian quán cà phê yên tĩnh ở khu Khe Cải](/uploads/1793642960431-d89345c1618b.jpg)

- **[Khe Cải Coffee (Ngày Nào Đó)](/cafe/khe-cai-coffee-ngay-nao-do)** — mở sớm 6h–19h, hợp buổi sáng săn mây.
- **[Lili Mountain – Tiệm cà phê Tử Tế](/cafe/lili-mountain-tiem-ca-phe-tu-te)** — tên đã thấy dễ thương.
- **[Trạm Mây Tà Xùa](/cafe/tram-may-ta-xua-2)**, **[Chillout Village](/cafe/chillout-village-nha-hang-cafe)** — vừa cà phê vừa ăn uống được.

## Khu Sống lưng khủng long — vừa cà phê vừa săn mây "xịn"

Nếu đã lặn lội ra [sống lưng khủng long](/kinh-nghiem/song-lung-khung-long-ta-xua), đừng vội về — ghé quán gần đó ngồi nghỉ, vẫn giữ nguyên view biển mây huyền thoại.

![Quán cà phê ngắm hoàng hôn trên biển mây Tà Xùa](/uploads/1793642603022-d340540ca3c7.jpg)

- **[Cà phê Bản – Sống Lưng Khủng Long](/cafe/ca-phe-ban-song-lung-khung-long)** — mở rất sớm 5h–19h, đúng khung giờ săn mây.
- **[Sunset Clouds Coffee](/cafe/sunset-clouds-coffee)** — như tên gọi, "tủ" của hoàng hôn trên mây.

## Khu trung tâm — tiện, gần chỗ ở

Ở trung tâm thì khỏi đi đâu xa, cà phê sáng ngay gần homestay.

- **[Thào Coffee Tà Xùa](/cafe/thao-coffee-ta-xua)** — mở 5h–22h, đồ uống từ 40.000đ, tiện cả sáng sớm lẫn tối muộn.
- **[Nhà H'Mông](/cafe/nha-h-mong)** — đậm chất bản địa, mở tới khuya.
- **[MẬN – The Cocktail Bar](/cafe/man-the-cocktail-bar)** — cho ai muốn đổi gió buổi tối.

## Mẹo "săn mây tại quán" cho đẹp

- **Đi sớm giữ chỗ ban công.** Quán view đẹp sáng cuối tuần rất đông; 5h30–6h là hợp lý.
- **Hỏi hướng view trước khi gọi đồ.** Ngồi đúng hướng thung lũng mới thấy mây.
- **Gọi đồ nóng** (cà phê, cacao, trà gừng) cho ấm tay lúc sáng lạnh.
- **Mặc ấm, mang theo áo khoác gió** — ngồi ngoài ban công sáng sớm lạnh hơn bạn tưởng (xem [mùa đông Tà Xùa mặc gì](/kinh-nghiem/ta-xua-mua-dong-lanh-mac-gi)).
- **Chụp ảnh:** để điện thoại ở chế độ lưới, canh đường chân trời mây — mẹo chi tiết trong bài [mẹo chụp ảnh săn mây bằng điện thoại](/kinh-nghiem/meo-chup-anh-san-may-bang-dien-thoai).

> Có hôm trời trắng xóa không lên mây, tôi vẫn thấy vui vì được ngồi yên một buổi sáng với ly cà phê nóng, nghe gió núi. Đó là kiểu "săn mây" dễ chịu nhất — và gần như không bao giờ về tay không. Xem đầy đủ [danh sách quán cà phê Tà Xùa](/cafe) để chọn nơi hợp gu.`,
  },
];

async function main() {
  let created = 0;
  for (const a of ARTICLES) {
    const existing = await prisma.article.findUnique({ where: { slug: a.slug } });
    if (existing) { console.log("SKIP (da ton tai): " + a.slug); continue; }
    await prisma.article.create({
      data: { slug: a.slug, title: a.title, excerpt: a.excerpt, content: a.content, coverImage: a.coverImage, topic: a.topic, published: true },
    });
    created++;
    console.log("CREATED: " + a.slug);
  }
  console.log("\nDone. Created " + created + "/" + ARTICLES.length + " articles.");
}
main().finally(() => prisma.$disconnect());
