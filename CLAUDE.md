# CLAUDE.md — Tà Xùa Booking

Hướng dẫn cho Claude Code (và lập trình viên) khi làm việc trong repo này.

## 1. Dự án là gì
Website **booking du lịch Tà Xùa** (Tà Xùa Booking): xe cabin, homestay, bungalow (đã gộp vào homestay), thuê xe máy, xe ôm, taxi, combo. Khách xem **giá + tình trạng còn chỗ theo ngày** và gửi **yêu cầu đặt**; admin quản lý bài đăng, tồn kho, bảng giá; có **module CTV** (cộng tác viên đặt đơn) + tài khoản chủ dịch vụ + thống kê/đối soát thanh toán. Không có cổng thanh toán online.

## 2. Công nghệ
- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (qua `@tailwindcss/postcss`, cấu hình trong `src/app/globals.css` bằng `@theme`; **không** dùng `tailwind.config`)
- **PostgreSQL** + **Prisma 6** (migration + seed)
- Xác thực: JWT (`jose`) trong cookie httpOnly + `bcryptjs`
- Font: Be Vietnam Pro (next/font)

## 3. Database
- Cấu hình ở **`.env`** → `DATABASE_URL`.
- Local: DB `taxua_trip`, user `postgres`, pass `postgres`, `localhost:5432` (PostgreSQL 17 cài qua winget, service `postgresql-x64-17`).
- Xem dữ liệu: `npm run db:studio` (Prisma Studio) hoặc pgAdmin.
- Prisma schema: `prisma/schema.prisma`. Seed: `prisma/seed.ts`.

## 4. Lệnh thường dùng
```bash
npm run dev          # chạy dev (http://localhost:3000)
npm run build        # build production (prisma generate + next build)
npm run start        # chạy bản đã build
npm run db:migrate   # tạo & áp dụng migration (dev)
npm run db:seed      # nạp dữ liệu mẫu
npm run db:studio    # xem/sửa DB bằng giao diện
npm run db:reset     # xoá & tạo lại DB (cẩn thận)
npx tsc --noEmit     # type-check nhanh (không build)
```

## 5. Tài khoản (sau khi seed)
Đăng nhập tại `/admin/login` — hệ thống tự điều hướng theo vai trò.
| Vai trò | Tài khoản | Khu vực |
|---|---|---|
| Admin | `admin` / `taxua@2026` | `/admin` (toàn quyền) |
| CTV | `ctv1` / `ctv123` | `/admin/ctv` |
| Chủ dịch vụ | `chuxe1`, `chuhome1` / `chu123` | `/admin/provider` |

## 6. Cấu trúc
```
prisma/            schema.prisma, migrations/, seed.ts
src/app/
  (site)/          Trang công khai: trang chủ, /[category], /[category]/[slug],
                   /[category]/[slug]/phong/[roomId], kinh-nghiem, lien-he
  admin/           login, dashboard, services, inventory, availability, cabin-prices,
                   bookings, accounts, reports, ctv/, provider/  (+ *.actions.ts)
  api/             bookings, availability, admin/upload, admin/room-status
  sitemap.ts, robots.ts
src/components/     UI công khai + components/admin/ (ActionForm, Toast, AdminShell, RoomGrid...)
src/lib/           prisma, auth(+auth-token), queries, booking, inventory, room-availability,
                   availability, dates, format, validation, constants, site, utils
src/middleware.ts  Bảo vệ /admin + phân quyền theo vai trò
```

