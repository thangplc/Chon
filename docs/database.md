# Database runbook

## Stack

- PostgreSQL 17.
- PostGIS 3.5.
- Drizzle ORM + `node-postgres` cho runtime.
- Drizzle Kit cho migration SQL có version.
- Docker Compose cho local development.

Image local được pin ở `postgis/postgis:17-3.5-alpine`. Upstream hiện chỉ phát hành image này cho `linux/amd64`, vì vậy Docker Desktop dùng emulation trên Apple Silicon. Không đổi sang image PostGIS không chính thức chỉ để tránh emulation.

## Cấu hình local

Tạo `.env` từ `.env.example` và chỉ dùng các biến rời:

```text
DATABASE_HOST
DATABASE_PORT
DATABASE_NAME
DATABASE_USER
DATABASE_PASSWORD
DATABASE_SCHEMA
DATABASE_SSL
DATABASE_POOL_MAX
```

Không commit `.env` hoặc tạo thêm `.env.local`. Cấu hình mặc định dùng cổng PostgreSQL chuẩn `5432`. Nếu máy đang có database khác dùng cổng này, chỉ đổi `DATABASE_PORT` trong `.env` local; không sửa `.env.example` và không dừng database ngoài phạm vi Chốn.

## Khởi động và migrate

```bash
pnpm db:up
pnpm db:migrate
```

Kiểm tra container và PostGIS:

```bash
docker compose ps
docker compose exec postgres psql -U chon -d chon -c \
  "SELECT current_database(), PostGIS_Version();"
```

Dừng container nhưng giữ volume:

```bash
pnpm db:down
```

Không thêm command xóa volume vào script dự án. Mọi thao tác xóa/reset database cần phê duyệt riêng.

## Migration workflow

Migration đầu tiên `0000_enable_postgis.sql` bật extension bằng `CREATE EXTENSION IF NOT EXISTS postgis`. Câu lệnh vẫn an toàn với provider hoặc Docker image đã bật PostGIS trước đó.

Local foundation được xác minh ngày 2026-08-13: container healthy trên cổng `5432`, migration chạy lặp lại an toàn, journal có năm migration và PostGIS thực thi được `Point`/`MultiPolygon` SRID 4326.

Core schema hiện có:

- `service_areas` và `service_area_boundaries` lưu khu vực phục vụ cùng boundary có version.
- `place_service_areas` lưu membership theo đúng boundary version và chỉ cho một primary area mỗi place.
- `places` và `place_areas` lưu POI cùng các không gian con.
- `place_sources` lưu provenance và mapping ID giữa canonical place với provider.
- `provider_vibe_signals` lưu tín hiệu bên thứ ba tách khỏi report Chốn, với storage policy, TTL, attribution, mapping version, confidence và tối đa sáu dimension estimate.
- `vibe_reports` lưu sáu chiều vibe và ràng buộc riêng cho bốn `data_type`.

Chạy integration verification sau khi migrate:

```bash
pnpm db:verify
```

Verification kiểm tra tám bảng, SRID/geometry type, GiST/partial unique indexes, spatial coverage và các constraint cốt lõi. Với provider signal, script kiểm tra `reference_only`, `persist_allowed`, mapping version và foreign key buộc source/place cùng provenance. Dữ liệu kiểm thử được chạy trong transaction rồi rollback, không để lại fixture trong database.

Khi thay đổi schema:

```bash
pnpm db:generate --name=<migration_name>
pnpm db:check
pnpm db:migrate
```

Quy tắc:

1. Review SQL được tạo và migration snapshot trước khi chạy.
2. Không dùng `drizzle-kit push` cho staging/production.
3. Không sửa migration đã được áp dụng ở môi trường dùng chung; tạo forward-fix migration mới.
4. Migration production chạy bằng credential riêng có quyền tối thiểu cần thiết.
5. Database runtime không mặc định có quyền tạo extension hoặc sửa schema.
6. Backup/restore phải được kiểm thử trước beta.

## Production

- Lưu các biến `DATABASE_*` trong secret manager của hosting platform.
- Bật `DATABASE_SSL=true` và cấu hình chứng chỉ phù hợp với provider trước staging.
- Xác nhận managed PostgreSQL hỗ trợ PostGIS và quyền chạy migration `CREATE EXTENSION`.
- Không expose database trực tiếp ra public network nếu provider hỗ trợ private networking hoặc connection pooler.
