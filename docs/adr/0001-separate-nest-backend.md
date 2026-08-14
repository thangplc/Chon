# ADR-0001: Separate NestJS backend

- Status: accepted
- Date: 2026-08-14

## Context

Chốn bắt đầu bằng Next.js full-stack modular monolith. Trước khi triển khai
authentication, contribution, provider ingestion và vibe aggregation, dự án
chọn tách server runtime để API, authorization, jobs và database ownership có
thể phát triển độc lập với web rendering.

## Decision

Sử dụng NestJS REST API với Drizzle ORM, `node-postgres` và PostgreSQL/PostGIS.
Next.js tiếp tục đảm nhiệm web rendering và có thể giữ thin same-origin proxy,
nhưng không sở hữu business query hoặc database connection sau cutover.

Migration diễn ra tăng dần. Không đổi ORM, database schema, migration history
hoặc data importer trong cùng bước.

## Consequences

### Positive

- Boundary rõ cho API, auth, moderation và background processing.
- Có thể deploy/scale web và API độc lập.
- Giữ TypeScript, Drizzle schema, PostGIS queries và domain tests hiện có.
- OpenAPI trở thành contract giữa web và backend.

### Cost

- Hai runtime, hai build/deployment và thêm network hop cho SSR.
- Phải quản lý CORS/proxy, API versioning, database pool và environment riêng.
- Cần contract/integration tests để ngăn web và API drift.

## Rejected alternatives

- Big-bang rewrite: risk cao và không tạo thêm giá trị dữ liệu.
- Đổi sang Prisma/TypeORM trong cùng migration: mở rộng phạm vi không cần thiết.
- Microservices ngay: chưa có load hoặc team boundary chứng minh nhu cầu.
