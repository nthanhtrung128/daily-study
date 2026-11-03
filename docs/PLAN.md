# Kế hoạch daily-study (tóm tắt)

Bản đầy đủ có bảng so sánh và hướng dẫn: tài liệu "Kế hoạch app Ôn luyện TR + Tiếng Anh" trên Claude.

## Mục tiêu
Hợp nhất Sổ ôn TR101 (`legacy/so-on-template.html` + `content/tr101/data.json`) với module tiếng Anh giao tiếp mỗi ngày, dưới dạng PWA dùng trên iPhone. Mặc định mỗi phiên chia TR 40% / tiếng Anh 60%.

## Module tiếng Anh
| Phần | Cách luyện | Nội dung |
|---|---|---|
| Từ vựng & cụm từ | Thẻ 2 chiều, nghe phát âm, tự đặt câu | ~600 cụm: công sở, họp, email, C&B/HR, phỏng vấn, deal lương |
| Mẫu câu | Nghe → nhại → tự thay từ | ~300 câu theo tình huống |
| Shadowing | Hội thoại ngắn, phát từng câu, tốc độ 0,75–1× | ~60 hội thoại B1–C1 |
| Nói có chấm | Nhận giọng nói, so từng từ, tô từ sai | Dùng lại câu mẫu và hội thoại |
| Đề nói 1 phút | Đếm ngược, ghi âm lưu trên máy, nghe lại | ~100 đề (40 đề giải thích khái niệm TR) |

## Các phiên (mỗi phiên một PR)
| Phiên | Việc | Cần xong trước | Trạng thái |
|---|---|---|---|
| S1 | Khung Vite + React + TS + PWA, CI, 4 trang rỗng | — | ✅ Xong (#1) |
| S2 | Chuyển lõi TR: Leitner, lập phiên, thẻ, trắc nghiệm, 19 bài tính, câu mở + test | S1 | ✅ Xong (#2) |
| S3 | Tra cứu, Tiến độ, ghi chú, xuất/nhập tiến độ (đọc được state bản cũ) | S2 | ✅ Xong (#5) |
| S4 | Nội dung EN gói 1: schema, 300 cụm từ, 150 câu mẫu | — | ✅ Xong (#3) |
| S5 | UI tiếng Anh: thẻ từ + TTS, câu mẫu, trình phát shadowing | S2, S4 | ✅ Xong (#4) |
| S6 | Luyện nói: nhận giọng, so từng từ, đề 1 phút có ghi âm | S5 | ✅ Xong (#8) |
| S7 | Nội dung EN gói 2: 60 hội thoại, 100 đề nói, thêm 300 cụm | S4 | ✅ Xong (#6) |
| S8 | Phiên hằng ngày trộn TR + EN, cài đặt, file nhắc lịch .ics | S3, S6 | ✅ Xong (#9) |
| S9a | docs/DEPLOY.md (Cloudflare Pages + Access), `public/_headers`, Playwright WebKit, kiểm tra PWA/offline | S8 | ✅ Xong (#7) |
| S9b | Rà soát toàn app trên iPhone (audit e2e sáng/tối, 320/375 px, a11y, offline), sửa lỗi, docs, ảnh chụp | S9a | ✅ Xong (PR S9b) |

## Việc còn lại
Chỉ kiểm được trên iPhone thật — làm theo [docs/DEPLOY.md § 10](DEPLOY.md#10-danh-sách-kiểm-tra-trên-iphone-thật):
- Deploy lần đầu lên Cloudflare Pages + bật Access (người dùng tự làm theo DEPLOY.md § 1–3).
- Giọng đọc thật của iOS (Nâng cao / Cao cấp), nút gạt im lặng, chất lượng nhận giọng Safari (cần mạng), quyền micro, ghi âm `audio/mp4` và nghe lại, tải `.ics` vào Lịch, lưu file sao lưu vào Tệp, safe-area trên máy có Dynamic Island.
- Theo dõi sau 1–2 tuần dùng: số mục mới/ngày và tỉ lệ 40/60 có hợp lý không; độ khó các đề nói; câu chấm sai do nhận giọng.

Có thể làm thêm (nhỏ, không bắt buộc):
- Sao lưu kèm bản ghi âm (hiện file .json chưa gồm ghi âm).
- Nhắc người dùng xuất sao lưu định kỳ (vd mỗi 2 tuần) ngay trong app.
- Hỗ trợ cỡ chữ hệ thống (Dynamic Type) — hiện cỡ chữ cố định theo px.

## Giai đoạn 4 (tùy chọn, cần quyết định của người dùng)
- Bọc Capacitor thành app iOS: cần Mac hoặc dịch vụ build cloud, và tài khoản Apple Developer.
- Đồng bộ nhiều máy bằng Supabase.
- AI chấm bài nói và sửa bài viết: cần API trả phí và một máy chủ nhỏ.
