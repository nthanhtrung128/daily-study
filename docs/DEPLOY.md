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
10. [Danh sách kiểm tra trên iPhone thật](#10-danh-sách-kiểm-tra-trên-iphone-thật)

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
   | Project name | `daily-study` → bản đang chạy tại `https://daily-study-6en.pages.dev` |
   | Production branch | `main` |
   | Framework preset | `None` (hoặc `Vite`, miễn là 2 dòng dưới đúng) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | để trống |

5. Mở **Environment variables (advanced)** → thêm biến `NODE_VERSION` = `22`. (Repo cũng có file `.node-version` ghi `22`; đặt thêm biến cho chắc.)
6. Bấm **Save and Deploy**. Chờ 1–3 phút tới khi thấy *Success*.
7. **Chưa mở link vội** — làm ngay bước 2.

Sau này, mỗi lần PR được merge vào `main`, Cloudflare tự build và cập nhật. Mỗi PR/nhánh khác cũng được build thành một link xem trước dạng `https://<mã>.daily-study-6en.pages.dev` — các link này **cũng chứa dữ liệu TR**, nên bước 2 phải bảo vệ cả chúng.

### Tắt những thứ Cloudflare có thể tự chèn vào trang
App cấm script ngoài (CSP chặt, xem mục 9), và theo `CLAUDE.md` không được có analytics:
- Project → **Metrics** (hoặc *Analytics*) → **Web Analytics**: để **tắt**.
- Nếu sau này gắn tên miền riêng: trong zone của tên miền, **không** bật Rocket Loader, Zaraz, Email Address Obfuscation, Web Analytics. Các tính năng này chèn script, sẽ bị CSP chặn và có thể làm lỗi trang.

## 2. Bật Cloudflare Access

1. Ở dash.cloudflare.com, mở **Zero Trust** (menu trái). Lần đầu sẽ được hỏi:
   - *Team name*: đặt tên bất kỳ, vd `ten-ban-hoc` → trang đăng nhập sẽ là `ten-ban-hoc.cloudflareaccess.com`.
   - Chọn gói **Free** ($0). Cloudflare có thể đòi nhập thẻ thanh toán dù gói miễn phí; không bị trừ tiền với gói Free.
2. **Cách đăng nhập**: Trong **Zero Trust → Integrations → Identity providers**, kiểm tra **One-time PIN** để nhận mã qua email. Nếu chưa có, chọn **Add new identity provider** rồi chọn **One-time PIN**.
3. Mở **Zero Trust → Access controls → Applications**. Chọn ứng dụng đang bảo vệ `daily-study-6en.pages.dev` để kiểm tra cấu hình. Khi thiết lập lần đầu, chọn **Create new application → Self-hosted and private**.
   - *Application name*: `On moi ngay`.
   - *Session Duration*: chọn dài, vd **1 month** (xem mục 5 để hiểu vì sao).
   - **Add public hostname** (thêm đủ hai tên miền):
     1. Subdomain trống, Domain `daily-study-6en.pages.dev` (bản chính).
     2. Subdomain `*`, Domain `daily-study-6en.pages.dev` (mọi link xem trước của PR).
   - Nếu có tên miền riêng, thêm dòng thứ 3 cho tên miền đó.
4. **Tạo policy** (bước tiếp theo của trình tạo, hoặc tab *Policies*):
   - *Policy name*: `Chi minh toi`, *Action*: **Allow**.
   - *Include* → *Selector* **Emails** → *Value*: **`<EMAIL_CUA_BAN>`** ← thay bằng đúng email bạn dùng để nhận mã (vd email cá nhân). **Chỉ điền ở Cloudflare, không ghi email vào repo.**
   - Không thêm dòng nào khác (đừng chọn *Everyone*, đừng chọn *Emails ending in* `@gmail.com`).
5. *Login methods* của ứng dụng: chỉ tick **One-time PIN**; có thể bật *Instant Auth* (bỏ qua màn chọn cách đăng nhập).
6. Phần *Settings/Advanced* (cookie): để mặc định. **Không** bật *Binding Cookie* (dễ làm hỏng đăng nhập trên app ở Màn hình chính).
7. **Save**.

> Cách khác: trong project Pages → **Settings** → **General** → *Access policy* → **Enable access policy**. Nút này chỉ bảo vệ **link xem trước**, không bảo vệ bản chính, nên vẫn phải làm như trên cho domain chính. Làm theo bước 3 (có dòng `*`) là đủ cả hai.

Hướng dẫn của Cloudflare: [Ứng dụng self-hosted](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/) · [One-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/).

## 3. Kiểm tra sau khi deploy

Dùng **cửa sổ ẩn danh** trên máy tính:

1. Mở `https://daily-study-6en.pages.dev` → phải thấy **trang đăng nhập Cloudflare Access**, không thấy app.
2. Thử mở thẳng file: `https://daily-study-6en.pages.dev/manifest.webmanifest`, `/sw.js`, `/robots.txt` → cũng phải ra trang đăng nhập (không ai tải được file khi chưa đăng nhập).
3. Nhập email của bạn → nhận mã 6 số trong hộp thư → nhập → vào được app.
4. Thử một email khác (nếu có) → kiểm tra rằng email ngoài danh sách cho phép không thể vào app.
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

Trong **Cài đặt → Tài khoản**, bấm **Đăng nhập qua Cloudflare** để mở Access qua mạng. Nếu phiên còn hiệu lực, app quay về mục Tài khoản ngay. Nếu Access yêu cầu mã, dùng email đã được cấp quyền ở mục 2. Bấm **Kiểm tra phiên** để xem email do Access vừa xác nhận, rồi chọn **Đăng xuất Cloudflare** khi cần kết thúc phiên trực tuyến. Kiểm tra phiên chỉ gửi yêu cầu đến tên miền của app khi bạn bấm nút. Khi mất mạng, bạn vẫn đọc bài và ghi memo trên thiết bị đã tải app. Memo, tiến độ và ghi âm vẫn ở trên thiết bị sau khi đăng xuất.

Để lấy bản mới khi phiên Access hết hạn, kết nối mạng rồi mở **Cài đặt → Dữ liệu → Kiểm tra bản mới / đăng nhập lại**. Nút mở `/dang-nhap` qua mạng. Nhập mã email nếu Access yêu cầu. Sau khi app tải xong bản mới, làm theo mục 6. Khi máy đang ngoại tuyến, nút báo “Đang không có mạng”.

Trên máy tính, có thể mở trực tiếp `https://daily-study-6en.pages.dev/dang-nhap`. Nếu kẹt ở trang đăng nhập trên iPhone, thoát hẳn app rồi mở lại. Nếu cần cài lại hoặc xóa dữ liệu trang, trước hết hãy xuất tiến độ, kèm ghi âm nếu có, và kiểm tra tệp đã lưu theo mục 7.

## 6. Cập nhật phiên bản mới

- Sau khi PR vào `main`, mở **Workers & Pages → daily-study → Deployments** để kiểm tra bản production đã triển khai thành công và đúng commit.
- Mở app trên iPhone khi có mạng và phiên Access còn hạn. Khi bản mới đã tải xong, dải **Có bản mới** xuất hiện bên ngoài phiên ôn. Nếu đang ôn, tiếp tục đến màn kết quả.
- Chọn **Cập nhật** để tải lại app và dùng bản mới. Chọn **Để sau** để ẩn dải trong lần mở app này. Nếu đổi ý, vào **Cài đặt → Dữ liệu → Cập nhật ngay**. Tiến độ, cài đặt và ghi âm vẫn nằm trong IndexedDB trên máy.
- Dòng *Phiên bản* trong Cài đặt lấy số từ `package.json`. Nhiều lần triển khai có thể dùng cùng một số. Để kiểm tra trên iPhone, mở tính năng vừa phát hành sau khi bấm cập nhật.
- Khi cần khôi phục một bản production trước, vào **Deployments**, mở menu **⋯** của lần triển khai thành công muốn dùng, chọn **Rollback to this deployment** và xác nhận. [Hướng dẫn khôi phục của Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/rollbacks/).

## 7. Sao lưu tiến độ

Tiến độ và ghi âm **chỉ nằm trên máy** (IndexedDB). Xóa app khỏi Màn hình chính, xóa dữ liệu Safari, đổi máy, hoặc iOS dọn bộ nhớ đều **mất tiến độ** nếu chưa sao lưu.

Trước khi xóa app hoặc đổi máy:
1. Mở app → **Cài đặt** → **Xuất tiến độ (.json)**.
2. Trong **app ở Màn hình chính**: app mở **bảng Chia sẻ** → chọn **Lưu vào Tệp** → *iCloud Drive* (hoặc *Trên iPhone*). Nếu app hiện thêm nút **Lưu file sao lưu** (iOS đòi bấm thêm một lần) thì bấm nút đó. Trong **Safari**: iPhone hỏi tải file → **Tải về**, file nằm trong Tệp → *Tải về*. Giữ lại vài bản gần nhất. Nếu vẫn không thấy gì xảy ra: **đừng xóa app**, báo lại để sửa (mở link trong Safari không lấy được tiến độ này, vì Safari có bộ nhớ riêng).
3. Ở máy/app mới: **Cài đặt** → **Nhập từ file…** → chọn file → xác nhận.

Nên xuất định kỳ. App tự nhắc trên trang **Hôm nay** khi đã quá **14 ngày** chưa xuất (đổi 7 / 14 / 30 ngày hoặc tắt ở **Cài đặt → Nhắc sao lưu**; bấm **Để sau** thì ẩn 3 ngày). Cài đặt hiện **Lần sao lưu gần nhất** trên máy này. File có tiến độ ôn của bạn; không gửi lên chỗ công khai.

**Bản ghi âm:** khi trên máy có ghi âm “Đề nói 1 phút”, bấm nút **Kèm bản ghi âm (≈ X MB)** trước khi xuất để đưa ghi âm vào file (âm thanh mã hóa base64 trong cùng file JSON, file lớn hơn khoảng 1/3 so với dung lượng ghi âm). Khi nhập: **Thay thế** dùng đúng các bản ghi trong file, **Gộp** chỉ thêm bản chưa có. File không kèm ghi âm (kể cả file cũ) thì ghi âm trên máy được giữ nguyên. App cảnh báo khi file trên 50 MB: nên xóa bớt bản ghi cũ trước khi xuất.

## 8. Cách thay thế: deploy bằng lệnh

Dùng khi không muốn cho Cloudflare đọc repo GitHub. Cần Node 22 trên máy tính.

```bash
npm ci
npm run build
npx wrangler pages deploy dist --project-name daily-study --branch main
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

## 10. Danh sách kiểm tra trên iPhone thật

Test tự động (Playwright giả lập iPhone 14 / iPhone SE, cả WebKit) đã kiểm bố cục, offline, header, luồng bấm. Những mục dưới đây **chỉ kiểm được trên iPhone thật** (giọng đọc, micro, nhận giọng, Lịch, Tệp). Làm một lượt sau lần deploy đầu, và sau mỗi lần nâng iOS lớn. Đánh dấu ☐ → ☑.

### A. Cài đặt và mở app
- ☐ Safari → link app → đăng nhập Access bằng mã email → thấy trang **Hôm nay**, không lỗi.
- ☐ Để yên ~10 giây, rồi **Chia sẻ → Thêm vào MH chính** (mục 4). Biểu tượng hiện đúng (nền xanh, không bị cắt viền), tên "Ôn mỗi ngày".
- ☐ Mở từ biểu tượng: app chạy toàn màn hình (không có thanh địa chỉ); nếu phải đăng nhập Access lần nữa thì nhập mã như mục 4.
- ☐ Tai thỏ / Dynamic Island và thanh Home không che chữ hay nút (đầu trang, cuối trang, khi cuộn). Xoay ngang (nếu máy cho) không vỡ bố cục.
- ☐ Không có trang nào cuộn ngang được bằng ngón tay (thử vuốt trái/phải ở cả 4 tab và trong màn ôn).

### B. Offline
- ☐ Sau lần mở đầu có mạng: bật **Chế độ máy bay** → thoát hẳn app (vuốt khỏi đa nhiệm) → mở lại. App vẫn lên, đủ 4 tab.
- ☐ Khi offline: bắt đầu phiên **Hôm nay**, ôn TR, thẻ từ, câu mẫu, shadowing một hội thoại, tra cứu "touch base", mở Tiến độ → đều chạy; chấm vài mục, thoát app, mở lại → tiến độ còn.
- ☐ Khi offline, Cài đặt → **Kiểm tra bản mới / đăng nhập lại** chỉ báo "Đang không có mạng".

### C. Giọng đọc tiếng Anh (TTS)
- ☐ Cài giọng tốt (miễn phí, chạy offline): **Cài đặt iPhone → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Anh** → tải một giọng có nhãn **Nâng cao** (*Enhanced*) hoặc **Cao cấp** (*Premium*). Gợi ý: Mỹ — *Ava (Cao cấp)*, *Zoe (Cao cấp)*, *Evan (Nâng cao)*, *Samantha (Nâng cao)*; Anh — *Serena (Cao cấp)*, *Daniel (Nâng cao)*, *Kate (Nâng cao)*. Mỗi giọng khoảng 100–400 MB, nên tải qua Wi‑Fi. (Giọng "Siri" không dùng được cho trang web.) Tên menu có thể hơi khác giữa các bản iOS.
- ☐ Sau khi tải giọng: thoát hẳn app rồi mở lại (Safari chỉ đọc danh sách giọng lúc mở).
- ☐ Cài đặt (trong app) → **Giọng Mỹ / Giọng Anh**, tốc độ **0,75× / 0,85× / 1×** → **Nghe thử**: nghe đúng giọng, đúng tốc độ; giọng tự nhiên (không phải giọng robot/hiệu ứng).
- ☐ Nút **gạt im lặng** (Ring/Silent) đang bật im lặng: kiểm xem vẫn nghe được (iOS có thể tắt tiếng TTS trang web khi gạt im lặng — nếu không nghe, gạt sang chuông).
- ☐ Đang đọc mà bấm sang tab khác / về Màn hình chính → tiếng dừng ngay.
- ☐ Shadowing: phát một hội thoại, câu nghỉ để nhại, **Lặp câu**, **Ẩn chữ**, câu trước / sau đều chạy; khóa màn hình giữa chừng → dừng, không đọc tiếp nền.

### D. Micro, nhận giọng (Safari cần mạng), ghi âm
- ☐ Lần đầu bấm **Nói thử** (thẻ câu mẫu hoặc Luyện nói): iPhone hỏi quyền **Micro** và **Nhận dạng giọng nói** → **Cho phép**. Từ chối thử một lần → app báo hướng dẫn tiếng Việt; bật lại trong Cài đặt iPhone → Safari → Micrô (hoặc **aA** → Cài đặt trang web).
- ☐ **Nhận giọng cần mạng** (Safari gửi âm thanh tới máy chủ Apple): có mạng → nói câu mẫu → hiện chữ, điểm %, tô từ sai/thiếu. Tắt mạng → bấm Nói thử → app báo "cần mạng" và hiện ô gõ / đọc chính tả.
- ☐ Nói xong im lặng: Safari tự dừng sau vài giây; bấm **Dừng** cũng chấm ngay. Chấm đúng mức: nói chuẩn ≥ 90% → Nhớ rõ.
- ☐ **Đề nói 1 phút**: chọn đề → **Bắt đầu ghi âm** → chấm cam/đỏ "đang dùng micro" hiện trên thanh trạng thái → đếm ngược chạy → hết giờ tự lưu (hoặc **Dừng & lưu**) → chấm micro **tắt ngay**.
- ☐ Nghe lại bản ghi ngay trong app (nút ▶ của trình phát), tua được; **Tải về** lưu file `.m4a` vào Tệp; **Xóa** (bấm 2 lần) xóa được.
- ☐ Đang ghi âm thì về Màn hình chính hoặc chuyển tab trong app → ghi âm dừng, phần đã ghi được lưu, chấm micro tắt.
- ☐ Thoát app, mở lại → bản ghi vẫn còn.
- ☐ Bật **VoiceOver** (tùy chọn): đếm ngược chỉ đọc các mốc (30, 20, 10, 5 giây), điểm luyện nói được đọc khi chấm xong.

### E. Nhắc lịch (.ics)
- ☐ Cài đặt → chọn giờ nhắc + ngày → **Tải file nhắc lịch (.ics)** → iPhone hiện bản xem trước sự kiện → **Thêm tất cả** → chọn lịch → **Xong**.
- ☐ Mở app **Lịch**: sự kiện lặp lại đúng các ngày đã chọn, đúng giờ Việt Nam, có báo nhắc; bấm vào sự kiện thấy link mở app.
- ☐ Nếu bấm tải trong app ở Màn hình chính mà không thấy gì: mở cùng link bằng Safari và tải ở đó (file .ics không chứa tiến độ).

### F. Sao lưu / khôi phục
- ☐ Trong app ở Màn hình chính: Cài đặt → **Xuất tiến độ (.json)** → bảng Chia sẻ hiện ra (hoặc nút **Lưu file sao lưu** → bấm) → **Lưu vào Tệp** (iCloud Drive). Mở file trong Tệp xem được nội dung JSON.
- ☐ **Nhập từ file…** → chọn file vừa lưu → bảng xác nhận hiện đúng số mục / lượt ôn → **Gộp** → báo thành công, số liệu Tiến độ không đổi.
- ☐ Có ghi âm: bật **Kèm bản ghi âm** → xuất → nhập lại file đó bằng **Gộp** → số bản ghi không tăng; nghe lại được bản ghi trong “Đề nói 1 phút”.
- ☐ Sau khi xuất: Cài đặt hiện **Lần sao lưu gần nhất: <ngày giờ hôm nay>**; trang Hôm nay không còn dải nhắc sao lưu.
- ☐ (Một lần, khi đổi máy) Thử **Thay thế** trên app mới cài → tiến độ giống máy cũ.
- ☐ Nếu còn Sổ ôn bản cũ: dán state cũ (**Dán JSON**) → xác nhận → tiến độ cũ hiện trong Tiến độ.

### G. Giao diện tối, cỡ chữ, chuyển động
- ☐ Cài đặt iPhone → Màn hình & Độ sáng → **Tối**: app (chế độ *Theo máy*) chuyển tối, thanh trạng thái tối theo; chữ, nút đỏ (Thay thế, đang ghi âm), thẻ xanh/vàng đều đọc rõ.
- ☐ Trong app chọn **Sáng** khi máy đang tối (và ngược lại): app và thanh trạng thái theo lựa chọn trong app; thoát mở lại vẫn giữ.
- ☐ **Cỡ chữ theo máy (Dynamic Type)**: trong app để Cài đặt → Cỡ chữ = **Theo máy**. Cài đặt iPhone → Màn hình & Độ sáng → **Cỡ chữ**, kéo thanh trượt lên/xuống → quay lại app (không cần mở lại): chữ trong app to/nhỏ theo. Ở mức mặc định chữ app khoảng 17 pt (bằng chữ của app Cài đặt), hơi to hơn bản cũ (15 px) — muốn như cũ thì chọn **Vừa**.
- ☐ **Chữ rất lớn**: Cài đặt iPhone → Trợ năng → Màn hình & Cỡ chữ → **Chữ lớn hơn** → bật *Cỡ chữ lớn hơn*, kéo tới 2–3 nấc cuối. Đi qua Hôm nay, một phiên ôn (thẻ lật, nút Quên/Mơ hồ/Nhớ rõ), Shadowing, Tra cứu, Tiến độ, Cài đặt: không phải cuộn ngang, chữ không bị cắt hay che, thanh tab xuống 2 hàng và bấm được (thanh trên thôi dính đầu màn khi chữ quá to), ô thống kê tự xuống hàng. Tắt lại sau khi thử.
- ☐ Trong app chọn **Rất lớn** (rồi **Nhỏ**): chữ đổi ngay; thoát hẳn app mở lại vẫn giữ cỡ đã chọn, không thấy nháy cỡ chữ lúc mở. Chọn tay thì app bỏ qua cỡ chữ của máy; chọn lại **Theo máy** để theo máy.
- ☐ Bật **Trợ năng → Chuyển động → Giảm chuyển động**: thẻ mới hiện ngay, không trượt.

### H. Dữ liệu, cập nhật
- ☐ Khi có bản mới, mở app có mạng. Nếu đang ôn, hoàn tất phiên. Khi thấy **Có bản mới**, bấm **Để sau** và kiểm tra app tiếp tục hoạt động. Vào **Cài đặt → Dữ liệu → Cập nhật ngay**; sau khi app tải lại, kiểm tra tính năng vừa phát hành và tiến độ cũ. Nếu cần đăng nhập lại, làm theo mục 5.
- ☐ Nếu app báo **"Không mở được bộ nhớ trên máy"** hoặc **"Bộ nhớ máy đã đầy"**: đang dùng Duyệt web riêng tư hoặc iPhone hết dung lượng — tiến độ lần đó **không được lưu**; xử lý theo hướng dẫn trong thông báo rồi Xuất tiến độ.

Gặp lỗi: ghi lại bước làm, bản iOS (Cài đặt → Cài đặt chung → Giới thiệu), chụp màn hình, rồi báo để sửa.

