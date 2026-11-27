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
4. Từ kết quả, luyện lại các câu đã đánh dấu cần luyện thêm và giữ những câu đã đạt.
5. Thêm hội thoại cho sáu bài đọc đầu tiên, từ đổi ca và bàn giao đến giải thích tăng lương và đánh giá phúc lợi.
6. Thêm tình huống vận dụng ở tuần kế tiếp cho các bài còn thiếu, với số liệu hoặc điều kiện công việc mới.

## Nghiệm thu trên iPhone

Bản PWA đã được cài trên Màn hình chính. Dùng chính bản này để thử luồng học hằng ngày. Ghi phiên bản iOS, ngày thử và kết quả vào mục 10 của [hướng dẫn triển khai](DEPLOY.md).

| Thứ tự | Thao tác | Dấu hiệu đạt |
|---|---|---|
| 1. Email đã cấp quyền | Mở trang bằng tab Safari riêng tư có mạng, nhận mã bằng email đã đăng ký, nhập mã rồi mở Cài đặt → Tài khoản → Kiểm tra phiên. | Vào được bài học và thấy đúng email. Thử đăng nhập bằng một email ngoài danh sách trong phiên riêng mới, xác nhận không vào được bài. |
| 2. Học trên thiết bị | Mở app từ Màn hình chính, học một lượt, lưu memo và thử nghe, nói, ghi âm. Sau khi app đã tải xong, bật chế độ máy bay, mở lại bài và memo. | Đọc được bài và memo ngoại tuyến. Khi có mạng, có thể nhận giọng; bản ghi phát lại được trên iPhone. |
| 3. Sao lưu và khôi phục | Xuất bản sao có ghi âm vào Tệp. Nhập vào một phiên thử có kho dữ liệu trống, rồi đối chiếu memo, tiến độ và phát lại bản ghi. | Khôi phục được cả nội dung lẫn âm thanh. Giữ bản đang học và tệp sao lưu trong suốt lần thử. |
| 4. Quyết định về app iOS riêng | Sau 1–2 tuần, ghi tác vụ cụ thể còn vướng trên PWA, tần suất và ảnh hưởng khi học. | Chọn tác vụ cần thử trong Xcode và ghi hành vi mong đợi trên thiết bị. Dùng kết quả PWA làm mốc so sánh cho bản thử iOS. |

## Lộ trình phát hành iOS

Bản đang dùng là PWA trên Cloudflare Pages. Mục tiêu của bản iOS đầu tiên là hoàn thành một lượt ôn khi mất mạng và mở đúng bài từ lời nhắc trên iPhone. Dùng một bài đọc Anh–Việt tự biên soạn để thử toàn bộ hành trình trước khi mở rộng kho nội dung.

