# Chốn Web

Next.js App Router application for rendering Explore and Place Detail. This app
may consume `@chon/contracts` and `@chon/domain`, but must not import database
clients, Drizzle schema or backend credentials.

## Ownership

```text
src/app/            Next.js routes, layouts và route states
src/features/       Explore/Place Detail UI, hooks và web repositories
src/config/         Browser map và backend URL configuration
scripts/            Frontend-only asset preparation
public/             Static browser assets được generate/serve bởi Next.js
```

Transport schemas và pure domain rules dùng qua web–API nằm trong
`packages/contracts` và `packages/domain`.

## Environment local

```bash
cp apps/web/.env.example apps/web/.env
```

Các biến frontend:

```ini
BACKEND_API_URL=http://127.0.0.1:3001
BACKEND_API_TIMEOUT_MS=5000
SITE_URL=http://localhost:3000
NEXT_PUBLIC_MAPTILER_API_KEY=your_browser_key
NEXT_PUBLIC_MAPTILER_STYLE_ID=streets-v4

AUTH_SECRET=generate-a-long-random-secret
AUTH_TRUST_HOST=false
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_API_SECRET=dev-only-change-this-auth-api-secret-32chars
AUTH_API_ISSUER=chon-web
AUTH_API_AUDIENCE=chon-api
```

Không đặt database credential hoặc provider token trong file này.

## Chạy riêng frontend

Backend phải chạy tại `BACKEND_API_URL`, sau đó chạy từ repository root:

```bash
pnpm dev:web
```

Các quality command:

```bash
pnpm test:web
pnpm typecheck:web
pnpm build:web
pnpm --filter @chon/web format:check
```

Production build và start riêng web:

```bash
pnpm build:web
pnpm start:web
```

## Chạy cả frontend và backend

```bash
cp apps/api/.env.example apps/api/.env
pnpm db:up
pnpm db:migrate
pnpm dev
```

`pnpm dev` chạy đồng thời Next.js và NestJS. Port API được cấu hình bằng
`API_PORT`; web kết nối qua `BACKEND_API_URL`. Dùng `Ctrl+C` để dừng cả hai
runtime.

Server-side requests use `BACKEND_API_URL`; browser spatial requests go through
the same-origin `/api/places` proxy. Next.js loads `apps/web/.env` automatically.
This file only contains web runtime configuration and public browser map values;
database credentials and provider tokens belong exclusively to `apps/api/.env`.

Explore đồng bộ bộ lọc vào URL và có nút `Chia sẻ bộ lọc`. Analytics dùng
anonymous session ID, chỉ gửi context đã chuẩn hóa qua same-origin
`/api/analytics/events`; không gửi tọa độ hoặc raw report text.

Bộ lọc quy mô, tiện ích và giá chỉ là trạng thái đang chọn cho đến khi người
dùng bấm `Áp dụng bộ lọc`. Khi xác nhận, browser gọi same-origin
`/api/explore/simulated`; Next.js proxy chuyển tiếp truy vấn metadata tới NestJS
để lấy dataset mới, sau đó Explore cập nhật ranking và URL canonical.

Selector khu vực đọc động từ `GET /v1/explore/service-areas`. Explore lọc POI
theo `place_service_areas` primary và dùng boundary bounds để fit bản đồ; không
còn allowlist Quận 1, Quận 3 và Bình Thạnh trong source code.

Auth.js Google OAuth dùng các route `/api/auth/*`. `AUTH_API_SECRET` là secret
server-only phải trùng với API để proxy `/api/auth/me` tạo assertion ngắn hạn;
không dùng prefix `NEXT_PUBLIC_` cho secret này. Xem callback URL và security
boundary tại [Authentication](../../docs/authentication.md).

Place Detail có flow `Góp vibe` ba bước cho user đã đăng nhập; report đi qua
same-origin proxy `/api/places/:slug/vibe-reports` và được auto-publish trong
MVP trước khi snapshot của địa điểm được rebuild.

Explore và Place Detail dùng chung `SavePlaceButton`. Dữ liệu được lưu trong
collection private mặc định qua same-origin proxy; `/saved` hiển thị danh sách
của identity hiện tại. Xem [Collections](../../docs/collections.md).

Public collection được server-render tại `/collections/:id`. `SITE_URL` phải là
origin HTTPS thật ở production để canonical URL và Open Graph image dùng đúng
domain khi chia sẻ lên mạng xã hội.