## 7. Khái niệm nghiệp vụ quan trọng
- **Danh mục** cố định bằng enum `ServiceCategory` (CABIN, HOMESTAY, BUNGALOW(ẩn, gộp vào HOMESTAY), MOTORBIKE, XEOM, TAXI, COMBO). Metadata (slug, nhãn, kiểu tồn) ở `src/lib/constants.ts` → `CATEGORIES` / `CATEGORY_LIST`.
- **Giá & tình trạng tính phía server** (`src/lib/booking.ts`, `availability.ts`). KHÔNG hardcode/tin giá từ client. Thiếu dữ liệu ngày nào ⇒ "Chưa cập nhật/Chờ xác nhận", không mặc định còn chỗ.
- **Homestay**: `RoomType` (hạng phòng) = **nhóm** giữ tiện ích combo (bồn tắm/view mây/ăn sáng/điều hòa/sưởi) + ảnh chung; `Room` (phòng riêng có tên) là **đơn vị giá & đặt**. **Giá & sức chứa nằm ở `Room`**: `capacity`, `listPrice` (giá thường/niêm yết), `salePrice` (giá chiết khấu = giá bán thực, null = không giảm → web gạch ngang giá thường khi có), và `priceMon..priceSun` (giá theo thứ, ghi đè). Giá hiệu lực mỗi đêm = giá-theo-thứ ?? salePrice ?? listPrice (`roomPricing`/`roomListPrice` trong `availability.ts`). **Đặt theo từng phòng cụ thể**: `computeAvailability` (kind stay) sinh mỗi phòng 1 lựa chọn (còn trống nếu mọi đêm không bị `RoomDayStatus != AVAILABLE`); Trang homestay (`HomestayBooking`) cho chọn **nhiều phòng cùng home trong 1 đơn** (bấm "Chọn phòng"/"+ Thêm phòng", bấm lại để bỏ) → gửi `roomIds`; `createBooking` tính lại giá từng phòng + phụ thu theo tổng sức chứa (`multiRoomExtraCost`), lưu `BookingRequest.roomIds` (`roomId` = phòng đầu, `quantity` = số phòng; số khách ở `adults`+`childrenAges`, hiển thị qua `bookingPax`); `assignRoomsForBooking` giữ đúng tất cả phòng đó. Trang chi tiết phòng (`BookingPanel`) vẫn đặt 1 phòng. Quản lý tình trạng ở `/admin/availability` (chọn homestay) có **2 chế độ** (query `?view=`): **`grid`** (mặc định) = lưới `RoomDayStatus` từng phòng, bấm ô để đổi Trống/Đã đặt/Chờ/Đóng (`RoomGrid`); **`overview`** = lịch tháng tổng quan (`MonthOverview`), mỗi ngày hiện số phòng trống + ô vuông theo từng phòng (nhóm theo hạng), bấm ngày để xem danh sách phòng kèm tình trạng & giá đêm đó (giá dựng server bằng `roomPricing`+`priceForDay`). `syncRoomTypeAvailability` vẫn quy đổi sang `RoomAvailability` (số lượng) cho tổng quan. Admin cấu hình giá/sức chứa/giá-theo-thứ ở form **Phòng** (trang sửa dịch vụ). Trang danh sách `/homestay` dùng thiết kế **"biển mây"** (`HomestayList`, `src/components/home/HomestayList.tsx`): hero động (mặt trời mọc, mây trôi, núi parallax, chim/đốm sáng), ô tìm kiếm kính nổi (tên + nhận/trả phòng + khoảng giá + chip Homestay/Bungalow), lưới thẻ lọc phía client; dữ liệu từ `getHomestayCards()` (giá "từ" = giá thấp nhất của các phòng con), thẻ dẫn tới `/homestay/[slug]?from=&to=`. Phòng có trang chi tiết `/[category]/[slug]/phong/[roomId]`. Mỗi phòng con có **ảnh riêng** (`RoomImage`, upload qua `/api/admin/upload` với `roomId`, quản lý ở form phòng trong trang sửa dịch vụ); trang chi tiết phòng ưu tiên ảnh riêng, thiếu thì hiển thị ảnh của hạng phòng.
- **Cabin**: mỗi nhà xe = 1 service. `CabinTrip` = chuyến **theo ngày + chiều** (`direction` OUTBOUND/RETURN) giữ tồn vé theo **2 pool**: cabin đơn (`price`/`seatsAvailable`) và cabin đôi (`priceDouble`/`seatsDoubleTotal`/`seatsDoubleAvailable`; để trống giá = không bán đôi). `CabinPriceRow` = bảng giá theo chặng hiển thị (`serviceId=null` = bảng giá chung trang chủ, `ticketType` ROUND_TRIP/OUTBOUND/RETURN). **Lộ trình** `CabinRoute`(+`CabinRouteStop`) theo chiều đi/về — timeline animation ở `src/components/CabinRoutes.tsx`.
  - **Luồng đặt vé** (riêng, không dùng `BookingPanel`): `/xe-cabin?from=&to=` tìm theo **ngày đi + ngày về** → `getCabinOperators` liệt kê nhà xe còn chỗ → click vào `/xe-cabin/[slug]?from=&to=` mở **sidebar `CabinBooking`** (`src/components/cabin/CabinBooking.tsx`): dải 7 ngày/chiều, chọn **số lượng vé đơn/đôi**, 3 bước (Chọn vé → Điểm đón trả → Liên hệ). Dữ liệu dải ngày dựng server qua `buildDirectionOptions` (`src/lib/cabin.ts`). Gửi đơn qua `POST /api/cabin/book` → `createCabinBooking` (tính giá server-side, **1 yêu cầu gồm cả đi + về**): lưu `cabinTripId` (đi) + `cabinReturnTripId` (về) + `seatsSingle`/`seatsDouble`.
  - **Quản trị vé cabin** ở `/admin/availability` (chọn nhà xe): lịch tháng (`CabinMonth`, `src/components/admin/CabinMonth.tsx`) — mỗi ô ngày hiện 2 chiều (Đi/Về) với thanh **đã đặt/tổng chỗ** + badge yêu cầu mới; KPI (vé đã đặt / yêu cầu mới / ngày sắp hết chỗ); toggle chiều. Bấm ngày → panel (desktop) / bottom sheet (mobile): **Đang bán/Tạm dừng**, **Mở bán** (tạo chuyến), chỉnh **tổng chỗ** + **giá vé**, **danh sách vé** + **+ Thêm vé** (khách gọi / CTV), **Xác nhận/Huỷ** yêu cầu mới. Mọi thao tác gọi `POST /api/admin/cabin` (op: saveTrip/addTicket/confirm/cancel) dùng `adjustInventory`. "Tạm dừng" = `status SOLD_OUT` khi **vẫn còn chỗ** (phân biệt với hết chỗ tự nhiên); "Đã đặt" = `seatsTotal − seatsAvailable`. **Trang sửa dịch vụ CABIN** (`/admin/services/[id]`) dùng **bố cục tab** (`ServiceTabNav` scrollspy + cuộn đến mục): Thông tin / Hình ảnh / Lộ trình / Giá vé / Chuyến xe — mỗi mục là 1 thẻ, **lưu riêng** qua server action hiện có (`updateService`, ảnh, `upsertCabinRoute`, `upsertCabinPrice`, `upsertTrip`); tab Chuyến xe có "Tạo nhanh nhiều ngày" (`CabinScheduleEditor`→`applyCabinSchedule`). Các danh mục khác giữ trang sửa dạng cuộn thẳng như cũ.
