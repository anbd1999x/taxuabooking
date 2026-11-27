import fs from "node:fs";
const f = "phuot-ta-xua-bang-xe-may-tu-ha-noi.md";
let c = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const lines = c.split("\n");
const s = lines.findIndex(l => l.startsWith("## Đi xe máy từ Hà Nội lên Tà Xùa"));
const e = lines.findIndex(l => l.startsWith("## Chạy xe máy lên Tà Xùa mất mấy tiếng"));
const newSec = `## Đi xe máy lên Tà Xùa theo đường nào, bao xa?

Tóm gọn: **quốc lộ 32 qua Sơn Tây, Thanh Sơn tới Thu Cúc, quốc lộ 32B vượt đèo Cón sang Mường Cơi, quốc lộ 37 qua Phù Yên về Bắc Yên, rồi 14km tỉnh lộ 112 lên trung tâm Tà Xùa.** Tổng khoảng 207 đến 210km theo đo đạc của hai dịch vụ dẫn đường OSRM và Valhalla. Đặc điểm từng chặng, đèo nào dài, đoạn nào hay sạt có ở bài [đường lên Tà Xùa từ Hà Nội](/kinh-nghiem/duong-di-ta-xua-tu-ha-noi). Bài này chỉ nói chuyện của người cầm lái xe máy.

Ba điều riêng cho xe máy:

- **Xe máy không được vào cao tốc.** Ra khỏi Hà Nội bạn đi quốc lộ 32 qua Nhổn, Phùng về Sơn Tây.
- **Gõ đúng "Tà Xùa, Sơn La"** trên ứng dụng bản đồ. Có một bản Tà Xùa khác ở Trạm Tấu, bản đồ dẫn nhầm là lệch 3 đến 4 tiếng. Giải thích ở bài [Tà Xùa ở đâu, cách Hà Nội bao nhiêu km](/kinh-nghiem/ta-xua-o-dau-cach-ha-noi-bao-nhieu-km).
- **Xuất phát từ phía đông Hà Nội** thì cộng thêm 15 đến 20km đường phố.

Đi từ nơi khác cũng được. Từ Mộc Châu sang, bạn đi quốc lộ 6, quốc lộ 37 qua cầu Tạ Khoa, khoảng 135km; cách ghép tuyến ở bài [từ Mộc Châu, Sơn La sang Tà Xùa](/kinh-nghiem/tu-moc-chau-son-la-sang-ta-xua). Từ Sapa thì xa hơn nhiều, khoảng 287km đường xe, và xe máy phải tránh đoạn cao tốc.
`;
lines.splice(s, e - s, ...newSec.split("\n"));
c = lines.join("\n");
const rep = (a, b) => { if (!c.includes(a)) console.log("MISS:", a.slice(0, 50)); c = c.split(a).join(b); };
rep("là chặng khoảng 215km, chạy thực", "là chặng khoảng 210km, chạy thực");
rep("rồi leo 15km đèo cuối lên trung tâm Tà Xùa.", "rồi leo 14km đèo cuối lên trung tâm Tà Xùa.");
rep("- **Quãng đường:** khoảng 215km mỗi chiều, khứ hồi khoảng 430km,", "- **Quãng đường:** khoảng 207 đến 210km mỗi chiều, khứ hồi khoảng 420km,");
rep("Bắc Yên (khoảng 200km), trung tâm Tà Xùa (khoảng 215km).", "Bắc Yên (khoảng 195km), trung tâm Tà Xùa (207 đến 210km).");
rep("- **Đoạn khó nhất:** 15km tỉnh lộ 112", "- **Đoạn khó nhất:** 14km tỉnh lộ 112");
// gas section with table
rep(`Đường từ Hà Nội tới Bắc Yên đi qua nhiều thị trấn, khoảng cách giữa các mốc chỉ 35 đến 90km. Thói quen an toàn là **đổ đầy bình ở mỗi thị trấn lớn**, không đợi kim xăng chạm vạch đỏ:

- **Thanh Sơn:** điểm nghỉ đầu tiên sau khoảng 90km, nhiều quán ăn sáng.
- **Thu Cúc:** đổ trước khi vào đoạn núi dài.
- **Phù Yên:** thị trấn lớn, hợp ăn trưa.
- **Bắc Yên:** điểm đổ xăng cuối trước 15km đèo. ATM gần nhất của Tà Xùa cũng ở đây, nên rút tiền mặt luôn.`,
`Đường từ Hà Nội tới Bắc Yên đi qua nhiều thị trấn, khoảng cách giữa các điểm dừng chỉ 30 đến 90km. Thói quen an toàn là **đổ đầy bình ở mỗi thị trấn lớn**, không đợi kim xăng chạm vạch đỏ. Lịch dừng gợi ý cho xe máy:

| Điểm dừng | Cộng dồn từ Hà Nội | Việc nên làm |
| --- | --- | --- |
| Thanh Sơn | khoảng 90km | Ăn sáng, đổ xăng, duỗi lưng sau đoạn phố đông |
| Thu Cúc | khoảng 130km | Đổ đầy bình trước đèo Cón, kiểm tra phanh |
| Phù Yên | khoảng 165km | Ăn trưa, nghỉ 45 phút, đổ xăng |
| Bắc Yên | khoảng 195km | Đổ đầy bình lần cuối, rút tiền ATM, mặc thêm áo |
| Trung tâm Tà Xùa | 207 đến 210km | Nhận phòng, dựng xe ở homestay |

ATM gần nhất của Tà Xùa cũng ở Bắc Yên, nên rút tiền mặt luôn ở đây.`);
rep("## 15km đèo Bắc Yên lên Tà Xùa chạy thế nào cho an toàn?", "## 14km đèo Bắc Yên lên Tà Xùa chạy thế nào cho an toàn?");
rep("phanh dễ nóng khi đổ đèo 15km", "phanh dễ nóng khi đổ đèo 14km");
rep("Khoảng 215km tới trung tâm Tà Xùa theo cung Sơn Tây, Thanh Sơn, Thu Cúc, Phù Yên, Bắc Yên. Khứ hồi khoảng 430km,", "Khoảng 207 đến 210km tới trung tâm Tà Xùa theo cung Sơn Tây, Thanh Sơn, Thu Cúc, đèo Cón, Phù Yên, Bắc Yên. Khứ hồi khoảng 420km,");
rep("là chiều đổ đèo 15km:", "là chiều đổ đèo 14km:");
rep("thị trấn cuối trước 15km đèo.", "thị trấn cuối trước 14km đèo.");
rep("Quãng đường và thời gian là ước tính theo cung Hà Nội, Sơn Tây, Thanh Sơn, Thu Cúc, Phù Yên, Bắc Yên, đối chiếu với dữ liệu dẫn đường OpenStreetMap (OSRM, Valhalla) và Vietnam Tourism (vietnam.travel)", "Quãng đường đo bằng hai dịch vụ dẫn đường trên OpenStreetMap (OSRM, Valhalla), thống nhất với bài đường lên Tà Xùa từ Hà Nội; tuyến đối chiếu Vietnam Tourism (vietnam.travel)");
fs.writeFileSync(f, c);
console.log((c.match(/15km/g)||[]).length, (c.match(/215/g)||[]).length);
