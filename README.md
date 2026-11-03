# daily-study

App ôn luyện Total Rewards + tiếng Anh mỗi ngày (PWA, chạy trên Safari iPhone và trình duyệt máy tính).
Repo **private** — xem quy tắc trong [CLAUDE.md](CLAUDE.md) và kế hoạch trong [docs/PLAN.md](docs/PLAN.md).

## Chạy thử

```bash
npm install
npm run dev          # http://localhost:5173 (thêm --host để mở từ iPhone cùng mạng Wi‑Fi)
```

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript strict |
| `npm test` | Vitest (logic, `tests/unit/`) |
| `npm run test:e2e` | Playwright, giả lập iPhone 14 và iPhone SE (`tests/e2e/`) |
| `npm run build` | Bản build PWA vào `dist/` |
| `npm run preview` | Xem bản build (có service worker, chạy offline) |
| `npm run validate:content` | Kiểm tra dữ liệu trong `content/` |
| `npm run icons` | Sinh lại icon PNG từ `public/icons/icon.svg` |

Lần đầu chạy e2e cần tải trình duyệt: `npx playwright install chromium`.
Nếu máy đã có sẵn Chromium khác phiên bản, đặt `PW_CHROMIUM_PATH=/đường/dẫn/chrome`.
