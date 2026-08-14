# Chốn API

NestJS REST API owns runtime access to PostgreSQL/PostGIS. Next.js calls this
service and does not query the database from request paths.

## Ownership

```text
src/database/       Drizzle schema/client/PostGIS queries và Nest DB module
src/data-pipeline/  CSV/boundary validation và transactional importer
src/providers/      Third-party provider flags, policy và registry
drizzle/            Versioned SQL, snapshots và migration journal
scripts/            Data/DB/provider operator entrypoints
compose.yaml        Local PostgreSQL/PostGIS
```

Không đặt các phần này trong root `packages`: chúng chỉ thuộc backend. API chỉ
dùng `packages/domain` cho business rules dùng chung với web.

## Environment local

From the repository root:

```bash
cp apps/api/.env.example apps/api/.env
```

Các biến tối thiểu cần kiểm tra:

```ini
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
API_PORT=3001
API_CORS_ORIGINS=http://localhost:3000
DATA_IMPORT_TARGET_ENVIRONMENT=local
```

Không đặt MapTiler browser key trong API env.

## Chạy riêng backend

```bash
pnpm db:up
pnpm db:migrate
pnpm dev:api
```

Các quality command:

```bash
pnpm test:api
pnpm typecheck:api
pnpm build:api
pnpm --filter @chon/api format:check
```

Production build và start riêng API:

```bash
pnpm build:api
pnpm start:api
```

## Chạy cả frontend và backend

```bash
cp apps/web/.env.example apps/web/.env
pnpm db:up
pnpm db:migrate
pnpm dev
```

`pnpm dev` chạy đồng thời NestJS và Next.js. Port API được lấy từ `API_PORT`;
web kết nối qua `BACKEND_API_URL`. Command này không tự khởi tạo/xóa database
volume; PostgreSQL được quản lý riêng bằng `pnpm db:up` và `pnpm db:down`.

## Endpoints

- `GET /v1/health`
- `GET /v1/places?bbox=west,south,east,north&limit=50`
- `GET /v1/places?lat=10.775&lng=106.700&radius=1500&limit=50`
- `GET /v1/places/:slug`
- `GET /v1/explore/simulated`
- `GET /openapi.json`
- `GET /docs`

## Environment

The API reads `apps/api/.env`, including the discrete `DATABASE_*` variables and:

```text
API_HOST=0.0.0.0
API_PORT=3001
API_CORS_ORIGINS=http://localhost:3000
```

Production does not use permissive CORS defaults. Set every allowed web origin
explicitly and keep database credentials/provider tokens in the API deployment
only. Drizzle, Docker Compose and this app's data/operator scripts use the same
API environment file; Next.js does not load it.

Root commands như `pnpm db:migrate`, `pnpm data:import` và
`pnpm provider:status` chỉ delegate vào scripts/tooling của app này.
