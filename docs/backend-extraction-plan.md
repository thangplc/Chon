# Backend extraction plan

Trạng thái: **cutover và workspace extraction hoàn thành 2026-08-14**.

Sprint 3 vẫn tạm dừng sau khi tách backend để review lại scope trên kiến trúc
mới. Không tự động tiếp tục feature chỉ vì cutover gate đã hoàn tất.

## Quyết định

- Frontend: Next.js App Router.
- Backend API: NestJS, REST dưới prefix `/v1`, OpenAPI là contract công khai.
- Database: giữ PostgreSQL 17 + PostGIS 3.5.
- Data access: giữ Drizzle ORM + `node-postgres`; không đổi ORM trong migration.
- Repository: pnpm workspace; Next.js ở `apps/web`, NestJS ở `apps/api` và
  shared code trong `packages/*`.
- Next.js không được truy cập database sau cutover. Route `/api/*` của Next.js
  chỉ được giữ làm same-origin proxy khi browser cần nó.
- Importer, migration và operational scripts tiếp tục dùng schema Drizzle hiện
  có; không rewrite data pipeline trong backend extraction.

## Target architecture

```text
Browser
  → Next.js web / same-origin proxy
  → NestJS REST API
  → application/domain services
  → Drizzle ORM + node-postgres
  → PostgreSQL/PostGIS

Operator scripts
  → Drizzle schema / migration / importer
  → PostgreSQL/PostGIS
```

## Phases

### Phase 1 — Foundation

- [x] Khởi tạo pnpm workspace và `apps/api`.
- [x] Cấu hình NestJS, environment validation và graceful shutdown.
- [x] Đăng ký `pg.Pool` và Drizzle bằng Nest custom providers.
- [x] Thêm `/v1/health` và OpenAPI document.
- [x] Bổ sung API typecheck, test và build vào CI.

### Phase 2 — Read API cutover

- [x] Chuyển bbox/radius place query sang `GET /v1/places`.
- [x] Giữ `/api/places` ở Next.js làm proxy tương thích cho browser.
- [x] Chuyển simulated Explore dataset sang `GET /v1/explore/simulated`.
- [x] Chuyển Place Detail sang `GET /v1/places/:slug`.
- [x] Next Server Components chỉ đọc qua API client có response validation.

### Phase 3 — Boundary enforcement

- [x] Không còn import database client trong `apps/web/src/app` hoặc UI feature
  repositories.
- [x] Database credentials không còn là runtime requirement của Next web.
- [x] API contract/error mapping có regression tests.
- [x] Web và API build độc lập.
- [x] HTTP integration smoke test qua cả Nest API và Next proxy.

### Phase 4 — Shared extraction và ownership refinement

- [x] Đưa canonical schema/query, SQL migration và journal về `apps/api` vì chỉ
  backend sở hữu; giữ nguyên nội dung/thứ tự migration history đã áp dụng.
- [x] Chuyển request/response Zod schemas sang `packages/contracts`.
- [x] Chuyển pure Explore, Place Detail và spatial functions hiện có sang
  `packages/domain`.
- [x] Đưa data pipeline, provider registry, Compose và operator scripts về
  `apps/api`; đưa MapLibre asset preparation về `apps/web`.

Contract response được validate tại Next boundary qua `packages/contracts`.
OpenAPI response DTO/schema chi tiết hơn vẫn có thể được bổ sung độc lập khi API
mở rộng, không thay đổi deployment boundary hiện tại.

## Cutover gate

Migration chỉ được coi là hoàn tất khi:

1. `/v1/health`, spatial places, Explore dataset và Place Detail hoạt động từ
   NestJS.
2. Next.js không query PostgreSQL trực tiếp trong request path.
3. Existing web tests, API tests, typecheck, lint và production build đều pass.
4. Spatial query verification và database schema verification vẫn pass.
5. Tài liệu environment, local commands và deployment boundary đã cập nhật.

## Verification evidence

- Shared packages: 2 test files, 15 tests pass.
- Web: 9 test files, 41 tests pass.
- API: 10 test files, 48 tests pass, gồm database/data/provider tests do backend
  sở hữu.
- `format:check`, `lint`, web/API `typecheck` và `build:all` pass.
- `db:check`, core schema verification và bbox/radius spatial verification pass.
- HTTP smoke pass cho health, spatial places, Explore, Place Detail, Next proxy
  và hai Next page routes.

Cutover gate đã pass. Bước tiếp theo là review lại Sprint 3; roadmap không tự
động tiếp tục và có thể thay đổi theo hoàn cảnh sản phẩm/kỹ thuật lúc đó.
