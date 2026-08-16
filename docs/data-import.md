# Data importer runbook

## Phạm vi

CLI hiện hỗ trợ ba luồng:

- `boundary`: validate/import GeoJSON ranh giới có version vào PostGIS.
- `poi`: validate/import cặp `places.csv` và `place-sources.csv` đã normalize.
- `seed`: validate/import một thư mục gồm `places.csv`, `place-areas.csv` tùy chọn, `place-media.csv` tùy chọn và các file `*-vibe-reports.csv`.
- `metadata:synthetic:import`: validate/upsert metadata giả lập vào bảng overlay riêng cho POI thật.

Production import **fail-closed theo record**: chỉ nhận dữ liệu thật và chỉ nhận vibe report `editorial` hoặc `community`. `synthetic`, `research` và mọi record `is_simulated=true` bị từ chối trước khi query dữ liệu hiện có hoặc thực hiện database write.

Mọi import có ghi database còn phải có `DATA_IMPORT_TARGET_ENVIRONMENT` trong
`apps/api/.env` và giá trị này phải khớp `--environment`. Điều này ngăn việc kết
nối production nhưng vô tình hoặc cố ý gắn nhãn import là `local`. Dry-run không
ghi dữ liệu nên được phép dùng `--environment production` trên target local để
kiểm tra policy.

| Environment | Data type được phép | Simulated record |
|---|---|---|
| `local`, `ci`, `staging`, `research` | Cả bốn data type | Cho phép |
| `production` | `editorial`, `community` | Từ chối |

Boundary production không có `data_type`/`is_simulated` nên được kiểm soát bởi validation và provenance contract. POI production được phép khi `places.csv` có `is_simulated=false`.

## Dry-run

Luôn chạy dry-run và review summary trước khi ghi database:

```bash
pnpm data:import poi \
  --file path/to/places.csv \
  --sources path/to/place-sources.csv \
  --dry-run
pnpm data:import seed --dir data/fixtures --dry-run
```

Thêm `--json` để lấy summary máy đọc được:

```bash
pnpm data:import seed --dir data/fixtures --dry-run --json
```

Summary chứa import ID, contract version, checksum từng file, environment, operator, create/update/unchanged/conflict/reject, warning và phân bố `data_type`. Dry-run có `Database writes: 0`. `opening_hours` được parse và kiểm tra theo contract lịch thường lệ v1 trước khi lập kế hoạch ghi.

### Synthetic metadata overlay cho POI thật

Không ghi các giá trị giả lập vào `places`. Dùng template
`data/templates/place-metadata-overlays.csv` với `place_id` là
`places.internal_id`:

```bash
pnpm metadata:synthetic:import \
  --file path/to/place-metadata-overlays.csv \
  --environment local --dry-run --json
pnpm metadata:synthetic:import \
  --file path/to/place-metadata-overlays.csv \
  --environment local
```

Importer chỉ nhận POI `published` và `is_simulated=false`, rồi upsert theo
`(place_id, environment)`. `real` bỏ qua overlay; `mixed` chỉ dùng overlay cho
field canonical đang thiếu; `synthetic` dùng overlay để test UI. Production bị
chặn cả ở importer lẫn API config. Web hiển thị nhãn `Dữ liệu minh họa — chưa
xác minh` khi một overlay được sử dụng.

Có thể kiểm tra production policy an toàn bằng dry-run trước khi import thật:

```bash
pnpm data:import seed --dir path/to/production-seed \
  --environment production --dry-run
```

## Import thật

Sau khi summary không có conflict/reject:

Cấu hình `DATA_IMPORT_TARGET_ENVIRONMENT=local` (hoặc target tương ứng) trong
`apps/api/.env`, sau đó chạy:

```bash
pnpm data:import poi \
  --file path/to/places.csv \
  --sources path/to/place-sources.csv
pnpm data:import seed --dir path/to/seed-directory
```

