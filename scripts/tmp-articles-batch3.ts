/**
 * Đăng 5 bài kinh nghiệm Tà Xùa (đợt 3) — chủ đề chưa có trên web.
 * Bỏ qua bài có slug đã tồn tại. Cần tunnel DB đang chạy (scripts/db-tunnel.cmd).
 * Chạy: npx tsx scripts/tmp-articles-batch3.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

interface Art { slug: string; title: string; excerpt: string; topic: string; coverImage: string; content: string; }

const ARTICLES: Art[] = [
  // ───────────────────────── 1. Tà Xùa về đêm ─────────────────────────
  {
    slug: "ta-xua-buoi-toi-lam-gi",
    title: "Tà Xùa buổi tối làm gì? 7 cách tận hưởng đêm trên núi không hề chán",
    excerpt:
      "Nhiều người nghĩ Tà Xùa tối là 'đi ngủ sớm'. Thật ra đêm trên độ cao gần 2.000m có cả bầu trời sao, lẩu nướng, đốt lửa, bồn tắm nóng và cả những quán nhỏ mở khuya. Đây là 7 gợi ý cho buổi tối trọn vẹn.",
    topic: "diem-den",
    coverImage: "/uploads/1793636873670-a66795ee384c.jpg",
    content: `Lần đầu lên Tà Xùa, tôi tưởng 6h tối là hết chuyện để làm: trời tối nhanh, lạnh, đường núi không đèn. Nhưng sau vài chuyến, tôi lại thấy **buổi tối mới là lúc Tà Xùa "riêng tư" nhất** — đoàn khách ngày đã về, chỉ còn tiếng gió, ánh đèn bản lấp lánh dưới thung lũng và một bầu trời đầy sao. Dưới đây là 7 cách để buổi tối của bạn không bị phí.

## 1. Ngắm hoàng hôn rồi ở lại chờ "giờ xanh"

Đừng vội về phòng khi mặt trời vừa lặn. Khoảng 15–20 phút sau hoàng hôn là **"giờ xanh"**: bầu trời chuyển tím – xanh thẫm, núi xa thành từng lớp, đèn bản bắt đầu sáng. Chụp ảnh lúc này rất có không khí.

![Hoàng hôn đỏ rực sau dãy núi nhìn từ vườn hoa homestay Tà Xùa](/uploads/1793636873670-a66795ee384c.jpg)

- Điểm gợi ý: khu Đỉnh Gió, các quán cà phê hướng tây — xem bài [ngắm hoàng hôn Tà Xùa](/kinh-nghiem/ngam-hoang-hon-ta-xua).
- Mang áo khoác ngay từ chiều: nhiệt độ có thể tụt 5–7°C chỉ trong một giờ.

## 2. Lẩu, nướng — "đặc sản" của đêm lạnh

Trời càng lạnh, nồi lẩu gà đen, lẩu cá hồi hay mâm nướng than hoa càng "đúng bài". Nhiều homestay nhận nấu riêng cho đoàn nếu bạn báo trước buổi chiều.

![Món ăn truyền thống Tây Bắc tại nhà hàng ở Tà Xùa](/uploads/1793641957150-3b3201dd9775.jpg)

- Đi đông người: tự tổ chức BBQ ở sân homestay, xem [kinh nghiệm BBQ, lẩu nướng tại homestay](/kinh-nghiem/bbq-lau-nuong-toi-homestay-ta-xua).
- Đi ít người: ra các [nhà hàng ở Tà Xùa](/nha-hang) cho tiện, gọi thêm thịt gác bếp, rau cải mèo, xôi nếp nương.
- **Mẹo:** báo giờ ăn trước, vì nhiều bếp ở bản nghỉ sớm khoảng 20h–21h.

## 3. Ngắm sao — thứ mà thành phố không cho bạn

Đêm trời quang (thường gặp vào mùa khô, tháng 10–3), bầu trời Tà Xùa có thể thấy **rất nhiều sao**, có hôm thấy cả dải Ngân Hà vào mùa hè – thu nếu không có trăng.

- Chọn đêm **không trăng hoặc trăng muộn** (đầu và cuối tháng âm lịch).
- Tắt đèn pin, để mắt quen bóng tối 10–15 phút.
- Muốn chụp: điện thoại để chế độ Đêm/Pro, phơi sáng 10–30 giây, **bắt buộc kê chắc hoặc có chân máy**.
- Không đi bộ một mình ra mép vực trong tối — ngắm ngay sân homestay là đủ đẹp.

## 4. Ngâm bồn nước nóng nhìn ra núi

Nếu chuyến này là đi "chữa lành", hãy đặt một phòng có **bồn tắm view núi**. Ngâm nước nóng giữa đêm 8–10°C, nhìn qua kính ra màn đêm và đèn bản — trải nghiệm này nhiều người thích còn hơn săn mây.

![Bồn tắm đặt sát cửa kính nhìn thẳng xuống thung lũng núi ở Tà Xùa](/uploads/1793637227451-3654f565213c.jpg)

Xem danh sách gợi ý trong bài [phòng bồn tắm view biển mây Tà Xùa](/kinh-nghiem/bon-tam-view-bien-may-ta-xua).

## 5. Ngồi quán cà phê, bar nhỏ mở muộn

Không phải quán nào cũng đóng cửa sớm. Ở khu trung tâm có vài quán mở đến tối muộn, hợp để ngồi nói chuyện, uống cacao nóng hoặc một ly cocktail nhẹ:

- [Thào Coffee Tà Xùa](/cafe/thao-coffee-ta-xua) — mở đến khoảng 22h, tiện ngay trung tâm.
- [Nhà H'Mông](/cafe/nha-h-mong) — không gian đậm chất bản địa.
- [MẬN – The Cocktail Bar](/cafe/man-the-cocktail-bar) — cho ai muốn đổi gió.

## 6. Đốt lửa trại, nướng khoai cùng chủ nhà

Nhiều homestay có bếp lửa hoặc lò sưởi ngoài sân. Hỏi chủ nhà xin ngồi cùng, nướng ngô, khoai, nghe kể chuyện bản — đây thường là đoạn ký ức mọi người nhớ lâu nhất. Nhớ hỏi trước, không tự ý đốt lửa ở đồi cỏ khô (rất dễ cháy rừng vào mùa khô).

## 7. Đi ngủ sớm — để dậy săn mây

Nghe có vẻ "phí đêm", nhưng nếu sáng mai bạn định đi [săn mây](/kinh-nghiem/kinh-nghiem-san-may-ta-xua) lúc 5h, thì **ngủ trước 23h** là lựa chọn khôn ngoan nhất. Chuẩn bị sẵn áo ấm, đèn pin, sạc dự phòng từ tối để sáng chỉ việc đi.

## Vài lưu ý an toàn buổi tối

- **Hạn chế chạy xe máy đường đèo sau 19h**, nhất là khi có sương mù dày — tầm nhìn có lúc dưới 10m.
- Nếu uống rượu (rượu táo mèo, rượu ngô khá "say lâu"), tuyệt đối không lái xe; gọi [xe ôm, taxi ở Tà Xùa](/kinh-nghiem/xe-om-taxi-ta-xua) hoặc đi bộ nếu gần.
- Giữ ấm chân và đầu khi ngồi ngoài trời; mang tất dày, mũ len.

> Một buổi tối trọn vẹn ở Tà Xùa không cần lịch trình dày: bữa lẩu nóng, vài ly trà, bầu trời sao và một giấc ngủ ngon. Chọn được chỗ ở hợp ý là đã xong một nửa — xem các [homestay Tà Xùa](/homestay) có ban công, bồn tắm, lò sưởi để đặt trước.`,
  },

  // ───────────────────────── 2. Đi Tà Xùa một mình ─────────────────────────
  {
    slug: "di-ta-xua-mot-minh",
    title: "Đi Tà Xùa một mình: kinh nghiệm solo trip an toàn, tiết kiệm và không cô đơn",
    excerpt:
      "Đi Tà Xùa một mình có an toàn không? Ở đâu rẻ mà vẫn vui, di chuyển thế nào, săn mây ra sao khi không có bạn đồng hành? Tổng hợp kinh nghiệm thực tế cho chuyến solo đầu tiên.",
    topic: "cam-nang",
    coverImage: "/uploads/1793636863449-8fe29536d4b6.jpg",
    content: `Tà Xùa là một trong những điểm **dễ đi một mình nhất** vùng Tây Bắc: có xe cabin đón tận nơi, homestay nhiều phòng cộng đồng, người bản thân thiện và các điểm săn mây đều khá gần nhau. Tôi từng đi solo hai lần — một lần tự lái xe máy, một lần đi xe cabin — và đây là những gì tôi rút ra.

![Ngồi ghế dã ngoại thư giãn trên đài ngắm mây tròn giữa biển mây Tà Xùa](/uploads/1793636863449-8fe29536d4b6.jpg)

## Đi một mình có an toàn không?

Nhìn chung **an toàn**. Rủi ro lớn nhất ở Tà Xùa không phải con người, mà là **đường đèo và thời tiết**: dốc dài, sương mù, mưa trơn. Vài nguyên tắc:

- Luôn **báo lịch trình** cho người nhà và chủ homestay (đi đâu, mấy giờ về).
- Không đi bộ/chạy xe ra các điểm hiểm như [sống lưng khủng long](/kinh-nghiem/song-lung-khung-long-ta-xua) khi trời mù hoặc gió to.
- Lưu số chủ homestay và một số [xe ôm địa phương](/kinh-nghiem/xe-om-taxi-ta-xua) phòng khi cần.
- Sóng điện thoại ở trung tâm ổn, nhưng một số khúc đèo yếu — tải bản đồ offline trước.

## Di chuyển: xe cabin là lựa chọn nhẹ đầu nhất

Đi một mình mà tự lái xe máy 200km từ Hà Nội khá mệt và rủi ro. Mình khuyên:

- **[Xe cabin](/xe-cabin) chuyến đêm**: nằm khoang riêng có rèm, sáng sớm đã đến nơi, đỡ được một đêm tiền phòng. Khoang **cabin đơn** rất hợp người đi một mình — riêng tư, an toàn. Xem thêm [trải nghiệm xe cabin đi Tà Xùa](/kinh-nghiem/trai-nghiem-xe-cabin-di-ta-xua).
- Lên đến nơi thì **[thuê xe máy](/thue-xe-may)** tại Tà Xùa (nếu tay lái vững) hoặc gọi **[xe ôm](/xe-om)** theo chặng — xe ôm bản địa còn biết giờ nào điểm nào có mây.

![Khoang nằm xe cabin đi Tà Xùa với đệm, chăn và rèm riêng tư](/uploads/1793442945574-3636c341eef1.jpg)

## Ở đâu: phòng cộng đồng hay phòng riêng?

- **Phòng cộng đồng (dorm)** — rẻ nhất, tính tiền theo người, dễ làm quen bạn đi cùng để ghép xe săn mây. Hợp người trẻ, ngủ dễ.
- **Phòng đơn/phòng đôi nhỏ** ở trung tâm — riêng tư hơn, đi bộ ra quán ăn, cà phê. Ngày thường giá mềm hơn cuối tuần khá nhiều, xem [giá homestay ngày thường – cuối tuần – lễ](/kinh-nghiem/gia-homestay-ta-xua-ngay-thuong-cuoi-tuan-le).
- Chọn khu gần trung tâm để không phải chạy xe tối — tham khảo [ở Tà Xùa nên chọn khu nào](/kinh-nghiem/o-ta-xua-nen-chon-khu-nao).

## Săn mây khi không có bạn đồng hành

- **Hỏi chủ homestay** dự báo mây tối hôm trước — họ thường đoán chuẩn hơn app thời tiết.
- **Ghép nhóm** với khách cùng homestay, chia tiền xe ôm/taxi.
- Chọn điểm săn mây **ngay tại homestay hoặc quán cà phê** view thung lũng — an toàn, có chỗ ngồi, có đồ nóng. Gợi ý: [quán cà phê săn mây theo từng khu](/kinh-nghiem/quan-ca-phe-san-may-ta-xua-theo-khu).
- Chụp ảnh một mình: mang chân máy mini + hẹn giờ 10 giây hoặc chế độ chụp liên tục. Mẹo bố cục ở bài [chụp ảnh săn mây bằng điện thoại](/kinh-nghiem/meo-chup-anh-san-may-bang-dien-thoai).

## Chi phí tham khảo cho 1 người (2 ngày 1 đêm)

- **Xe cabin khứ hồi:** tiết kiệm ~600–800k · thoải mái ~800k–1tr (khoang đơn đẹp)
- **Ở 1 đêm:** tiết kiệm ~150–250k (dorm) · thoải mái ~500k–1tr (phòng riêng view)
- **Ăn uống:** tiết kiệm ~250k · thoải mái ~500k
- **Xe ôm/thuê xe:** tiết kiệm ~150k · thoải mái ~300k
- **Tổng:** tiết kiệm **~1,2–1,5 triệu** · thoải mái **~2–2,8 triệu**

*Giá chỉ để tham khảo, thay đổi theo mùa và ngày lễ. Chi tiết hơn ở bài [chi phí du lịch Tà Xùa tự túc](/kinh-nghiem/chi-phi-du-lich-ta-xua-tu-tuc).*

## Danh sách đồ "phải có" khi đi solo

- Sạc dự phòng ≥10.000mAh (lạnh làm pin tụt nhanh)
- Áo khoác gió + áo giữ nhiệt, mũ len, găng tay
- Đèn pin/đèn đội đầu nhỏ
- Ít tiền mặt (nhiều quán nhỏ, xe ôm chưa nhận chuyển khoản ổn định do sóng yếu)
- Thuốc say xe, thuốc cảm cơ bản — xem [mẹo chống say xe đèo Tà Xùa](/kinh-nghiem/meo-chong-say-xe-deo-ta-xua)

> Đi một mình, bạn sẽ có những khoảnh khắc rất riêng: ngồi im trên đồi cỏ nhìn mây trôi, không cần chụp cho ai, không cần vội. Chuẩn bị kỹ phần xe và chỗ ở là chuyến đi gần như "thả lỏng" hoàn toàn. Đặt trước [xe cabin](/xe-cabin) và [homestay](/homestay) để khỏi lo cháy chỗ cuối tuần.`,
  },

  // ───────────────────────── 3. Mùa mưa / mùa hè ─────────────────────────
  {
    slug: "ta-xua-mua-mua-mua-he-co-nen-di",
    title: "Tà Xùa mùa hè – mùa mưa (tháng 5–9): có nên đi? Ưu, nhược và kinh nghiệm an toàn",
    excerpt:
      "Mùa hè Tà Xùa mát, xanh, vắng và rẻ — nhưng cũng là mùa mưa, đường trơn, sạt lở. Bài này giúp bạn quyết định có nên đi không, đi tháng nào, và cần lưu ý gì để an toàn.",
    topic: "cam-nang",
    coverImage: "/uploads/1793855540301-d3c403997f37.jpg",
    content: `"Mùa hè có mây không?", "mưa có đi được không?" — đây là hai câu hỏi tôi nhận nhiều nhất từ tháng 5 trở đi. Câu trả lời ngắn: **đi được, và có cái hay riêng**, nhưng cần chọn thời điểm và chuẩn bị kỹ hơn mùa khô.

## Ưu điểm của Tà Xùa mùa hè

- **Mát mẻ:** khi Hà Nội 37–38°C, Tà Xùa ban ngày khoảng 20–25°C, đêm 15–18°C — đúng nghĩa "trốn nóng".
- **Núi đồi xanh mướt:** đồi chè, đồi cỏ, ruộng bậc thang xanh nhất năm, ảnh lên rất "tươi".
- **Vắng và rẻ hơn:** ngày thường homestay dễ đặt phòng view đẹp, giá mềm hơn cao điểm mùa mây.
- **Vẫn có mây:** sau những trận mưa đêm, sáng hôm sau trời hửng nắng thường có **mây bồng bềnh dưới thung lũng**. Không dày đặc như tháng 11–1 nhưng không hiếm.
- **Cuối mùa có lúa chín:** khoảng tháng 9 có thể kết hợp đi [Xím Vàng mùa lúa chín](/kinh-nghiem/xim-vang-mua-lua-chin).

![Biển mây trắng cuộn dưới thung lũng nhìn từ Tà Xùa](/uploads/1793855540301-d3c403997f37.jpg)

## Nhược điểm cần biết

- **Mưa nhiều, mưa rào bất chợt** — có khi cả buổi chiều.
- **Đường đèo trơn, có nguy cơ sạt lở** sau mưa lớn kéo dài (đặc biệt tháng 7–8).
- **Sương mù dày** vào buổi sáng và chiều tối, tầm nhìn kém.
- Các điểm như [sống lưng khủng long](/kinh-nghiem/song-lung-khung-long-ta-xua) đi bộ trơn trượt, gió mạnh — **không nên lên khi vừa mưa**.

## Tháng nào trong mùa hè đáng đi nhất?

- **Tháng 5 – đầu tháng 6:** mưa chưa nhiều, trời trong, có ngày mây đẹp. Rất đáng đi.
- **Tháng 7 – 8:** mưa nhiều nhất. Chỉ nên đi khi theo dõi dự báo chắc chắn có vài ngày khô, và linh hoạt đổi ngày.
- **Tháng 9:** bắt đầu chuyển mùa, lúa chín, mây quay lại dần — khởi đầu cho [mùa săn mây](/kinh-nghiem/ta-xua-mua-nao-dep-nhat).

Xem thêm [thời tiết Tà Xùa theo từng tháng](/kinh-nghiem/thoi-tiet-ta-xua-theo-thang).

## Kinh nghiệm đi Tà Xùa mùa mưa an toàn

1. **Xem dự báo 3 ngày trước khi đi**, ưu tiên khung có mưa đêm – nắng sáng (cơ hội mây cao).
2. **Hạn chế tự lái xe máy từ Hà Nội.** Đi [xe cabin](/xe-cabin) để tài xế quen đường lo phần đèo dốc. Lên đến nơi mới thuê xe chạy quãng ngắn.
3. **Không chạy xe sau mưa lớn** qua các đoạn taluy cao; nghe ngóng thông tin từ chủ homestay về tình trạng đường.
4. **Tránh đi khi có cảnh báo bão/áp thấp** ảnh hưởng Bắc Bộ. Đổi lịch là quyết định đúng.
5. **Chọn phòng có view tại chỗ:** trời mưa vẫn ngồi trong phòng kính ngắm mây vờn qua là đủ thích — gợi ý [phòng bồn tắm view mây](/kinh-nghiem/bon-tam-view-bien-may-ta-xua).

![Phòng kính ở Bếp Nhà Táo với giường sát cửa sổ, mây trắng phủ kín bên ngoài](/uploads/1793637187325-d95bfdaaac8f.jpg)

## Mang gì khi đi mùa mưa?

- Áo mưa bộ (loại quần + áo, không dùng áo mưa cánh dơi khi chạy xe)
- Giày có đế bám, tránh dép xốp; mang thêm 1 đôi dép tông đi trong nhà
- Túi chống nước cho điện thoại, ví
- Áo khoác mỏng, áo giữ nhiệt nhẹ (đêm vẫn lạnh)
- Thuốc chống côn trùng, vắt (nếu đi rừng, đồi chè)

## Ở Tà Xùa trời mưa thì làm gì?

- Ngồi [quán cà phê săn mây](/kinh-nghiem/ca-phe-san-may-ta-xua) chờ mây kéo đến sau mưa.
- Thưởng thức [trà Shan Tuyết cổ thụ](/kinh-nghiem/tra-shan-tuyet-ta-xua), lẩu gà đen, thịt gác bếp.
- Khi tạnh, dạo [đồi chè cổ thụ](/kinh-nghiem/doi-che-rung-che-co-thu-ta-xua) — sau mưa lá chè xanh bóng rất đẹp (đi giày bám).

> Tà Xùa mùa hè giống một Tà Xùa "chậm" hơn: ít người, nhiều xanh, mây đến bất ngờ. Nếu bạn linh hoạt ngày giờ và ưu tiên an toàn, đây là thời điểm rất đáng để thử. Có thể đặt [combo xe cabin + homestay](/combo) để chủ động cả đi lẫn ở.`,
  },

  // ───────────────────────── 4. Văn hoá H'Mông ─────────────────────────
  {
    slug: "van-hoa-nguoi-hmong-ta-xua-dieu-nen-biet",
    title: "Văn hoá người H'Mông ở Tà Xùa: điều nên biết và phép lịch sự khi lên bản",
    excerpt:
      "Tà Xùa đẹp không chỉ vì mây mà còn vì con người. Hiểu một chút về văn hoá H'Mông — chợ phiên, Tết, trang phục, kiêng kỵ — giúp chuyến đi sâu sắc hơn và được bà con quý mến hơn.",
    topic: "diem-den",
    coverImage: "/uploads/1793636909568-e59915404418.jpg",
    content: `Phần lớn cư dân ở xã Tà Xùa (huyện Bắc Yên, Sơn La) là **người H'Mông**, sống ở các bản như Háng Đồng, Tà Xùa, Xím Vàng… Đi Tà Xùa mà chỉ săn mây rồi về thì hơi tiếc. Dành chút thời gian tìm hiểu văn hoá bản địa, bạn sẽ thấy chuyến đi "có hồn" hơn hẳn — và cũng tránh được những tình huống khó xử không đáng có.

![Bình minh ửng hồng sau rặng đào đá bên tường rào đá ở Tà Xùa](/uploads/1793636901353-c93660f17d52.jpg)

## Đôi nét về cuộc sống người H'Mông ở Tà Xùa

- **Nhà và nương:** người H'Mông sống trên sườn núi cao, canh tác nương ngô, lúa nương, trồng chè và táo mèo (sơn tra).
- **Cây chè cổ thụ:** những rừng [chè Shan Tuyết](/kinh-nghiem/tra-shan-tuyet-ta-xua) hàng trăm năm tuổi là "tài sản" của bản, gắn với sinh kế của nhiều gia đình.
- **Du lịch cộng đồng:** nhiều homestay hiện nay do chính người H'Mông làm chủ — ở nhà bà con là cách hay nhất để trải nghiệm văn hoá, đồng thời đóng góp trực tiếp cho bản.

## Trang phục và thổ cẩm

Phụ nữ H'Mông nổi bật với váy xoè xếp ly, áo thêu hoa văn sặc sỡ, khăn quấn đầu. Hoa văn trên thổ cẩm được thêu tay, có khi mất nhiều tháng cho một bộ. Nếu thích, bạn có thể:

- Thuê trang phục H'Mông chụp ảnh ở một số homestay/điểm check-in.
- Mua khăn, túi, ví thổ cẩm làm quà — xem [mua gì làm quà ở Tà Xùa](/kinh-nghiem/qua-ta-xua-mua-gi-lam-qua).

## Tết của người H'Mông

Người H'Mông ăn Tết riêng, thường **sớm hơn Tết Nguyên Đán khoảng một tháng** (khoảng tháng 11–12 âm lịch, mỗi năm mỗi khác). Dịp này có:

- Trò chơi truyền thống: **ném pao, đánh quay, bắn nỏ**.
- Tiếng **khèn Mông** và những màn múa khèn.
- Trai gái mặc trang phục đẹp nhất đi chơi Tết.

Nếu trùng lịch, đây là dịp rất đáng để trải nghiệm — và cũng đúng giữa [mùa săn mây](/kinh-nghiem/ta-xua-mua-nao-dep-nhat). Hỏi trước chủ homestay về ngày Tết cụ thể của bản.

## Ẩm thực bản địa nên thử

- **Thắng cố** (món truyền thống, vị khá đặc biệt — thử một chút cho biết)
- **Mèn mén** (bột ngô hấp), xôi nếp nương, rau cải mèo luộc
- **Thịt trâu, thịt lợn gác bếp**, gà đen, lợn bản
- **Rượu ngô, rượu táo mèo** — uống ít thôi, nhiều người bị "say lâu"

Gợi ý chỗ ăn ở bài [ăn sáng ở Tà Xùa](/kinh-nghiem/an-sang-ta-xua-quan-mo-som) và danh sách [nhà hàng Tà Xùa](/nha-hang).

## Phép lịch sự khi lên bản — 8 điều nên nhớ

1. **Xin phép trước khi chụp ảnh người**, nhất là người già và trẻ em. Nếu họ từ chối, hãy vui vẻ cảm ơn.
2. **Không tự ý vào nhà** khi chưa được mời. Một số nhà treo cành lá trước cửa là dấu hiệu kiêng khách lạ (có việc cúng bái) — đừng vào.
3. **Không chạm vào bàn thờ, cột nhà chính, bếp thiêng** trong nhà người H'Mông.
4. **Không cho trẻ em kẹo, tiền** — vô tình tạo thói quen xin khách. Nếu muốn giúp, hãy ủng hộ qua trường học, hoặc mua sản phẩm của bà con.
5. **Không hái chè, táo mèo, rau trên nương** — đó là tài sản của gia đình họ.
6. **Ăn mặc kín đáo** khi vào bản, hạn chế ồn ào, mở nhạc to ban đêm.
7. **Không xả rác** trên đồi, đặc biệt ở các điểm như [sống lưng khủng long](/kinh-nghiem/song-lung-khung-long-ta-xua), [mỏm cá heo](/kinh-nghiem/mom-ca-heo-cay-co-don-ta-xua) — mang rác về điểm tập kết.
8. **Mặc cả nhẹ nhàng, tôn trọng.** Giá đồ thủ công thường đã phản ánh công sức lớn.

![Vườn hoa cúc và lối đá của homestay trên núi lúc hoàng hôn ở Tà Xùa](/uploads/1793636868332-cc4408e65d0c.jpg)

## Vài câu tiếng H'Mông đơn giản

Học vài câu chào là cách nhanh nhất để thấy nụ cười của bà con. Hỏi chính chủ homestay cách phát âm "xin chào", "cảm ơn" theo giọng bản họ — mỗi vùng có thể nói khác đôi chút, và họ thường rất vui khi được dạy.

> Tà Xùa đẹp bền vững được là nhờ bà con giữ đất, giữ rừng chè. Mỗi lần mình chọn ở homestay của người bản địa, ăn một bữa cơm bản, mua một chiếc khăn thổ cẩm — là mình góp một phần nhỏ để nơi này tiếp tục đẹp như vậy. Xem các [homestay Tà Xùa](/homestay) để chọn chỗ ở phù hợp.`,
  },

  // ───────────────────────── 5. Mùa hoa ─────────────────────────
  {
    slug: "ta-xua-mua-hoa-dao-man-son-tra",
    title: "Tà Xùa mùa hoa (tháng 1–4): hoa đào, hoa mận, hoa sơn tra nở trắng núi",
    excerpt:
      "Sau Tết, Tà Xùa đổi áo: đào hồng ven đường, mận trắng quanh bản, rồi hoa sơn tra (táo mèo) phủ trắng sườn đồi. Đây là thời điểm vừa săn mây vừa ngắm hoa — lịch nở từng loại và chỗ ngắm đẹp.",
    topic: "diem-den",
    coverImage: "/uploads/1793636914648-ad329e3e2b82.jpg",
    content: `Người ta hay nhắc Tà Xùa với mây, ít ai nói đến hoa. Nhưng nếu đi vào **khoảng tháng 1 đến tháng 4**, bạn sẽ thấy một Tà Xùa rất khác: sắc hồng đào, trắng mận, rồi trắng tinh hoa sơn tra trên nền xanh núi — và vẫn còn trong **mùa săn mây**. Một chuyến, hai trải nghiệm.

![Nắng sớm rọi xuống biển mây trắng nhìn từ sân homestay ở Tà Xùa](/uploads/1793636914648-ad329e3e2b82.jpg)

## Lịch hoa nở ở Tà Xùa (tham khảo)

- **Hoa đào (đào phai):** khoảng tháng 12 – tháng 2 · hồng nhạt đến hồng đậm, rải rác ven đường, quanh nhà dân
- **Hoa mận:** khoảng tháng 1 – tháng 2 · trắng muốt, nở thành vườn quanh bản
- **Hoa sơn tra (táo mèo):** khoảng tháng 3 – tháng 4 · trắng, mọc thành rừng trên sườn đồi cao
- **Hoa cải, hoa dại:** rải rác mùa xuân · vàng, trắng ven nương

*Thời gian nở thay đổi theo thời tiết từng năm (rét đậm hoa nở muộn, ấm thì sớm). Hỏi chủ homestay trước khi đi để chắc ăn.*

## Hoa đào, hoa mận — sắc xuân quanh bản

Dịp quanh Tết (cả Tết H'Mông lẫn Tết Nguyên Đán), những cây đào, cây mận trong vườn nhà bà con bắt đầu nở. Không thành "biển hoa" như một số nơi, nhưng **hoa đào bên tường rào đá, nhà gỗ, có mây phía sau** là khung hình rất Tây Bắc.

![Bình minh ửng hồng sau rặng đào đá bên tường rào đá ở Tà Xùa](/uploads/1793636901353-c93660f17d52.jpg)

- **Chỗ ngắm:** dọc đường vào trung tâm, quanh các bản, sân nhiều homestay.
- **Chụp đẹp:** chụp ngược sáng buổi sáng sớm hoặc chiều muộn để cánh hoa trong suốt; lấy mây/núi làm nền.
- Nhớ **không bẻ cành** — đó là cây trong vườn nhà dân. Xem thêm [phép lịch sự khi lên bản](/kinh-nghiem/van-hoa-nguoi-hmong-ta-xua-dieu-nen-biet).

## Hoa sơn tra — "tuyết trắng" tháng 3

Sơn tra chính là cây [táo mèo](/kinh-nghiem/tao-meo-ta-xua) — đặc sản của vùng. Khoảng tháng 3, những rừng sơn tra trên sườn núi cao nở **hoa trắng phủ kín cành**, nhìn xa như tuyết. Đây là cảnh ít người biết, vắng khách, rất hợp chụp ảnh "đi trốn".

- Rừng sơn tra thường ở vùng cao, đường có đoạn đất đá — nên **đi cùng người bản địa hoặc xe ôm quen đường**.
- Mang giày bám, áo khoác — vùng cao gió lạnh hơn trung tâm.

## Vẫn là mùa mây — săn cả hai trong một chuyến

Tháng 1–3 là giai đoạn **còn nhiều mây**, sáng sớm lạnh, trời thường trong. Lịch gợi ý:

- **Sáng sớm (5h30–7h30):** [săn mây](/kinh-nghiem/kinh-nghiem-san-may-ta-xua) ở Đỉnh Gió, [sống lưng khủng long](/kinh-nghiem/song-lung-khung-long-ta-xua) hoặc ngay homestay.
- **Giữa buổi sáng (8h–10h):** dạo bản ngắm đào, mận khi nắng lên.
- **Chiều:** đồi chè cổ thụ, quán cà phê view thung lũng, ngắm hoàng hôn.

Lịch trình chi tiết tham khảo bài [lịch trình Tà Xùa 2 ngày 1 đêm](/kinh-nghiem/lich-trinh-ta-xua-2-ngay-1-dem).

## Kinh nghiệm đi Tà Xùa mùa hoa

- **Tránh đúng mùng 1–5 Tết Nguyên Đán** nếu không muốn đông và giá cao; cuối tháng 1 âm lịch trở đi vắng hơn mà hoa vẫn đẹp.
- **Trời rất lạnh** — có đêm xuống 2–5°C, thỉnh thoảng có băng giá. Chuẩn bị theo bài [Tà Xùa mùa đông lạnh mặc gì](/kinh-nghiem/ta-xua-mua-dong-lanh-mac-gi).
- **Chọn phòng có sưởi/điều hoà 2 chiều** và chăn điện — lọc nhanh ở trang [homestay Tà Xùa](/homestay).
- **Đặt xe và phòng sớm** cho dịp cuối tuần sau Tết, khi nhiều đoàn đi "du xuân" — có thể đặt [combo xe cabin + homestay](/combo) cho gọn.

![Phòng kính 3 mặt với ghế thư giãn cạnh cửa sổ mây ở Tà Xùa](/uploads/1793637360001-8db1c2ed79b2.jpg)

> Tà Xùa mùa hoa không ồn ào, không "biển người" như những điểm hoa nổi tiếng. Chỉ là vài cành đào bên vách đá, một rừng sơn tra trắng xoá trên đồi, và mây vẫn trôi dưới chân. Nếu bạn đang tìm một chuyến du xuân nhẹ nhàng, đây là gợi ý rất đáng thử.`,
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