- **Trang chủ – khối cabin**: bảng giá & lộ trình (`getCabinPriceRows`/`getHomeCabinRoute`) lấy theo **nhà xe cabin đang được tick "nổi bật"** (`Service.featured`); nhà xe đó chưa có bảng giá riêng thì dùng bảng giá chung (`CabinPriceRow.serviceId=null`). **Chỉ MỘT nhà xe cabin được nổi bật tại một thời điểm**: tick xe này ⇒ bỏ tick các xe khác (ép trong `enforceSingleFeaturedCabin`, gọi từ `createService`/`createServiceFull`/`updateService`/`toggleField`). Menu admin đã bỏ "Tồn kho" và "Bảng giá cabin" (route vẫn còn, chỉ ẩn khỏi nav).
- **Combo** (`/combo`): bộ ghép **xe cabin khứ hồi + phòng homestay** theo giá mong muốn (`src/lib/combo.ts` → `findComboMatches`). Ngày: ngày đi = đêm lên xe (chiều đi) → **check-in = ngày đi + 1**; ngày về = ngày xe chạy chiều về = **check-out**. Giá combo/khách = **(tiền phòng cả kỳ ÷ số người) + vé khứ hồi 1 người − 25.000đ** (`COMBO_DISCOUNT`); riêng **phòng cộng đồng** (nhận diện theo tên hạng/phòng: cộng đồng/dorm/tập thể/giường tầng — giá phòng là giá MỖI NGƯỜI) thì combo/khách = **giá phòng cộng đồng + vé khứ hồi** (không chia theo đoàn, không trừ 25k; `isCommunalRoom`/`planPricePerPerson` trong `combo.ts`). Form `ComboSearch` (điểm xuất phát, ngày đi/về, số người, giá, tiêu chí). **Điểm xuất phát** (`?origin=`, danh sách từ `getComboOrigins`): chọn thì giá vé khứ hồi lấy theo **bảng giá chặng** `CabinPriceRow` (bảng riêng của nhà xe, thiếu thì bảng chung; ưu tiên dòng Khứ hồi, không có thì Chiều đi + Chiều về); nhà xe có bảng giá nhưng không khai chặng đó bị ẩn; không chọn → giá chuyến (đi + về). **Ghép phòng cho đoàn đông** (`buildStayPlans`): mỗi homestay sinh tối đa 3 **phương án** (`ComboStayPlan`) đủ chỗ cho cả đoàn — VD 10 người: "5× Phòng đơn", "1× Family + 2× Phòng đôi", dorm — gộp phòng giống nhau thành nhóm, DFS tổ hợp, loại phương án **thừa phòng** (bỏ 1 phòng vẫn đủ chỗ), rẻ nhất trước; mỗi phương án có `amenityScore` (view mây nặng nhất). DFS chạy 2 lượt: sức chứa chuẩn và **ở ghép** tới `Room.maxCapacity` kèm phụ thu `extraPersonFee`/người/đêm (xếp khách ghép vào phòng phụ thu rẻ nhất; phương án ghi `extraGuests`/`extraCost`, nhãn "+N khách ở ghép") — giữ cả 2 loại để khách chọn tiết kiệm/thoải mái. Kết quả (`ComboResults`) mỗi thẻ = 1 phương án, mặc định sắp theo **điểm tổng hợp** 55% giá (khớp budget nếu có) + 25% view/tiện ích + 20% khoảng cách trung tâm, hiện dần lên. **Tiêu chí lọc** là cột boolean: `RoomType.hasBathtub/cloudView/breakfast/airCon/heating` (bồn tắm/view mây/ăn sáng/điều hòa/đêm sưởi) + `Service.easyRoad` (đường dễ đi) — sửa trong admin (ô tick ở hạng phòng & form dịch vụ). Giá/tồn phòng tái dùng `aggregateStay`+`roomTypePricing` (`availability.ts`); vé khứ hồi = `CabinTrip` chiều đi + chiều về (cabin đơn). **Đặt combo nhiều phòng**: client gửi `roomIds` (toàn bộ phòng của phương án) → `createComboBooking` tính lại giá server-side từng phòng, lưu `BookingRequest.roomIds` (String[], `roomId` = phòng đầu); `assignRoomsForBooking` giữ đúng TẤT CẢ phòng trong `roomIds` (nhiều hạng → sync tồn từng hạng). Đơn combo lưu **tách tiền từng bên**: `BookingRequest.roomAmount` (phần tiền phòng → homestay) + `busAmount` (phần tiền vé → nhà xe), `referencePrice` = TỔNG khách trả; trang đơn provider cho nhà xe thấy cả đơn combo đi qua chuyến của mình (lọc theo `cabinTripId`), mỗi bên chỉ hiển thị phần tiền của mình (thẻ chỉ-xem, combo do sàn điều phối); thống kê (`stats.ts`) chia doanh thu combo đúng bên qua `comboSideView`.
- **Tồn kho**: xác nhận đơn (CONFIRMED/COMPLETED) ⇒ giữ chỗ; huỷ ⇒ trả. Homestay dùng `assignRoomsForBooking` (gán phòng riêng); cabin/xe máy dùng `adjustInventory` (số lượng; cabin trừ/cộng **cả 2 pool đơn+đôi trên cả chuyến đi lẫn chuyến về** theo `seatsSingle`/`seatsDouble`). Xem `src/lib/inventory.ts`. Tổng quan ở `/admin/inventory`.
- **CTV / vai trò / thanh toán**: `AdminUser.role` (ADMIN/CTV/PROVIDER). `Service.ownerId` = chủ cơ sở (PROVIDER). CTV thuộc một chủ cơ sở qua `AdminUser.providerId` (self-relation "ProviderCtv"); admin gán ở `/admin/accounts`, hoặc **chủ cơ sở tự tạo CTV** ở `/admin/provider/ctv` (action `createMyCtv`, providerId = session). `BookingRequest.ctvId` + `paymentStatus` (UNPAID/PAID). CTV đăng nhập đặt đơn trên web → `/api/bookings` tự gắn `ctvId` từ session. Báo cáo đối soát ở `/admin/reports`.

