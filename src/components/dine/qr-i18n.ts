/**
 * Chữ giao diện của trang gọi món QR (điện thoại khách) cho 4 ngôn ngữ của web: vi (gốc) · en · zh · ko.
 * Khoá = chính chuỗi tiếng Việt (như từ điển chung của site); mỗi dòng: "khoá": [en, zh, ko]. `{0}`, `{1}` = tham số.
 * Thiếu bản dịch ⇒ hiện tiếng Việt. Tên món / nhóm món / mô tả KHÔNG nằm ở đây — tra bảng Translation (xem /api/qr `tr=1`).
 * Thêm chữ mới trong QrOrder: bọc `t("…")` rồi thêm một dòng vào bảng dưới.
 */
export type QrLang = "vi" | "en" | "zh" | "ko";
export const QR_LANGS: { code: QrLang; name: string }[] = [
  { code: "vi", name: "Tiếng Việt" },
  { code: "en", name: "English" },
  { code: "zh", name: "中文" },
  { code: "ko", name: "한국어" },
];
export type QrTF = (key: string, vars?: readonly (string | number | null | undefined)[]) => string;

const D: Record<string, [string, string, string]> = {
  // --- chung ---
  "Khác": ["Other", "其他", "기타"],
  "Chưa thực hiện được — thử lại hoặc gọi nhân viên giúp mình.": ["That didn't go through — please try again or call a staff member.", "操作未成功，请重试或呼叫服务员。", "처리되지 않았습니다. 다시 시도하거나 직원을 불러 주세요."],
  "Mất kết nối, thử lại giúp mình.": ["Connection lost — please try again.", "网络连接中断，请重试。", "연결이 끊겼습니다. 다시 시도해 주세요."],
  "Đã khôi phục món bạn chọn trước đó": ["Your earlier selection has been restored", "已恢复您之前选择的菜品", "이전에 담은 메뉴를 복원했습니다"],
  "Chọn ngôn ngữ": ["Choose language", "选择语言", "언어 선택"],
  "Đổi ngôn ngữ hiển thị — món và giá vẫn y nguyên.": ["Changes the display language only — dishes and prices stay the same.", "仅更改显示语言，菜品和价格不变。", "표시 언어만 바뀌며 메뉴와 가격은 그대로입니다."],
  "Đóng": ["Close", "关闭", "닫기"],
  "Bàn {0}": ["Table {0}", "{0} 号桌", "테이블 {0}"],
  "Bớt": ["Remove one", "减少", "줄이기"],
  "Thêm": ["Add one", "增加", "추가"],
  "Bớt {0}": ["Remove one {0}", "减少 {0}", "{0} 줄이기"],
  "Thêm {0}": ["Add {0}", "添加 {0}", "{0} 추가"],
  "Ghi chú": ["Note", "备注", "메모"],
  "Thanh toán": ["Pay", "结账", "결제"],
  "Xem hoá đơn": ["View bill", "查看账单", "계산서 보기"],
  "Phụ thu": ["Surcharge", "附加费", "추가 요금"],
  "Tiền mặt": ["Cash", "现金", "현금"],
  "Chuyển khoản": ["Bank transfer", "银行转账", "계좌 이체"],

  // --- chào mừng ---
  "Chào mừng quý khách!": ["Welcome!", "欢迎光临！", "환영합니다!"],
  "Nhập thông tin để mở bàn gọi món — nhân viên dựa vào đây để phục vụ đúng bàn và liên hệ khi cần.": ["Enter your details to open ordering for this table — staff use them to serve the right table and reach you if needed.", "请填写信息以开启本桌点餐——服务员将据此为您服务，并在需要时联系您。", "정보를 입력하면 이 테이블의 주문이 열립니다. 직원이 정확한 테이블로 서비스하고 필요할 때 연락드리기 위한 정보입니다."],
  "Tên": ["Name", "姓名", "이름"],
  "VD: Nguyễn Tuấn": ["e.g. John Smith", "例如：王伟", "예: 김민수"],
  "Số điện thoại": ["Phone number", "电话号码", "전화번호"],
  "VD: 0901234567": ["e.g. 0901234567", "例如：0901234567", "예: 0901234567"],
  "Quý khách đi mấy người?": ["How many people are dining?", "请问几位用餐？", "몇 분이신가요?"],
  "VD: 4": ["e.g. 4", "例如：4", "예: 4"],
  "Mở bàn gọi món": ["Open ordering for this table", "开始点餐", "주문 시작하기"],
  "Vui lòng nhập tên": ["Please enter your name", "请输入姓名", "이름을 입력해 주세요"],
  "Số điện thoại không hợp lệ (9–11 chữ số)": ["Invalid phone number (9–11 digits)", "电话号码无效（9–11 位数字）", "전화번호가 올바르지 않습니다 (숫자 9–11자리)"],
  "Vui lòng nhập số khách": ["Please enter the number of guests", "请输入用餐人数", "인원수를 입력해 주세요"],

  // --- thực đơn ---
  "Đơn đã gọi": ["Orders", "已点订单", "주문 내역"],
  "Tìm món (vd: bò, lẩu, trà…)": ["Search dishes (e.g. beef, hotpot, tea…)", "搜索菜品（如：牛肉、火锅、茶…）", "메뉴 검색 (예: 소고기, 전골, 차…)"],
  "Xoá tìm kiếm": ["Clear search", "清除搜索", "검색 지우기"],
  "Tất cả": ["All", "全部", "전체"],
  "Quán chưa đưa thực đơn lên. Bạn bấm “Gọi NV” giúp mình nhé.": ["The menu isn't online yet. Please tap “Staff”.", "菜单尚未上线，请点击“呼叫服务员”。", "아직 메뉴가 등록되지 않았습니다. “직원 호출”을 눌러 주세요."],
  "Không tìm thấy món nào.": ["No dishes found.", "未找到菜品。", "검색된 메뉴가 없습니다."],
  "Hết món": ["Sold out", "已售罄", "품절"],
  "Đã gọi ×{0}": ["Ordered ×{0}", "已点 ×{0}", "주문함 ×{0}"],
  "Đã gọi NV": ["Staff called", "已呼叫", "호출됨"],
  "Gọi NV": ["Staff", "呼叫服务员", "직원 호출"],
  "Giỏ hàng": ["Cart", "购物车", "장바구니"],
  "Xem & Gọi món": ["View & order", "查看并下单", "보기 & 주문"],
  "Bàn mình đã gọi {0} phần món này rồi.": ["Your table has already ordered {0} of this dish.", "本桌已点过 {0} 份该菜品。", "이 테이블에서 이미 이 메뉴를 {0}개 주문했습니다."],
  "Muốn “không cay”, “ít ngọt”… bạn ghi chú cho từng món ở giỏ hàng trước khi gửi bếp.": ["Want it “not spicy”, “less sweet”…? Add a note to each dish in the cart before sending to the kitchen.", "想要“不辣”“少糖”？下单前可在购物车中为每道菜添加备注。", "“안 맵게”, “덜 달게” 등은 주방에 보내기 전에 장바구니에서 메뉴별로 메모해 주세요."],
  "Món này đang hết": ["This dish is sold out", "该菜品已售罄", "이 메뉴는 품절입니다"],
  "Xong": ["Done", "完成", "완료"],
  "Thêm vào giỏ": ["Add to cart", "加入购物车", "장바구니에 담기"],
  "Đã thêm {0} vào giỏ": ["Added {0} to cart", "已将 {0} 加入购物车", "{0}을(를) 장바구니에 담았습니다"],
  "{0} hiện đã hết — chọn món khác giúp mình nhé": ["{0} is sold out — please choose another dish", "{0} 已售罄，请选择其他菜品", "{0}은(는) 품절입니다. 다른 메뉴를 선택해 주세요"],

  // --- giỏ hàng & xác nhận ---
  "Tổng": ["Total", "合计", "합계"],
  "Gọi món": ["Order", "下单", "주문하기"],
  "Giỏ hàng trống": ["Your cart is empty", "购物车是空的", "장바구니가 비어 있습니다"],
  "Quay lại menu để chọn món.": ["Go back to the menu to pick dishes.", "请返回菜单选择菜品。", "메뉴로 돌아가 선택해 주세요."],
  "Ít cay": ["Less spicy", "少辣", "덜 맵게"],
  "Không cay": ["Not spicy", "不辣", "안 맵게"],
  "Không hành": ["No onion", "不要葱", "파 빼고"],
  "Ít đá": ["Less ice", "少冰", "얼음 적게"],
  "Ít đường": ["Less sugar", "少糖", "덜 달게"],
  "Ghi chú món (vd: ít cay, không hành…)": ["Note for this dish (e.g. less spicy, no onion…)", "菜品备注（如：少辣、不要葱…）", "메뉴 메모 (예: 덜 맵게, 파 빼고…)"],
  "Ghi chú chung cả đơn (không bắt buộc)": ["Note for the whole order (optional)", "整单备注（选填）", "주문 전체 메모 (선택)"],
  "Ghi chú gửi xuống bếp bằng tiếng Việt — bấm các gợi ý ở trên là chắc nhất.": ["Notes reach the kitchen in Vietnamese — tapping the suggestions above is the safest.", "备注将以越南语送达厨房——点击上方的快捷选项最稳妥。", "메모는 베트남어로 주방에 전달됩니다. 위의 추천 버튼을 누르는 것이 가장 확실합니다."],
  "Món vào bếp ngay sau khi bạn bấm Gọi món. Thanh toán tại bàn khi ăn xong.": ["Goes to the kitchen as soon as you tap Order. Pay at your table when you finish.", "点击下单后立即送达厨房。用餐后在桌边结账。", "주문하기를 누르면 바로 주방으로 전달됩니다. 식사 후 테이블에서 결제하세요."],
  "Đang gửi vô bếp…": ["Sending to the kitchen…", "正在发送到厨房…", "주방으로 보내는 중…"],
  "Đúng — Gửi bếp": ["Yes — send to kitchen", "确认——发送到厨房", "네 — 주방으로 보내기"],
  "Sửa lại đơn": ["Edit my order", "修改订单", "주문 수정"],
  "Gửi order vào bếp?": ["Send this order to the kitchen?", "将此订单发送到厨房？", "이 주문을 주방으로 보낼까요?"],
  "Bếp bắt đầu làm là KHÔNG huỷ được": ["Once the kitchen starts, it CANNOT be cancelled", "厨房开始制作后将无法取消", "주방에서 조리를 시작하면 취소할 수 없습니다"],
  "Vui lòng kiểm tra kỹ trước khi bấm “Đúng — Gửi bếp”.": ["Please double-check before tapping “Yes — send to kitchen”.", "点击“确认——发送到厨房”前请仔细核对。", "“네 — 주방으로 보내기”를 누르기 전에 다시 확인해 주세요."],
  "Bàn mình đã gọi {0} ở đơn trước rồi — gửi là gọi THÊM nhé.": ["Your table already ordered {0} earlier — sending this will order MORE.", "本桌之前已点过 {0}——发送后将再次加点。", "이 테이블은 이미 {0}을(를) 주문했습니다. 보내면 추가로 주문됩니다."],
  "Tổng đơn": ["Order total", "订单合计", "주문 합계"],
  "Đã gửi {0} món tới bếp": ["Sent {0} items to the kitchen", "已将 {0} 份菜品发送到厨房", "{0}개를 주방으로 보냈습니다"],

  // --- đơn đã gọi ---
  "{0} lần gọi · Tổng: {1}": ["{0} orders · Total: {1}", "{0} 次下单 · 合计：{1}", "주문 {0}회 · 합계: {1}"],
  "Tổng cộng đã gọi": ["Total ordered", "已点合计", "총 주문 금액"],
  "Gọi thêm món": ["Order more", "继续加菜", "추가 주문"],
  "Chưa có đơn nào": ["No orders yet", "暂无订单", "아직 주문이 없습니다"],
  "Quay lại menu để gọi món đầu tiên.": ["Go back to the menu to place your first order.", "请返回菜单开始点餐。", "메뉴로 돌아가 첫 주문을 해 보세요."],
  "Quay lại menu": ["Back to menu", "返回菜单", "메뉴로 돌아가기"],
  "Quán chưa nhận được tiền chuyển khoản — mở hoá đơn để xem": ["The restaurant hasn't received your transfer — open the bill for details", "餐厅尚未收到转账——请打开账单查看", "식당에서 이체를 확인하지 못했습니다. 계산서를 열어 확인하세요"],
  "Đã gửi xác nhận chuyển khoản · chờ quán kiểm tra": ["Transfer confirmation sent · waiting for the restaurant to check", "已发送转账确认 · 等待餐厅核实", "이체 확인을 보냈습니다 · 식당 확인 대기 중"],
  "Đã chọn chuyển khoản · mở hoá đơn để quét mã QR": ["Bank transfer selected · open the bill to scan the QR code", "已选择转账 · 打开账单扫描二维码", "계좌 이체 선택됨 · 계산서를 열어 QR 코드를 스캔하세요"],
  "Đã báo nhân viên · thanh toán tiền mặt tại bàn": ["Staff notified · pay cash at your table", "已通知服务员 · 在桌边现金结账", "직원에게 알렸습니다 · 테이블에서 현금 결제"],
  "Lần gọi {0}": ["Order {0}", "第 {0} 次下单", "주문 {0}"],
  "Đã gửi bếp": ["Sent to kitchen", "已发送", "주방 전달됨"],
  "Bếp đang làm": ["Cooking", "制作中", "조리 중"],
  "Đã lên món": ["Served", "已上菜", "서빙 완료"],
  "Đã gửi": ["Sent", "已发送", "전달"],
  "Đang làm": ["Cooking", "制作中", "조리 중"],
  "Lên món": ["Served", "上菜", "서빙"],
  "Gọi thêm 1": ["1 more", "再来 1 份", "1개 더"],
  "Bếp chưa bắt đầu làm — còn huỷ được": ["The kitchen hasn't started — you can still cancel", "厨房尚未开始制作——仍可取消", "아직 조리 전입니다 — 취소할 수 있습니다"],
  "Huỷ lần gọi {0} ({1} món)?": ["Cancel order {0} ({1} items)?", "取消第 {0} 次下单（{1} 份）？", "주문 {0} ({1}개)를 취소할까요?"],
  "Đã huỷ lần gọi món": ["Order cancelled", "已取消该次下单", "주문을 취소했습니다"],
  "Huỷ lần gọi": ["Cancel order", "取消下单", "주문 취소"],

  // --- gọi nhân viên ---
  "Bạn cần gì?": ["What do you need?", "您需要什么？", "무엇이 필요하신가요?"],
  "nhân viên nhận thông báo trong vài giây": ["staff are notified within seconds", "服务员将在几秒内收到通知", "직원에게 몇 초 안에 알림이 갑니다"],
  "Đã gọi nhân viên": ["Staff called", "已呼叫服务员", "직원을 호출했습니다"],
  "Bấm 1 lần là đủ — bấm lại không tạo yêu cầu mới.": ["One tap is enough — tapping again won't create a new request.", "点击一次即可——重复点击不会产生新请求。", "한 번만 누르면 됩니다. 다시 눌러도 새 요청이 생기지 않습니다."],
  "Gọi nhân viên": ["Call staff", "呼叫服务员", "직원 호출"],
  "Đã gọi nhân viên tới bàn {0}": ["Staff called to table {0}", "已呼叫服务员到 {0} 号桌", "테이블 {0}로 직원을 호출했습니다"],
  "Hỗ trợ về món": ["Help with dishes", "菜品咨询", "메뉴 문의"],
  "Thêm chén đũa / dụng cụ ăn": ["Extra bowls / cutlery", "加碗筷 / 餐具", "그릇·수저 추가"],
  "Thêm đá / nước / khăn": ["Ice / water / napkins", "加冰 / 水 / 纸巾", "얼음·물·물수건"],
  "Đổi bàn": ["Change table", "换桌", "자리 변경"],
  "Việc khác": ["Something else", "其他需求", "기타 요청"],
  "Cần thanh toán": ["Ask for the bill", "我要结账", "계산 요청"],
  "Chọn tiền mặt / chuyển khoản → nhân viên ra bàn xử lý": ["Choose cash / bank transfer → staff come to your table", "选择现金 / 转账 → 服务员到桌边处理", "현금 / 계좌 이체 선택 → 직원이 테이블로 옵니다"],
  "Bàn chưa gọi món nào": ["No dishes ordered yet", "本桌尚未点餐", "아직 주문한 메뉴가 없습니다"],

  // --- hoá đơn & chuyển khoản ---
  "Hoá đơn": ["Bill", "账单", "계산서"],
  "/ phần": ["each", "/ 份", "/ 1개"],
  "Tiền món": ["Dishes", "菜品金额", "메뉴 금액"],
  "Tổng thanh toán": ["Total to pay", "应付合计", "결제 금액"],
  "Chọn hình thức thanh toán": ["Choose a payment method", "选择付款方式", "결제 방법 선택"],
  "Tiền mặt tại bàn": ["Cash at the table", "桌边现金支付", "테이블에서 현금"],
  "Báo nhân viên mang hoá đơn ra bàn thu tiền": ["Staff bring the bill to your table", "服务员将账单送到桌边收款", "직원이 계산서를 가지고 테이블로 옵니다"],
  "Chuyển khoản QR": ["QR bank transfer", "二维码转账", "QR 계좌 이체"],
  "Hiện mã QR có sẵn số tiền — quét bằng app ngân hàng": ["Shows a QR code with the amount — scan it with a Vietnamese banking app", "显示含金额的二维码——用越南银行 App 扫码", "금액이 포함된 QR 코드 표시 — 베트남 은행 앱으로 스캔"],
  "Nhân viên mang mã chuyển khoản ra bàn": ["Staff bring the transfer code to your table", "服务员将把转账码送到桌边", "직원이 이체 코드를 테이블로 가져옵니다"],
  "Giữ cách đang chọn ({0})": ["Keep the current choice ({0})", "保持当前选择（{0}）", "현재 선택 유지 ({0})"],
  "Quán chưa cài mã chuyển khoản — nhân viên sẽ mang mã ra bàn.": ["The restaurant has no transfer code set up — staff will bring one to your table.", "餐厅尚未设置转账码——服务员会送到桌边。", "식당에 이체 코드가 설정되어 있지 않습니다. 직원이 테이블로 가져옵니다."],
  "Thanh toán tiền mặt": ["Cash payment", "现金支付", "현금 결제"],
  "Đã báo nhân viên — nhân viên sẽ mang hoá đơn ra bàn. Bạn chuẩn bị {0} nhé.": ["Staff notified — they will bring the bill to your table. Please have {0} ready.", "已通知服务员——服务员会把账单送到桌边，请准备 {0}。", "직원에게 알렸습니다. 계산서를 테이블로 가져옵니다. {0}을(를) 준비해 주세요."],
  "Đổi hình thức thanh toán": ["Change payment method", "更换付款方式", "결제 방법 변경"],
  "Quét mã VietQR — app ngân hàng tự điền số tiền": ["Scan the VietQR code — the banking app fills in the amount", "扫描 VietQR 码——银行 App 自动填入金额", "VietQR 코드를 스캔하면 은행 앱에 금액이 자동 입력됩니다"],
  "Lưu ảnh QR (mở app ngân hàng → quét ảnh)": ["Save QR image (open banking app → scan from image)", "保存二维码图片（打开银行 App → 从图片扫码）", "QR 이미지 저장 (은행 앱 → 이미지로 스캔)"],
  "Ngân hàng": ["Bank", "银行", "은행"],
  "Số tài khoản": ["Account number", "账号", "계좌번호"],
  "Chủ tài khoản": ["Account holder", "户名", "예금주"],
  "Số tiền": ["Amount", "金额", "금액"],
  "Nội dung": ["Reference", "转账备注", "이체 메모"],
  "Chép": ["Copy", "复制", "복사"],
  "Đã chép {0}": ["Copied {0}", "已复制{0}", "{0} 복사됨"],
  "Không tải được ảnh, thử lại.": ["Couldn't upload the image — please try again.", "图片上传失败，请重试。", "이미지를 올리지 못했습니다. 다시 시도해 주세요."],
  "Đã gửi xác nhận chuyển khoản {0} lúc {1}": ["Transfer of {0} reported at {1}", "已于 {1} 提交 {0} 的转账确认", "{1}에 {0} 이체 확인을 보냈습니다"],
  "Quán đang kiểm tra tài khoản, xác nhận xong bàn sẽ được đóng hoá đơn.": ["The restaurant is checking its account; the bill closes once confirmed.", "餐厅正在核对账户，确认后将为本桌结清账单。", "식당에서 계좌를 확인 중이며, 확인되면 계산이 완료됩니다."],
  "Hoá đơn vừa thay đổi thành {0} — chuyển thêm phần chênh lệch rồi gửi lại xác nhận.": ["The bill has changed to {0} — transfer the difference, then confirm again.", "账单已变更为 {0}——请补转差额后重新提交确认。", "계산서가 {0}(으)로 변경되었습니다. 차액을 이체한 뒤 다시 확인을 보내 주세요."],
  "Quán chưa nhận được tiền:": ["The restaurant hasn't received the money:", "餐厅尚未收到款项：", "식당에서 입금을 확인하지 못했습니다:"],
  "Kiểm tra lại giao dịch rồi gửi xác nhận lại.": ["Check your transaction, then confirm again.", "请核对交易后重新提交确认。", "거래를 확인한 뒤 다시 확인을 보내 주세요."],
  "Chuyển xong? Gửi ảnh bill để quán xác nhận": ["Transferred? Send a receipt photo so the restaurant can confirm", "已转账？请发送转账凭证供餐厅确认", "이체하셨나요? 식당에서 확인할 수 있도록 영수증 사진을 보내 주세요"],
  "Đang tải ảnh…": ["Uploading…", "上传中…", "업로드 중…"],
  "Đổi ảnh bill": ["Change receipt photo", "更换凭证图片", "영수증 사진 변경"],
  "Chọn ảnh bill chuyển khoản": ["Choose a transfer receipt photo", "选择转账凭证图片", "이체 영수증 사진 선택"],
  "Gửi xác nhận mà không kèm ảnh bill? Quán sẽ tự kiểm tra tài khoản.": ["Confirm without a receipt photo? The restaurant will check its account itself.", "不附凭证直接提交确认？餐厅将自行核对账户。", "영수증 사진 없이 확인을 보낼까요? 식당에서 직접 계좌를 확인합니다."],
  "Tôi đã chuyển khoản {0}": ["I have transferred {0}", "我已转账 {0}", "{0} 이체 완료"],

  // --- đã thanh toán ---
  "Đã thanh toán": ["Paid", "已结账", "결제 완료"],
  "Cảm ơn {0} đã ghé {1} 🥰": ["Thank you {0} for visiting {1} 🥰", "感谢{0}光临 {1} 🥰", "{0}, {1}을(를) 찾아 주셔서 감사합니다 🥰"],
  "quý khách": ["", "您", "고객님"],
  "Hẹn gặp lại ở Tà Xùa.": ["See you again in Tà Xùa.", "期待在塔萨再次相见。", "따쑤아에서 다시 만나요."],
  "Gọi món tiếp": ["Order again", "继续点餐", "다시 주문하기"],
};

const IDX: Record<Exclude<QrLang, "vi">, number> = { en: 0, zh: 1, ko: 2 };
const fill = (s: string, vars?: readonly (string | number | null | undefined)[]) => (vars ? s.replace(/\{(\d+)\}/g, (_, i) => String(vars[Number(i)] ?? "")) : s);

/** Hàm dịch của một ngôn ngữ. Khoá chưa có trong bảng ⇒ trả nguyên tiếng Việt. */
export function qrT(lang: QrLang): QrTF {
  if (lang === "vi") return fill;
  const i = IDX[lang];
  return (key, vars) => {
    const hit = D[key]?.[i];
    // bản dịch rỗng có chủ ý (vd "quý khách" trong tiếng Anh) ⇒ dọn khoảng trắng thừa
    return fill(hit ?? key, vars).replace(/ {2,}/g, " ");
  };
}
