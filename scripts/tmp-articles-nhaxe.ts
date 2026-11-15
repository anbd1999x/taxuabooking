/**
 * 3 bài chủ đề NHÀ XE đi Tà Xùa (topic di-chuyen). Giá vé, giờ chạy, điểm đón lấy từ dữ liệu
 * các nhà xe đang mở bán trên hệ thống (11/2026); ảnh là ảnh thật do chính nhà xe đăng (/uploads).
 * Phần "đánh giá" là nhận xét biên tập dựa trên dữ liệu công khai — KHÔNG có trích lời khách bịa.
 * Chạy: npx tsx scripts/tmp-articles-nhaxe.ts            (đăng; bỏ qua slug đã có)
 *       npx tsx scripts/tmp-articles-nhaxe.ts --dry      (chỉ in ra)
 *       npx tsx scripts/tmp-articles-nhaxe.ts --update   (ghi đè bài đã có)
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

const NOTE =
  "*Giá vé, giờ chạy và điểm đón trong bài lấy từ thông tin các nhà xe đang mở bán trên Tà Xùa Booking, cập nhật tháng 11/2026, có thể thay đổi theo mùa và dịp lễ. Ảnh trong bài là ảnh thật do chính các nhà xe cung cấp. Phần nhận xét là đánh giá của ban biên tập dựa trên dữ liệu công khai đó, không phải quảng cáo trả tiền của nhà xe nào.*";

const ARTICLES: Art[] = [
  // ───────────── 1. So sánh 4 nhà xe ─────────────
  {
    slug: "nha-xe-di-ta-xua",
    title: "Nhà xe đi Tà Xùa: review 4 nhà xe cabin từ Hà Nội (2026)",
    excerpt:
      "Review 4 nhà xe cabin Hà Nội – Tà Xùa: Khánh Châu, Thành Mỹ, Tiến Thành, Quang Nghĩa. So sánh giá vé, giờ chạy, điểm đón và nhà xe nào hợp với ai.",
    topic: "di-chuyen",
    coverImage: "/uploads/1794209453036-f540b6aa3ffc.jpg",
    content: `Tuyến Hà Nội – Tà Xùa hiện có 4 nhà xe cabin chạy đêm đang mở bán trên Tà Xùa Booking: **Khánh Châu, Thành Mỹ, Tiến Thành và Quang Nghĩa**. Vé khứ hồi từ Hà Nội dao động **500.000đ đến 650.000đ một người**, xe rời Hà Nội lúc 21h hoặc 22h và tới Tà Xùa khoảng 6h sáng. Khác nhau chủ yếu ở điểm đón, giờ chạy, giá từ các tỉnh và kiểu khoang cabin. Bài này đặt 4 nhà xe cạnh nhau để bạn chọn nhanh.

**So sánh nhanh (vé khứ hồi từ Hà Nội, cabin đơn):**

- **[Khánh Châu](/xe-cabin/nha-xe-khanh-chau):** 500.000đ, đi 21h từ 68 Mạc Thái Tông, đón trung chuyển 10 tỉnh.
- **[Thành Mỹ](/xe-cabin/nha-xe-thanh-my-2):** 600.000đ, đi 22h từ 24 Đình Núp, có đón sân bay Nội Bài.
- **[Tiến Thành](/xe-cabin/nha-xe-tien-thanh):** 600.000đ, đi 21h từ khu Mễ Trì – Mạc Thái Tông, đón trung chuyển 8 tỉnh.
- **[Quang Nghĩa](/xe-cabin/nha-xe-quang-nghia-2):** 650.000đ, đi 22h từ CC2 Mễ Trì (Mỹ Đình), có cả cabin đơn lẫn cabin đôi.

![Xe cabin nhà xe Thành Mỹ qua vòng xuyến trung tâm Bắc Yên, chặng cuối trước khi lên Tà Xùa](/uploads/1794209453036-f540b6aa3ffc.jpg)

## Cả 4 nhà xe giống nhau ở điểm nào?

Trước khi so khác biệt, có mấy thứ gần như nhà xe nào cũng vậy, bạn không cần cân nhắc:

- **Đều là xe giường nằm cabin chạy đêm.** Mỗi khách một khoang riêng có rèm, chăn, gối. Chữ "limousine" trên tên xe ở tuyến này là cách gọi dòng xe cabin cao cấp, không phải xe 9 chỗ.
- **Tổng thời gian khoảng 8 tiếng mỗi chiều.** Xe tới thị trấn Bắc Yên khoảng 4h sáng, rồi đi nốt khoảng 15 km đèo lên trung tâm Tà Xùa, có mặt lúc 6h, đúng giờ săn mây.
- **Chiều về cùng một khung giờ.** Gom khách ở trung tâm Tà Xùa 12h, rời Bắc Yên 13h, nghỉ chân quanh Ba Vì khoảng 16h, về tới Hà Nội khoảng 19h.
- **Chạy hằng ngày.** Không cần chờ đủ khách mới chạy; ngày nào hết vé thì nhà xe đó tự ẩn khỏi kết quả tìm kiếm.

Vì vậy phần đáng so là: **lên xe ở đâu, mấy giờ, bao nhiêu tiền, và khoang nằm ra sao**.

## Nhà xe Khánh Châu: giá mềm nhất, đón nhiều tỉnh nhất

- **Giá khứ hồi từ Hà Nội:** 500.000đ (vé lẻ mỗi chiều 250.000đ).
- **Giờ đi:** 21h00, điểm lên xe 68 Mạc Thái Tông.
- **Lộ trình đêm:** nghỉ ở Phú Thọ khoảng 2h, tới Bắc Yên 4h, lên tới Tà Xùa 6h.
- **Đón từ tỉnh (khứ hồi, đã gồm trung chuyển):** Bắc Ninh, Hưng Yên, Thái Nguyên 700.000đ; Bắc Giang, Hải Dương 800.000đ; Hà Nam, Ninh Bình 850.000đ; Thái Bình 900.000đ; Hải Phòng, Quảng Ninh 950.000đ.

![Xe cabin Khánh Châu đỗ cạnh xe trung chuyển buổi sáng sớm, phía sau là núi](/uploads/1793442934896-a1f6dfa021f8.jpg)

**Điểm cộng:** rẻ nhất tuyến ở hầu hết điểm đón. So cùng một tỉnh, Khánh Châu thấp hơn các nhà xe còn lại từ 50.000đ đến 300.000đ, ví dụ Bắc Ninh 700.000đ so với 950.000đ, Hưng Yên 700.000đ so với 1.000.000đ. Danh sách tỉnh cũng dài nhất, và là nhà xe duy nhất có giá công bố cho Thái Nguyên, Quảng Ninh, Hà Nam. Xe bán cả cabin đơn và cabin đôi.

**Điểm cần lưu ý:** xe đi 21h, ai tan làm muộn hoặc ở xa Cầu Giấy cần tính thời gian ra điểm đón. Giá rẻ nên các chuyến tối thứ Sáu trong mùa mây thường kín sớm.

**Hợp với:** người đi tiết kiệm, nhóm bạn, khách ở các tỉnh phía Đông và Nam Hà Nội. Bài đánh giá riêng: [review nhà xe Khánh Châu đi Tà Xùa](/kinh-nghiem/review-nha-xe-khanh-chau-ta-xua).

## Nhà xe Thành Mỹ: đi muộn 22h, đón được ở Nội Bài

- **Giá khứ hồi từ Hà Nội:** 600.000đ.
- **Giờ đi:** 22h00, điểm lên xe 24 Đình Núp (khu Trung Hoà, Cầu Giấy).
- **Lộ trình đêm:** tới Bắc Yên 4h, lên Tà Xùa 6h.
- **Đón từ nơi khác (khứ hồi):** sân bay Nội Bài 800.000đ; Bắc Ninh, Bắc Giang, Hải Dương 950.000đ; Hải Phòng 1.050.000đ.

![Khoang cabin đôi trên xe Thành Mỹ: nệm rộng cho hai người, màn hình và cửa sổ riêng](/uploads/1794209452709-2e7185a20f0a.jpg)

**Điểm cộng:** là nhà xe duy nhất công bố giá đón từ **sân bay Nội Bài**, tiện cho khách bay từ miền Trung, miền Nam ra rồi đi thẳng lên núi. Giờ xuất phát 22h dễ thở với dân văn phòng tan làm muộn. Điểm đón ở tỉnh được ghi khá cụ thể: Bắc Giang đón 19h30 quanh BigC, Đình Trám, Vân Trung, Quang Châu; Hải Dương đón ở BigC, toà nhà 25 tầng; Hải Phòng có đón tại nhà. Ảnh xe cho thấy khoang có màn hình giải trí riêng; nhà xe có khoang đôi, nhưng vé đôi chưa mở bán online nên cần ghi chú khi đặt.

**Điểm cần lưu ý:** giá từ tỉnh cao hơn Khánh Châu. Lộ trình công bố không ghi điểm nghỉ ở Phú Thọ như hai nhà xe đi 21h, nên nếu bạn cần dừng vệ sinh giữa đêm thì hỏi trước.

**Hợp với:** khách bay tới Nội Bài, người tan làm muộn, khách Bắc Giang và Hải Dương muốn điểm đón rõ ràng.

## Nhà xe Tiến Thành: khoang riêng tư, màn hình giải trí

- **Giá khứ hồi từ Hà Nội:** 600.000đ.
- **Giờ đi:** 21h00, lên xe khu Mễ Trì – 68 Mạc Thái Tông.
- **Lộ trình đêm:** nghỉ ở Phú Thọ khoảng 2h, tới Bắc Yên 4h, lên Tà Xùa 6h.
- **Đón từ tỉnh (khứ hồi, đã gồm trung chuyển):** Bắc Ninh, Thái Bình 950.000đ; Hải Dương, Bắc Giang, Ninh Bình, Hưng Yên, Nam Định 1.000.000đ; Hải Phòng 1.050.000đ.

![Trong khoang cabin xe Tiến Thành: màn hình riêng, rèm kéo kín, chăn nỉ và chỗ để túi xách](/uploads/1793518540434-d0047cc1c5f1.jpg)

**Điểm cộng:** đây là nhà xe có nhiều ảnh thật bên trong khoang nhất, nên bạn biết khá rõ mình sẽ nằm ở đâu: nệm bọc da, màn hình gắn cuối khoang, rèm kéo kín phía lối đi, khay để đồ và cụm nút điều khiển trong tầm tay. Khoang đủ rộng để đặt túi xách cạnh người mà vẫn duỗi thẳng chân. Là nhà xe duy nhất có giá công bố cho **Nam Định**.

**Điểm cần lưu ý:** cùng mức 600.000đ với Thành Mỹ nhưng giá từ tỉnh nhìn chung cao nhất trong ba nhà xe có trung chuyển.

**Hợp với:** cặp đôi, người đi một mình cần riêng tư, người khó ngủ muốn khoang kín.

![Vách khoang cabin xe Tiến Thành nhìn từ lối đi, bên trong là nệm da và rèm che](/uploads/1793518540679-c9b9b1a2f5ac.jpg)

## Nhà xe Quang Nghĩa: nhiều cabin đôi, trả khách tận homestay trung tâm

- **Giá khứ hồi từ Hà Nội:** 650.000đ.
- **Giờ đi:** 22h00 hằng ngày, lên xe tại CC2 Mễ Trì, Mỹ Đình (Nam Từ Liêm).
- **Lộ trình:** Hà Nội – Phù Yên – Bắc Yên – Tà Xùa; tới Bắc Yên 4h, lên trung tâm Tà Xùa 6h.
- **Đội xe theo giới thiệu của nhà xe:** xe VIP 24 cabin đôi và xe 34 cabin đơn.

![Lối đi giữa hai dãy khoang cabin hai tầng trên xe Quang Nghĩa, nội thất tông trắng ốp gỗ](/uploads/1794213958838-7b6f4c6137de.jpg)

**Điểm cộng:** có dòng xe riêng toàn **cabin đôi**, hợp với cặp đôi hoặc bố mẹ đi cùng con nhỏ, trong khi cabin đôi ở các xe khác thường ít chỗ. Nhà xe cho biết khách được trả tại văn phòng ở Tà Xùa hoặc tại các homestay trong trung tâm xã, đỡ phải kéo vali lúc 6h sáng. Điểm đón Mỹ Đình tiện cho khách đi xe khách từ tỉnh lên bến Mỹ Đình rồi nối chuyến.

**Điểm cần lưu ý:** giá từ Hà Nội cao nhất trong bốn nhà xe. Nhà xe có nhận khách nối chuyến từ Hải Phòng, Quảng Ninh, Bắc Ninh, Thái Nguyên, Nam Định, Thanh Hoá nhưng **chưa công bố giá từng tỉnh**, bạn cần ghi rõ điểm đón để được báo giá.

**Hợp với:** cặp đôi muốn cabin đôi, gia đình có trẻ nhỏ, khách muốn được trả gần chỗ ở.

## Nên chọn nhà xe nào?

- **Ưu tiên giá:** Khánh Châu, 500.000đ khứ hồi từ Hà Nội.
- **Tan làm muộn, sợ lỡ xe:** Thành Mỹ hoặc Quang Nghĩa, cùng đi 22h.
- **Nhà gần Cầu Giấy, Mễ Trì:** Khánh Châu, Tiến Thành (Mạc Thái Tông) hoặc Thành Mỹ (Đình Núp).
- **Nhà gần Mỹ Đình, hoặc từ bến Mỹ Đình nối chuyến:** Quang Nghĩa.
- **Bay ra Nội Bài rồi đi luôn:** Thành Mỹ.
- **Ở Thái Nguyên, Quảng Ninh, Hà Nam:** Khánh Châu. **Ở Nam Định:** Tiến Thành.
- **Đi hai người muốn nằm chung:** Quang Nghĩa, hoặc cabin đôi của Khánh Châu nếu còn chỗ.
- **Hay say xe:** nhà xe nào cũng qua cùng một đoạn đèo, quan trọng là chọn khoang tầng dưới, giữa xe. Xem thêm [mẹo chống say xe đèo Tà Xùa](/kinh-nghiem/meo-chong-say-xe-deo-ta-xua).

Nếu chưa biết đánh giá một nhà xe theo tiêu chí nào, đọc bài [8 tiêu chí chọn xe giường nằm, limousine đi Tà Xùa](/kinh-nghiem/xe-giuong-nam-limousine-di-ta-xua).

## Đặt vé thế nào?

Mở trang [xe cabin Hà Nội – Tà Xùa](/xe-cabin), chọn ngày đi và ngày về, hệ thống liệt kê các nhà xe còn chỗ đúng hai ngày đó kèm giá. Bấm vào nhà xe, chọn số vé cabin đơn hoặc đôi, điểm đón, điểm trả rồi để lại tên và số điện thoại. Website không thu tiền online; bạn được gọi lại để xác nhận chỗ và hướng dẫn đặt cọc.

Cần cả chỗ ở thì dùng [combo xe cabin + homestay](/combo): chọn điểm xuất phát, ngày, số người, hệ thống ghép vé khứ hồi với phòng còn trống và trừ 25.000đ mỗi người so với đặt lẻ. Hướng dẫn từng bước có ở bài [đặt xe đi Tà Xùa từ A–Z](/kinh-nghiem/dat-xe-di-ta-xua).

${NOTE}

## Câu hỏi thường gặp

### Có những nhà xe nào chạy tuyến Hà Nội – Tà Xùa?

Trên Tà Xùa Booking hiện có 4 nhà xe cabin đang mở bán tuyến Hà Nội – Tà Xùa: Khánh Châu, Thành Mỹ, Tiến Thành và Quang Nghĩa. Cả 4 đều chạy đêm hằng ngày và có chặng lên tận trung tâm Tà Xùa.

### Nhà xe nào đi Tà Xùa rẻ nhất?

Tính vé khứ hồi cabin đơn từ Hà Nội, Khánh Châu rẻ nhất với 500.000đ. Thành Mỹ và Tiến Thành cùng 600.000đ, Quang Nghĩa 650.000đ.

### Xe đi Tà Xùa xuất phát mấy giờ, ở đâu?

Khánh Châu và Tiến Thành đi 21h từ khu Mạc Thái Tông – Mễ Trì. Thành Mỹ đi 22h từ 24 Đình Núp. Quang Nghĩa đi 22h từ CC2 Mễ Trì, Mỹ Đình. Tất cả tới Tà Xùa khoảng 6h sáng hôm sau.

### Ở tỉnh thì nhà xe nào đón?

Khánh Châu đón 10 tỉnh (Bắc Ninh, Hưng Yên, Thái Nguyên, Bắc Giang, Hải Dương, Hà Nam, Ninh Bình, Thái Bình, Hải Phòng, Quảng Ninh). Tiến Thành đón 8 tỉnh, có Nam Định. Thành Mỹ đón Nội Bài, Bắc Ninh, Bắc Giang, Hải Dương, Hải Phòng. Giá khứ hồi từ tỉnh khoảng 700.000đ đến 1.050.000đ.

### Chiều về các nhà xe chạy lúc mấy giờ?

Cả 4 nhà xe đều gom khách ở trung tâm Tà Xùa lúc 12h, rời Bắc Yên 13h và về tới Hà Nội khoảng 19h.

### Nên đặt vé trước bao lâu?

Ngày thường đặt trước 1 đến 2 ngày vẫn có chỗ. Tối thứ Sáu và trưa Chủ nhật trong mùa mây (tháng 11 đến tháng 3) nên đặt trước 5 đến 7 ngày, dịp lễ Tết trước 2 đến 3 tuần.

## Xem chỗ trống theo ngày

- [Lịch và giá xe cabin Hà Nội – Tà Xùa](/xe-cabin) theo ngày đi, ngày về của bạn.
- [Combo xe cabin + homestay](/combo) nếu cần cả phòng.
- [Xe cabin đón ở đâu tại các tỉnh](/kinh-nghiem/diem-don-xe-cabin-cac-tinh) nếu bạn không ở Hà Nội.`,
  },

  // ───────────── 2. Review Khánh Châu ─────────────
  {
    slug: "review-nha-xe-khanh-chau-ta-xua",
    title: "Review nhà xe Khánh Châu đi Tà Xùa: giá vé, giờ chạy, điểm đón",
    excerpt:
      "Review nhà xe Khánh Châu đi Tà Xùa: vé khứ hồi 500.000đ, đi 21h từ 68 Mạc Thái Tông, lộ trình, khoang cabin, giá đón 10 tỉnh và ưu nhược điểm.",
    topic: "di-chuyen",
    coverImage: "/uploads/1793442935427-e9b98d34546d.jpg",
    content: `Nhà xe Khánh Châu là nhà xe cabin có **giá vé thấp nhất tuyến Hà Nội – Tà Xùa** hiện nay: 500.000đ khứ hồi một người, 250.000đ mỗi chiều. Xe chạy đêm hằng ngày, rời 68 Mạc Thái Tông lúc 21h và tới Tà Xùa khoảng 6h sáng. Bài này đi vào chi tiết: lộ trình từng chặng, khoang nằm thực tế ra sao, giá từ các tỉnh, điểm mạnh và điểm cần cân nhắc.

**Thông tin nhanh về nhà xe Khánh Châu:**

- **Tuyến:** Hà Nội – Tà Xùa (Bắc Yên, Sơn La) và ngược lại, chạy hằng ngày.
- **Loại xe:** giường nằm cabin (xe ghi "Phòng Limousine"), có cabin đơn và cabin đôi.
- **Giá từ Hà Nội:** 500.000đ khứ hồi, 250.000đ một chiều (cabin đơn).
- **Chiều đi:** 21h00 từ 68 Mạc Thái Tông, tới Tà Xùa khoảng 6h00.
- **Chiều về:** 12h00 từ trung tâm Tà Xùa, tới Hà Nội khoảng 19h00.
- **Đón từ tỉnh:** 10 tỉnh, có xe trung chuyển, khứ hồi 700.000đ đến 950.000đ.
- **Xem chỗ trống:** trang [nhà xe Khánh Châu](/xe-cabin/nha-xe-khanh-chau).

![Xe cabin Khánh Châu màu vàng cam, thân xe ghi Phòng Limousine và biển tuyến Tà Xùa](/uploads/1793442935427-e9b98d34546d.jpg)

## Lộ trình chiều đi: 21h lên xe, 6h thấy mây

Theo lộ trình nhà xe công bố:

- **21h00, 68 Mạc Thái Tông (Cầu Giấy):** khách lên xe, cất hành lý, nhận khoang. Nên có mặt trước giờ xe chạy 15 đến 20 phút.
- **Khoảng 2h00, Phú Thọ:** dừng nghỉ, đi vệ sinh, mua nước.
- **Khoảng 4h00, Bắc Yên:** nghỉ thêm một nhịp trước khi vào khoảng 15 km đèo cuối.
- **Khoảng 6h00, Tà Xùa:** tới nơi đúng khung giờ mây đẹp nhất trong ngày.

Tổng thời gian khoảng 8 tiếng, tức bạn ngủ gần trọn đêm trên xe và không mất ngày phép nào để di chuyển. Một điều cần nhớ khi đặt phòng: lên xe tối thứ Sáu thì sáng thứ Bảy mới tới, và homestay thường 14h mới cho nhận phòng. Cách dùng khoảng thời gian đó có ở bài [xuống xe đêm ở Tà Xùa lúc 6h sáng](/kinh-nghiem/xuong-xe-dem-ta-xua-sang-som-lam-gi).

![Xe cabin Khánh Châu và xe trung chuyển đỗ cạnh nhau lúc sáng sớm ở chân núi](/uploads/1793442934896-a1f6dfa021f8.jpg)

## Lộ trình chiều về: kịp bữa tối ở Hà Nội

- **12h00:** khởi hành từ trung tâm Tà Xùa, trùng giờ trả phòng của hầu hết homestay.
- **13h00:** qua Bắc Yên.
- **Khoảng 16h00:** dừng chân ở Ba Vì.
- **Khoảng 19h00:** về tới Hà Nội, trả khách tại 68 Mạc Thái Tông.

Chiều về chạy ban ngày nên ai dễ say xe sẽ thấy đoạn đổ đèo rõ hơn lúc đi. Nên ăn nhẹ trước 11h30 thay vì ăn no sát giờ xe chạy.

## Khoang cabin trên xe Khánh Châu có gì?

Nhìn từ ảnh thật của nhà xe, mỗi khoang là một ô riêng có vách ngăn với khoang bên cạnh:

- **Nệm nằm duỗi thẳng chân**, kèm chăn dày và gối. Đêm vùng núi lạnh, điều hoà trên xe cũng lạnh, nên chăn dày là thứ đáng giá.
- **Cửa sổ riêng** cho từng khoang, kéo rèm là kín.
- **Lối đi giữa hai dãy khoang** hai tầng, đèn LED xanh mờ để cả xe ngủ được.

![Giường trong khoang cabin xe Khánh Châu với chăn dày và cửa sổ riêng](/uploads/1793442945574-3636c341eef1.jpg)

Xe bán hai loại chỗ:

- **Cabin đơn:** một người một khoang. Đây là loại có giá 250.000đ mỗi chiều.
- **Cabin đôi:** khoang rộng cho hai người nằm cạnh nhau, giá 500.000đ một khoang mỗi chiều, tức mỗi người vẫn 250.000đ. Số khoang đôi ít hơn khoang đơn nên cuối tuần hết trước.

Nếu phân vân chọn loại nào, tầng nào, đọc bài [một đêm trên xe cabin đi Tà Xùa](/kinh-nghiem/trai-nghiem-xe-cabin-di-ta-xua).

![Lối đi hẹp giữa hai dãy khoang cabin trên xe Khánh Châu, đèn LED xanh chạy dọc trần](/uploads/1793442945714-62c854b0067f.jpg)

## Giá vé nhà xe Khánh Châu từ Hà Nội và 10 tỉnh

Giá dưới đây là **vé khứ hồi một người, cabin đơn**. Giá từ tỉnh đã gồm xe trung chuyển đưa bạn về điểm lên xe cabin ở Hà Nội:

- **Hà Nội:** 500.000đ
- **Bắc Ninh, Hưng Yên, Thái Nguyên:** 700.000đ
- **Bắc Giang, Hải Dương:** 800.000đ
- **Hà Nam, Ninh Bình:** 850.000đ
- **Thái Bình:** 900.000đ
- **Hải Phòng, Quảng Ninh:** 950.000đ

Đặt lên bàn cân với các nhà xe cùng tuyến:

- **Từ Hà Nội:** Khánh Châu 500.000đ, các nhà xe khác 600.000đ đến 650.000đ.
- **Từ Bắc Ninh:** 700.000đ so với 950.000đ.
- **Từ Hải Dương:** 800.000đ so với 950.000đ đến 1.000.000đ.
- **Từ Hưng Yên:** 700.000đ so với 1.000.000đ.
- **Từ Hải Phòng:** 950.000đ so với 1.050.000đ.

Một nhóm 4 người đi từ Hà Nội tiết kiệm được 400.000đ đến 600.000đ tiền xe so với các nhà xe còn lại, đủ cho một bữa lẩu tối trên núi. Bảng so sánh đầy đủ có ở bài [review 4 nhà xe đi Tà Xùa](/kinh-nghiem/nha-xe-di-ta-xua).

## Đánh giá: ưu điểm và điểm cần cân nhắc

**Ưu điểm:**

- **Giá tốt nhất tuyến**, cả từ Hà Nội lẫn từ tỉnh.
- **Mạng trung chuyển rộng nhất:** 10 tỉnh, và là nhà xe duy nhất công bố giá cho Thái Nguyên, Quảng Ninh, Hà Nam.
- **Có điểm nghỉ ở Phú Thọ lúc 2h** ngoài điểm nghỉ Bắc Yên, đỡ mệt hơn chạy một mạch.
- **Bán cả cabin đơn và cabin đôi** trên cùng chuyến.
- **Giờ về 12h khớp giờ trả phòng**, không phải ngồi chờ.

**Điểm cần cân nhắc:**

- **Xuất phát 21h**, sớm hơn Thành Mỹ và Quang Nghĩa một tiếng. Tan làm lúc 19h và ở xa Cầu Giấy thì khá sát giờ.
- **Khách ở tỉnh phải ra điểm trung chuyển sớm**, giờ xe trung chuyển luôn trước giờ xe cabin chạy vài tiếng. Hỏi rõ giờ và chỗ đón lúc được gọi xác nhận.
- **Chưa có chính sách đổi, huỷ vé đăng công khai.** Nên hỏi luôn khi đặt cọc, nhất là khi đi theo dự báo mây.
- **Vé cuối tuần mùa mây kín sớm** vì giá mềm.

**Nhà xe Khánh Châu hợp với ai?**

- Người đi tiết kiệm, sinh viên, nhóm bạn đông người.
- Khách ở các tỉnh quanh Hà Nội muốn có xe trung chuyển tận nơi.
- Người ở khu Cầu Giấy, Mỹ Đình, tiện ra Mạc Thái Tông.

Nếu bạn cần đi muộn hơn hoặc đón từ sân bay Nội Bài, xem thêm các nhà xe khác trong bài so sánh ở trên.

## Cách đặt vé nhà xe Khánh Châu

1. Mở trang [nhà xe Khánh Châu](/xe-cabin/nha-xe-khanh-chau), chọn ngày đi và ngày về.
2. Chọn số vé cabin đơn hoặc đôi cho từng chiều.
3. Chọn điểm đón, điểm trả; khách ở tỉnh ghi rõ tỉnh và khu vực.
4. Để lại tên, số điện thoại và gửi yêu cầu.

Website không thu tiền online. Sau khi gửi, bạn được gọi lại xác nhận chỗ và hướng dẫn đặt cọc; mã đơn dùng để xem lại ở trang [tra cứu đơn](/tra-cuu). Muốn ghép luôn phòng thì thử [combo xe cabin + homestay](/combo), giá vé Khánh Châu được tính theo đúng tỉnh bạn xuất phát và mỗi người được trừ thêm 25.000đ.

${NOTE}

## Câu hỏi thường gặp

### Vé nhà xe Khánh Châu đi Tà Xùa bao nhiêu tiền?

Từ Hà Nội, vé cabin đơn là 500.000đ khứ hồi một người, 250.000đ một chiều. Từ các tỉnh có trung chuyển, vé khứ hồi từ 700.000đ đến 950.000đ.

### Nhà xe Khánh Châu đón khách ở đâu tại Hà Nội?

Điểm lên xe là 68 Mạc Thái Tông, quận Cầu Giấy. Xe xuất phát khoảng 21h hằng ngày.

### Xe Khánh Châu chạy mấy giờ, mấy tiếng thì tới Tà Xùa?

Xe đi 21h, nghỉ ở Phú Thọ khoảng 2h và Bắc Yên khoảng 4h, tới Tà Xùa khoảng 6h sáng. Tổng thời gian khoảng 8 tiếng.

### Nhà xe Khánh Châu đón những tỉnh nào?

Bắc Ninh, Hưng Yên, Thái Nguyên, Bắc Giang, Hải Dương, Hà Nam, Ninh Bình, Thái Bình, Hải Phòng và Quảng Ninh. Giá khứ hồi đã gồm xe trung chuyển về Hà Nội.

### Xe Khánh Châu có cabin đôi không?

Có. Xe bán cả cabin đơn và cabin đôi. Cabin đôi tính giá theo khoang cho hai người và số lượng ít hơn cabin đơn, nên đặt sớm nếu đi cuối tuần.

### Chiều về xe Khánh Châu chạy lúc mấy giờ?

Xe rời trung tâm Tà Xùa lúc 12h, qua Bắc Yên 13h, nghỉ ở Ba Vì khoảng 16h và về tới Hà Nội khoảng 19h.

## Đặt chỗ

- [Xem lịch và chỗ trống nhà xe Khánh Châu](/xe-cabin/nha-xe-khanh-chau).
- [So sánh với các nhà xe khác cùng ngày](/xe-cabin).
- [Tìm combo xe + homestay theo ngân sách](/combo).`,
  },

  // ───────────── 3. Tiêu chí chọn nhà xe / dịch vụ ─────────────
  {
    slug: "xe-giuong-nam-limousine-di-ta-xua",
    title: "Xe giường nằm, limousine đi Tà Xùa: 8 tiêu chí chọn nhà xe tốt",
    excerpt:
      "Xe giường nằm, cabin, limousine đi Tà Xùa khác gì nhau? Dịch vụ một chuyến gồm những gì và 8 tiêu chí đánh giá nhà xe chất lượng trước khi đặt vé.",
    topic: "di-chuyen",
    coverImage: "/uploads/1794213958980-af8f04d9ba8b.jpg",
    content: `Tìm "xe đi Tà Xùa" sẽ gặp đủ tên gọi: xe giường nằm, xe cabin, xe limousine, xe VIP. Thực tế trên tuyến Hà Nội – Tà Xùa, gần như tất cả đều là **một loại: xe giường nằm cabin chạy đêm**, mỗi khách một khoang riêng. Dịch vụ giữa các nhà xe khác nhau ở những chi tiết nhỏ nhưng ảnh hưởng nhiều tới chuyến đi: điểm đón, giờ chạy, xe trung chuyển, kiểu khoang, chỗ trả khách. Bài này giải thích dịch vụ gồm những gì và đưa ra 8 tiêu chí để bạn tự đánh giá một nhà xe.

**Tóm tắt nhanh:**

- **Xe limousine đi Tà Xùa** thường là xe giường nằm cabin cao cấp, không phải limousine 9 chỗ.
- **Một vé khứ hồi** gồm: chỗ nằm trong khoang riêng, chăn gối, chặng lên đèo tới trung tâm Tà Xùa và chiều về Hà Nội.
- **Giá hợp lý:** 500.000đ đến 650.000đ khứ hồi từ Hà Nội; 700.000đ đến 1.050.000đ từ các tỉnh, đã gồm trung chuyển.
- **Ba thứ phải hỏi trước khi đặt cọc:** điểm đón chính xác, chỗ trả khách ở Tà Xùa, điều kiện đổi hoặc huỷ vé.

![Lối đi giữa hai dãy khoang cabin trên xe Quang Nghĩa, mỗi khoang có màn hình riêng và đèn LED xanh](/uploads/1794213958980-af8f04d9ba8b.jpg)

## Xe giường nằm, xe cabin, xe limousine: khác gì nhau?

- **Xe giường nằm thường:** giường xếp ba dãy, không có vách ngăn, nằm hơi ngả chứ không thẳng hẳn. Loại này gần như không còn trên tuyến du lịch Tà Xùa.
- **Xe giường nằm cabin:** hai dãy khoang, hai tầng, mỗi khoang có vách ngăn, rèm hoặc cửa kéo, nệm nằm thẳng. Đây là loại các nhà xe Khánh Châu, Thành Mỹ, Tiến Thành, Quang Nghĩa đang chạy.
- **"Limousine", "VIP", "phòng limousine":** tên thương mại các nhà xe đặt cho dòng xe cabin đời mới, khoang rộng, có màn hình. Nhìn ảnh thật thì đó vẫn là xe cabin.
- **Cabin đơn và cabin đôi:** cabin đơn cho một người; cabin đôi là khoang rộng gấp đôi cho hai người nằm chung.

Nên khi so sánh, đừng so theo tên gọi. Hãy so theo những thứ cụ thể bên dưới.

## Một chuyến xe cabin đi Tà Xùa gồm những dịch vụ gì?

Đi từ đầu tới cuối, một vé khứ hồi bao gồm:

- **Xe trung chuyển (với khách ở tỉnh):** xe nhỏ đón bạn ở tỉnh, đưa về điểm lên xe cabin tại Hà Nội. Chi phí đã nằm trong giá vé từ tỉnh.
- **Lên xe ở Hà Nội lúc 21h đến 22h:** gửi vali xuống gầm, mang balo nhỏ lên khoang.
- **Chỗ nằm riêng suốt đêm:** nệm, chăn, gối, rèm. Nhiều xe có màn hình giải trí và cổng sạc trong khoang.
- **Điểm dừng nghỉ:** xe đi 21h thường nghỉ ở Phú Thọ khoảng 2h; mọi xe đều dừng ở Bắc Yên khoảng 4h.
- **Chặng lên đèo:** khoảng 15 km từ Bắc Yên lên trung tâm Tà Xùa, tới nơi khoảng 6h.
- **Chiều về:** gom khách ở trung tâm 12h, rời Bắc Yên 13h, nghỉ ở Ba Vì, về Hà Nội khoảng 19h.

Vé **không gồm** bữa ăn, phòng nghỉ, và xe đi lại giữa các điểm săn mây. Phần đi lại tại chỗ bạn thuê xe máy hoặc gọi xe ôm, taxi bản địa.

![Xe cabin của nhà xe Tiến Thành đón khách ban đêm, dải đèn LED xanh chạy dọc thân xe](/uploads/1793518540349-3ef221d28de8.jpg)

## 8 tiêu chí đánh giá một nhà xe đi Tà Xùa

### 1. Điểm đón có gần bạn không?

Mỗi nhà xe có một điểm lên xe cố định ở Hà Nội, và chúng không trùng nhau: 68 Mạc Thái Tông (Khánh Châu, Tiến Thành), 24 Đình Núp (Thành Mỹ), CC2 Mễ Trì, Mỹ Đình (Quang Nghĩa). Nhà bạn ở Long Biên hay Hà Đông thì cả ba khu đều cách 30 đến 45 phút đi xe vào giờ tối. Chọn nhà xe có điểm đón thuận đường nhất sẽ đỡ một cuốc taxi và đỡ lo trễ xe.

### 2. Giờ xuất phát có khớp giờ tan làm?

Hai mốc phổ biến là **21h** và **22h**. Chênh một tiếng nghe ít, nhưng với người tan làm 18h30, còn phải về lấy đồ, ăn tối rồi ra điểm đón thì khác hẳn. Bù lại, mọi nhà xe đều tới Tà Xùa khoảng 6h, nên xe đi 21h có thêm thời gian nghỉ dọc đường.

### 3. Giá vé đã gồm những gì?

Giá công bố trên tuyến là giá **khứ hồi một người, cabin đơn**. Khi so, kiểm tra ba điều:

- Giá đó là khứ hồi hay một chiều.
- Từ tỉnh thì đã gồm trung chuyển chưa (các nhà xe trên Tà Xùa Booking đều đã gồm).
- Dịp lễ Tết có phụ thu không.

Mức 500.000đ đến 650.000đ khứ hồi từ Hà Nội là bình thường. Giá thấp hơn hẳn mức này thì nên hỏi kỹ loại xe và xe có lên tới trung tâm Tà Xùa hay chỉ tới Bắc Yên.

### 4. Nhà xe có đón tỉnh bạn không?

Không nhà xe nào đón đủ mọi tỉnh. Khánh Châu đón 10 tỉnh, Tiến Thành 8 tỉnh, Thành Mỹ đón sân bay Nội Bài cùng 4 tỉnh. Cùng một tỉnh, giá giữa các nhà xe chênh nhau 100.000đ đến 300.000đ. Danh sách điểm đón từng tỉnh có ở bài [xe cabin đi Tà Xùa đón ở đâu](/kinh-nghiem/diem-don-xe-cabin-cac-tinh).

### 5. Có ảnh thật của khoang nằm không?

Đây là tiêu chí dễ kiểm tra nhất mà nhiều người bỏ qua. Một nhà xe đáng tin sẽ có ảnh chụp thật: ngoại thất xe có tên nhà xe, lối đi, bên trong khoang. Nhìn ảnh bạn biết được:

- Khoang có rèm hay cửa kéo, kín tới mức nào.
- Nệm bọc da hay bọc vải, có chăn gối sẵn không.
- Có màn hình, khay để đồ, cổng sạc không.
- Trần khoang cao hay thấp, người cao có ngồi dậy được không.

![Bên trong một khoang cabin xe Tiến Thành: màn hình cuối khoang, cụm nút điều khiển, chăn nỉ và rèm che](/uploads/1793518540603-2199956546ec.jpg)

Ảnh chỉ toàn hình minh hoạ lấy trên mạng, hoặc không có ảnh nội thất, là dấu hiệu nên hỏi thêm trước khi chuyển cọc.

### 6. Có cabin đôi không, còn bao nhiêu chỗ?

Đi hai người, cabin đôi thoải mái hơn và thường không đắt hơn hai vé đơn bao nhiêu. Nhưng số khoang đôi trên một xe ít, cuối tuần mùa mây hết rất sớm. Quang Nghĩa có dòng xe riêng 24 cabin đôi; Khánh Châu bán cabin đôi ngay trên trang đặt vé; Thành Mỹ có khoang đôi nhưng cần ghi chú khi đặt. Nếu bắt buộc phải nằm chung, hãy chọn theo tiêu chí này trước rồi mới xét giá.

![Khoang cabin đôi trên xe Thành Mỹ: nệm rộng cho hai người, màn hình và cửa sổ riêng](/uploads/1794209452709-2e7185a20f0a.jpg)

### 7. Xe trả khách ở đâu tại Tà Xùa?

Sáu giờ sáng, trời khoảng 10 độ, bạn vừa ngủ dậy và có một vali. Xe trả ở đâu lúc này rất quan trọng. Hầu hết nhà xe trả tại trung tâm xã. Quang Nghĩa cho biết có trả tại văn phòng nhà xe hoặc tại homestay trong khu trung tâm. Nếu homestay của bạn ở Đỉnh Gió hay Khe Cải, cách trung tâm vài cây số, hãy hỏi nhà xe hoặc chủ home xem có xe đón không, và nhắn trước để gửi hành lý. Xem thêm [ở Tà Xùa nên chọn khu nào](/kinh-nghiem/o-ta-xua-nen-chon-khu-nao).

### 8. Điều kiện đổi, huỷ vé và cách đặt cọc

Thời tiết trên núi thay đổi nhanh, nhiều người muốn dời ngày theo dự báo mây. Trước khi chuyển cọc, hỏi rõ:

- Đổi ngày được không, báo trước bao lâu.
- Huỷ thì mất bao nhiêu tiền cọc.
- Tiền cọc chuyển cho ai, có tin nhắn hoặc mã đơn xác nhận không.

Hiện các nhà xe trên tuyến chưa đăng chính sách đổi huỷ thành văn bản, nên phần này bắt buộc phải hỏi trực tiếp. Đặt qua Tà Xùa Booking, mỗi yêu cầu có mã đơn để bạn xem lại ở trang [tra cứu đơn](/tra-cuu).

## 5 dấu hiệu nên cân nhắc lại trước khi đặt

- **Giá rẻ bất thường** so với mặt bằng 500.000đ đến 650.000đ khứ hồi.
- **Không có ảnh thật** của xe và khoang nằm.
- **Không nói rõ điểm đón**, chỉ hẹn "sẽ báo sau".
- **Yêu cầu chuyển toàn bộ tiền** ngay mà không có xác nhận chỗ.
- **Không nói rõ xe có lên tới trung tâm Tà Xùa hay không.**

## Áp tiêu chí vào 4 nhà xe đang chạy

- **Giá tốt, đón nhiều tỉnh:** [Khánh Châu](/xe-cabin/nha-xe-khanh-chau), 500.000đ khứ hồi, 10 tỉnh trung chuyển. Xem [review nhà xe Khánh Châu](/kinh-nghiem/review-nha-xe-khanh-chau-ta-xua).
- **Đi muộn, đón Nội Bài:** [Thành Mỹ](/xe-cabin/nha-xe-thanh-my-2), 22h từ 24 Đình Núp.
- **Ảnh khoang rõ ràng, riêng tư:** [Tiến Thành](/xe-cabin/nha-xe-tien-thanh), 21h từ khu Mễ Trì – Mạc Thái Tông.
- **Cần cabin đôi, trả gần homestay:** [Quang Nghĩa](/xe-cabin/nha-xe-quang-nghia-2), 22h từ CC2 Mễ Trì.

So sánh đầy đủ từng nhà xe có ở bài [review 4 nhà xe đi Tà Xùa](/kinh-nghiem/nha-xe-di-ta-xua).

${NOTE}

## Câu hỏi thường gặp

### Xe limousine đi Tà Xùa có phải xe 9 chỗ không?

Thường là không. Trên tuyến Hà Nội – Tà Xùa, "limousine" là tên các nhà xe đặt cho xe giường nằm cabin đời mới, mỗi khách một khoang riêng có rèm, chăn gối và thường có màn hình.

### Xe giường nằm đi Tà Xùa giá bao nhiêu?

Vé khứ hồi cabin đơn từ Hà Nội khoảng 500.000đ đến 650.000đ một người tuỳ nhà xe. Từ các tỉnh có trung chuyển, vé khứ hồi khoảng 700.000đ đến 1.050.000đ.

### Xe có lên tận trung tâm Tà Xùa không?

Có. Các nhà xe trên Tà Xùa Booking đều có chặng từ thị trấn Bắc Yên lên trung tâm Tà Xùa, khoảng 15 km đèo, đã nằm trong giá vé và lịch chạy.

### Nên chọn cabin đơn hay cabin đôi?

Đi một mình hoặc nhóm bạn muốn ngủ riêng thì chọn cabin đơn. Cặp đôi hoặc bố mẹ đi cùng con nhỏ nên chọn cabin đôi, nhưng cần đặt sớm vì số khoang đôi ít.

### Trên xe cabin có chăn gối không, có cần mang thêm gì?

Khoang có sẵn nệm, chăn và gối. Nên mang thêm áo khoác mỏng, tất, nút tai, bịt mắt và sạc dự phòng. Để áo ấm ở balo nhỏ mang lên khoang vì 6h sáng xuống xe trời rất lạnh.

### Làm sao biết nhà xe nào uy tín?

Kiểm tra bốn thứ: có ảnh thật của xe và khoang nằm, điểm đón và giờ chạy rõ ràng, giá nằm trong mặt bằng chung, và có xác nhận chỗ kèm mã đơn trước khi đặt cọc.

## Bắt đầu chọn xe

- [Xem nhà xe còn chỗ theo ngày đi, ngày về](/xe-cabin).
- [Ghép xe cabin với homestay thành combo](/combo).
- Đọc tiếp: [một đêm trên xe cabin đi Tà Xùa](/kinh-nghiem/trai-nghiem-xe-cabin-di-ta-xua) và [mẹo chống say xe đèo](/kinh-nghiem/meo-chong-say-xe-deo-ta-xua).`,
  },
];

async function main() {
  const dry = process.argv.includes("--dry");
  const update = process.argv.includes("--update");
  for (const a of ARTICLES) {
    const exists = await prisma.article.findUnique({ where: { slug: a.slug }, select: { id: true } });
    if (dry) { console.log("dry:", a.slug, "| title", a.title.length, "ký tự | excerpt", a.excerpt.length, "| nội dung", a.content.split(/\s+/).length, "từ", exists ? "(đã có)" : ""); continue; }
    if (exists) {
      if (update) { await prisma.article.update({ where: { slug: a.slug }, data: { title: a.title, excerpt: a.excerpt, content: a.content, coverImage: a.coverImage, topic: a.topic } }); console.log("đã cập nhật:", a.slug); }
      else console.log("skip (đã có):", a.slug);
      continue;
    }
    await prisma.article.create({ data: { ...a, published: true } });
    console.log("đã đăng:", a.slug);
  }
}
main().finally(() => prisma.$disconnect());
