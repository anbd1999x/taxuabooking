# Tà Xùa Trip 🏔️

Website booking du lịch Tà Xùa: xe cabin, homestay, bungalow, thuê xe máy, xe ôm, taxi và combo.
Khách xem **giá và tình trạng còn chỗ theo ngày**, gửi yêu cầu đặt; quản trị viên quản lý bài đăng,
lịch giá/tình trạng và các yêu cầu đặt.

## Công nghệ

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (design system xanh núi rừng / trắng / cam)
- **PostgreSQL** + **Prisma** (migration + seed)
- Xác thực admin: JWT (jose) trong cookie httpOnly + bcrypt
- Không cổng thanh toán, không phân quyền phức tạp, không partner portal

## 4 chức năng cốt lõi

1. Đăng bài dịch vụ (CRUD + nhiều ảnh, theo 7 danh mục).
2. Cập nhật giá theo ngày.
3. Cập nhật tình trạng còn chỗ theo ngày (còn chỗ / còn ít / hết / chưa cập nhật / chờ xác nhận).
4. Nhận và quản lý yêu cầu đặt (trạng thái: Mới → Đang liên hệ → Đã xác nhận → Hoàn thành / Huỷ).

> Giá và tình trạng **luôn được kiểm tra lại phía server** khi khách gửi yêu cầu — không tin giá từ trình duyệt.
> Nếu ngày khách chọn chưa có dữ liệu, hệ thống hiển thị rõ "cần xác nhận lại".

---

## 1) Chạy ở máy local

### Yêu cầu
- Node.js 20+ (khuyến nghị 22/24)
- PostgreSQL 14+ đang chạy (local hoặc Docker)

### Các bước

```bash
# 1. Cài thư viện
npm install

# 2. Tạo file .env (xem .env.example) — chỉnh DATABASE_URL cho đúng Postgres của bạn
cp .env.example .env

# 3. Tạo bảng + sinh Prisma Client
npm run db:migrate

# 4. (tuỳ chọn) Nạp dữ liệu mẫu
npm run db:seed

# 5. Chạy
npm run dev
```

Mở http://localhost:3000 — trang quản trị tại http://localhost:3000/admin

**Tài khoản admin mặc định** (từ `ADMIN_USERNAME` / `ADMIN_PASSWORD` trong `.env`): `admin` / `taxua@2026`

### Các lệnh hữu ích

| Lệnh | Tác dụng |
|------|----------|
| `npm run dev` | Chạy môi trường phát triển |
| `npm run build` | Build production (prisma generate + next build) |
| `npm run start` | Chạy bản production đã build |
| `npm run db:migrate` | Tạo & áp dụng migration (dev) |
| `npm run db:seed` | Nạp dữ liệu mẫu |
| `npm run db:studio` | Mở Prisma Studio xem dữ liệu |
| `npm run db:reset` | Xoá & tạo lại DB (cẩn thận) |

---

## 2) Triển khai production (VPS bằng Docker)

Đã có `Dockerfile` và `docker-compose.yml` (PostgreSQL + ứng dụng, ảnh upload lưu qua volume).

```bash
# 1. Tạo file .env ở thư mục dự án với giá trị thật, ví dụ:
#    POSTGRES_USER=taxua
#    POSTGRES_PASSWORD=mat-khau-manh
#    POSTGRES_DB=taxua_trip
#    AUTH_SECRET=chuoi-ngau-nhien-dai-tren-32-ky-tu
#    ADMIN_USERNAME=admin
#    ADMIN_PASSWORD=mat-khau-admin-manh
#    NEXT_PUBLIC_SITE_URL=https://taxuatrip.vn
#    APP_PORT=3000

# 2. Build & chạy (tự động chạy prisma migrate deploy khi khởi động)
docker compose up -d --build

# 3. (lần đầu, tuỳ chọn) nạp dữ liệu mẫu
docker compose exec app npm run db:seed
```

Ứng dụng chạy ở cổng `APP_PORT` (mặc định 3000). Đặt Nginx/Caddy phía trước để gắn domain + HTTPS.

### Biến môi trường

| Biến | Bắt buộc | Ý nghĩa |
|------|:---:|---------|
| `DATABASE_URL` | ✅ | Chuỗi kết nối PostgreSQL |
| `AUTH_SECRET` | ✅ | Khoá ký phiên đăng nhập (≥ 16 ký tự, nên ≥ 32) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | ✅ (khi seed) | Tài khoản admin tạo lúc seed |
| `NEXT_PUBLIC_SITE_URL` | ✅ | URL công khai (SEO, sitemap, Open Graph) |

> Trong `docker-compose.yml`, `DATABASE_URL` được ghép tự động từ `POSTGRES_*`.

---

## Cấu trúc dự án

```
prisma/
  schema.prisma        # Mô hình DB (Service, RoomType, DailyAvailability, CabinTrip, BookingRequest...)
  seed.ts              # Dữ liệu mẫu
src/
  app/
    (site)/            # Trang công khai: trang chủ, danh mục, chi tiết, kinh nghiệm, liên hệ
    admin/             # Trang quản trị (đăng nhập, dashboard, bài đăng, lịch, yêu cầu)
    api/               # availability, bookings, admin/upload
    sitemap.ts, robots.ts
  components/          # UI dùng chung + components admin
  lib/                 # prisma, auth, queries, availability, booking, dates, format, validation
  middleware.ts        # Bảo vệ /admin
```

## SEO
URL thân thiện (`/homestay`, `/xe-cabin/...`), title + meta description theo trang, `sitemap.xml`,
`robots.txt`, Open Graph, ảnh tối ưu qua `next/image`, responsive, ưu tiên mobile.
