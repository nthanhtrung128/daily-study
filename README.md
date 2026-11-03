# daily-study

App ôn luyện mỗi ngày cho một người: **Total Rewards (TR101)** + **tiếng Anh giao tiếp công sở**. PWA chạy trên Safari iPhone (thêm vào Màn hình chính, chạy offline) và trình duyệt máy tính.
Repo **private** — xem quy tắc trong [CLAUDE.md](CLAUDE.md), kế hoạch trong [docs/PLAN.md](docs/PLAN.md), cách đưa lên mạng và kiểm tra trên iPhone trong [docs/DEPLOY.md](docs/DEPLOY.md).

## Tính năng

| Trang | Có gì |
|---|---|
| **Hôm nay** | Một nút **Bắt đầu ôn hôm nay**: phiên trộn TR + tiếng Anh (mặc định 40/60) theo thời lượng 10–30 phút, ưu tiên mục đến hạn → câu từng sai → mục mới, kèm 1 bài luyện nói. Ôn riêng **TR** (thẻ khái niệm, công thức, thuật ngữ, 121 câu trắc nghiệm, 19 bài tính sinh số ngẫu nhiên, câu hỏi mở) và **tiếng Anh** (thẻ từ 2 chiều, câu mẫu tự thay từ, shadowing 60 hội thoại, luyện nói có chấm từng từ, 100 đề nói 1 phút có ghi âm). |
| **Tra cứu** | Tìm không dấu trong khái niệm, công thức, thuật ngữ, câu hỏi, cụm từ EN; chấm mức thuộc và ghi chú từng mục. |
| **Tiến độ** | Mức thuộc theo buổi, bản đồ nhiệt 5 tuần, chuỗi ngày, mục hay sai, bảng bài tính. |
| **Cài đặt** | Sáng / tối / theo máy; thời lượng, tỉ lệ TR/EN, số mục mới mỗi ngày, luyện nói; giọng đọc Mỹ/Anh và tốc độ; file nhắc lịch `.ics`; xuất / nhập tiến độ (đọc được state Sổ ôn bản cũ). |

- Lặp lại ngắt quãng **Leitner** 5 hộp (1, 3, 7, 14, 30 ngày); chuỗi ngày theo giờ máy.
- Đọc bằng `speechSynthesis`, nhận giọng bằng `SpeechRecognition` của trình duyệt (miễn phí, không API trả phí). Âm thanh và micro chỉ bật khi bấm nút; tự dừng khi đổi màn hoặc ẩn app.
- Tiến độ, cài đặt, bản ghi âm **chỉ lưu trên máy** (IndexedDB). Không analytics, không script ngoài (CSP `'self'`). Báo bằng tiếng Việt khi không lưu được (bộ nhớ đầy, Duyệt web riêng tư).
- Giao diện vùng chạm ≥ 44 px, không cuộn ngang ở 320 px, tôn trọng safe-area, tương phản WCAG AA ở cả sáng và tối, hỗ trợ VoiceOver (nhãn nút, `aria-live`, focus khi chuyển thẻ) và *Giảm chuyển động*.

## Chạy thử

Cần Node 22.

```bash
npm install
npm run dev          # http://localhost:5173 (thêm --host để mở từ iPhone cùng mạng Wi‑Fi)
npm run build && npm run preview   # bản build có service worker + header như Cloudflare: http://localhost:4173
```

Nhận giọng nói và ghi âm cần `https` hoặc `localhost`; mở từ iPhone qua `http://<ip-máy>:5173` thì hai tính năng này bị trình duyệt chặn (phần còn lại chạy bình thường).

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript strict |
| `npm test` | Vitest (logic + giao diện jsdom, `tests/unit/`) |
| `npm run test:e2e` | Playwright, giả lập iPhone 14 và iPhone SE (`tests/e2e/`); thêm `PW_WEBKIT=1` để chạy cả WebKit (Safari) |
| `npm run build` | Bản build PWA vào `dist/` |
| `npm run preview` | Xem bản build (có service worker, chạy offline) |
| `npm run validate:content` | Kiểm tra dữ liệu trong `content/` theo schema |
| `npm run icons` | Sinh lại icon PNG từ `public/icons/icon.svg` |
| `PW_SHOTS=1 npx playwright test screenshots` | Chụp các màn chính vào `docs/screenshots/` |

Lần đầu chạy e2e cần tải trình duyệt: `npx playwright install chromium` (và `npx playwright install --with-deps webkit` nếu dùng `PW_WEBKIT=1`; CI luôn chạy cả hai).
Nếu máy đã có sẵn Chromium khác phiên bản, đặt `PW_CHROMIUM_PATH=/đường/dẫn/chrome`.

`tests/e2e/audit.spec.ts` đi hết mọi luồng ở giao diện sáng và tối và kiểm: không tràn ngang / chữ không tràn hộp, vùng chạm ≥ 44 px, tương phản chữ, không lỗi console / CSP, focus và `aria-live`, dừng TTS / nhận giọng / micro khi rời màn, chạy offline toàn bộ.

## Cấu trúc

```
content/tr101/data.json        # dữ liệu TR101 (nội bộ, không chia sẻ)
content/english/               # phrases, patterns, dialogues, speaking-topics (+ schema/)
src/main.tsx, src/App.tsx      # khởi động, đăng ký service worker, khung 4 tab (điều hướng bằng #)
src/core/                      # Leitner, lịch ôn, chuỗi ngày, IndexedDB (Dexie), tiến độ, sao lưu, cài đặt, .ics, parse số
src/modules/tr/                # dữ liệu TR, 19 bài tính, lập phiên, thẻ TR (cards/TrCard.tsx)
src/modules/english/           # nội dung EN, TTS, trình phát shadowing, thẻ từ / câu mẫu (ui/)
src/modules/english/speech/    # nhận giọng, chấm từng từ, ghi âm, kho bản ghi, đề nói
src/modules/mix/               # phiên hằng ngày trộn TR + EN, kết quả theo phần
src/modules/lookup/, progress/ # chỉ mục tra cứu, thống kê tiến độ
src/ui/                        # trang Hôm nay / Tra cứu / Tiến độ / Cài đặt, thành phần chung, styles.css (design token)
scripts/                       # validate-content, đọc public/_headers cho vite preview, sinh icon
public/_headers, robots.txt    # header bảo mật + cache cho Cloudflare Pages
tests/unit/, tests/e2e/        # Vitest, Playwright
legacy/so-on-template.html     # bản Sổ ôn cũ (nguồn chuyển logic, không sửa)
docs/                          # PLAN, DEPLOY (kèm danh sách kiểm tra trên iPhone thật), screenshots/
```

Bundle được tách: `content-*.js` (nội dung JSON), `react-*.js`, `dexie-*.js`, `index-*.js` (code app) — tải song song lần đầu, và khi chỉ sửa code thì iPhone không phải tải lại phần nội dung.

## Deploy

Cloudflare Pages + Cloudflare Access (bắt buộc, vì dữ liệu TR là nội bộ), cài lên iPhone, cập nhật, sao lưu, danh sách kiểm tra trên iPhone thật: xem [docs/DEPLOY.md](docs/DEPLOY.md).
