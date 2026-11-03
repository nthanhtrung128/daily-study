# CLAUDE.md — daily-study

App ôn luyện mỗi ngày cho một người dùng: **Total Rewards (TR101)** + **tiếng Anh giao tiếp**. Đây là PWA chạy trên Safari iPhone, có thể thêm vào Màn hình chính, và chạy trên trình duyệt máy tính.

## Người dùng
- Chuyên viên C&B / Total Rewards ở Hà Nội. Mục tiêu tiếng Anh: **nói lưu loát** trong môi trường công sở. Trình độ hiện tại khoảng B2 (TOEIC 855 Listening & Reading), phần nói yếu hơn.
- Giao diện, nội dung giải thích, commit message và mô tả PR: **tiếng Việt**. Nội dung học tiếng Anh viết bằng tiếng Anh, kèm nghĩa tiếng Việt ngắn.

## Bảo mật
- Repo **private**. Dữ liệu `content/tr101/` lấy từ tài liệu khóa học có ghi "nội bộ, không chia sẻ": không đưa ra repo công khai, gist, CDN hay dịch vụ bên thứ ba.
- Không thêm analytics, tracker hay script bên ngoài. Tiến độ và ghi âm chỉ lưu trên máy (IndexedDB).
- Nội dung tiếng Anh phải tự soạn mới, không chép từ sách, báo, bài hát hay app khác.

## Stack (giữ nguyên, trừ khi PR giải thích lý do đổi)
- Vite + React + TypeScript (strict), vite-plugin-pwa, Dexie (IndexedDB).
- Web Speech API: `speechSynthesis` để đọc, `SpeechRecognition` / `webkitSpeechRecognition` để nhận giọng. Không dùng API giọng nói trả phí.
- Vitest cho logic, Playwright (thiết bị `iPhone 14`, `iPhone SE`) cho giao diện; GitHub Actions chạy lint + typecheck + test + build mỗi PR.
- Không dùng framework UI nặng. CSS thuần với design token trên `:root`, có light/dark (`prefers-color-scheme`).

## Cấu trúc
```
content/tr101/      # dữ liệu TR101 (data.json gốc → tách file theo loại ở S2)
content/english/    # vocab, phrases, dialogues, speaking-topics (JSON, có schema)
src/core/           # Leitner, lập phiên, chuỗi ngày, lưu trữ, parse số
src/modules/tr/     # thẻ, trắc nghiệm, bài tính, câu hỏi mở
src/modules/english/# thẻ từ, câu mẫu, shadowing, luyện nói
src/ui/             # các trang: Hôm nay, Tra cứu, Tiến độ, Cài đặt
scripts/validate-content.ts
tests/
legacy/so-on-template.html   # bản Sổ ôn cũ (một file HTML) — nguồn để chuyển logic, KHÔNG sửa
docs/PLAN.md
```

## Quy tắc nghiệp vụ (giữ đúng như bản cũ)
- **Leitner:** hộp 1–5. Nhớ rõ / đúng → lên 1 hộp, giãn lịch 1, 3, 7, 14, 30 ngày. Mơ hồ → ôn lại ngày mai. Quên / sai → về hộp 1, đến hạn ngay, cộng 1 lần sai. Mức "Đã thuộc" = hộp ≥ 4.
- **Chuỗi ngày** tính theo ngày có ít nhất 1 lượt ôn, theo giờ máy (Asia/Bangkok).
- **Bài tính:** sinh số ngẫu nhiên, đáp số có dung sai. `parseNums` chấp nhận "1.530" (nghìn kiểu VN), "12,5", "1.530.000 đ", "15 %".
- **Số liệu pháp lý 2026 (nhãn [Bổ sung]):** giảm trừ bản thân 15,5 triệu; người phụ thuộc 6,2 triệu; biểu thuế 5 bậc 5/10/20/30/35% (ngưỡng 10/30/60/100 triệu); BH người lao động 10,5%; doanh nghiệp 21,5% (chưa gồm KPCĐ). Không tự đổi các số này nếu người dùng chưa xác nhận.
- Định dạng số theo `vi-VN`.

## Cách làm việc
- Mỗi phiên làm đúng một việc trong `docs/PLAN.md`, mở **một PR**, mô tả gồm: đã làm gì, cách thử, ảnh chụp màn hình iPhone (nếu đụng UI), việc còn lại.
- Phiên "nội dung" chỉ sửa `content/`, không đụng `src/`.
- Trước khi mở PR, chạy `npm run lint && npm run typecheck && npm test && npm run build`, và `npm run validate:content` nếu sửa nội dung.
- Ưu tiên chạy được trên iOS Safari: âm thanh và nhận giọng chỉ bắt đầu sau thao tác bấm; tôn trọng safe-area; không cuộn ngang ở chiều rộng 375px.
- Chỗ nào chưa rõ thì chọn cách hợp lý nhất, ghi rõ giả định trong mô tả PR; không dừng lại để hỏi.
