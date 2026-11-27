import fs from "node:fs";
const keys = [
"Đặt xe cabin, homestay, tour Tà Xùa",
"Homestay Tà Xùa: giá & phòng trống theo ngày",
"{0} homestay, bungalow Tà Xùa view biển mây ở trung tâm, Đỉnh Gió, Khe Cải. Xem giá từng phòng và phòng trống theo ngày, đặt phòng không cần thanh toán online.",
"Xe cabin Hà Nội – Tà Xùa: giá vé & chỗ trống",
"Đặt xe cabin giường nằm Hà Nội – Tà Xùa và các tỉnh: vé khứ hồi từ {0}, chạy đêm 21h tới 6h sáng. Xem nhà xe còn chỗ theo ngày, đặt vé cả hai chiều.",
"Combo Tà Xùa: xe cabin khứ hồi + homestay trọn gói",
"Combo Tà Xùa ghép sẵn xe cabin khứ hồi và phòng homestay còn trống đúng ngày bạn đi. Nhập ngày, số người, ngân sách để xem giá trọn gói mỗi người.",
"Kinh nghiệm du lịch Tà Xùa",
"Kinh nghiệm du lịch Tà Xùa mới nhất: mùa mây, đặt xe cabin, chọn homestay, điểm check-in, lịch trình 2N1Đ, 3N2Đ, chi phí và mẹo đi lần đầu.",
"Thuê xe máy Tà Xùa: giá thuê theo ngày & xe còn trống","Xe ôm Tà Xùa: tài xế bản địa, giá theo tuyến","Taxi Tà Xùa: xe 4–7 chỗ, giá theo ngày",
];
for (const l of ["en","zh","ko"]) { const d = JSON.parse(fs.readFileSync(`src/lib/i18n/dict/${l}.json`,"utf8")); console.log("==",l); for (const k of keys) console.log(" ", JSON.stringify(d[k] ?? "(MISSING)")); }
