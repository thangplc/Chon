# Kiến trúc và dữ liệu MVP

## 1. Stack đề xuất

- Web/PWA: Next.js + TypeScript.
- UI: Tailwind CSS + component primitives có accessibility.
- Map: MapLibre GL JS.
- Database: PostgreSQL + PostGIS.
- ORM: Drizzle ORM.
- Authentication: Auth.js hoặc nhà cung cấp tương đương.
- Validation: Zod.
- Test: Vitest, Testing Library và Playwright.
- Hosting ban đầu: Vercel/Cloudflare cho web; managed PostgreSQL có PostGIS.
- Analytics: công cụ event analytics tôn trọng privacy.

Quyết định nhà cung cấp bản đồ tile, auth, database và hosting chỉ chốt sau một spike ngắn về giá, điều khoản và độ phủ Việt Nam.

## 2. Các module

```text
Web/PWA
  ├── Explore map/list
  ├── Search and filters
  ├── Place details
  ├── Contribution flow
  └── Collections
        │
Application layer
  ├── Place search
  ├── Vibe aggregation
  ├── Explainable ranking
  ├── Moderation
  └── Data ingestion
        │
PostgreSQL + PostGIS
  ├── POI data
  ├── Raw vibe reports
  ├── Aggregated snapshots
  └── Users and collections
```

MVP nên là modular monolith. Chưa cần microservices, queue riêng hoặc vector database.

## 3. Data model đề xuất

### `places`

- `id`: UUID.
- `name`, `slug`, `description`.
- `location`: PostGIS geography point.
- `address`, `district`.
- `price_level`.
- `opening_hours`: structured JSON.
- `status`: draft, published, archived.
- timestamps.

### `place_sources`

- `place_id`.
- `provider`: tên nguồn POI bên thứ ba.
- `provider_place_id`.
- `last_synced_at`.
- `raw_data`: chỉ lưu khi điều khoản provider cho phép.
- Unique key: provider + provider place ID.

### `place_areas`

Khu vực bên trong một địa điểm có vibe khác nhau:

- `id`, `place_id`.
- `name`: tầng 2, sân vườn, khu trong nhà.
- `description`.

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
GET  /api/places?bbox=&purpose=&at=&filters=
GET  /api/places/:slug
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

1. Import POI cơ bản từ provider bên thứ ba có giấy phép phù hợp.
2. Founder/curator xác minh tên, vị trí, giờ mở cửa và trạng thái hoạt động trong file CSV.
3. Chạy validation/dry-run, sau đó import CSV bằng script có khả năng upsert an toàn.
4. Nhóm dự án curate vibe seed và ghi rõ `data_type=editorial`.
5. Thu vibe cộng đồng trực tiếp từ contribution flow trên web/PWA Chốn.
6. Chỉ sinh snapshot khi đủ dữ liệu; nếu thiếu, hiển thị editorial note và confidence thấp.

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
- Synthetic fixtures có ID/prefix nhận diện rõ và không dùng chung artifact import production.
- Research data chỉ được chuyển sang production qua một thao tác xác minh riêng, có consent và audit; kết quả phải mang nhãn `editorial` hoặc `community` phù hợp.
- Không đổi nhãn tự động để vượt qua rào chắn môi trường.

### Quyền cập nhật trong MVP

- Developer chạy provider import/sync job.
- Founder hoặc curator được chỉ định chuẩn bị và review CSV.
- Người vận hành được cấp quyền chạy import/operations script.
- Người dùng gửi vibe report trên Chốn.
- Chủ địa điểm chưa có quyền tự sửa dữ liệu hoặc vibe score.

Không scrape review/ảnh từ nền tảng khác nếu chưa có quyền sử dụng và lưu trữ.

## 9. Testing tối thiểu

- Unit test cho time bucket, aggregation, confidence và ranking.
- Integration test cho geospatial query và permissions.
- Test importer với file hợp lệ, sai schema, record trùng và dry-run.
- Test production guard từ chối synthetic/research và không ghi một phần dữ liệu.
- E2E cho khám phá, xem địa điểm và đóng góp.
- Accessibility test cho filter, modal và map fallback dạng danh sách.
- Kiểm tra mobile performance với dataset ít nhất 1.000 marker giả lập.