Import thật chạy trong transaction `SERIALIZABLE` và dùng advisory lock để ngăn hai data import chạy đồng thời. Một lỗi sẽ rollback toàn bộ batch. Stable CSV IDs được map qua `internal_id`, vì vậy chạy lại cùng artifact trả về `unchanged` thay vì tạo duplicate. Cùng ID nhưng thay đổi identity, vị trí, trạng thái hoặc simulation flag được báo conflict; các field chi tiết được allowlist (`price`, `currency`, `size`, `capacity`, `opening_hours`) được cập nhật idempotent khi CSV có giá trị không rỗng. Field tùy chọn bị bỏ trống được giữ nguyên trên place hiện hữu; importer hiện chưa có cú pháp clear field có chủ đích.

### Fixture cho Explore local

Pipeline runtime của Explore là:

```text
data/fixtures/*.csv → seed importer → PostgreSQL → Explore repository → Server Component → UI
```

CSV fixture là dữ liệu giả lập, kể cả các report mang `data_type=community`. Chúng luôn giữ `is_simulated=true`, chỉ được Explore repository đọc khi `DATA_IMPORT_TARGET_ENVIRONMENT` là `local`, `ci` hoặc `staging`, và bị production importer từ chối.

Explore lọc nguồn qua `EXPLORE_PLACE_DATA_MODE`: `synthetic` chỉ đọc fixture,
`mixed` đọc cả fixture và POI thật, còn `real` chỉ đọc place/report có
`is_simulated=false`. Đổi mode cần restart API.

`places.csv` giữ mức giá, quy mô, sức chứa và lịch mở cửa thường lệ. `place-areas.csv` giữ các khu vực con trong quán. Cả hai đều đi qua cùng seed transaction; UI Place Detail chỉ đọc dữ liệu đã import từ PostgreSQL.

`place-media.csv` dùng cùng transaction seed. Importer kiểm tra place/area ownership, stable `media_id`, một `sort_order` duy nhất trong khoảng `0–4`, đúng một trong `storage_key`/`source_url`, moderation và quyền sử dụng. Media `source_type=synthetic` bắt buộc `is_simulated=true`, `storage_key` local và `rights_status=verified`; production policy từ chối record simulated trước khi query DB.

Địa điểm được gán vào active service area bằng `ST_Covers` trên current boundary. Chuỗi `district` chỉ là metadata, không quyết định membership. Nếu chưa có boundary, importer vẫn cho phép nạp POI nhưng báo warning `outside_active_service_area`.

## Provider provenance

Provider POI đang được cấu hình trong MVP:

```text
fsq_os_places
openstreetmap
```

Mỗi POI trong `places.csv` bắt buộc có ít nhất một record tương ứng trong `place-sources.csv`:

```text
place_id,provider,provider_place_id,last_synced_at,source_url
```

Quy tắc mapping:

- UUID/`internal_id` của Chốn vẫn là định danh nghiệp vụ; provider ID không được dùng làm khóa chính.
- `(provider, provider_place_id)` chỉ được thuộc một place của Chốn.
- Một place chỉ có một mapping hiện hành cho mỗi provider.
- Snapshot mới hơn được phép cập nhật `last_synced_at` và `source_url`.
- Snapshot cũ hơn chỉ tạo warning và không làm lùi provenance đang lưu.
- Provider ID đổi hoặc bị gán sang place khác tạo conflict; importer không tự remap/merge.
- `raw_data` chỉ được lưu bởi adapter khi provider terms cho phép; CSV importer hiện để field này `NULL`.

OSM có pipeline riêng cho metadata giờ mở cửa, không cần API key:

```bash
OSM_OPENING_HOURS_ENABLED=true \
pnpm osm:opening-hours:sync --dry-run --environment local --json
```

