# Kiến trúc và dữ liệu MVP

## 1. Stack và runtime boundary

- Web/PWA: Next.js + TypeScript; chịu trách nhiệm React UI và SSR.
- Backend API: NestJS REST/OpenAPI; cutover hoàn thành ngày 2026-08-14.
- UI: Tailwind CSS + component primitives có accessibility.
- Map: MapLibre GL JS + MapTiler Cloud tile/style.
- Database: PostgreSQL + PostGIS.
- ORM: Drizzle ORM.
- Authentication: Auth.js hoặc nhà cung cấp tương đương.
- Validation: Zod.
- Test: Vitest, Testing Library và Playwright.
- Hosting ban đầu: managed Next.js platform cho web, managed Node.js runtime cho API và managed PostgreSQL có PostGIS.
- Analytics: công cụ event analytics tôn trọng privacy.

Provider architecture đã chốt trong `PROVIDER-SPIKE.md`: FSQ OS Places cho POI snapshot/delta, MapTiler Cloud cho tile/style và geocoding; Geoapify là fallback. Auth, database hosting và web hosting vendor vẫn chờ spike riêng.

## 2. Các module

```text
Browser
  │
Next.js Web
  ├── Explore map/list
  ├── Search and filters
  ├── Place details
  ├── Contribution flow
  └── Collections
  └── same-origin API proxy
        │
NestJS API / Application layer
  ├── Place search
  ├── Provider signal normalization
  ├── Vibe aggregation
  ├── Explainable ranking
  ├── Moderation
  └── Data ingestion
        │
PostgreSQL + PostGIS
  ├── POI data
  ├── Service areas và versioned boundaries
  ├── Provider vibe signals
  ├── Raw vibe reports
  ├── Aggregated snapshots
  └── Users and collections
```

MVP là modular monolith trong pnpm workspace với hai deployable runtime: web và
API. Next.js không truy cập database trong request path. Importer và
operational scripts vẫn dùng cùng Drizzle schema/migrations. Chưa cần
microservices, queue riêng hoặc vector database.

Cây source và dependency direction được chốt trong
`docs/repository-structure.md`: web/API cùng operational code do chúng sở hữu ở
`apps/*`; chỉ contract/domain dùng chung ở `packages/*`; không còn production
`src` tại workspace root.

## 3. Data model đề xuất

### `service_areas`

- `id`: UUID; `code` bất biến như `hcm-q1`.
- `display_name`, `area_type`, `timezone`, `priority`.
- `status`: draft, active, paused, archived.
- `parent_id`: nullable, dành cho khu vực lồng nhau về sau.
- timestamps.

### `service_area_boundaries`

- `id`, `service_area_id`, `version`.
- `boundary`: PostGIS `geometry(MultiPolygon, 4326)` với GiST index.
- `source_storage_key`: object key của GeoJSON nguồn bất biến.
- `source_name`, `source_relation_id`, `source_url`, `source_license`.
- `retrieved_at`, `checksum`, `is_current`, timestamps.
- Unique key: service area + version; chỉ một current version cho mỗi service area.

GeoJSON nguồn được lưu trong S3-compatible object storage, không nằm trong repository. Local development giữ mirror bị Git ignore tại `data/source-objects/<source_storage_key>`; production phải upload đúng artifact/checksum này trước khi import. Runtime chỉ query geometry đã validate/simplify trong PostGIS. Cập nhật ranh giới luôn tạo version mới để có thể audit và rollback bằng cách chuyển current version, không ghi đè source object.

### `place_service_areas`

- `place_id`, `service_area_id`.
- `is_primary`, `assigned_at`, `boundary_version`.
- Unique key: place + service area.

Importer gán POI vào khu vực bằng `ST_Covers(boundary, place.location)`. Khi active boundary version mới, importer phải tính lại membership liên quan trong cùng workflow. Trường `district` của provider chỉ là metadata hiển thị, không quyết định membership.

### `places`

- `id`: UUID.
- `name`, `slug`, `description`.
- `location`: PostGIS `geometry(Point, 4326)`; cast sang geography khi tính khoảng cách theo mét.
- `address`, `district`.
- `price_level`.
- `typical_spend_min`, `typical_spend_max`, `currency`.
- `size_category`, `estimated_capacity`.
- `opening_hours`: structured JSON cho lịch thường lệ v1 gồm timezone
  `Asia/Ho_Chi_Minh`, đủ bảy ngày và các khoảng `opens`/`closes` cùng ngày;
  `NULL` nghĩa là chưa có lịch đã xác minh.
- `status`: draft, published, archived.
- timestamps.

### `place_sources`

