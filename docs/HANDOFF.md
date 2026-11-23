# Bàn giao (cập nhật 23/11/2026)

## Hiện trạng
App chạy từ nhánh `main`. CI chạy lint, typecheck, Vitest, kiểm tra nội dung và build cho mọi PR. PR sẵn sàng review chạy thêm Playwright với Chromium trên iPhone 14 và iPhone SE. Push lên `main` và chạy CI thủ công kiểm tra cả Chromium lẫn WebKit. Cloudflare Pages đang phục vụ app tại [daily-study-6en.pages.dev](https://daily-study-6en.pages.dev/) qua Cloudflare Access. Người dùng đã thêm PWA vào Màn hình chính trên iPhone.

| PR | Nội dung |
|---|---|
| #1 | S1: khung Vite + React + TS strict, PWA, Dexie, CI, 4 trang (điều hướng hash) |
| #2 | S2: lõi TR: Leitner, lập phiên, chuỗi ngày, `parseNums`, 19 bài tính |
| #3 | S4: nội dung EN gói 1: schema, 300 cụm từ, 150 câu mẫu |
| #4 | S5: UI tiếng Anh: thẻ từ + TTS, câu mẫu đổi từ, trình phát shadowing |
| #5 | S3: Tra cứu, Tiến độ, ghi chú, xuất/nhập (đọc state Sổ ôn bản cũ) |
| #6 | S7: nội dung EN gói 2: 60 hội thoại, 100 đề nói, +300 cụm |
| #7 | S9a: `docs/DEPLOY.md`, `public/_headers` (CSP), Playwright WebKit |
| #8 | S6: nhận giọng, chấm từng từ, đề nói 1 phút có ghi âm |
| #9 | S8: phiên trộn TR 40% / EN 60%, cài đặt, file nhắc lịch `.ics` |
| #10 | S9b: rà soát toàn app, sửa lỗi, a11y, test audit sáng/tối |
| #11 | Nâng Vitest 5, ESLint 10, react-hooks 7; vá `npm audit` (còn 4 mức thấp do `deepmerge`, chưa có bản vá) |
| #12 | Sao lưu kèm ghi âm, nhắc sao lưu định kỳ, `navigator.storage.persist()` |
| #13 | Cỡ chữ theo hệ thống (Dynamic Type) + lựa chọn cỡ chữ trong app |
| #14 | Hỏi trước khi cập nhật bản mới (`registerType: 'prompt'`), tiếp tục phiên dở |
| #17 | Nghe chép chính tả (`dictation.ts`, `ui/DictationScreen.tsx`): nghe TTS → gõ → chấm từng từ bằng `speech/score.ts`, chấm Leitner cho câu mẫu / ví dụ cụm từ |
| #18 | Mục tiêu ngày (phút/ngày, ngày nghỉ) + tổng kết tuần ở trang Tiến độ; ghi giây học theo ngày tách TR / EN / nói (`core/studytime.ts`, `modules/progress/week.ts`) |
| #19 | Hội thoại nhập vai (`roleplay.ts`, `ui/RoleplayScreen.tsx`): chọn hội thoại + vai, app đọc lượt vai kia (TTS), người học nói → chấm từng từ; không có nhận giọng thì tự đánh giá; kết quả mỗi bài lưu ở `settings` khóa `en.roleplay` |
| #20 | Ôn điểm yếu (`core/weak.ts`, `core/misswords.ts`, `modules/mix/weak.ts`, `ui/mix/WeakPanel.tsx`): mục TR/EN hay sai + câu chứa từ hay nói / nghe sai; khối "Từ hay sai" ở Tiến độ; nghe chép trong phiên hằng ngày (công tắc ở Cài đặt, mặc định tắt); tiếp tục phiên dở cho nghe chép và Ôn điểm yếu |
| #21 | M05: bốn bài Cấu trúc lương cơ bản, bài tính compa-ratio và vị trí trong dải, lưu trạng thái học |
| #22 | Kho đọc M05/M06: tám bài có bối cảnh, ví dụ và câu tự ôn, kèm bài thực hành cân ma trận merit |
| #23 | M09: bốn bài phân tích dữ liệu đãi ngộ, lọc và chuẩn hóa FTE trên 12 hồ sơ giả định. Phiên trộn, Ôn điểm yếu và nút hoãn nhắc sao lưu đợi ghi IndexedDB trước khi cập nhật màn hình. |
| #24 | Dùng nút chọn mức hiệu suất và vùng compa trong ma trận merit để WebKit không kích hoạt vi phạm CSP khi tạo ô chọn |
| #25 | M05: mở thẻ TR101 liên quan ngay trong bài đọc, chọn thẻ vào lịch ôn ở Hôm nay và chấm theo Leitner |
| #26 | M05.2: nhập dự đoán compa-ratio, đối chiếu theo điểm phần trăm rồi thực hành đổi độ rộng dải |
| #27 | M05: Học tiếp từ Hôm nay và mở bài theo liên kết hash, giữ đúng bài khi tải lại hoặc dùng nút Back |
| #28 | Trang Tiến độ hiển thị số bài đọc đã đánh dấu hoàn thành trên tổng số bài của từng mô-đun M05, M06 và M09. |
| #29 | Cập nhật hướng dẫn triển khai cho domain Pages đang dùng, menu Cloudflare Access và luồng hỏi trước khi cập nhật PWA trên iPhone. |
| #30 | Lộ trình Total Rewards theo thứ tự 17 mô-đun của Excel. Hôm nay và Lộ trình gợi ý bài chưa học, cuối bài chuyển tiếp qua M05, M06 và M09. Tiến độ tính trên 12 bài đang mở. |
| #31 | Bổ sung 57 bài đọc từ lộ trình Excel ở M01–M04, M07–M08 và M10–M17, kèm tình huống, bước thực hiện và câu tự ôn riêng cho từng bài. |
| #32 | Mở 69 bài theo 17 buổi và 4 chặng từ nền tảng đến chuyên sâu. Hôm nay, Lộ trình và Tiến độ dùng cùng thứ tự M01–M17 và giữ mã bài cũ. |
| #33 | Memo cá nhân trong 69 bài đọc, tự lưu vào bảng notes và đi cùng bản sao lưu. Sổ memo trong Lộ trình cho tìm theo nội dung hoặc bài, mở lại đúng vị trí. |
| #34 | Hôm nay giữ thời lượng tiếng Anh vừa chọn khi IndexedDB trả cài đặt muộn. Test nghe chép giữ dấu thập phân khi nhập câu đúng. |
| #35 | Tìm trong 69 bài ngay tại Lộ trình bằng mã bài, tên buổi hoặc nội dung không dấu. Khi quay lại từ bài đã mở, giữ kết quả và đặt focus về bài đó. |
| #36 | Cài đặt → Tài khoản: đăng nhập qua Cloudflare Access, kiểm tra email phiên theo yêu cầu, đăng xuất và nhận biết ngoại tuyến. |
| #37 | Tab Đọc thêm có 6 tình huống Anh–Việt tự biên soạn theo nguồn Việt Nam và quốc tế, đổi ngôn ngữ cả bài hoặc mở nghĩa từng đoạn ngay cả khi ngoại tuyến. |
| #38 | Ôn duy trì sau khóa ở Hôm nay và Lộ trình. M01–M17 có 34 câu trắc nghiệm, 17 tình huống tự chấm và lịch ôn lưu trên thiết bị. |
| #39 | Cả 69 bài trong 17 buổi đều có thẻ liên quan. Có thể chọn thẻ khái niệm, công thức hoặc thuật ngữ để ôn từ Hôm nay. |
| #40 | M04.5 có bài thực hành chấm giá trị năm vị trí bằng bốn yếu tố, xem điểm, ngạch và căn cứ cho mỗi cấp. |
| #41 | M07.3 có mô phỏng phân bổ quỹ thưởng cho năm nhân viên. Thử thay đổi quỹ và trọng số từng người, kiểm tra số đã chia và số còn lại sau làm tròn. |
| #42 | Tiết kiệm phút Actions. PR nháp chạy kiểm tra mã và nội dung, PR sẵn sàng review chạy thêm Chromium. Push lên main và chạy tay có cả Chromium và WebKit. |
| #43 | Lộ trình giao tiếp công sở có sáu buổi từ small talk đến phản biện và đề xuất. Hôm nay gợi ý buổi học hoặc ôn theo Leitner, Tiến độ đối chiếu những lần luyện và mỗi bài giao tiếp/TR có thể xuất lời nhắc riêng cho Lịch. |
| #44 | Skill thiết kế học tập dùng trong repo, bảng tra UX ngoại tuyến và DESIGN.md cho giao diện Daily Study. |
| #45 | Ghim ba action CI theo commit, bỏ lưu token checkout và chỉ tải trace Playwright khi CI lỗi trong repo private. |
| #46 | M08.2 luyện chọn một trong ba hồ sơ khảo sát và viết căn cứ trước khi đối chiếu. |
| #47 | M11.2 dùng lại tình huống M08 để trình bày 60 giây, trả lời CFO và nghe đối chiếu hai lượt. |
| #48 | M10.2 cho dự đoán chi phí tăng lương trong năm và đủ 12 tháng, so hai phương án trong quỹ. |
| #49 | Sau khóa có hai tình huống vận dụng vào ngày 7 và 30, mở memo sau khi trả lời và lưu ba tiêu chí tự chấm. |
| #50 | Thêm ba bài tham khảo Anh–Việt về dự toán, nguồn lương và nghỉ việc, mỗi bài có ba lượt hội thoại tự đánh giá. |

## Bản đồ code
- `src/core/`: Leitner, lập phiên, phiên trộn (`mix.ts`), chuỗi ngày, Dexie (`db.ts`), sao lưu (`backup.ts`), `.ics`, cỡ chữ, theme.
- `src/modules/tr/`: thẻ, trắc nghiệm, 19 bài tính (`calc.ts`), câu mở.
- `src/modules/english/`: TTS, thẻ từ, câu mẫu, shadowing, `speech/` (nhận giọng, chấm điểm, ghi âm).
- `src/ui/`: các trang, phiên trộn (`mix/`), component chung.
- `content/english/`: JSON + `schema/`; kiểm bằng `npm run validate:content`.
- `tests/unit/` (Vitest), `tests/e2e/` (Playwright; `audit.spec.ts` quét tràn ngang, vùng chạm 44px, tương phản, lỗi console ở sáng/tối).

## Quy ước đã chốt
- Dexie: khi nâng version chỉ **thêm** bảng/chỉ mục, không đổi bảng cũ; có test nâng cấp (`tests/unit/db-upgrade.test.ts`).
- Id mục: `tr:<id>` cho TR, `en:ph-xxxx` / `en:pt-xxxx` / … cho EN.
- Âm thanh, micro, nhận giọng chỉ bắt đầu sau thao tác bấm (iOS). Nút ≥ 44px; không cuộn ngang ở 320–375px; cỡ chữ dùng `rem`.
- CSP trong `public/_headers` chặt (`'self'`); `vite preview` và Playwright cũng đọc file này.
- Trong `tests/e2e`, chỉ được skip kịch bản chụp ảnh (`PW_SHOTS`) và kịch bản 375px chạy một lần.
- Môi trường e2e cục bộ: `npx playwright install chromium webkit`.

- Thống kê ngày (`days`): trường tùy chọn `st`/`se`/`sk` (giây học TR / EN / nói, đo giữa các lượt chấm, bỏ khoảng nghỉ > 2 phút), `ks`/`kn` (tổng điểm nói, số lần), `m` (mục mới thuộc). Không đánh chỉ mục nên không tăng version Dexie; ngày cũ không có thì dùng `s`. Phiên mới phải gọi `progress.touch()` lúc bắt đầu (`beginSession` đã gọi sẵn).
- Từ hay sai: một khóa `settings` (`en.missWords`, `{ từ: { n, at } }`), không thêm bảng nên không tăng version Dexie; tự nằm trong file sao lưu (gộp: lấy số lớn hơn; thay thế bằng file cũ không có khóa này: xóa). Mọi lượt chấm nói (`SayCheck`) và nghe chép (`DictCard`) gọi `missStore.record`.
- Độ yếu của mục: `wrong × (4 − hộp)/3 + 2 (nếu hộp 1 và ôn ≤ 3 ngày)`, yếu khi ≥ 2 (`core/weak.ts`). Phiên Ôn điểm yếu và câu nghe chép trong phiên hằng ngày đều là `DailyEntry` chạy bằng `DailySession` (mục thêm kiểu `dict`, id `dict:<khóa câu>`); phiên dở lưu kiểu `weak` / `dict` trong `core/resume.ts`.

## Việc còn lại
1. Kiểm tra các khả năng riêng của iPhone bằng danh sách trong `docs/DEPLOY.md` §10.
2. **Sau 1–2 tuần dùng, nếu người dùng chọn:**
   - Chỉnh tỉ lệ 40/60, số mục mới/ngày, độ khó đề nói theo phản hồi.
3. Giai đoạn 4 (cần người dùng quyết định, có chi phí): xem `docs/PLAN.md`.