Pipeline gọi Overpass theo batch, match POI bằng tên + khoảng cách, chỉ nhận
subset `opening_hours` regular cùng ngày của contract v1, và chỉ ghi khi
`places.opening_hours` còn trống. Mapping OSM và raw tags tối thiểu được lưu
trong `place_sources`; `24/7`, overnight và lịch theo ngày lễ bị bỏ qua để
không suy diễn sai. Xem thêm [API OSM enrichment guide](../apps/api/README.md#osm-opening-hours-enrichment).

## Boundary

Ba service area MVP được khai báo tập trung trong
`apps/api/src/data-pipeline/service-area-boundaries.ts`:

| Service area | OSM relation | Storage key |
|---|---:|---|
| Quận 1 | `2587287` | `boundaries/osm/hcm-q1/v1/boundary.geojson` |
| Quận 3 | `3819816` | `boundaries/osm/hcm-q3/v1/boundary.geojson` |
| Bình Thạnh | `3797166` | `boundaries/osm/hcm-binh-thanh/v1/boundary.geojson` |

Từ ngày 01/07/2025, ba quận không còn là đơn vị hành chính hiện hành. OSM giữ các relation này với `type=historic` và `end_date=2025-06-30`. Chốn dùng chúng như **vùng phục vụ sản phẩm** đang active, đồng thời lưu `area_type=historic_district` để không diễn giải sai trạng thái hành chính.

Workflow local/staging:

```bash
# Tải snapshot đã simplify từ Nominatim; lần sau reuse file cùng version.
pnpm service-areas:sync

# Validate cả ba source object, geometry và kế hoạch membership; không ghi DB.
pnpm service-areas:import --dry-run

# Import atomically và kích hoạt current boundary.
pnpm service-areas:import

# Đối chiếu source checksum/provenance, PostGIS và ST_Covers membership.
pnpm service-areas:verify
```

`service-areas:sync` dùng `polygon_threshold=0.00005` độ (xấp xỉ 5,5 m), kiểm tra relation/name/type/end date và tạo một manifest có checksum cho mỗi GeoJSON. Source object local nằm dưới `data/source-objects/<storage-key>` và bị loại khỏi Git. Nếu muốn cập nhật ranh giới, phải tăng `version` và đổi storage key trong catalog; script không ghi đè snapshot đã tồn tại.

Có thể gọi boundary importer cấp thấp cho một boundary riêng lẻ:

```bash
pnpm data:import boundary \
  --file data/source-objects/boundaries/osm/hcm-q1/v1/boundary.geojson \
  --code hcm-q1 \
  --name "Quận 1" \
  --version 1 \
  --current \
  --area-type historic_district \
  --source-storage-key boundaries/osm/hcm-q1/v1/boundary.geojson \
  --source-name "OpenStreetMap via Nominatim" \
  --source-relation-id 2587287 \
  --source-url https://www.openstreetmap.org/relation/2587287 \
  --source-license ODbL-1.0 \
  --retrieved-at <manifest.retrievedAt> \
  --dry-run
```

Boundary importer:

- nhận Polygon, MultiPolygon, Feature hoặc FeatureCollection và chuẩn hóa thành `MultiPolygon`;
- kiểm tra geometry không rỗng, hợp lệ và tọa độ trong phạm vi EPSG:4326;
- tính SHA-256 của file nguồn;
- không ghi đè geometry/source metadata của một version đã tồn tại;
- khi `--current`, tắt current version cũ và tính lại `place_service_areas`;
- có thể kích hoạt lại version cũ nếu checksum và source metadata khớp.

Trước production import, upload **đúng file có checksum trong manifest** vào S3-compatible object storage bằng `source_storage_key` đã khai báo. Database chỉ lưu key bất biến và provenance; file local chỉ là mirror phục vụ development, không thay thế durable production storage.

## Exit code và an toàn

- `0`: validation/import pass; warning không làm command fail.
- `1`: schema error, environment-policy rejection, missing foreign key, duplicate/conflict hoặc DB error.
- Mọi import thật phải có `DATA_IMPORT_TARGET_ENVIRONMENT` khớp `--environment`; không override target inline trong command history.
- CLI không tự merge địa điểm gần giống và không tự sửa `data_type`/`is_simulated`.
- Free-text từ CSV không được in vào summary ngoài validation message tối thiểu.

## Verification

```bash
pnpm data:verify
```

Integration verification chạy boundary → POI/provider mapping → place area → vibe report; kiểm tra spatial membership, provenance update, ownership conflict và idempotence, sau đó rollback toàn bộ dữ liệu test.

`pnpm service-areas:verify` là verification dành riêng cho ba vùng MVP đang active. Command fail nếu source object khác checksum DB, provenance/version/geometry sai, membership khác kết quả `ST_Covers`, hoặc fixture mang nhãn quận mục tiêu không được cover đúng vùng.
