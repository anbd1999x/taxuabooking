import fs from "node:fs";
const f = "tu-sapa-di-ta-xua.md";
let c = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const rep = (a, b) => { if (!c.includes(a)) console.log("MISS:", a.slice(0, 60)); c = c.split(a).join(b); };
rep("Từ Sapa đi Tà Xùa theo đường ngang trên núi khoảng 285 đến 310km, tuỳ cung, không phải vòng về Hà Nội. Ô tô theo cao tốc xuống Yên Bái rồi quốc lộ 37 qua Phù Yên chạy khoảng 6 đến 6,5 tiếng;",
 "Từ Sapa đi Tà Xùa theo đường ngang khoảng 287km bằng ô tô, không phải vòng về Hà Nội; chim bay chỉ khoảng 130km. Ô tô theo cao tốc Nội Bài – Lào Cai về hướng Yên Bái cũ rồi quốc lộ 32, 37 qua Phù Yên, chạy khoảng 6,5 tiếng;");
rep("xe máy không được vào cao tốc nên đi qua Than Uyên, Mường La, mất khoảng 8 tiếng chạy.", "xe máy không được vào cao tốc nên đi qua Than Uyên, Mường La, khoảng 305km và 8 tiếng chạy.");
rep("- **Khoảng cách đường ngang:** khoảng 285km bằng ô tô qua cao tốc,", "- **Khoảng cách đường ngang:** khoảng 287km bằng ô tô qua cao tốc,");
rep("tới Bắc Yên trước 15h để lên 15km đèo cuối trước 16h", "tới Bắc Yên trước 15h để lên 14km đèo cuối trước 16h");
rep("| Ô tô qua cao tốc | Sapa, Lào Cai, cao tốc Nội Bài – Lào Cai, nút Yên Bái, quốc lộ 37, Phù Yên, Bắc Yên | khoảng 285km | khoảng 6 đến 6,5 tiếng |",
 "| Ô tô qua cao tốc | Quốc lộ 4D, cao tốc Nội Bài – Lào Cai, quốc lộ 32, 37 qua Phù Yên, Bắc Yên | khoảng 287km | khoảng 6,5 tiếng |");
rep("Thời gian trong bảng là thời gian lăn bánh theo dữ liệu dẫn đường, chưa tính ăn uống và nghỉ.",
 "Số km ô tô là mức hai dịch vụ dẫn đường OSRM và Valhalla cùng đo (286,7km và 287,5km), khớp bài [Tà Xùa hay Sapa](/kinh-nghiem/ta-xua-hay-sapa-y-ty). Hai cung xe máy do tụi mình đo bằng Valhalla ở chế độ xe máy, dài hơn vì phải tránh cao tốc. Thời gian là thời gian lăn bánh, chưa tính ăn uống và nghỉ.");
