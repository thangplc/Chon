# Tech stack đề xuất: Chốn MVP

Trạng thái: **proposed**, chưa chốt nhà cung cấp trả phí.

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
| Web framework | Next.js + TypeScript | Full-stack trong một repo, phù hợp modular monolith |
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

Sử dụng modular monolith trong một repository:

```text
src/
  app/              # routes và UI composition
  features/
    places/
    explore/
    vibe/
    collections/
  db/               # schema, migrations, queries
  domain/           # ranking, aggregation, confidence
  lib/              # shared infrastructure
  components/       # shared UI primitives
scripts/
  data/             # validate/import/sync, không phải Admin UI
```

Các thuật toán ranking, aggregation và confidence phải nằm trong domain functions độc lập để test mà không cần browser/database.

## 4. Bản đồ và POI

### Renderer

Chọn MapLibre GL JS cho client map.

### Chưa chốt

- Tile/style provider.
- Geocoding/reverse geocoding provider.
- Nguồn POI seed.
- Deep-link chỉ đường mặc định.

### Spike bắt buộc trước scaffold

So sánh 2–3 phương án theo:

- Độ phủ và độ chính xác tại TP.HCM.
- Chi phí ở 1.000, 10.000 và 100.000 lượt sử dụng/tháng.
- Điều khoản cache/lưu trữ POI, ảnh và attribution.
- Hỗ trợ tiếng Việt.
- Khả năng đổi provider.

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
- Không cho phép đổi `data_type` ngầm trong quá trình import.

Admin Dashboard không thuộc MVP. Việc seed/correction ban đầu thực hiện qua CSV và script; dashboard được cân nhắc sau beta.

## 5. Database và dữ liệu

PostgreSQL + PostGIS là thành phần bắt buộc vì cần:

- Tìm địa điểm theo bán kính.
- Query theo viewport của bản đồ.
- Sắp xếp theo khoảng cách.
- Spatial index khi dữ liệu tăng.

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

- Web/API: nền tảng managed hỗ trợ Next.js.
- Database: managed PostgreSQL có PostGIS.
- Ảnh: S3-compatible object storage.
- DNS/CDN/WAF: chọn cùng hoặc tách tùy chi phí.

Không chốt vendor trước khi làm bảng giá và kiểm tra region/latency từ Việt Nam.

### Môi trường

- Local: ưu tiên `synthetic` fixtures.
- Preview theo pull request: `synthetic` fixtures.
- CI: deterministic `synthetic` fixtures.
- Staging: `synthetic`; chỉ dùng `research` đã ẩn danh khi có lý do kiểm thử rõ ràng.
- Research/prototype workspace: `research`, tách khỏi production.
- Production: chỉ `editorial` và `community`.

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
| Tile/geocoding/POI provider | Trước scaffold | Spike độ phủ, giá và terms |
| Auth provider/flow | Trước contribution | Prototype magic link và OAuth |
| Hosting/database vendor | Trước staging | So sánh latency, PostGIS và chi phí |
| CSV schema/import contract | Trước scaffold | Test với 30 địa điểm thật |
| Data-type environment policy | Trước scaffold | Automated tests cho production guard |
| Snapshot update strategy | Trước Sprint build 3 | Load test và đánh giá độ phức tạp |
| Location verification | Trong validation | Research mức chấp nhận của user |
| Thời điểm xây Admin Dashboard | Sau beta | Dựa trên khối lượng chỉnh sửa/moderation thực tế |
