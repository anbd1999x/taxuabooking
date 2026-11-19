import type { DemoModule } from "@/lib/module-demo";

/** Nội dung trang giới thiệu các module cho chủ dịch vụ (/hop-tac) — theo claude.ai/design "Gioi thieu Module Hop tac". Chỉ tiếng Việt. */
export interface HubModule {
  /** Tên ở thanh chuyển module + nhãn nhỏ phía trên. */
  name: string; kick: string;
  for: string; badge: string; h1a: string; h1b: string; lead: string;
  proof: [string, string][];
  painKick: string; painTitle: string; pains: [string, string][];
  howTitle: string; steps: [string, string, string, string[]][];
  featKick: string; featTitle: string; feats: [string, string][];
  dayKick: string; dayTitle: string; day: [string, string, string][];
  ctaTitle: string; ctaText: string; ctaNote: string;
  faq: [string, string][];
}

export const HUB_ORDER: DemoModule[] = ["qr", "ticket", "xe", "home"];

export const HUB: Record<DemoModule, HubModule> = {
  xe: {
    name: "Quản lý thuê xe máy", kick: "TIỆM XE",
    for: "Cho tiệm cho thuê xe máy", badge: "Quản lý thuê xe máy · miễn phí", h1a: "Biết xe nào rảnh, ai đang thuê,", h1b: "chỉ trong một màn hình.",
    lead: "Nhập từng xe với ảnh, biển số, loại xe, tình trạng. Có đơn mới, hệ thống tự xếp xe còn trống đúng khung ngày. Cọc, giấy tờ, km, xăng khi giao và nhận xe đều ghi lại.",
    proof: [["1 chạm", "tự xếp xe trống"], ["0 lần", "giao trùng xe"], ["Mỗi xe", "một lịch sử riêng"]],
    painKick: "TIỆM XE THƯỜNG GẶP", painTitle: "Mùa săn mây xe chạy liên tục, nhớ trong đầu là không đủ.",
    pains: [["Hứa xe rồi mới biết đã cho thuê", "Khách gọi đặt, nhân viên khác đã giao chiếc đó từ sáng."], ["Ai đang giữ cọc, giữ giấy tờ gì?", "Căn cước, bằng lái, tiền cọc ghi giấy, trả xe xong lại đi tìm."], ["Xe về trễ, xăng hụt, trầy xước", "Không có ảnh và số km lúc giao, khó nói chuyện với khách."], ["Không biết xe nào lời, xe nào lỗ", "Thay nhớt, sửa phanh, bảo hiểm ghi rải rác, cuối mùa không biết lãi bao nhiêu."]],
    howTitle: "Từ lúc nhập xe tới khi khách trả chìa khoá.",
    steps: [
      ["01", "Nhập đội xe một lần", "Mỗi xe có ảnh, biển số, loại xe số, tay ga, côn tay, giá theo ngày và tình trạng hiện tại.", ["Gắn lịch bảo dưỡng theo km", "Đánh dấu xe đang sửa, không cho thuê", "Giá ngày thường, cuối tuần, mùa cao điểm"]],
      ["02", "Có đơn là tự xếp xe", "Khách đặt trên web hoặc bạn tạo đơn khi khách gọi. Hệ thống chọn xe trống phù hợp loại và khung ngày.", ["Đổi xe khác một chạm", "Giữ chỗ chưa cọc tự nhả", "Đơn từ Tà Xùa Booking tự vào lịch"]],
      ["03", "Giao xe có biên bản", "Ghi giấy tờ khách để lại, tiền cọc, số km, mức xăng và ảnh xe lúc giao.", ["Ảnh 4 góc xe", "Mũ bảo hiểm, áo mưa đi kèm", "Chép biên bản gửi Zalo cho khách"]],
      ["04", "Nhận xe, tự tính tiền", "Nhập km và xăng lúc trả. Hệ thống cộng phí trễ giờ, hụt xăng, hư hỏng, trừ cọc và báo số còn thu hay hoàn.", ["Trả giấy tờ, đánh dấu đã hoàn cọc", "Xe tự về trạng thái rảnh", "Doanh thu từng xe tự cộng"]],
    ],
    featKick: "ĐẦY ĐỦ CHO MỘT TIỆM XE", featTitle: "Quản lý cả đội xe như quản lý một chiếc.",
    feats: [["Lịch xe theo ngày · tháng · năm", "Mỗi xe một hàng, thấy ngay xe rảnh, đang thuê, đã cọc."], ["Tự xếp xe trống", "Đúng loại xe, đúng khung ngày, không bao giờ giao trùng."], ["Hồ sơ người thuê", "Số điện thoại, giấy tờ giữ lại, lịch sử thuê, khách quen, danh sách đen."], ["Cọc & thu chi", "Cọc tiền hay giấy tờ, thu thêm, hoàn cọc, chi phí sửa xe."], ["Bảo dưỡng theo km", "Nhắc thay nhớt, kiểm tra phanh, gia hạn bảo hiểm, đăng kiểm."], ["Biên bản giao nhận", "Km, xăng, ảnh xe, phụ kiện đi kèm, lưu lại để đối chiếu."], ["Báo cáo từng xe", "Số ngày cho thuê, doanh thu, chi phí, xe nào nên bán bớt."], ["Tài khoản nhân viên", "Nhân viên giao nhận xe, không xem báo cáo, không sửa giá."]],
    dayKick: "MỘT NGÀY Ở TIỆM XE", dayTitle: "Mở máy lúc sáng, biết chiếc nào đi đâu.",
    day: [["07:00", "Xem màn Hôm nay", "5 xe cần giao, 3 xe về, 1 xe quá hạn trả, 2 xe tới hạn thay nhớt."], ["08:30", "Khách gọi thuê 2 xe số", "Tạo đơn 3 ngày, hệ thống tự chọn 2 xe rảnh, ghi cọc 500k."], ["09:00", "Giao xe", "Chụp ảnh, ghi km, xăng, giữ căn cước. Chép biên bản gửi Zalo."], ["17:30", "Nhận xe về", "Xe về trễ 2 giờ, hụt xăng. Phí tự cộng, hoàn cọc phần còn lại."], ["21:00", "Xem sổ", "Hôm nay 9 xe chạy, thu bao nhiêu, cọc đang giữ bao nhiêu."]],
    ctaTitle: "Đưa cả đội xe của bạn lên một màn hình.", ctaText: "Gửi tụi mình danh sách xe và giá thuê, tụi mình nhập sẵn và hướng dẫn bạn cùng nhân viên trong một buổi.", ctaNote: "Miễn phí hoàn toàn, không giới hạn số xe, không thu phí theo đơn.",
    faq: [["Có cần cài ứng dụng không?", "Không cần. Mở bằng trình duyệt trên điện thoại hoặc máy tính, đăng nhập là dùng."], ["Tự xếp xe có đổi được không?", "Được. Hệ thống gợi ý xe trống phù hợp, bạn đổi sang xe khác cùng loại chỉ một chạm."], ["Khách cọc bằng giấy tờ thì ghi thế nào?", "Chọn loại giấy tờ giữ lại (căn cước, bằng lái, hộ chiếu), chụp ảnh lưu kèm đơn. Trả xe thì đánh dấu đã hoàn."], ["Nhân viên có xem được doanh thu không?", "Không. Nhân viên chỉ giao nhận xe, ghi cọc và tình trạng xe."]],
  },
  home: {
    name: "Quản lý homestay", kick: "HOMESTAY",
    for: "Cho chủ homestay", badge: "Phần mềm quản lý homestay · miễn phí", h1a: "Một lịch phòng cho mọi nguồn khách,", h1b: "không còn trùng phòng.",
    lead: "Khách gọi điện, khách vãng lai, khách Facebook, đơn từ Tà Xùa Booking: tất cả về một sơ đồ. Đặt ở đây là web tự báo hết phòng, nhận phòng và trả phòng tính tiền giúp bạn.",
    proof: [["1 lịch", "cho mọi kênh bán"], ["0 lần", "trùng phòng"], ["2 phút", "nhận khách, có CCCD"]],
    painKick: "HOMESTAY THƯỜNG GẶP", painTitle: "Sổ tay, Google Sheet và tin nhắn Zalo không nói chuyện với nhau.",
    pains: [["Khách gọi đặt, quên ghi lịch", "Tới nơi mới biết phòng đã có người, phải xin lỗi và tìm chỗ khác giữa đêm."], ["Web vẫn hiện còn phòng", "Lịch trên các trang bán phòng lệch thực tế, khách đặt rồi lại huỷ."], ["Cọc ai, còn nợ ai?", "Tiền cọc, tiền thu thêm, tiền hoàn nằm rải rác trong tin nhắn ngân hàng."], ["Trả phòng rối", "Quên tính lẩu, bia, phụ thu trả muộn. Phòng chưa dọn mà khách mới đã tới."]],
    howTitle: "Từ cuộc gọi đặt phòng tới lúc khách trả chìa khoá.",
    steps: [
      ["01", "Khai báo phòng một lần", "Tạo hạng phòng, số phòng, giá ngày thường, cuối tuần, giá lễ. Giờ nhận, trả và phụ phí theo ý bạn.", ["Giá lễ tự áp cho web và combo", "Đóng phòng bảo trì theo khoảng ngày", "Đồng bộ thêm Google Sheet nếu đang dùng"]],
      ["02", "Khách gọi là đặt ngay trên sơ đồ", "Bấm ô trống, nhập tên và số điện thoại, chọn một hay nhiều phòng cho đoàn. Báo giá tự tính, sửa tay được.", ["Phòng bận không chọn được", "Khách cũ, danh sách đen tự cảnh báo", "Chưa cọc thì tự nhả sau N giờ"]],
      ["03", "Nhận phòng có CCCD", "Ghi giờ đến thực tế, danh sách khách lưu trú và ảnh CCCD. Nhận sớm tự cộng phụ thu.", ["Xuất danh sách khai báo tạm trú", "Ghi lẩu, BBQ, bia vào phòng", "Đổi phòng, gia hạn một chạm"]],
      ["04", "Trả phòng, tự quyết toán", "Cộng dịch vụ, phụ thu, hư hỏng, trừ cọc. Thu nốt hoặc hoàn tiền, phòng tự chuyển chưa dọn.", ["Sổ thu chi tự ghi", "Buồng phòng thấy ngay phòng cần dọn", "Báo cáo công suất, doanh thu theo đêm"]],
    ],
    featKick: "ĐẦY ĐỦ CHO MỘT HOMESTAY", featTitle: "Những việc bạn đang làm bằng tay, giờ tự động.",
    feats: [["Sơ đồ phòng tháng · ngày · năm", "Mỗi lượt ở một thanh có tên khách, màu theo trạng thái."], ["Đơn từ sàn tự vào lịch", "Xác nhận còn phòng hoặc từ chối kèm lý do, sàn tìm phòng khác cho khách."], ["Thu chi một nơi", "Cọc, thu, hoàn, sàn thu hộ, chi phí điện nước, lương."], ["Buồng phòng", "Sạch, chưa dọn, đang dọn, bảo trì. Danh sách dọn ưu tiên phòng có khách tới."], ["Khách hàng", "Gom theo số điện thoại: số lần ở, tổng chi, khách quen, danh sách đen."], ["Báo cáo đúng nghề", "Công suất phòng, giá bình quân/đêm, doanh thu theo nguồn, lãi sau chi phí."], ["Tài khoản lễ tân", "Lễ tân đặt phòng, thu tiền, nhận trả phòng. Không xem báo cáo, không sửa giá."], ["Chạy trên điện thoại", "Không cần cài app, mở trình duyệt là dùng."]],
    dayKick: "MỘT NGÀY Ở HOMESTAY", dayTitle: "Mở máy lúc sáng, biết hết việc trong ngày.",
    day: [["07:00", "Mở \"Hôm nay\"", "Thấy ngay 3 phòng trả, 2 khách tới, 1 khách quá giờ, 1 giữ chỗ sắp hết hạn."], ["10:30", "Khách gọi đặt đoàn", "Chọn 3 phòng trống trên sơ đồ, báo giá có phụ thu cuối tuần, ghi cọc."], ["12:15", "Trả phòng 202", "Cộng lẩu gà, trả muộn, thu nốt bằng chuyển khoản. Phòng chuyển chưa dọn."], ["14:00", "Nhận phòng đoàn", "Ghi CCCD 6 khách, giao phòng đã dọn."], ["21:00", "Xem sổ thu chi", "Hôm nay thu bao nhiêu, cọc đang giữ bao nhiêu, còn ai nợ."]],
    ctaTitle: "Đưa homestay của bạn lên một lịch.", ctaText: "Gửi tụi mình danh sách phòng và giá, tụi mình cài đặt và hướng dẫn bạn cùng lễ tân trong một buổi.", ctaNote: "Miễn phí hoàn toàn, không giới hạn số phòng, không thu phí theo đơn.",
    faq: [["Đơn tôi tự tạo có bị sàn tính chiết khấu không?", "Không. Đơn khách gọi, vãng lai, Facebook là của bạn. Sàn chỉ tính chiết khấu đơn đến từ Tà Xùa Booking."], ["Tôi đang dùng Google Sheet thì sao?", "Vẫn dùng được song song. Sheet khoá thêm phòng được, lượt ở tạo trong phần mềm luôn được giữ."], ["Ảnh CCCD của khách có an toàn không?", "Chỉ chủ, lễ tân và admin của nhà xem được, không có đường dẫn công khai."], ["Lễ tân có xem được doanh thu không?", "Không. Lễ tân chỉ đặt phòng, thu tiền, nhận trả phòng và đổi tình trạng dọn."]],
  },
  ticket: {
    name: "Bán vé & đặt bàn", kick: "ĐIỂM CHECK-IN · SHOW",
    for: "Cho điểm check-in, show, nhà hàng", badge: "Bán vé & đặt bàn · miễn phí", h1a: "Bán vé, giữ ghế, soát vé QR,", h1b: "không cần quầy vé.",
    lead: "Điểm check-in bán vé theo ngày, show bán ghế theo sơ đồ, nhà hàng nhận đặt bàn kèm món trước. Khách nhận vé QR, nhân viên quét bằng điện thoại ở cổng.",
    proof: [["10 phút", "giữ ghế, không bán trùng"], ["1 mã QR", "mỗi người, mỗi ghế"], ["3 loại", "vé cổng · show · đặt bàn"]],
    painKick: "ĐIỂM DU LỊCH THƯỜNG GẶP", painTitle: "Bán vé tay thì đông là rối, vắng là phí người.",
    pains: [["Hai khách cùng một ghế", "Bán qua Zalo, Facebook, CTV cùng lúc, tới giờ diễn mới biết trùng."], ["Không biết còn bao nhiêu vé", "Mùa mây đông khách, hỏi còn vé không phải gọi qua lại nhiều lần."], ["Soát vé chậm", "Khách xếp hàng đọc tên, tìm tin nhắn chuyển khoản."], ["Bếp không biết khách đặt món gì", "Đặt bàn qua điện thoại, món ghi giấy, tới nơi lại chờ."]],
    howTitle: "Từ lúc mở bán tới lúc khách bước qua cổng.",
    steps: [
      ["01", "Tạo vé, suất, sơ đồ", "Hạng vé, giá, quota theo ngày. Show dựng sơ đồ ghế bằng lưới, nhà hàng khai báo bàn theo tầng và khu.", ["Quota riêng từng ngày", "Tạm dừng bán khi thời tiết xấu", "Khoá ghế cho khách mời"]],
      ["02", "Khách chọn và giữ chỗ", "Chọn ngày, suất, ghế hoặc bàn. Ghế được giữ 10 phút trong lúc khách điền thông tin.", ["Không bao giờ bán trùng", "Hết giờ giữ tự nhả", "Đặt kèm đồ ăn uống"]],
      ["03", "Thanh toán, phát vé QR", "Khách quét VietQR. Bạn bấm \"Đã thu\", vé QR hiện ngay trên trang đơn của khách.", ["Mỗi người một mã", "Voucher đồ uống riêng", "Bán tại cổng vẫn in vé"]],
      ["04", "Soát vé bằng điện thoại", "Nhân viên mở trang soát vé, quét là biết hợp lệ, đã dùng hay sai suất.", ["Không cần máy quét riêng", "Đếm số khách đã vào", "Phiếu bếp theo khung giờ"]],
    ],
    featKick: "ĐẦY ĐỦ CHO MỘT ĐIỂM BÁN", featTitle: "Một hệ thống cho cả ba kiểu bán.",
    feats: [["Vé vào cổng theo ngày", "Quota từng ngày, người lớn, trẻ em, miễn phí dưới 6 tuổi."], ["Show có sơ đồ ghế", "VIP, Thường, khu đứng. Khách thấy ghế nào còn, ghế nào đang giữ."], ["Đặt bàn nhiều tầng", "Sơ đồ bàn theo tầng và khu, đoàn đông chọn nhiều bàn."], ["Đặt món trước", "Bếp nhận phiếu theo khung giờ, có ghi chú từng món."], ["Chính sách cọc tuỳ chọn", "Không bắt buộc, cọc theo bàn, hoặc đặt món tối thiểu."], ["Bán tại quầy", "Khách mua trực tiếp, tiền mặt hoặc chuyển khoản, cộng vào quota."], ["Theo dõi từng suất", "Vé đã bán, đang giữ, tỉ lệ đã vào cổng, doanh thu vé."], ["Nhân viên soát vé", "Tài khoản riêng, chỉ vào được trang quét."]],
    dayKick: "MỘT ĐÊM DIỄN", dayTitle: "Từ lúc mở cổng tới khi hạ màn.",
    day: [["15:00", "Xem tình trạng suất", "Còn 9 ghế, 3 đơn đang chờ chuyển khoản, giữ chỗ tự đếm ngược."], ["17:00", "Khoá 4 ghế khách mời", "Bấm vào ghế, chọn khoá. Web không bán các ghế này nữa."], ["19:15", "Mở cổng", "Hai nhân viên quét QR trên điện thoại, mỗi lượt chỉ vài giây."], ["19:40", "Quầy nước", "Khách đưa voucher QR, quầy đánh dấu đã giao combo."], ["22:00", "Đóng sổ", "Bán 112 vé, 94% đã vào, doanh thu vé và món tách riêng."]],
    ctaTitle: "Mở bán vé cho điểm của bạn.", ctaText: "Gửi tụi mình hạng vé, giá và sơ đồ chỗ ngồi, tụi mình dựng sẵn và chạy thử cùng bạn.", ctaNote: "Miễn phí hoàn toàn, không thu phí theo vé, kể cả vé bán qua sàn.",
    faq: [["Có cần cổng thanh toán không?", "Không bắt buộc. Khách chuyển khoản VietQR, bạn bấm \"Đã thu\" là vé phát ra."], ["Khách không có email thì sao?", "Vé nằm ở trang đơn của khách: tra cứu bằng mã đơn hoặc bạn chép link gửi qua Zalo."], ["Mất mạng ở cổng thì soát vé thế nào?", "Nhập mã tay khi có mạng lại, hoặc đối chiếu danh sách khách in sẵn theo suất."], ["Nhà hàng nhiều tầng có làm được không?", "Được, sơ đồ bàn chia theo tầng và khu, khách chọn tầng khi đặt."]],
  },
  qr: {
    name: "Gọi món QR tại bàn", kick: "NHÀ HÀNG · QUÁN ĂN",
    for: "Cho nhà hàng, quán ăn", badge: "Gọi món QR tại bàn · miễn phí", h1a: "Khách quét QR tự gọi món,", h1b: "bếp nhận ngay, trả tiền tại bàn.",
    lead: "Dán mã QR lên bàn. Khách quét bằng điện thoại, xem thực đơn có ảnh, gọi món, ghi chú ít cay. Đơn hiện trên máy của quán sau vài giây kèm chuông báo.",
    proof: [["0đ", "tiền in thực đơn mỗi lần đổi giá"], ["Vài giây", "đơn tới bếp"], ["1 chạm", "gọi nhân viên, xin thanh toán"]],
    painKick: "QUÁN ĐÔNG KHÁCH THƯỜNG GẶP", painTitle: "Mùa mây quán kín bàn, nhân viên chạy không kịp.",
    pains: [["Khách vẫy mãi không ai ra", "Muốn gọi thêm món, xin hoá đơn phải chờ nhân viên rảnh."], ["Ghi order sai, thiếu món", "Bàn đông người gọi nhiều lần, giấy ghi lộn xộn, bếp làm nhầm."], ["Thực đơn in sẵn lỗi thời", "Hết món vẫn ghi, đổi giá phải in lại."], ["Tính tiền lâu", "Cộng tay từng tờ order, khách đợi ở quầy."]],
    howTitle: "Từ lúc khách ngồi xuống tới khi rời bàn.",
    steps: [
      ["01", "Tạo thực đơn và bàn", "Thêm món, giá, ảnh, nhóm món. Tạo bàn theo khu, in thẻ QR dán lên từng bàn.", ["Mỗi bàn một mã riêng", "Bật \"Hết món\" là khách thấy ngay", "Đánh dấu món bán chạy"]],
      ["02", "Khách quét và gọi món", "Mở camera quét mã, vào đúng thực đơn của bàn. Chọn món, ghi chú, bấm gửi.", ["Không tải app, không đăng nhập", "Gọi thêm nhiều lần, theo dõi món đã lên", "Gọi nhân viên một chạm"]],
      ["03", "Quán nhận đơn", "Đơn mới hiện trên máy quán kèm chuông. Bếp bấm Nhận đơn, rồi Đã lên món.", ["Đồng hồ đếm từng đơn, quá 15 phút báo đỏ", "Ghi chú món nổi bật cho bếp", "Nhiều máy cùng xem một lúc"]],
      ["04", "Thanh toán tại bàn", "Khách bấm yêu cầu thanh toán, chọn tiền mặt hoặc VietQR. Quán mở hoá đơn gộp, bấm đã thu.", ["Hoá đơn tự cộng", "Bàn tự trống lại", "Doanh thu ngày tự tính"]],
    ],
    featKick: "ĐẦY ĐỦ CHO MỘT QUÁN", featTitle: "Nhân viên đỡ chạy, khách đỡ chờ.",
    feats: [["Thực đơn điện tử có ảnh", "Đổi giá, hết món là khách thấy ngay."], ["Đơn mới kèm chuông", "Màn bếp chia cột Mới · Đang làm · Đã lên món."], ["Sơ đồ bàn sống", "Bàn trống, chờ món, đang ăn, chờ thanh toán, mỗi màu một trạng thái."], ["Gọi nhân viên", "Khách bấm trên điện thoại, quán thấy bàn nào cần."], ["Thanh toán QR", "Hiện VietQR đúng số tiền, nội dung là số bàn."], ["Thẻ QR in sẵn", "Thiết kế sẵn theo tên quán, in một lần dùng mãi."], ["Không cần thiết bị riêng", "Điện thoại, máy tính bảng hay laptop đều dùng được."], ["Nối với Tà Xùa Booking", "Cùng một sơ đồ bàn và thực đơn cho khách đặt bàn trước trên sàn."]],
    dayKick: "MỘT TỐI MÙA MÂY", dayTitle: "Kín 10 bàn, vẫn chỉ 2 nhân viên chạy bàn.",
    day: [["18:00", "Khách bàn B3 ngồi xuống", "Quét QR, gọi lẩu gà đen ít cay và 2 cơm lam."], ["18:01", "Chuông báo ở bếp", "Bếp bấm nhận đơn, khách thấy \"Bếp đang làm\"."], ["18:20", "Gọi thêm", "Khách tự gọi thêm 4 bia, không cần vẫy nhân viên."], ["19:30", "Xin thanh toán", "Khách chọn chuyển khoản, quét VietQR ngay tại bàn."], ["19:31", "Dọn bàn", "Quán bấm đã thu, bàn chuyển trống cho khách tiếp theo."]],
    ctaTitle: "Dán QR lên bàn từ tuần này.", ctaText: "Gửi tụi mình thực đơn và số bàn, tụi mình dựng thực đơn điện tử và gửi file thẻ QR để bạn in.", ctaNote: "Miễn phí hoàn toàn, không giới hạn số bàn, không thu phí theo đơn.",
    faq: [["Khách có phải tải ứng dụng không?", "Không. Camera điện thoại quét mã là mở thực đơn trên trình duyệt."], ["Quán cần mua máy gì?", "Không cần. Một điện thoại hoặc máy tính bảng để ở bếp và quầy là đủ."], ["Khách nghịch gọi bừa thì sao?", "Mỗi mã gắn đúng một bàn và có khoá riêng, quán thấy bàn nào gọi và có thể huỷ đơn."], ["Có in hoá đơn được không?", "Có, in từ máy tính hoặc máy in nối với máy của quán."]],
  },
};
