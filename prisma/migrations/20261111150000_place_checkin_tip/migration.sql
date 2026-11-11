-- Mẹo ngắn cho khách (thẻ trên trang /lich-trinh)
ALTER TABLE "Place" ADD COLUMN IF NOT EXISTS "tip" TEXT;

-- Danh mục mới: điểm check-in (kind = 'CHECKIN'). Nạp sẵn 7 điểm quen thuộc; admin sửa/thêm ở /admin/places.
INSERT INTO "Place" ("id","kind","slug","name","area","address","price","hours","tags","desc","tip","sortOrder","published","createdAt","updatedAt") VALUES
 ('checkin_dinh_gio','CHECKIN','dinh-gio','Đỉnh Gió','Đỉnh Gió','1,5 km từ trung tâm','Miễn phí','05:30–09:00','Ngắm mây sát trung tâm','Dải đồi lộng gió ngay sau trung tâm, đi bộ được.','Hợp ngắm bình minh nếu không muốn đi xa.',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
 ('checkin_cay_co_don','CHECKIN','cay-co-don','Cây cô đơn','Trung tâm','2 km từ trung tâm','Miễn phí','05:30–08:00','Biểu tượng săn mây','Cây táu đứng một mình trên mỏm đồi, mây trôi ngay dưới chân.','Tới trước 6h để có ảnh vắng người.',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
 ('checkin_ban_be','CHECKIN','doi-che-co-thu-ban-be','Đồi chè cổ thụ Bản Bẹ','Bản Bẹ','3 km từ trung tâm','Miễn phí','08:00–16:00','Chè Shan tuyết trăm năm','Rừng chè cổ thụ phủ rêu, thân to cả vòng tay.','Mua chè trực tiếp của bà con làm quà.',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
 ('checkin_thao_nguyen','CHECKIN','thao-nguyen-ta-xua','Thảo nguyên Tà Xùa','Thảo nguyên','4 km từ trung tâm','Thuê lều ~200.000đ',NULL,'Đồi cỏ cắm trại, Chiều & đêm','Đồi cỏ thoai thoải, dựng lều ngắm sao và đợi mây sớm.','Đêm rất lạnh, mang áo ấm dày.',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
 ('checkin_mong_vai','CHECKIN','ban-mong-vai','Bản Mống Vài','Mống Vài','6 km từ trung tâm','Miễn phí','09:00–16:00','Bản người Mông','Nhà trình tường, ruộng bậc thang, trẻ em chăn bò trên đồi.','Xin phép trước khi chụp ảnh người dân.',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
 ('checkin_mom_ca_heo','CHECKIN','mom-ca-heo','Mỏm cá heo','Háng Đồng','9 km từ trung tâm','Vé ~20.000đ','06:00–09:00','Cung Háng Đồng','Mỏm đá nhô ra hình cá heo giữa biển mây.','Đường đất dốc, nên đi xe ôm bản địa.',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
 ('checkin_song_lung','CHECKIN','song-lung-khung-long','Sống lưng khủng long','Sống lưng khủng long','12 km từ trung tâm','Vé ~20.000đ','06:00–10:00','Cung đường huyền thoại','Sống núi hẹp hai bên vực, uốn lượn như lưng khủng long.','Không đi khi mưa hoặc gió to; mang giày bám tốt.',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