rep("Từ Sơn La về Bắc Yên còn khoảng 100km và 15km đèo,", "Từ Sơn La về Bắc Yên còn khoảng 100km và 14km đèo,");
// shorten car section
const s = c.indexOf("## Tự lái ô tô từ Sapa đi Tà Xùa đi đường nào?");
const e = c.indexOf("![Ô tô 7 chỗ dừng");
c = c.slice(0, s) + `## Tự lái ô tô từ Sapa: nghỉ đâu dọc đường?

Cung ô tô tóm gọn: Sapa xuống Lào Cai theo quốc lộ 4D, vào cao tốc Nội Bài – Lào Cai, rời cao tốc về hướng Yên Bái cũ, theo quốc lộ 32, 37 tới Phù Yên, Bắc Yên rồi leo 14km tỉnh lộ 112. Đặc điểm từng đoạn từ Phù Yên trở lên có ở bài [đường lên Tà Xùa từ Hà Nội](/kinh-nghiem/duong-di-ta-xua-tu-ha-noi).

Lịch dừng gợi ý cho một ngày lái:

- **7h đến 8h:** rời Sapa sau bữa sáng, xuống Lào Cai khi đường đèo còn vắng.
- **Giữa buổi:** nghỉ ở trạm dừng trên cao tốc, đổ xăng trước khi rời cao tốc.
- **Trưa:** ăn ở Phù Yên, thị trấn lớn cuối cùng trước núi.
- **Trước 15h:** qua Bắc Yên, đổ đầy bình, rút tiền ATM.
- **Khoảng 15h30:** tới trung tâm Tà Xùa, nhận phòng, chiều ra Đỉnh Gió nếu còn sức.

Chỗ đỗ xe, homestay có đường ô tô vào và các điểm phải đổi sang xe ôm có ở bài [đi Tà Xùa bằng ô tô tự lái](/kinh-nghiem/di-ta-xua-bang-o-to-tu-lai). Trên Tà Xùa Booking, 23 trong 38 homestay có nhãn "Đường dễ đi".

` + c.slice(e);
rep("4. **Quốc lộ 37 từ Cò Nòi** lên Bắc Yên, rồi 15km đèo lên Tà Xùa.", "4. **Quốc lộ 37 từ Cò Nòi** qua cầu Tạ Khoa lên Bắc Yên, rồi 14km đèo lên Tà Xùa.");
rep("khách đổi sang xe trung chuyển của nhà xe leo 15km đèo.", "khách đổi sang xe trung chuyển của nhà xe leo 14km đèo.");
// itinerary section
const s2 = c.indexOf("## Ghép Sapa và Tà Xùa trong một chuyến thế nào?");
const e2 = c.indexOf("Chỗ ở cho đêm đầu tiên sau chặng dài:");
c = c.slice(0, s2) + `## Ghép Sapa và Tà Xùa: lịch 3, 4 hay 5 ngày?

Đi Sapa trước, kết thúc ở Tà Xùa là chiều hợp lý: bạn có buổi sáng săn mây cuối chuyến và chặng về Hà Nội chỉ còn khoảng 210km. Ba khung tuỳ số ngày:

| Số ngày | Cách đi | Ngủ ở đâu | Phù hợp |
| --- | --- | --- | --- |
| 3 ngày 2 đêm | Sapa về Hà Nội ban ngày, xe cabin đêm lên Tà Xùa | Đêm 1 trên xe cabin, đêm 2 ở Tà Xùa | Không tự lái, muốn 2 sáng săn mây |
| 4 ngày 3 đêm | Ô tô Sapa sang Tà Xùa theo cung cao tốc trong 1 ngày | Sapa, Tà Xùa 2 đêm | Nhóm có ô tô, lái quen |
| 5 ngày 4 đêm | Xe máy hoặc ô tô qua Mù Cang Chải, Nghĩa Lộ | Sapa, Mù Cang Chải, Tà Xùa 2 đêm | Người mê đèo, đi mùa lúa |

Khung 5 ngày chi tiết:

1. **Ngày 1:** Sapa.
2. **Ngày 2:** Sapa sang Mù Cang Chải qua Ô Quy Hồ, Than Uyên, ngủ Mù Cang Chải.
3. **Ngày 3:** qua đèo Khau Phạ, Tú Lệ, Nghĩa Lộ, sang Tà Xùa qua Trạm Tấu hoặc Phù Yên, tới trước 16h.
4. **Ngày 4:** săn mây sáng sớm, Sống lưng khủng long, chiều Đỉnh Gió.
5. **Ngày 5:** săn mây lần hai, trưa xuống núi về Hà Nội.

Khung 3 ngày dùng xe cabin: ngày 1 rời Sapa trước 13h, tối lên xe ở Hà Nội; ngày 2 tới Tà Xùa 6h, săn mây, ngủ homestay; ngày 3 săn mây lần hai, 12h lên xe về Hà Nội, khoảng 19h tới nơi.

` + c.slice(e2);
rep("Không gần. Hai nơi thuộc hai tỉnh, cách nhau gần 300km đường núi. Tà Xùa gần Hà Nội hơn Sapa, khoảng 215km so với khoảng 320km.", "Không gần. Hai nơi thuộc hai tỉnh, cách nhau khoảng 287km đường xe dù chim bay chỉ khoảng 130km. Tà Xùa gần Hà Nội hơn Sapa, khoảng 210km so với khoảng 320km.");
rep("Theo đường ngang trên núi, Tà Xùa cách Sapa khoảng 285 đến 310km tuỳ cung.", "Tà Xùa cách Sapa khoảng 287km theo đường ô tô ngắn nhất, xe máy tránh cao tốc thì khoảng 305 đến 310km.");
rep("Ô tô qua cao tốc mất khoảng 6 đến 6,5 tiếng lăn bánh, xe máy khoảng 8 tiếng.", "Ô tô qua cao tốc mất khoảng 6,5 tiếng lăn bánh, xe máy khoảng 8 tiếng.");
fs.writeFileSync(f, c);
console.log((c.match(/15km|215|285/g)||[]).join(","));