## 8. Quy ước kỹ thuật
- **Form admin có phản hồi**: bọc bằng `<ActionForm action={...}>` (client, dùng `useActionState`) — server action trả `{ok?, error?, message?}` để tự hiện toast (`src/components/admin/Toast.tsx`, `ToastHost` trong AdminShell). Nút **Xoá** dùng `formAction={deleteX}` (action trả `void`), **không** đặt `name=` trên nút đó (React 19 báo lỗi).
- **Phiên** chứa `role`. `src/lib/auth.ts` (server-only: cookie + bcrypt) vs `src/lib/auth-token.ts` (ký/verify JWT, dùng được ở middleware edge).
- **Upload**: `/api/admin/upload` (ảnh ≤5MB; video mp4/webm/mov ≤50MB chỉ cho hạng phòng) → lưu `public/uploads`. Gắn media theo `serviceId` (ServiceImage) / `roomTypeId` (RoomTypeImage, cho cả video) / `roomId` (RoomImage, chỉ ảnh).
- Tiền dùng `Decimal(12,0)`; chuyển sang number qua `toNumber`, hiển thị qua `formatPrice` (`src/lib/format.ts`). Ngày @db.Date xử lý UTC trong `src/lib/dates.ts`.
- Gallery ảnh (`Gallery`, `CardSlider`) là slider vuốt được (scroll-snap).