- `place_id`.
- `provider`: tên nguồn POI bên thứ ba.
- `provider_place_id`.
- `last_synced_at`.
- `raw_data`: chỉ lưu khi điều khoản provider cho phép.
- Unique key: provider + provider place ID.

### `provider_vibe_signals`

Tín hiệu vibe lấy từ provider được lưu tách khỏi report do con người gửi trên Chốn:

- `id`, `place_id`, `place_source_id`.
- `provider_product`, `signal_type`, `provider_signal_id`.
- `signal_value`: dữ liệu chuẩn hóa khi được phép cache/persist; `raw_data` chỉ có khi hợp đồng cho phép persist.
- Sáu cột estimate `noise`, `crowd`, `lighting`, `privacy`, `workability`, `social_energy` theo thang 1–5, kèm `mapping_version`.
- `day_type`, `time_bucket`: nullable; chỉ điền khi chính tín hiệu provider có ngữ cảnh thời gian tương ứng.
- `retrieved_at`, `observed_at`, `expires_at`.
- `source_url`, `attribution_text`, `storage_policy` và `confidence_score`.
- Unique key theo provider/source signal để sync idempotent.

Provider signal không có `data_type` và không được chèn vào `vibe_reports`. Bốn `data_type` hiện tại vì vậy không thay đổi.
Với `storage_policy=reference_only`, database chỉ giữ ID/provenance cần thiết; signal content và sáu dimension score không được persist.

### `place_areas`

Khu vực bên trong một địa điểm có vibe khác nhau:

- `id`, `place_id`.
- `name`: tầng 2, sân vườn, khu trong nhà.
- `description`.

### `place_amenities`

- `place_id`, `amenity_key`, `availability`.
- `source_type`, `verified_at`.
- `unknown` được lưu riêng, không đồng nghĩa `no`.

### `place_media`

- `id`, `place_id`, `place_area_id`.
- `storage_key` hoặc provider `source_url` theo terms.
- `width`, `height`, `alt_text`, `sort_order`.
- `source_type`, `source_reference`, `rights_status`.
- `captured_at`, `uploaded_by`, `moderation_status`, `is_simulated`.
- Tối đa 5 ảnh active trong gallery MVP; ảnh thứ tự 0 là cover.

### `vibe_reports`

- `id`, `place_id`, `place_area_id`, `user_id`.
- `visited_at`, `submitted_at`.
- `noise`, `crowd`, `lighting`, `privacy`, `workability`, `social_energy`.
- `visit_mode`, `seat_availability`, `short_note`.
- `location_verification`: none, approximate, verified.
- `data_type`: synthetic, research, editorial, community.
- `source_note`, `verified_at`.
- `moderation_status`.

`data_type` là enum bắt buộc. `synthetic` và `research` không hợp lệ trong production database. `contributor_type` không cần là cột riêng vì có thể suy ra từ `data_type` và contributor relation.

### `vibe_snapshots`

Dữ liệu tổng hợp phục vụ query nhanh:

- `place_id`.
- `day_type`: weekday, friday, weekend.
- `time_bucket`: morning, midday, afternoon, evening, late.
- Median/weighted mean cho từng chiều.
- `report_count`, `confidence_score`, `last_report_at`.
- Lưu riêng contribution component và provider component; API mới áp dụng fusion policy khi trả kết quả, không làm mất provenance.
- Unique key: place + area + day type + time bucket.

### `collections` và `collection_places`

- Collection public/private.
- Thứ tự địa điểm và ghi chú của chủ collection.

### `moderation_events`

Lưu lịch sử duyệt, ẩn và khôi phục report. Trong MVP, thao tác vận hành qua script; Admin Dashboard được hoãn lại.

## 4. Time buckets ban đầu

- Morning: 06:00–10:59.
- Midday: 11:00–13:59.
- Afternoon: 14:00–17:59.
- Evening: 18:00–21:59.
- Late: 22:00–05:59.

Sau khi có dữ liệu thật mới cân nhắc bucket nhỏ hơn. Snapshot phải dùng timezone của địa điểm.

## 5. Confidence score

Confidence không đồng nghĩa với vibe tốt. Nó chỉ biểu thị độ chắc chắn của dữ liệu.

Đầu vào:

- Số report trong khung giờ tương tự.
- Độ mới của report.
- Mức đồng thuận giữa các report.
- Xác minh vị trí.
- Reputation của contributor.

Quy tắc MVP:

- `low`: ít hơn 3 report hữu ích.
- `medium`: 3–7 report, không có bất đồng lớn.
- `high`: từ 8 report gần đây và có mức đồng thuận tốt.

Luôn hiển thị số report và thời điểm cập nhật gần nhất cạnh confidence.

## 6. API surface dự kiến

