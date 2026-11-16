/**
 * Viết lại tóm tắt + mô tả dịch vụ THUÊ XE MÁY và TAXI cho sinh động, chuyên nghiệp
 * (chỉ dùng dữ kiện chủ dịch vụ đã cung cấp: loại xe, giá, dịch vụ kèm). Bản cũ đã lưu ở scratchpad.
 * Chạy: npx tsx scripts/tmp-rewrite-moto-taxi.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TAXI_ROUTES = `**Gợi ý lịch trình nguyên ngày**
- Sáng sớm: săn mây, đón bình minh ở Sống Lưng Khủng Long hoặc Mỏm Cưỡi Mây
- Trong ngày: Thảo Nguyên Tà Xùa, Cây Cô Đơn, Đỉnh Gió, Khe Cải, Hồ Mắt Ngọc
- Chiều: dạo phố đi bộ Thiên Đường Mây, cà phê ngắm hoàng hôn`;

const TAXI_WHY = `**Vì sao nên đi taxi ở Tà Xùa?**
Đường lên các điểm săn mây nhiều dốc, cua tay áo và sương mù buổi sớm. Đi cùng tài xế quen đường giúp cả đoàn an toàn, đỡ mệt, không lo lạc và luôn có mặt đúng lúc mây đẹp nhất.`;

const MOTO_TIPS = `**Lưu ý khi tự lái ở Tà Xùa**
- Đường đèo dốc, nhiều cua gắt — giữ tốc độ chậm, xuống dốc về số thấp, hạn chế phanh gấp
- Sáng sớm sương dày: bật đèn, đi sát lề phải, mặc áo ấm & áo mưa
- Mang theo giấy tờ tuỳ thân, đội mũ bảo hiểm suốt hành trình`;

type U = { slug: string; summary: string; description: string };
const UPDATES: U[] = [
  // ===================== THUÊ XE MÁY =====================
  {
    slug: "anh-dat-ta-xua",
    summary:
      "Thuê xe máy anh Đạt ngay trung tâm Tà Xùa — Honda Wave bền bỉ, tiết kiệm xăng, leo dốc khoẻ, chỉ 180.000đ/ngày. Chủ xe hiền lành, nhiệt tình, xe được giữ gìn cẩn thận để bạn yên tâm tự do khám phá biển mây.",
    description: `**Tự do chinh phục Tà Xùa trên chiếc Wave quen thuộc**

Muốn chủ động lịch trình, dừng lại bất cứ khúc cua nào để ngắm mây? Thuê xe máy anh Đạt là lựa chọn gọn nhẹ và tiết kiệm cho cặp đôi, nhóm bạn hay người đi một mình.

- **Dòng xe:** Honda Wave — xe số bền bỉ, tiết kiệm xăng, dễ điều khiển trên đường đèo
- **Giá thuê:** 180.000đ/ngày
- **Tình trạng xe:** được giữ gìn, bảo dưỡng thường xuyên trước mỗi lượt thuê
- **Chủ xe:** anh Đạt hiền lành, thân thiện, sẵn lòng chỉ đường và gợi ý điểm đẹp
- **Vị trí:** trung tâm Tà Xùa, thuận tiện nhận – trả xe

**Đi đâu với một ngày thuê xe?**
Sống Lưng Khủng Long, Thảo Nguyên Tà Xùa, Cây Cô Đơn, Đỉnh Gió, Khe Cải, Mỏm Cưỡi Mây… đều nằm trong tầm tay.

${MOTO_TIPS}

Đặt xe trước để giữ xe vào cuối tuần và mùa săn mây.`,
  },
  {
    slug: "de-homestay",
    summary:
      "Thuê xe máy uy tín, lâu năm tại trung tâm Tà Xùa của Dê Homestay — Honda PG1 280.000đ/ngày, nhiều màu (đen, trắng, xanh, cam, hồng) để bạn chọn cho những bức ảnh thật đẹp.",
    description: `**Dê Homestay — cho thuê xe máy lâu năm, uy tín giữa lòng Tà Xùa**

Không chỉ là nơi nghỉ chân ngay phố đi bộ Thiên Đường Mây, Dê Homestay còn là điểm thuê xe máy quen thuộc của du khách nhiều năm nay. Nhận xe ngay tại trung tâm, xuất phát săn mây chỉ trong vài phút.

- **Dòng xe:** Honda PG1 — gầm cao, dáng gọn, leo dốc tốt, cực "ăn ảnh" trên nền biển mây
- **Giá thuê:** 280.000đ/ngày
- **Màu xe:** Đen · Trắng · Xanh · Cam · Hồng — chọn màu ngay khi đặt
- **Vị trí:** trung tâm xã Tà Xùa, trên tuyến phố đi bộ Thiên Đường Mây, mặt đường tỉnh lộ 112
- **Tiện lợi:** ở Dê Homestay thì nhận – trả xe ngay tại chỗ

**Hành trình gợi ý:** bình minh Sống Lưng Khủng Long → Thảo Nguyên Tà Xùa → Cây Cô Đơn → Đỉnh Gió → chiều về cà phê phố đi bộ.

${MOTO_TIPS}`,
  },
  {
    slug: "g-bike",
    summary:
      "G-Bike — đơn vị cho thuê Honda PG1 uy tín tại Tà Xùa (280.000đ/ngày, 4 màu) kèm gói xe ôm bản địa: tài xế quen đường đưa bạn tới Sống Lưng Khủng Long, Thảo Nguyên, Hồ Mắt Ngọc, Khe Cải.",
    description: `**G-Bike — tự lái PG1 hay để người bản địa cầm lái, tuỳ bạn chọn**

**1. Thuê xe tự lái**
- **Dòng xe:** Honda PG1 — gầm cao, chắc chắn, leo dốc tốt
- **Giá thuê:** 280.000đ/ngày
- **Màu xe:** Đỏ · Đen · Xanh · Cam

**2. Gói xe ôm bản địa (khứ hồi)**
Ngại đường đèo? Để tài xế người bản địa đưa bạn đến tận nơi, an toàn và đúng giờ mây đẹp.

- **Thảo Nguyên – Sống Lưng Khủng Long – Hồ Mắt Ngọc:** 400.000đ (1 xe/1 người) · 500.000đ (1 xe/2 người)
- **Tuyến Khe Cải:** 150.000đ (1 xe/1 người) · 200.000đ (1 xe/2 người)
- **Bao xe cả ngày:** 700.000đ

**Miễn phí kèm theo**
- Áo mưa
- 2 chai nước uống
- Hỗ trợ chụp ảnh bằng điện thoại tại các điểm đẹp
- Đón – trả tận homestay

${MOTO_TIPS}`,
  },

  // ===================== TAXI =====================
  {
    slug: "taxi-a-trang",
    summary:
      "Taxi A Trang — tài xế bản địa, xe Honda BR-V đời mới, cực kỳ quen địa hình và chắc tay lái. Thuê nguyên ngày khám phá Tà Xùa hoặc đưa đón Hà Nội ↔ Tà Xùa.",
    description: `**Taxi A Trang — người bản địa cầm lái, vững vàng trên mọi cung đèo**

Sinh ra và lớn lên giữa núi rừng Tà Xùa, A Trang thuộc từng khúc cua, từng con dốc và biết chính xác khi nào mây đẹp nhất ở đâu.

- **Xe:** Honda BR-V đời mới — rộng rãi, sạch sẽ, gầm cao vượt dốc tốt
- **Tài xế:** người bản địa, quen địa hình, chắc tay lái
- **Điểm đón:** trung tâm Tà Xùa · nhận chạy tuyến Hà Nội ↔ Tà Xùa
- **Giá tham khảo:** 1.800.000đ/ngày

${TAXI_ROUTES}

${TAXI_WHY}`,
  },
  {
    slug: "a-pao-taxi-dien-ta-xua",
    summary:
      "A Páo Taxi điện — VinFast VF 5 đời mới, êm ái, không mùi xăng, tài xế bản địa nhiệt tình kiêm dẫn tour. Đón khắp Tà Xùa, nhận đưa đón Hà Nội và các tỉnh miền Bắc.",
    description: `**A Páo Taxi điện — êm ái, sạch sẽ, thân thiện với núi rừng**

Ngồi trên chiếc xe điện êm ru, không mùi xăng, không say xe trên những cung đèo — cùng A Páo, chàng tài xế bản địa nhiệt tình, vừa lái xe vừa kể chuyện bản làng như một hướng dẫn viên thực thụ.

- **Xe:** VinFast VF 5 — xe điện đời mới, vận hành êm, cabin sạch thoáng
- **Tài xế:** người bản địa, nhiệt tình dẫn tour, rành điểm săn mây
- **Phạm vi:** đón mọi khu vực Tà Xùa · đưa đón Hà Nội và các tỉnh miền Bắc
- **Giá tham khảo:** 2.000.000đ/ngày

${TAXI_ROUTES}

${TAXI_WHY}`,
  },
  {
    slug: "lu-bun",
    summary:
      "Lừ Bun — taxi Tà Xùa chuyên nghiệp với Toyota Fortuner 7 chỗ gầm cao, mạnh mẽ. Tài xế người bản địa nhiệt tình, rành từng cung đường săn mây.",
    description: `**Lừ Bun — Fortuner gầm cao, chinh phục mọi con dốc Tà Xùa**

Đoàn đông, nhiều hành lý hay muốn đến những điểm đường khó? Chiếc Toyota Fortuner của anh Lừ Bun là lựa chọn mạnh mẽ và an tâm nhất.

- **Xe:** Toyota Fortuner 7 chỗ — gầm cao, máy khoẻ, vượt dốc đèo tự tin
- **Tài xế:** người bản địa, nhiệt tình, thuộc đường như lòng bàn tay
- **Điểm đón:** trung tâm Tà Xùa
- **Giá tham khảo:** 2.200.000đ/ngày

${TAXI_ROUTES}

${TAXI_WHY}`,
  },
  {
    slug: "luong-thieu",
    summary:
      "Lường Thiệu — chuyên taxi Tà Xùa và các tuyến miền Bắc với VinFast VF 5 Plus đời mới, êm ái. Tài xế kinh nghiệm, đúng giờ, phục vụ tận tình.",
    description: `**Lường Thiệu — taxi Tà Xùa & đường dài miền Bắc**

Từ những vòng săn mây quanh Tà Xùa đến các chuyến đưa đón đường dài khắp miền Bắc, anh Lường Thiệu luôn sẵn sàng đồng hành.

- **Xe:** VinFast VF 5 Plus — xe điện đời mới, êm, sạch, không mùi xăng
- **Phạm vi:** taxi nội vùng Tà Xùa · các tuyến Hà Nội ↔ Tà Xùa và miền Bắc
- **Điểm đón:** Tà Xùa
- **Giá tham khảo:** từ 1.600.000đ/ngày

${TAXI_ROUTES}

${TAXI_WHY}`,
  },
  {
    slug: "tuan-nguyen",
    summary:
      "Tuấn Nguyên — taxi 7 chỗ Mitsubishi Xpander Cross đời mới, sạch đẹp. Anh Tuấn hỗ trợ chụp ảnh, quay phim và có flycam để lưu lại khoảnh khắc biển mây Tà Xùa.",
    description: `**Tuấn Nguyên — vừa là tài xế, vừa là "nhiếp ảnh gia" của đoàn**

Không chỉ đưa bạn đến đúng nơi, đúng lúc mây đẹp, anh Tuấn còn giúp bạn mang về những thước phim, tấm ảnh từ trên cao thật ấn tượng.

- **Xe:** Mitsubishi Xpander Cross 7 chỗ đời mới — rộng rãi, sạch sẽ
- **Đặc biệt:** hỗ trợ chụp ảnh, quay phim, có **flycam** ghi hình từ trên cao
- **Điểm đón:** trung tâm Tà Xùa
- **Giá:** 2.000.000đ/ngày chạy các điểm Tà Xùa · 3.000.000đ/ngày kèm quay phim flycam

${TAXI_ROUTES}

${TAXI_WHY}`,
  },
  {
    slug: "khanh-car",
    summary:
      "Khánh Car — taxi 7 chỗ Toyota Avanza Premio 2024 đời mới, rộng rãi cho gia đình và nhóm bạn. Chuyên chạy các điểm săn mây Tà Xùa.",
    description: `**Khánh Car — xe 7 chỗ đời mới cho cả gia đình**

Chiếc Toyota Avanza Premio 2024 rộng rãi, thoải mái — vừa vặn cho gia đình có trẻ nhỏ hay nhóm bạn 5–6 người muốn trọn vẹn một ngày săn mây.

- **Xe:** Toyota Avanza Premio 2024 — 7 chỗ, đời mới, sạch sẽ
- **Chuyên:** taxi các điểm du lịch Tà Xùa
- **Điểm đón:** trung tâm Tà Xùa
- **Giá tham khảo:** 1.700.000đ/ngày

${TAXI_ROUTES}

${TAXI_WHY}`,
  },
  {
    slug: "trieu-du-lich-san-may-7-cho",
    summary:
      "Triệu Du lịch săn mây — taxi 7 chỗ Mitsubishi Xpander kiêm dẫn tour Tà Xùa, biết góc chụp đẹp và hỗ trợ chụp ảnh cho cả đoàn.",
    description: `**Triệu Du lịch săn mây (7 chỗ) — tài xế kiêm hướng dẫn viên**

Anh Triệu không chỉ lái xe mà còn dẫn tour: biết điểm nào mây đẹp theo mùa, góc nào lên ảnh lung linh và sẵn lòng cầm máy chụp cho cả đoàn.

- **Xe:** Mitsubishi Xpander 7 chỗ — rộng rãi cho nhóm đông
- **Dịch vụ:** taxi + dẫn tour Tà Xùa, hỗ trợ chụp ảnh đẹp
- **Điểm đón:** trung tâm Tà Xùa
- **Giá tham khảo:** 1.800.000đ/ngày

${TAXI_ROUTES}

${TAXI_WHY}`,
  },
  {
    slug: "trieu-du-lich-san-may-4-cho",
    summary:
      "Triệu Du lịch săn mây — taxi 4 chỗ VinFast VF 5 Plus kiêm dẫn tour Tà Xùa, hỗ trợ chụp ảnh flycam đẹp. Nhận đưa đón Hà Nội ↔ Tà Xùa.",
    description: `**Triệu Du lịch săn mây (4 chỗ) — gọn nhẹ cho cặp đôi & nhóm nhỏ**

Lựa chọn lý tưởng cho cặp đôi, gia đình nhỏ hay nhóm 3–4 bạn: xe điện êm ái, tài xế kiêm dẫn tour và có flycam để lưu lại khoảnh khắc biển mây từ trên cao.

- **Xe:** VinFast VF 5 Plus — xe điện đời mới, êm, sạch
- **Dịch vụ:** taxi + dẫn tour, hỗ trợ chụp ảnh **flycam**
- **Phạm vi:** trung tâm Tà Xùa · đưa đón Hà Nội ↔ Tà Xùa
- **Giá tham khảo:** 1.700.000đ/ngày

${TAXI_ROUTES}

${TAXI_WHY}`,
  },
];

async function main() {
  for (const u of UPDATES) {
    const r = await prisma.service.updateMany({ where: { slug: u.slug }, data: { summary: u.summary, description: u.description } });
    console.log(`${r.count ? "✓" : "✗ KHÔNG THẤY"} ${u.slug}`);
  }
}
main().finally(() => prisma.$disconnect());