## 9. Lưu ý môi trường (Windows)
- **Không đặt mật khẩu DB trên dòng lệnh** (vd `PGPASSWORD=...`) — trình phân loại auto-mode chặn. Luôn để trong `.env`, chạy Prisma.
- **Trước khi `npm run build`**: dừng tiến trình đang giữ cổng 3000 (next dev khoá DLL Prisma gây lỗi EPERM). Pattern: tìm PID theo port 3000 rồi `Stop-Process -Id <pid> -Force`.
- **`server-only`** không import được khi chạy script bằng `tsx` thường. Script chỉ cần DB thì dùng prisma thuần; script cần import file có `import "server-only"` (vd `src/lib/sheet-sync.ts`) thì chạy `npx tsx --tsconfig scripts/tsconfig.scripts.json <script>` (map `server-only` → stub rỗng `scripts/server-only-stub.ts`).
- Prisma deprecation: cấu hình `prisma` trong package.json sẽ bỏ ở Prisma 7 (chưa cần đổi). `middleware.ts` Next 16 cảnh báo nên dùng `proxy` (vẫn chạy).

## 10. Triển khai
- Đích: **VPS bằng Docker** (ảnh lưu qua volume). Có `Dockerfile` + `docker-compose.yml` (Postgres + app), `README.md` hướng dẫn. `next.config.ts` dùng `output: "standalone"`.
- Lệnh: `docker compose up -d --build`; nạp mẫu: `docker compose exec app npm run db:seed`.

## 11. Thiết kế giao diện
Trang chủ theo mẫu **1a (Biển mây)**; lộ trình cabin theo mẫu trên claude.ai/design (project `4ec052fe-10f0-4ecb-919b-3df57a20860b`). Thương hiệu: **Tà Xùa Booking** (màu xanh núi rừng + trắng + cam điểm nhấn).
