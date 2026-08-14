# Tech stack đề xuất: Chốn MVP

Trạng thái: **core stack approved; NestJS backend cutover hoàn thành ngày 2026-08-14; hosting/auth vendor chưa chốt**.

## 1. Mục tiêu kỹ thuật

- Một developer có thể vận hành.
- Type-safe end-to-end ở mức hợp lý.
- Hỗ trợ geospatial query tốt.
- UX mobile nhanh trên mạng di động.
- Chi phí thấp khi chưa có nhiều người dùng.
- Có đường nâng cấp mà không cần viết lại toàn bộ.

## 2. Stack chính

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Runtime | Node.js LTS | Hệ sinh thái ổn định, dùng chung TypeScript |
| Web framework | Next.js + TypeScript | React UI, App Router và server-side rendering |
| Backend API | NestJS + REST/OpenAPI | API/auth/jobs boundary độc lập, modular và type-safe |
| Styling | Tailwind CSS | Tốc độ triển khai UI và responsive |
| UI primitives | Radix UI hoặc tương đương | Accessibility cho dialog, menu, form |
| Map renderer | MapLibre GL JS | Tùy biến style/layer, WebGL, không khóa vào renderer độc quyền |
| Database | PostgreSQL | Transaction, indexing và hệ sinh thái mature |
| Geospatial | PostGIS | Radius, bounding box, distance và spatial index |
| ORM | Drizzle ORM | Schema TypeScript rõ, SQL vẫn kiểm soát được |
| Validation | Zod | Chia sẻ contract giữa form, API và domain |
| Auth | Auth.js | Phù hợp Next.js, hỗ trợ OAuth/magic link |
| Unit/integration test | Vitest | Nhanh và hợp TypeScript |
| Component test | Testing Library | Test theo hành vi người dùng |
| E2E | Playwright | Test responsive flow và map/list interaction |
| Package manager | pnpm | Nhanh, tiết kiệm dung lượng, workspace-friendly |

## 3. Kiến trúc ứng dụng

Sử dụng modular monolith trong pnpm workspace với hai deployable runtime.
Next.js nằm tại `apps/web`, NestJS tại `apps/api`; code dùng chung được tách theo
ownership trong `packages/*`.

```text
apps/
  web/              # Next.js, UI, map assets và frontend tooling
  api/              # NestJS, DB, Drizzle, importer và backend tooling
packages/
  contracts/        # Zod transport contracts
  domain/           # pure business rules
scripts/
  dev-stack.mjs     # workspace orchestration duy nhất
```

Code chỉ dùng bởi một runtime phải nằm trong app sở hữu. `packages/*` chỉ dành
cho contract/domain thực sự dùng qua ranh giới web–API và không chứa hạ tầng
database hay provider credential.

Các thuật toán ranking, aggregation và confidence phải nằm trong domain functions độc lập để test mà không cần browser/database.

## 4. Bản đồ và POI

### Renderer

Chọn MapLibre GL JS cho client map.

### Provider architecture đã chốt

- POI nền: FSQ OS Places snapshot/delta, lọc café/coffee shop theo ba khu vực mục tiêu.
- Tile/style: MapTiler Cloud, dùng trực tiếp từ client qua browser-restricted key.
- Geocoding/reverse geocoding: MapTiler Geocoding qua adapter, ưu tiên `vi`, `vn` và bbox TP.HCM.
- Fallback POI/geocoding: Geoapify nếu credential smoke test không đạt coverage/ngôn ngữ gate.
- Ranh giới service area: OpenStreetMap administrative boundary; GeoJSON nguồn versioned trong S3-compatible object storage, runtime geometry trong PostGIS.
- Renderer vẫn là MapLibre GL JS để không khóa UI vào SDK vendor.
- Chi tiết quyết định, cost model, field allowlist và gate nằm trong `PROVIDER-SPIKE.md`.

### Chưa chốt

- Deep-link chỉ đường mặc định.

### Gate credential trước import production

Provider architecture đã đủ để scaffold. Trước import production phải kiểm tra 30 POI thật bằng credential và xác nhận:

- Recall tên/địa điểm tối thiểu 80% và tọa độ median lệch không quá 75 m.
- Duplicate candidate không quá 5% và địa chỉ usable tối thiểu 80%.
- Mười query tiếng Việt có dấu/không dấu hoạt động chấp nhận được.
- Attribution hiển thị đúng và pricing/terms được kiểm tra lại trước public beta.