| Mốc | Việc thực hiện | Điều kiện để đi tiếp |
|---|---|---|
| 1. Đối chiếu bản đang học | Hiển thị mã commit của bản đã tải ở **Cài đặt → Dữ liệu**, cùng cách đang mở app. Thử trên Safari và từ Màn hình chính, cả khi mất mạng. | Chép được mã trên máy để so với bản production của Pages. Sau **Có bản mới → Cập nhật**, memo vẫn mở được và mã đổi sang bản vừa phát hành. |
| 2. Nghiệm thu PWA trên máy thật | Thử các bước email, ngoại tuyến, micro và khôi phục ở phần trên. Ghi kết quả theo từng cách mở app vào mục 10 của hướng dẫn triển khai. | Có kết quả trên một iPhone xác định, gồm cả lần từ chối micro. Bản sao thử khôi phục được memo, tiến độ và một bản ghi có thể phát lại. |
| 3. Thử một chức năng native trong Xcode | Làm một lượt ôn có lời nhắc cục bộ do người học chọn giờ. Khi chạm thông báo, mở đúng câu đang dở. Khi từ chối thông báo, vẫn vào được bài từ Hôm nay. Dùng SwiftUI và UserNotifications cho bản thử trên máy Mac. | Trên iPhone thật, đóng app, mở từ thông báo trong chế độ máy bay, chấm câu rồi khởi động lại. Câu tiếp theo và kết quả lần chấm trước phải khớp. Đối chiếu với luồng PWA trước khi chọn cách tích hợp. |
| 4. TestFlight | Chủ tài khoản Apple chọn Bundle ID, bật ký bản và tạo hồ sơ App Store Connect. Gửi một build cho nhóm thử nội bộ. Chỉ mời nhóm bên ngoài sau khi hoàn tất bước xét duyệt beta tương ứng. | Người thử cài được, hoàn thành lượt ôn và nâng từ build trước lên build sau mà giữ được tiến độ. Nhật ký có số build, phiên bản iOS, lỗi còn mở và kết quả thử lại. |
| 5. App Review và phát hành | Chuẩn bị ảnh từ bản gửi duyệt, mô tả chức năng, URL hỗ trợ, chính sách riêng tư, khai báo dữ liệu và cách để người xét duyệt vào đủ tính năng. | Chủ dự án xác nhận quyền phân phối nội dung, kết quả TestFlight và hồ sơ riêng tư. Ghi vào nhật ký ngày gửi, kết quả App Review và phiên bản thực tế khi phát hành. |

**Email và dữ liệu học.** Với bản hiện tại, người quản lý cấp quyền cho từng địa chỉ. Cloudflare Access gửi mã một lần và xác nhận phiên. Tiến độ, memo và ghi âm thuộc kho dữ liệu trên thiết bị. Khi thử bản native, kiểm tra lại lần đăng nhập đầu, hết phiên và đổi người dùng trên cùng iPhone. Người sau chỉ được mở dữ liệu của mình. Để chuyển dữ liệu PWA, dùng bản sao có ghi âm, nhập trên bản thử rồi đối chiếu trước khi xóa dữ liệu trên máy cũ. Tự đăng ký tài khoản trong app là một bước riêng, cần thiết kế cả xác minh và xóa tài khoản. [Đăng nhập bằng mã email của Cloudflare](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/) · [Yêu cầu xóa tài khoản của Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

**Nội dung được phép phân phối.** Bản web hiện đóng gói dữ liệu TR nội bộ trong JavaScript và dựa vào Cloudflare Access trước khi tải. Gói thử iOS dùng bài đã có quyền phân phối. Kiểm tra danh sách tài nguyên trong bản Archive trước khi đưa lên TestFlight. Nếu bản phát hành cần bài nội bộ, thiết kế đường tải có xác thực và kiểm tra riêng quyền truy cập của người học. Cấp cho App Review tài khoản thử với nội dung mẫu đủ để trải nghiệm các tính năng. Phần mô tả cần chỉ ra cách học ngoại tuyến và mở lại bài từ lời nhắc. [App Review Guidelines, mục 2.1, 4.2 và 5.1](https://developer.apple.com/app-store/review/guidelines/)

**Phân phối và quyền riêng tư.** Có thể dùng Apple Account với Xcode để thử trên thiết bị cá nhân. TestFlight và App Store cần tư cách thành viên Apple Developer Program của chủ dự án. Khi chuẩn bị thông tin riêng tư, đối chiếu riêng email xử lý qua Access, dữ liệu nằm trên máy và hành vi thực tế của tính năng giọng nói. [Quyền theo loại tài khoản](https://developer.apple.com/support/compare-memberships/) · [Hướng dẫn TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) · [Khai báo quyền riêng tư trên App Store](https://developer.apple.com/app-store/app-privacy-details/)

## Các hướng mở rộng khác (tùy chọn)
- Đồng bộ nhiều máy bằng Supabase.
- AI chấm bài nói và sửa bài viết: cần API trả phí và một máy chủ nhỏ.
