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
| Thêm | Sao lưu kèm bản ghi âm; nhắc sao lưu định kỳ trong app (7 / 14 / 30 ngày / tắt) | S9b | ✅ Xong (PR sao lưu) |
| Thêm | Cỡ chữ: Dynamic Type trên iOS (`-apple-system-body`), CSS theo rem, lựa chọn Cỡ chữ trong Cài đặt, audit e2e ở chữ lớn | S9b | ✅ Xong (PR cỡ chữ) |
| Thêm | Hỏi trước khi cập nhật bản mới (không tự tải lại giữa phiên); tiếp tục phiên dở khi iOS tắt app (lưu vị trí 12 giờ) | S9b | ✅ Xong (PR cập nhật + tiếp tục phiên) |

## Việc còn lại
Chỉ kiểm được trên iPhone thật — làm theo [docs/DEPLOY.md § 10](DEPLOY.md#10-danh-sách-kiểm-tra-trên-iphone-thật):
- Deploy lần đầu lên Cloudflare Pages + bật Access (người dùng tự làm theo DEPLOY.md § 1–3).
- Giọng đọc thật của iOS (Nâng cao / Cao cấp), nút gạt im lặng, chất lượng nhận giọng Safari (cần mạng), quyền micro, ghi âm `audio/mp4` và nghe lại, tải `.ics` vào Lịch, lưu file sao lưu vào Tệp (kể cả file lớn có ghi âm), safe-area trên máy có Dynamic Island.
- Theo dõi sau 1–2 tuần dùng: số mục mới/ngày và tỉ lệ 40/60 có hợp lý không; độ khó các đề nói; câu chấm sai do nhận giọng.

Có thể làm thêm (nhỏ, không bắt buộc):
- C. Ôn "lỗi hay gặp"; D. Tổng kết tuần — xem docs/HANDOFF.md.

## Thử nghiệm tự nhớ trong Đọc thêm

Trước thay đổi này, người học có thể mở đáp án trong khi bài mẫu vẫn ở cùng màn hình. Đây là quan sát về thiết kế. Hiện chưa có dữ liệu để kết luận người dùng thường xem đáp án sớm hay học tốt hơn với một cách luyện cụ thể.

- **Tự nhớ trước khi đối chiếu.** Trong hai thí nghiệm với văn bản, nhóm tự nhớ làm tốt hơn ở lần kiểm tra sau hai ngày hoặc một tuần, trong khi đọc lại có lợi ở lần kiểm tra sau năm phút. Ba bài C&B vì thế có màn riêng để người học trả lời trước khi xem cách tính. [Roediger và Karpicke, 2006](https://pubmed.ncbi.nlm.nih.gov/16507066/)
- **Ôn cách quãng.** Tổng quan của Dunlosky và cộng sự đánh giá cao tự kiểm tra và phân bố lần học theo thời gian. Người học có thể xuất lịch để quay lại tình huống thứ hai; ngày nhắc là lựa chọn cá nhân. [Dunlosky và cộng sự, 2013](https://pubmed.ncbi.nlm.nih.gov/26173288/)
- **Đổi câu hỏi, giữ kỹ năng.** Trong thí nghiệm của Butler, nhóm tự kiểm tra nhiều lần vận dụng tốt hơn vào các câu suy luận mới sau một tuần. Mỗi bài thử đổi dữ kiện hoặc đổi mục đích ra quyết định, chẳng hạn chuyển từ đối sánh FTE sang dự toán chi phí hợp đồng. [Butler, 2010](https://pubmed.ncbi.nlm.nih.gov/20804289/)

Phân tích tổng hợp 122 thí nghiệm của Pan và Rickard cho thấy khả năng vận dụng phụ thuộc vào cách đặt câu hỏi và việc người học giải thích khi tự nhớ. Vì vậy, mỗi đề yêu cầu nói căn cứ bằng tiếng Anh trước khi mở mẫu. App chỉ chấm đáp số; người học tự đối chiếu phần lập luận. [Pan và Rickard, 2018](https://pubmed.ncbi.nlm.nih.gov/29733621/)

Sau khi đối chiếu một trong sáu tình huống, chọn **Ghi memo lần tự thử** để tự ghi bước cần xem lại hoặc câu tiếng Anh muốn luyện. Mỗi tình huống có một memo cho từng ngày trên thiết bị. Mở **Lộ trình → Sổ memo bài học** để tìm hai lần ôn, sửa ghi chú hoặc làm lại đúng đề.

**Đề xuất sau hai tuần dùng.** Người học có thể ghi vào memo ba điều cho mỗi chủ đề: lần sau có tự tính đúng với dữ kiện mới không, có cần mở bài mẫu không, và có giải thích được bằng một câu tiếng Anh không. Nếu tiếp tục nhầm cùng một bước qua hai ngày, ưu tiên thêm cặp bài đối chiếu đúng bước đó. Nếu tính đúng nhưng ngập ngừng khi giải thích, ưu tiên luyện hỏi–đáp và nghe lại lời nói. Ba bài là thử nghiệm nhỏ; các kết quả nghiên cứu trên tài liệu học tập chỉ hướng dẫn thiết kế, chưa xác nhận hiệu quả của Daily Study.

## Tình huống công việc trong tuần

1. Đọc và luyện ba tình huống song ngữ về bắt chuyện, giải thích thưởng và phản biện đề xuất phụ cấp ca.
2. Chọn một tình huống từ Hôm nay, trả lời từng câu trong lượt khoảng hai phút và quay lại tiếp tục câu kế tiếp.
3. Nhìn lại hai lượt của cùng tình huống, nghe lại hoặc đọc memo, rồi ghi điều đã dùng được trong công việc và điều muốn luyện tiếp.

## Tìm bài và luyện từ thư viện

1. Tìm theo tiêu đề, cụm từ và nội dung Anh–Việt, kết hợp với nguồn. Chạm một trong hai tiêu đề để đọc và bắt đầu lượt luyện tuần từ bài phù hợp.
2. Bổ sung hai bài có lời thoại và dữ kiện tuần sau về đối chiếu hỗ trợ bữa ăn trên phiếu lương và trao đổi khi một nhân viên muốn xét lại ngạch.
3. Giữ từng lượt hội thoại đã tự chấm khi người học rời bài. Từ thư viện, mở lại đúng câu đang dở và xem kết quả sau lượt cuối.

## Giai đoạn 4 (tùy chọn, cần quyết định của người dùng)
- Bọc Capacitor thành app iOS: cần Mac hoặc dịch vụ build cloud, và tài khoản Apple Developer.
- Đồng bộ nhiều máy bằng Supabase.
- AI chấm bài nói và sửa bài viết: cần API trả phí và một máy chủ nhỏ.
