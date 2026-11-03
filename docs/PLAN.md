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
| Phiên | Việc | Cần xong trước |
|---|---|---|
| S1 | Khung Vite + React + TS + PWA, CI, 4 trang rỗng | — |
| S2 | Chuyển lõi TR: Leitner, lập phiên, thẻ, trắc nghiệm, 19 bài tính, câu mở + test | S1 |
| S3 | Tra cứu, Tiến độ, ghi chú, xuất/nhập tiến độ (đọc được state bản cũ) | S2 |
| S4 | Nội dung EN gói 1: schema, 300 cụm từ, 150 câu mẫu | — |
| S5 | UI tiếng Anh: thẻ từ + TTS, câu mẫu, trình phát shadowing | S2, S4 |
| S6 | Luyện nói: nhận giọng, so từng từ, đề 1 phút có ghi âm | S5 |
| S7 | Nội dung EN gói 2: 60 hội thoại, 100 đề nói, thêm 300 cụm | S4 |
| S8 | Phiên hằng ngày trộn TR + EN, cài đặt, file nhắc lịch .ics | S3, S6 |
| S9 | Kiểm tra trên iPhone, offline, dark mode, docs/DEPLOY.md (Cloudflare Pages + Access) | S8 |

## Giai đoạn 4 (tùy chọn)
- Bọc Capacitor thành app iOS: cần Mac hoặc dịch vụ build cloud, và tài khoản Apple Developer.
- Đồng bộ nhiều máy bằng Supabase.
- AI chấm bài nói và sửa bài viết: cần API trả phí và một máy chủ nhỏ.