Không để ID của provider trở thành primary key. Dùng `places.id` nội bộ và bảng mapping nguồn ngoài.

### Data ingestion trong MVP

- POI bên thứ ba: adapter/import job riêng cho từng provider.
- Seed thủ công: file CSV có schema cố định và được kiểm soát thay đổi.
- Vibe cộng đồng: form/API first-party trên Chốn.
- Mọi record có provenance để biết nguồn, người nhập và lần xác minh cuối.

Canonical `data_type`:

```text
synthetic  # local, CI, staging
research   # prototype/research workspace
editorial  # production
community  # production
```

`data_type` và `provider` là hai khái niệm khác nhau: provider mô tả nguồn POI bên thứ ba; `data_type` mô tả mục đích và mức xác minh của dữ liệu nghiệp vụ.

CSV importer phải:

- Validate header và từng dòng trước khi ghi database.
- Có chế độ `--dry-run`.
- Upsert bằng ID nội bộ hoặc external mapping đã xác minh.
- Báo record trùng/xung đột thay vì âm thầm ghi đè.
- Import lặp lại an toàn.
- Đọc environment đích và từ chối `synthetic`/`research` khi đích là production.
- Từ chối mọi record `is_simulated=true` khi đích là production.
- Không cho phép đổi `data_type` ngầm trong quá trình import.

Admin Dashboard không thuộc MVP. Việc seed/correction ban đầu thực hiện qua CSV và script; dashboard được cân nhắc sau beta.

## 5. Database và dữ liệu

PostgreSQL + PostGIS là thành phần bắt buộc vì cần:

- Tìm địa điểm theo bán kính.
- Query theo viewport của bản đồ.
- Sắp xếp theo khoảng cách.
- Lưu boundary `MultiPolygon` và gán POI vào service area bằng `ST_Covers`.
- Spatial index khi dữ liệu tăng.

Ranh giới khu vực dùng hai lớp lưu trữ:

- S3-compatible object storage giữ GeoJSON nguồn bất biến theo version, kèm checksum và provenance OSM/ODbL.
- PostGIS giữ geometry đã validate/simplify để query runtime; không dùng JSONB làm spatial source chính.

Không commit boundary GeoJSON vào repository. Boundary importer phải có dry-run, kiểm tra geometry/CRS, tạo version mới và chỉ chuyển current version trong transaction sau khi toàn bộ validation đạt.

### Database foundation đã triển khai

- Local: PostgreSQL 17 + PostGIS 3.5 qua `postgis/postgis:17-3.5-alpine` và Docker Compose.
- Runtime: Drizzle ORM + `node-postgres` connection pool.
- Migration: Drizzle Kit, SQL migration có journal và snapshot được commit.
- Cấu hình: chỉ dùng các biến `DATABASE_*` rời trong `apps/api/.env`; không yêu cầu `DATABASE_URL` và không đưa database credential sang env của web.
- Migration `0000`–`0006` hiện tạo PostGIS cùng chín bảng core, bao gồm `place_media`.
- Không cung cấp script reset/xóa volume. Database change ở môi trường dùng chung dùng forward-fix migration.

Raw reports và aggregated snapshots phải tách riêng:

- Raw report phục vụ audit và tính lại thuật toán.
- Snapshot phục vụ đọc nhanh trên map và ranking.

MVP có thể cập nhật snapshot đồng bộ sau khi report hợp lệ. Report cần ẩn được bằng operational script và có audit event. Chỉ thêm dashboard, queue hoặc background worker khi đo được nhu cầu.

## 6. Search và ranking

Phiên bản đầu không cần Elasticsearch, vector database hoặc ML pipeline.

- Structured filters bằng SQL.
- Full-text search cơ bản bằng PostgreSQL khi cần.
- Weighted ranking deterministic trong application/domain layer.
- Lưu lý do ranking để UI giải thích kết quả.

Natural-language search là P1: LLM chỉ chuyển câu người dùng thành filter schema, không tự tạo dữ liệu địa điểm.

## 7. Hosting

### Đề xuất ban đầu

