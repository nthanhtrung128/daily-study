# Đưa app lên mạng: Cloudflare Pages + Cloudflare Access

Hướng dẫn từng bước cho người không chuyên. Làm một lần khoảng 30–45 phút. Cả hai dịch vụ đều có gói **miễn phí** đủ dùng cho một người (Cloudflare Zero Trust miễn phí tới 50 người dùng).

> **Vì sao phải có Access?** Dữ liệu TR101 là tài liệu nội bộ, đã được đóng gói vào file JavaScript của app. Ai có đường link là tải được. Cloudflare Access chặn mọi người trừ email của bạn, **trước khi** tải bất kỳ file nào. **Đừng bỏ qua bước 2.** Trong lúc chưa bật Access, đừng gửi link cho ai.

Mục lục
1. [Tạo project Cloudflare Pages (nối với GitHub)](#1-tạo-project-cloudflare-pages)
2. [Bật Cloudflare Access chỉ cho email của bạn](#2-bật-cloudflare-access)
3. [Kiểm tra sau khi deploy](#3-kiểm-tra-sau-khi-deploy)
4. [Thêm vào Màn hình chính trên iPhone](#4-thêm-vào-màn-hình-chính-trên-iphone)
5. [Access + PWA trên iPhone: đăng nhập hết hạn, cách mở lại](#5-access--pwa-trên-iphone)
6. [Cập nhật phiên bản mới](#6-cập-nhật-phiên-bản-mới)
7. [Sao lưu tiến độ trước khi xóa app / đổi máy](#7-sao-lưu-tiến-độ)
8. [Cách thay thế: deploy bằng lệnh, không nối GitHub](#8-cách-thay-thế-deploy-bằng-lệnh)
9. [Những gì repo đã cấu hình sẵn](#9-những-gì-repo-đã-cấu-hình-sẵn)

---

## 1. Tạo project Cloudflare Pages

Cần: tài khoản GitHub có quyền với repo `daily-study`, và một tài khoản Cloudflare (đăng ký miễn phí tại dash.cloudflare.com).

1. Đăng nhập **dash.cloudflare.com** → menu trái **Workers & Pages** (tên menu có thể hơi khác) → **Create** → chọn thẻ **Pages** → **Connect to Git** (hoặc *Import an existing Git repository*).
2. Chọn **GitHub** → **Connect GitHub**. GitHub mở trang cài app "Cloudflare Workers and Pages":
   - Ở mục *Repository access* chọn **Only select repositories** → chọn đúng repo `daily-study`. Không cần cho Cloudflare đọc repo khác.
   - Bấm **Install & Authorize**. Repo private vẫn deploy bình thường; code không bị công khai.
3. Quay lại Cloudflare, chọn repo `daily-study` → **Begin setup**.
4. Điền:

   | Ô | Giá trị |
   |---|---|
   | Project name | tên ngắn, không dấu, khó đoán hơn tên repo, vd `on-moi-ngay-7k2` → link sẽ là `https://on-moi-ngay-7k2.pages.dev` |
   | Production branch | `main` |
   | Framework preset | `None` (hoặc `Vite`, miễn là 2 dòng dưới đúng) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | để trống |

5. Mở **Environment variables (advanced)** → thêm biến `NODE_VERSION` = `22`. (Repo cũng có file `.node-version` ghi `22`; đặt thêm biến cho chắc.)
6. Bấm **Save and Deploy**. Chờ 1–3 phút tới khi thấy *Success*.
7. **Chưa mở link vội** — làm ngay bước 2.

Sau này, mỗi lần PR được merge vào `main`, Cloudflare tự build và cập nhật. Mỗi PR/nhánh khác cũng được build thành một link xem trước dạng `https://<mã>.on-moi-ngay-7k2.pages.dev` — các link này **cũng chứa dữ liệu TR**, nên bước 2 phải bảo vệ cả chúng.

### Tắt những thứ Cloudflare có thể tự chèn vào trang
App cấm script ngoài (CSP chặt, xem mục 9), và theo `CLAUDE.md` không được có analytics:
- Project → **Metrics** (hoặc *Analytics*) → **Web Analytics**: để **tắt**.
- Nếu sau này gắn tên miền riêng: trong zone của tên miền, **không** bật Rocket Loader, Zaraz, Email Address Obfuscation, Web Analytics. Các tính năng này chèn script, sẽ bị CSP chặn và có thể làm lỗi trang.

## 2. Bật Cloudflare Access

1. Ở dash.cloudflare.com, mở **Zero Trust** (menu trái). Lần đầu sẽ được hỏi:
   - *Team name*: đặt tên bất kỳ, vd `ten-ban-hoc` → trang đăng nhập sẽ là `ten-ban-hoc.cloudflareaccess.com`.
   - Chọn gói **Free** ($0). Cloudflare có thể đòi nhập thẻ thanh toán dù gói miễn phí; không bị trừ tiền với gói Free.
2. **Cách đăng nhập**: Zero Trust → **Settings** → **Authentication** → *Login methods*: giữ **One-time PIN** (mã gửi về email). Không cần cài gì thêm.
3. **Tạo ứng dụng**: Zero Trust → **Access** → **Applications** → **Add an application** → **Self-hosted**.
   - *Application name*: `On moi ngay`.
   - *Session Duration*: chọn dài, vd **1 month** (xem mục 5 để hiểu vì sao).
   - *Application domain* (bấm *Add public hostname* / *Add domain* để thêm đủ 2 dòng):
     1. Subdomain trống, Domain `on-moi-ngay-7k2.pages.dev` (bản chính).
     2. Subdomain `*`, Domain `on-moi-ngay-7k2.pages.dev` (mọi link xem trước của PR).
   - Nếu có tên miền riêng, thêm dòng thứ 3 cho tên miền đó.
4. **Tạo policy** (bước tiếp theo của trình tạo, hoặc tab *Policies*):
   - *Policy name*: `Chi minh toi`, *Action*: **Allow**.
   - *Include* → *Selector* **Emails** → *Value*: **`<EMAIL_CUA_BAN>`** ← thay bằng đúng email bạn dùng để nhận mã (vd email cá nhân). **Chỉ điền ở Cloudflare, không ghi email vào repo.**
   - Không thêm dòng nào khác (đừng chọn *Everyone*, đừng chọn *Emails ending in* `@gmail.com`).
5. *Login methods* của ứng dụng: chỉ tick **One-time PIN**; có thể bật *Instant Auth* (bỏ qua màn chọn cách đăng nhập).
6. Phần *Settings/Advanced* (cookie): để mặc định. **Không** bật *Binding Cookie* (dễ làm hỏng đăng nhập trên app ở Màn hình chính).
7. **Save**.

> Cách khác: trong project Pages → **Settings** → **General** → *Access policy* → **Enable access policy**. Nút này chỉ bảo vệ **link xem trước**, không bảo vệ bản chính, nên vẫn phải làm như trên cho domain chính. Làm theo bước 3 (có dòng `*`) là đủ cả hai.

## 3. Kiểm tra sau khi deploy

Dùng **cửa sổ ẩn danh** trên máy tính:

1. Mở `https://on-moi-ngay-7k2.pages.dev` → phải thấy **trang đăng nhập Cloudflare Access**, không thấy app.
2. Thử mở thẳng file: `https://on-moi-ngay-7k2.pages.dev/manifest.webmanifest`, `/sw.js`, `/robots.txt` → cũng phải ra trang đăng nhập (không ai tải được file khi chưa đăng nhập).
3. Nhập email của bạn → nhận mã 6 số trong hộp thư → nhập → vào được app.
4. Thử một email khác (nếu có) → Access báo *không có quyền* và **không gửi mã**. Đúng như mong muốn.
5. (Không bắt buộc) Trong DevTools → Network → bấm vào request trang chính → mục *Response Headers* phải có `content-security-policy`, `x-robots-tag: noindex…`, `permissions-policy: microphone=(self)…`.

## 4. Thêm vào Màn hình chính trên iPhone

1. Mở **Safari** (bắt buộc Safari, hoặc trình duyệt khác có nút *Thêm vào MH chính* trên iOS 16.4 trở lên) → vào link app → đăng nhập Access bằng mã email.
2. Chờ app hiện trang **Hôm nay** và **để yên khoảng 10 giây** cho app tải đủ dữ liệu để chạy offline.
3. Bấm nút **Chia sẻ** (hình vuông có mũi tên lên) → kéo xuống → **Thêm vào MH chính** (*Add to Home Screen*). Trên iOS 26 nút Chia sẻ có thể nằm trong menu **⋯**.
4. Tên mặc định là "Ôn mỗi ngày" → **Thêm**. Bật *Mở như ứng dụng web* nếu có lựa chọn này.
5. Mở app từ biểu tượng mới. **Lần đầu mở có thể phải đăng nhập Access thêm một lần nữa**: app ở Màn hình chính có bộ nhớ (cookie, tiến độ) **riêng**, tách khỏi Safari. Nhập email → mở Mail lấy mã → quay lại app nhập mã (bàn phím iPhone thường gợi ý sẵn mã "Từ Mail"). Nếu quay lại thấy app đã tải lại trang đăng nhập thì bấm gửi mã mới.
6. Sau lần mở đầu có mạng, app chạy được **offline** (chế độ máy bay vẫn ôn được).

Lưu ý:
- Tiến độ ôn trên Safari và trên app ở Màn hình chính **không dùng chung**. Chọn dùng một chỗ (nên dùng app ở Màn hình chính). Muốn chuyển thì dùng *Xuất/Nhập tiến độ* (mục 7).
- Ghi âm và nhận giọng nói chỉ bắt đầu sau khi bạn bấm nút; lần đầu iPhone hỏi quyền micro → **Cho phép**. Nếu lỡ từ chối: Cài đặt iPhone → Safari → Micro (hoặc *Cài đặt trang web*) → cho phép.
- iOS có thể xóa dữ liệu của trang web **không mở trong nhiều tuần**. App ở Màn hình chính ít bị hơn, nhưng vẫn nên sao lưu định kỳ (mục 7).

## 5. Access + PWA trên iPhone

Cách app chạy khi đã cài:
- Sau lần mở đầu, **service worker** giữ toàn bộ app và nội dung trên máy. Mở app là chạy từ bộ nhớ máy, **không cần mạng và không cần phiên Access còn hạn**. Vì vậy dù phiên Access hết hạn, bạn **vẫn ôn bình thường**, tiến độ không mất.
- Thứ duy nhất cần phiên Access còn hạn là **tải bản mới**. Khi phiên hết hạn, app lặng lẽ không cập nhật được (không báo lỗi) và tiếp tục chạy bản cũ.

Nên:
- Đặt *Session Duration* của ứng dụng Access dài (1 tháng) như bước 2.

Khi muốn đăng nhập lại để lấy bản mới (dấu hiệu: số *Phiên bản* ở trang **Cài đặt** không đổi sau khi đã có bản mới):
- **Cách A (khi app đã có nút)**: repo đã cấu hình để đường dẫn `/dang-nhap` **luôn đi ra mạng**, không lấy từ bộ nhớ máy. Mở đường dẫn này *từ bên trong app* (dự kiến S8 thêm nút "Đăng nhập lại / kiểm tra bản mới" ở trang Cài đặt trỏ tới `./dang-nhap`) → Access hiện trang đăng nhập → nhập mã email → app mở lại và tự cập nhật.
- **Cách B (luôn làm được)**: trong app → Cài đặt → **Xuất tiến độ** (lưu file vào *Tệp*) → xóa app khỏi Màn hình chính → làm lại mục 4 → mở app mới → Cài đặt → **Nhập từ file…** chọn file vừa lưu.
- Trên máy tính (Chrome/Edge/Safari): chỉ cần mở `https://…pages.dev/dang-nhap`, hoặc xóa dữ liệu trang rồi mở lại.

Nếu app mở ra **trắng** hoặc kẹt ở trang đăng nhập không nhận mã: thoát hẳn app (vuốt lên khỏi màn hình đa nhiệm) rồi mở lại; vẫn lỗi thì làm Cách B.

## 6. Cập nhật phiên bản mới

- Bạn không phải làm gì trên Cloudflare: merge PR vào `main` là Cloudflare tự build bản mới (xem tab *Deployments* của project).
- Trên iPhone: mở app **khi có mạng** (và phiên Access còn hạn). App tự kiểm tra bản mới (`registerType: autoUpdate`), tải về nền, rồi **tự tải lại trang** sau vài giây. Nếu chưa thấy: thoát hẳn app rồi mở lại; đôi khi cần mở 2 lần.
- Kiểm tra: trang **Cài đặt** → dòng *Phiên bản*. (Số này lấy từ `version` trong `package.json`; nhớ tăng số khi phát hành để dễ nhận biết.)
- Cập nhật **không xóa** tiến độ: tiến độ nằm trong IndexedDB, tách khỏi phần code.
- Muốn quay về bản cũ: Cloudflare → project → *Deployments* → chọn bản cũ → **Rollback to this deployment**.

## 7. Sao lưu tiến độ

Tiến độ và ghi âm **chỉ nằm trên máy** (IndexedDB). Xóa app khỏi Màn hình chính, xóa dữ liệu Safari, đổi máy, hoặc iOS dọn bộ nhớ đều **mất tiến độ** nếu chưa sao lưu.

Trước khi xóa app hoặc đổi máy:
1. Mở app → **Cài đặt** → **Xuất tiến độ (.json)**.
2. iPhone hỏi tải file / hiện bản xem trước → bấm **Tải về** hoặc nút **Chia sẻ** → **Lưu vào Tệp** → *iCloud Drive* (hoặc *Trên iPhone*). Giữ lại vài bản gần nhất. Nếu bấm Xuất trong app ở Màn hình chính mà không thấy gì xảy ra: **đừng xóa app**, báo lại để sửa (mở link trong Safari không lấy được tiến độ này, vì Safari có bộ nhớ riêng).
3. Ở máy/app mới: **Cài đặt** → **Nhập từ file…** → chọn file → xác nhận.

Nên xuất định kỳ, vd mỗi tuần một lần. File có tiến độ ôn của bạn; không gửi lên chỗ công khai. (File sao lưu hiện chưa gồm bản ghi âm luyện nói.)

## 8. Cách thay thế: deploy bằng lệnh

Dùng khi không muốn cho Cloudflare đọc repo GitHub. Cần Node 22 trên máy tính.

```bash
npm ci
npm run build
npx wrangler pages deploy dist --project-name on-moi-ngay-7k2 --branch main
```

- Lần đầu `wrangler` mở trình duyệt để đăng nhập Cloudflare; nếu project chưa có, nó hỏi tạo mới → đồng ý, production branch `main`.
- File `_headers`, `robots.txt` trong `dist/` được dùng như khi nối Git.
- **Vẫn phải làm bước 2 (Access)** trước khi dùng.
- Mỗi lần có bản mới, chạy lại 2 lệnh `npm run build` và `npx wrangler pages deploy …`.

## 9. Những gì repo đã cấu hình sẵn

| File | Việc |
|---|---|
| `public/_headers` | Header Cloudflare Pages: CSP chỉ `'self'` (không script/style ngoài, cho `data:`/`blob:` với ảnh, font, âm thanh ghi âm), `Permissions-Policy` chỉ cho micro của chính app, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex`. Cache: `/assets/*` (tên có hash) cache 1 năm `immutable`; `/`, `index.html`, `sw.js`, `manifest.webmanifest` luôn `no-cache` để bản mới về ngay. |
| `public/robots.txt` | Chặn mọi bot (thêm một lớp; Access mới là lớp chính). |
| `vite.config.ts` | `vite preview` đọc `public/_headers` (qua `scripts/cf-headers.ts`) nên chạy thử/Playwright có đúng header như trên Cloudflare. Manifest tải kèm cookie (`crossorigin="use-credentials"`) để không bị Access chặn. Service worker không trả bản cache cho `/cdn-cgi/*` và `/dang-nhap`. |
| `.node-version` | Node 22 cho máy build Cloudflare. |

Không cần `_redirects`: app điều hướng bằng `#` (vd `#tra-cuu`) nên mọi trang đều là `index.html`. Đường dẫn lạ (vd `/dang-nhap`) Cloudflare Pages tự trả `index.html` vì repo không có `404.html`.

### Chạy thử header ở máy

```bash
npm run build && npx vite preview   # http://localhost:4173, có header như Cloudflare
npm run test:e2e                    # Playwright Chromium (iPhone 14, iPhone SE)
PW_WEBKIT=1 npm run test:e2e        # thêm WebKit (engine của Safari); cần: npx playwright install --with-deps webkit
```

CI (GitHub Actions) luôn chạy cả Chromium và WebKit.
