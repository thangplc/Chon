# Repository structure

Chốn là pnpm workspace theo mô hình modular monolith với hai deployable app và
các package dùng chung có ownership rõ ràng.

```text
apps/
  web/                 Next.js, UI/map, web tests, frontend scripts/config
  api/                 NestJS, DB/Drizzle, data pipeline, provider và BE tooling

packages/
  contracts/           Zod transport contracts được web validate tại boundary
  domain/              Pure Explore, Place Detail và spatial domain functions

scripts/               Chỉ workspace orchestration
data/                  Fixture/template và local source objects bị ignore
docs/                  Product, architecture và operational runbooks
prototype/             Prototype Sprint 0, không phải production source
```

## Dependency rules

```text
apps/web → packages/contracts + packages/domain
apps/api → packages/domain
packages/* → không import apps/*
root scripts → chỉ khởi chạy apps, không chứa business/infrastructure code
```

- `apps/web` không import `apps/api`, `pg`, Drizzle hoặc database credential.
- `apps/api` không import code từ `apps/web`.
- Package không import code từ `apps/*`.
- Database schema/query, data pipeline, provider registry và operator scripts là
  backend-only, nằm trong `apps/api`.
- SQL migration và journal nằm trong `apps/api/drizzle`; việc di chuyển folder
  không sửa migration history.
- MapLibre worker preparation và frontend-only tooling nằm trong `apps/web`.
- Next.js chỉ đọc `apps/web/.env`; NestJS, Drizzle, Docker Compose và operator
  scripts chỉ đọc `apps/api/.env`. Không tạo `.env.local` hoặc root `.env`.
- Production inject env/secret riêng cho từng deployable app; browser chỉ nhận
  biến có prefix `NEXT_PUBLIC_`.
- `data`, `docs` và `prototype` không được bundle vào web/API runtime.

## Commands

Chạy từ repository root:

```bash
pnpm dev             # web + API
pnpm dev:web         # chỉ web
pnpm dev:api         # chỉ API
pnpm test            # packages + web + API
pnpm typecheck       # shared packages + web + API/tooling
pnpm build           # production build web + API
pnpm build:web       # chỉ build web
pnpm build:api       # chỉ build API
pnpm start:web       # chạy web production sau khi build
pnpm start:api       # chạy API production sau khi build
pnpm --filter @chon/web format:check
pnpm --filter @chon/api format:check
```

Mỗi app có `README.md`, `.env.example`, `package.json` và
`prettier.config.mjs` riêng. Root Prettier config chỉ áp dụng cho shared
packages/docs/workspace files.