- Web: nền tảng managed hỗ trợ Next.js.
- API: managed Node.js runtime/container hỗ trợ tiến trình NestJS dài hạn.
- Database: managed PostgreSQL có PostGIS.
- Ảnh và GeoJSON nguồn của service area: S3-compatible object storage.
- DNS/CDN/WAF: chọn cùng hoặc tách tùy chi phí.

Không chốt vendor trước khi làm bảng giá và kiểm tra region/latency từ Việt Nam.

Media pipeline MVP cần thumbnail generation, metadata/rights provenance và moderation status. Không proxy hoặc cache ảnh provider nếu điều khoản không cho phép.

### Môi trường

- Local: ưu tiên `synthetic` fixtures.
- Preview theo pull request: `synthetic` fixtures.
- CI: deterministic `synthetic` fixtures.
- Staging: `synthetic`; chỉ dùng `research` đã ẩn danh khi có lý do kiểm thử rõ ràng.
- Research/prototype workspace: `research`, tách khỏi production.
- Production `vibe_reports`: chỉ `editorial` và `community`; provider signals production đi qua storage/terms policy riêng.

Không dùng dữ liệu vị trí thật của beta user trong staging.

## 8. Observability và analytics

### Error/operations

- Structured logging, không log tọa độ người dùng chính xác.
- Error tracking cho frontend và server.
- Health check và cảnh báo lỗi API quan trọng.
- Database backup được kiểm tra restore trước beta.

### Product events tối thiểu

- `explore_started`
- `filters_applied`
- `place_viewed`
- `place_saved`
- `directions_opened`
- `vibe_report_started`
- `vibe_report_submitted`

Event không chứa text tự do hoặc vị trí chính xác nếu không cần thiết.

## 9. Security và privacy baseline

- Session cookie an toàn và CSRF protection phù hợp auth flow.
- Quyền chạy data/operations script chỉ dành cho người vận hành được cấp quyền.
- Rate limiting cho auth và contribution.
- Validate mọi input tại server boundary.
- Không expose provider secrets ra client ngoài public map token được giới hạn.
- Không lưu lịch sử di chuyển.
- Location verification chỉ lưu mức xác minh nếu không cần tọa độ gốc.
- Audit log cho moderation.
- Quy trình export/xóa dữ liệu người dùng.

## 10. CI/CD quality gates

Baseline Sprint 1 đã tự động hóa `typecheck`, `lint` và unit test bằng GitHub Actions. Các gate còn lại trong danh sách dưới đây được bổ sung dần trước public beta khi migration/preview/E2E environment sẵn sàng.

Mỗi pull request chạy:

```text
format check
lint
typecheck
unit tests
database migration validation
build
critical E2E (khi môi trường preview sẵn sàng)
production data-type guard tests
```

Không deploy production nếu migration không rollback/forward-fix được hoặc critical E2E thất bại.

## 11. Những thứ chủ động chưa dùng

- Microservices.
- Kubernetes.
- GraphQL.
- Redis trước khi có use case đo được.
- Kafka/event streaming.
- Vector database.
- Native mobile app.
- AI-generated vibe score.

## 12. Technical decisions cần chốt

| Quyết định | Thời điểm | Cách chốt |
|---|---|---|
| Tile/geocoding/POI provider | Approved 2026-08-13 | FSQ OS Places + MapTiler; credential smoke test trước production import |
| Provider vibe architecture | Approved 2026-08-13 | Hybrid contribution + Foursquare Places Pro/Premium, Google Places, Yelp, Tripadvisor; schema verified, live credential/coverage gate còn pending |
| Service-area boundary storage | Approved 2026-08-13 | GeoJSON nguồn versioned trong object storage + runtime MultiPolygon trong PostGIS |
| Auth provider/flow | Trước contribution | Prototype magic link và OAuth |
| Hosting/database vendor | Trước staging | So sánh latency, PostGIS và chi phí |
| CSV schema/import contract | Trước scaffold | Test với 30 địa điểm thật |
| Data-type environment policy | Trước scaffold | Automated tests cho production guard |
| Snapshot update strategy | Trước Sprint build 3 | Load test và đánh giá độ phức tạp |
| Location verification | Trong validation | Research mức chấp nhận của user |
| Thời điểm xây Admin Dashboard | Sau beta | Dựa trên khối lượng chỉnh sửa/moderation thực tế |
