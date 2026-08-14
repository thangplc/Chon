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
NEXT_PUBLIC_MAPTILER_API_KEY=your_browser_key
NEXT_PUBLIC_MAPTILER_STYLE_ID=streets-v4
```

Không đặt database credential hoặc provider token trong file này.

## Chạy riêng frontend

Backend phải chạy tại `BACKEND_API_URL`, sau đó chạy từ repository root:

```bash
pnpm dev
```

Các quality command:

```bash
pnpm web:test
pnpm web:typecheck
pnpm web:build
pnpm --filter @chon/web format:check
```

## Chạy cả frontend và backend

```bash
cp apps/api/.env.example apps/api/.env
pnpm db:up
pnpm db:migrate
pnpm dev:stack
```

`pnpm dev:stack` là command duy nhất để chạy đồng thời Next.js tại
`http://localhost:3000` và NestJS tại `http://localhost:3001`. Dùng `Ctrl+C` để
dừng cả hai runtime.

Server-side requests use `BACKEND_API_URL`; browser spatial requests go through
the same-origin `/api/places` proxy. Next.js loads `apps/web/.env` automatically.
This file only contains web runtime configuration and public browser map values;
database credentials and provider tokens belong exclusively to `apps/api/.env`.
