# Quy tắc SEO & GEO — Tà Xùa Booking

Áp dụng cho mọi bài viết, trang mới và mã giao diện công khai. GEO = tối ưu để công cụ AI (Google AI Overview, ChatGPT, Perplexity…) trích dẫn đúng.

## 1. Viết bài (kinh nghiệm / review)
- **Một bài = một ý định tìm kiếm.** Kiểm `scripts/seo/gsc.mjs` (truy vấn đang có lượt hiển thị) và danh sách bài đang đăng trước khi viết; chủ đề đã có bài thì nâng cấp bài cũ hoặc gộp + chuyển hướng (`src/lib/article-redirects.ts`), không viết bài trùng.
- **Tiêu đề ≤ 60 ký tự**, từ khoá chính đứng đầu ("Review <tên> Tà Xùa: …", "Sống lưng khủng long Tà Xùa: …"), không ghi năm. **Mô tả 130–155 ký tự**, có từ khoá + 2–3 dữ kiện. Slug không dấu, có "ta-xua".
- **Cấu trúc:** đoạn mở 2–3 câu trả lời thẳng câu hỏi chính, có số → `**Tóm tắt nhanh:**` 4–6 gạch đầu dòng tự đứng được → 6–9 mục `##` (≥3 mục dạng câu hỏi) → ≥1 bảng → `## Câu hỏi thường gặp` 5–7 câu `### …?` (tự sinh FAQPage JSON-LD) → khối link đặt dịch vụ → dòng *nghiêng* ghi nguồn + ngày (dd/mm/yyyy).
- **Số liệu chỉ lấy từ DB / nguồn kiểm được** (giá phòng = giá niêm yết của hệ thống, giá xe ôm = 1 chiều 1 khách / 2 khách, vé xe = bảng giá chặng). Thiếu thì ghi "nên hỏi trước", không ước tính. Không bịa trải nghiệm cá nhân. Mây là thời tiết: viết thận trọng, không cam kết.
- **Văn phong:** câu ngắn, có số; không dùng "—"; tránh cụm sáo (thiên đường, không thể bỏ lỡ, hãy cùng, chữa lành, tóm lại, bên cạnh đó, ngoài ra…). Tiền viết `350.000đ`.
- **Ảnh:** 3–5 ảnh `/uploads/…` đúng nội dung, alt cụ thể có tên địa điểm; ảnh bìa cũng là `/uploads/…` (không dùng Unsplash/Pexels).
- **Link nội bộ:** 12–25 link tới bài / trang dịch vụ có thật, anchor tự nhiên, không lặp một link quá 2 lần; bài review homestay phải link trang `/homestay/<slug>` (khối link 2 chiều + JSON-LD `about` tự sinh nếu slug là `review-<slug nhà>[-ta-xua]`).
- **Bắt buộc dịch en/zh/ko** (xem CLAUDE.md mục 8): giữ nguyên link, ảnh, số tiền, số heading, số dòng bảng; zh gọi Tà Xùa là 塔萨, ko là 따쑤아.
- **Kiểm trước khi đăng:** `node --env-file=.env scripts/seo/article-qa.mjs --dir <thư mục nháp> <slug>` (độ dài, FAQ, bảng, ảnh 200, link 200, cụm sáo, trùng lặp ≤ 8% với bài cũ) + một lượt soát số liệu độc lập với DB.

## 2. Viết mã trang công khai
- **Metadata mọi trang:** `title` ≤ 60 ký tự (dài hơn 44 thì dùng `{ absolute }` để khỏi nối "| Tà Xùa Booking"), `description` ≤ 155 ký tự dựng từ dữ liệu thật — không dùng nguyên văn phần tóm tắt chủ cơ sở tự viết. Mẫu: `serviceMeta` (`src/lib/service-meta.ts`), `placeMeta` (`src/lib/place-meta.ts`). Luôn `alternates: i18nAlternates(path)` + `i18nOg`.
- **Tiêu đề theo cách người tìm gõ:** "<tên> Tà Xùa: <loại> …" cho trang thực thể (homestay, quán, nhà xe, xe máy, taxi, xe ôm).
- **Một H1 mỗi trang**, nội dung chính dựng phía server (Google đọc được trong HTML). Trang danh sách có `ItemListLd` + khối `SeoBlock` (đoạn giới thiệu + câu hỏi thường gặp + FAQPage) — thêm loại mới vào `SeoBlock` thay vì viết khối riêng.
- **JSON-LD đúng nội dung đang hiện:** LodgingBusiness (homestay, có `geo`, `hasMap`, `priceRange`, `subjectOf` bài review), Article (`about` khi là bài review), Service, TouristAttraction (bản đồ), FAQPage, BreadcrumbList. Không khai số liệu không hiển thị trên trang; không gắn SĐT sàn vào cơ sở lưu trú.
- **Chữ mới ở trang khách bọc `t()`** và thêm bản dịch vào `src/lib/i18n/dict/{en,zh,ko}.json` cùng commit.
- **Không làm hỏng lập chỉ mục:** trang không tồn tại phải `notFound()` (không `loading.tsx` trong `(site)/[category]`); trang gần trùng để `noindex, follow` và bỏ khỏi sitemap (như trang từng phòng); URL đổi / gộp thì 308 qua `ARTICLE_REDIRECTS` hoặc `permanentRedirect`.
- **Sitemap** (`src/app/sitemap.ts`) phải có mọi trang cần index (kể cả trang danh mục theo chủ đề), **mỗi bản ngôn ngữ là một mục `<url>` riêng** kèm đủ hreflang + x-default (chỉ khai bản dịch ở hreflang thì Google không xếp lịch thu thập ⇒ "URL is unknown to Google"); sau khi thêm nhiều trang mới chạy `node scripts/seo/gsc.mjs --submit-sitemap https://taxuabooking.com/sitemap.xml`.
- **Ảnh** qua `next/image` (loader `/thumb`), luôn có `alt` cụ thể.

## 3. Đo và lặp
- `node scripts/seo/gsc.mjs --days 90 --dims query --out q.csv` (thêm `page`, `query,page`, `date`); `--inspect <url>` xem trạng thái lập chỉ mục; `--sitemaps` xem sitemap. Khoá: `secrets/gsc-service-account.json` (bị .gitignore — repo public, KHÔNG commit).
- Mỗi 2–4 tuần: lấy truy vấn ở vị trí 5–20 có ≥ 10 lượt hiển thị → nâng cấp đúng trang đó (tiêu đề, đoạn mở, thêm mục / FAQ còn thiếu). Đây là cách lên top 5 nhanh nhất.
- `node scripts/seo/audit.mjs [/duong-dan…]` rà nhanh tiêu đề, mô tả, H1, canonical, JSON-LD của trang thật.
- Google không cho "Yêu cầu lập chỉ mục" qua API với trang thường (Indexing API chỉ dành cho tin tuyển dụng / livestream) ⇒ dùng sitemap; URL thật quan trọng thì bấm tay trong Search Console.