```text
GET  /api/places?bbox=west,south,east,north&limit=
GET  /api/places?lat=&lng=&radius=&limit=
GET  /api/service-areas?status=active
GET  /api/places/:slug
GET  /api/places/:id/media
POST /api/vibe-reports
GET  /api/places/:id/vibe?at=
POST /api/collections
POST /api/collections/:id/places
GET  /api/public/collections/:slug
```

MVP không có Admin API/UI. Import và thao tác vận hành dùng script có quyền truy cập giới hạn và audit log.

## 7. Privacy và chống abuse

- Không lưu lịch sử vị trí liên tục.
- Chỉ dùng vị trí khi người dùng chủ động xác minh đóng góp.
- Có thể lưu kết quả xác minh thay vì tọa độ chính xác của người dùng.
- Rate limit report và bảo vệ thao tác vận hành nhạy cảm.
- Cho phép report nội dung và xóa tài khoản/dữ liệu.
- Ghi chú tự do phải qua kiểm tra spam và dữ liệu cá nhân.
- Không công khai contributor đang ở một địa điểm theo thời gian thực.

## 8. Chiến lược dữ liệu ban đầu

1. Import GeoJSON ranh giới OSM vào object storage và PostGIS qua boundary importer có version/dry-run.
2. Import POI cơ bản từ provider bên thứ ba có giấy phép phù hợp.
3. Lọc/gán POI vào `service_area` bằng spatial query, không tin chuỗi district từ provider.
4. Founder/curator xác minh tên, vị trí, giờ mở cửa và trạng thái hoạt động trong file CSV.
5. Chạy validation/dry-run, sau đó import CSV bằng script có khả năng upsert an toàn.
6. Đồng bộ provider vibe signals qua adapter riêng sau terms/coverage gate; không đưa review text trực tiếp vào `vibe_reports`.
7. Nhóm dự án curate vibe seed và ghi rõ `data_type=editorial`.
8. Thu vibe cộng đồng trực tiếp từ contribution flow trên web/PWA Chốn.
9. Sinh snapshot với provenance tách biệt; khi thiếu contribution có thể dùng provider signal với nhãn và confidence phù hợp.

### CSV seed contract tối thiểu

```text
internal_id,name,address,latitude,longitude,district,
provider,provider_place_id,opening_hours,status,
data_type,source_note,verified_at,verified_by
```

Importer phải validate toàn bộ file trước khi ghi, hỗ trợ `--dry-run`, phát hiện trùng/xung đột và có thể chạy lặp lại an toàn.

### Data-type policy

| Data type | Local/CI | Staging | Research workspace | Production |
|---|---:|---:|---:|---:|
| `synthetic` | Có | Có | Không cần | Không |
| `research` | Không cần | Chỉ khi đã ẩn danh | Có | Không |
| `editorial` | Có thể | Có thể | Có thể | Có |
| `community` | Không dùng dữ liệu thật | Không dùng dữ liệu thật | Không cần | Có |

Ràng buộc bắt buộc:

- Production importer và database constraint/application guard từ chối `synthetic` và `research`.
- Production importer từ chối mọi record có `is_simulated=true`, kể cả fixture mô phỏng `editorial` hoặc `community`.
- Synthetic fixtures có ID/prefix nhận diện rõ và không dùng chung artifact import production.
- Research data chỉ được chuyển sang production qua một thao tác xác minh riêng, có consent và audit; kết quả phải mang nhãn `editorial` hoặc `community` phù hợp.
- Không đổi nhãn tự động để vượt qua rào chắn môi trường.

### Quyền cập nhật trong MVP

- Developer chạy provider import/sync job.
- Founder hoặc curator được chỉ định chuẩn bị và review CSV.
- Người vận hành được cấp quyền chạy import/operations script.
- Người dùng gửi vibe report trên Chốn.
- Provider sync job chỉ ghi `provider_vibe_signals` theo field/storage allowlist của từng hợp đồng.
- Chủ địa điểm chưa có quyền tự sửa dữ liệu hoặc vibe score.

Không scrape review/ảnh từ nền tảng khác. API content chỉ được lưu, biến đổi và hiển thị khi điều khoản tương ứng cho phép và attribution đầy đủ.

## 9. Testing tối thiểu

- Unit test cho time bucket, aggregation, confidence và ranking.
- Integration test cho geospatial query và permissions.
- Test importer với file hợp lệ, sai schema, record trùng và dry-run.
- Test production guard từ chối synthetic/research và không ghi một phần dữ liệu.
- Test production guard từ chối mọi record có `is_simulated=true`.
- E2E cho khám phá, xem địa điểm và đóng góp.
- Accessibility test cho filter, modal và map fallback dạng danh sách.
- Kiểm tra mobile performance với dataset ít nhất 1.000 marker giả lập.
