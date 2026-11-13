import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
const prisma = new PrismaClient();

// [giờ mong đợi, ghi chú] theo đúng thứ tự điểm dừng; chỉ ghi vào ô ghi chú ĐANG TRỐNG.
const NOTES: Record<string, [string, string][][]> = {
  "2n1d": [
    [
      ["04:30", "Xe cabin tới Bắc Yên, đổi xe trung chuyển lên Tà Xùa. Trời còn tối và lạnh, mặc sẵn áo ấm."],
      ["06:00", "Gửi đồ ở homestay, nhận xe máy thuê, đổ đầy xăng trước khi đi các điểm."],
      ["06:30", "Ăn sáng, uống cà phê nóng và ngắm mây buổi sớm ngay tại quán."],
      ["07:00", "Chụp ảnh hồ nước giữa núi lúc nắng sớm, mặt hồ lặng và mây còn thấp."],
      ["09:00", "Dạo thảo nguyên, chụp ảnh đồi cỏ và đàn ngựa. Nắng lên nhanh, nhớ mũ và kem chống nắng."],
      ["11:30", "Chụp ảnh trên mỏm đá nhô ra giữa biển mây. Đứng cách mép đá, không ra sát khi gió to hay đá ướt."],
      ["12:00", "Chụp ảnh với cây cô đơn bên sườn núi. Đông khách thì xếp hàng, mỗi lượt chụp nhanh vài kiểu."],
      ["13:00", "Ăn cơm bản địa: gà đồi, rau cải mèo, thịt gác bếp. Đi nhóm đông nên gọi đặt trước."],
      ["14:00", "Nhận phòng, tắm rửa, ngủ bù sau đêm ngồi xe để chiều còn sức đi tiếp."],
      ["15:30", "Uống cà phê, ngồi ban công nhìn xuống thung lũng, chờ nắng chiều dịu."],
      ["16:00", "Chụp ảnh ở các tiểu cảnh trên đồi, nắng xiên cuối chiều lên hình đẹp nhất."],
      ["17:00", "Chọn chỗ ngồi hướng tây, gọi đồ uống rồi ngắm mặt trời lặn. Chiều gió mạnh, mang áo khoác."],
      ["19:00", "Ăn tối đồ nướng, lẩu. Cuối tuần quán đông nên đặt bàn trước."],
      ["20:30", "Uống trà, cà phê, sưởi ấm và trò chuyện buổi tối."],
      ["22:00", "Ngủ sớm, đặt báo thức khoảng 05:00 để kịp săn mây sáng hôm sau."],
    ],
    [
      ["05:45", "Xuất phát khi trời vừa hửng để đón bình minh và biển mây. Đi giày bám tốt, mang nước; đường sống núi hẹp, đi chậm và không đùa giỡn."],
      ["09:00", "Xem và thử tự tay nhuộm chàm, vẽ sáp ong; có thể mua khăn, vải chàm làm quà."],
    ],
  ],
  "3n2d": [
    [
      ["04:30", ""],
      ["05:30", "Ăn sáng, uống cà phê nóng, gửi đồ và ngắm mây buổi sớm ngay tại quán."],
      ["07:00", "Chụp ảnh hồ nước giữa núi lúc nắng sớm, mặt hồ lặng và mây còn thấp."],
      ["09:00", "Dạo thảo nguyên, chụp ảnh đồi cỏ và đàn ngựa. Nắng lên nhanh, nhớ mũ và kem chống nắng."],
      ["11:00", "Chụp ảnh trên mỏm đá nhô ra giữa biển mây. Đứng cách mép đá, không ra sát khi gió to hay đá ướt."],
      ["12:00", "Chụp ảnh với cây cô đơn bên sườn núi. Đông khách thì xếp hàng, mỗi lượt chụp nhanh vài kiểu."],
      ["12:30", "Ăn cơm bản địa: gà đồi, rau cải mèo, thịt gác bếp. Đi nhóm đông nên gọi đặt trước."],
      ["14:00", "Nhận phòng, tắm rửa, ngủ bù sau đêm ngồi xe để chiều còn sức đi tiếp."],
      ["15:30", "Uống cà phê, ngồi ban công nhìn xuống thung lũng, chờ nắng chiều dịu."],
      ["17:00", "Chụp ảnh ở các tiểu cảnh trên đồi và ngắm hoàng hôn, nắng xiên cuối chiều lên hình đẹp nhất."],
      ["18:30", "Tắm nước nóng, thay đồ ấm trước khi đi ăn tối."],
      ["19:00", "Lẩu gà đen, lẩu cá tầm hoặc đồ nướng; hỏi giá và đặt bàn trước vào cuối tuần."],
      ["20:30", "Uống trà, cà phê, sưởi ấm và trò chuyện buổi tối."],
      ["22:00", "Ngủ sớm, đặt báo thức khoảng 04:45 cho buổi săn mây sáng hôm sau."],
    ],
    [
      ["05:30", ""],
      ["10:30", "Xem và thử tự tay nhuộm chàm, vẽ sáp ong; có thể mua khăn, vải chàm làm quà."],
      ["12:00", "Ăn trưa gần trung tâm cho tiện về nghỉ; xem mục Nhà hàng để chọn quán."],
      ["13:00", "Ngủ trưa, sạc pin điện thoại và máy ảnh cho buổi chiều."],
      ["15:00", "Ngồi cà phê ngắm thung lũng và mây chiều. Khu này gió mạnh, mang áo khoác."],
      ["17:30", "Ngắm hai ngọn núi đôi lúc hoàng hôn, chụp ảnh ngược nắng. Tối nhanh và lạnh, về trước khi trời tối hẳn."],
      ["19:00", "Ăn tối lẩu, nướng; đặt bàn trước vào cuối tuần."],
      ["20:30", ""],
      ["22:00", "Hôm sau không phải dậy quá sớm nên có thể chơi khuya hơn một chút; giữ yên lặng khi về homestay."],
    ],
    [
      ["06:00", "Ăn sáng thong thả, dậy sớm thì ngắm mây lần cuối ngay tại homestay."],
      ["08:00", "Thăm đồi chè, thưởng trà shan tuyết cổ thụ và mua trà làm quà."],
      ["09:30", "Mua đặc sản mang về: trà shan tuyết, táo mèo, mật ong, thịt gác bếp. Hỏi giá trước khi mua."],
      ["10:30", "Ăn trưa sớm, xong về homestay thu dọn hành lý."],
      ["12:00", ""],
      ["19:30", "Về tới Hà Nội, nghỉ ngơi và hẹn chuyến Tà Xùa lần sau."],
    ],
  ],
};

(async () => {
  const row = await prisma.siteSetting.findUnique({ where: { key: "itinerary" } });
  if (!row) throw new Error("no itinerary");
  writeFileSync(process.argv[2], row.value);
  const cfg = JSON.parse(row.value);
  let n = 0;
  for (const p of cfg.plans) {
    const days = NOTES[p.id];
    if (!days) continue;
    days.forEach((stops, di) => stops.forEach(([time, note], si) => {
      const s = p.days[di]?.stops[si];
      if (!s || !note) return;
      if (s.time !== time) { console.log(`LỆCH ${p.id} ngày ${di + 1} #${si}: ${s.time} ≠ ${time} — bỏ qua`); return; }
      if ((s.note ?? "").trim()) return;
      s.note = note; n++;
    }));
  }
  await prisma.siteSetting.update({ where: { key: "itinerary" }, data: { value: JSON.stringify(cfg) } });
  console.log("đã thêm", n, "ghi chú");
})().finally(() => prisma.$disconnect());
