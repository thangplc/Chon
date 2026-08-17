# Chốn API

NestJS REST API owns runtime access to PostgreSQL/PostGIS. Next.js calls this
service and does not query the database from request paths.

## Ownership

```text
src/database/       Drizzle schema/client/PostGIS queries và Nest DB module
src/data-pipeline/  CSV/boundary validation và transactional importer
src/providers/      Third-party provider flags, policy, adapters và registry
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
AUTH_API_SECRET=dev-only-change-this-auth-api-secret-32chars
AUTH_API_ISSUER=chon-web
AUTH_API_AUDIENCE=chon-api
DATA_IMPORT_TARGET_ENVIRONMENT=local
EXPLORE_PLACE_DATA_MODE=synthetic
```

`EXPLORE_PLACE_DATA_MODE` quyết định dataset Explore đọc từ PostgreSQL:
`synthetic` chỉ seed giả lập, `mixed` gồm cả seed và POI thật, còn `real` chỉ
đọc địa điểm và community report có `is_simulated=false`. Sau khi import và
verify POI thật, đặt `EXPLORE_PLACE_DATA_MODE=real` rồi restart API để không
query các quán giả lập. `EXPLORE_INCLUDE_REAL_PLACES` được giữ lại để tương
thích với `.env` cũ; nếu không đặt mode mới, `true` tương đương `mixed`.

`EXPLORE_PLACE_METADATA_MODE` độc lập với POI mode và quyết định cách merge
metadata demo cho POI thật:

- `real`: chỉ dùng các trường canonical trên `places`.
- `mixed`: giữ giá trị canonical, chỉ dùng overlay synthetic cho trường còn
  thiếu.
- `synthetic`: dùng overlay synthetic khi có để test UI.

Overlay nằm trong `place_metadata_overlays`, không ghi đè `places` và chỉ được
nhập cho POI thật (`is_simulated=false`). Production bắt buộc dùng
`EXPLORE_PLACE_METADATA_MODE=real`.

Template và importer:

```bash
pnpm metadata:synthetic:import \
  --file data/templates/place-metadata-overlays.csv \
  --environment local --dry-run
```

CSV dùng `place_id` là `places.internal_id`; `opening_hours` và `amenities`
là JSON. Importer có idempotent upsert, kiểm tra POI published/real và không
cho phép environment production. UI luôn gắn nhãn `Dữ liệu minh họa — chưa
xác minh` khi overlay được sử dụng.

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
- `GET /v1/auth/me` (requires a signed server assertion)
- `GET /v1/places?bbox=west,south,east,north&limit=50`
- `GET /v1/places?lat=10.775&lng=106.700&radius=1500&limit=50`
- `GET /v1/places/:slug`
- `GET /v1/places/:slug/vibe?day_type=weekday&time_bucket=morning&area_id=<uuid>`
- `GET /v1/explore/simulated`
- `POST /v1/analytics/events`
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

## Provider vibe adapters

Bốn adapter `foursquare_places`, `google_places`, `yelp` và `tripadvisor` hiện
được triển khai theo hướng fixture-first. Adapter chỉ nhận payload đã được
transport layer lấy về; nó không tự gọi API. Normalizer áp dụng field/storage
allowlist, giữ `place_id`/`place_source_id` và provenance, từ chối raw payload
hoặc dimension mapping khi terms chưa cho phép, rồi map sang input của
`provider_vibe_signals`.

Response contract `v1` kiểm tra object shape và range của các field candidate
trước khi adapter đọc dữ liệu. Fixture được version trong
`src/providers/vibe/fixtures/v1/` và luôn đánh dấu synthetic; chưa có fixture
nào được coi là response thật của provider.

Kiểm tra local mà không gọi provider và không ghi database:

```bash
THIRD_PARTY_VIBE_ENABLED=true \
GOOGLE_VIBE_INGEST_ENABLED=true \
GOOGLE_PLACES_API_KEY=fixture \
pnpm provider:vibe:normalize --provider google_places \
  --place-id <place-id> --place-source-id <place-source-id> \
  --provider-place-id <google-place-id> \
  --retrieved-at 2026-08-14T10:00:00Z --dry-run --json
```

Lệnh trên chỉ dùng payload fixture nội bộ. Live API client, matching/sync job,
coverage smoke test và production enablement vẫn bị chặn bởi credential,
commercial/partner approval, attribution và cost gate trong
`docs/provider-vibe-spike.md`.

## VIETMAP POI sync

VIETMAP được triển khai ở POI provider boundary riêng, không thuộc provider vibe.
Fixture spike và live read-only smoke test không ghi database. Live sync dùng
importer guarded; API key chỉ được đọc ở backend từ `apps/api/.env`.

```bash
# Fixture mode, không gọi mạng và không ghi database
pnpm vietmap:poi:spike --fixture --json

# Live read-only smoke test, cần bật flag và đặt VIETMAP_API_KEY
VIETMAP_POI_ENABLED=true \
VIETMAP_API_KEY=<server-key> \
pnpm vietmap:poi:spike --live \
  --lat 10.78 --lng 106.69 --radius 750 --json

# Live sync vào importer guarded; dry-run không ghi database
VIETMAP_POI_MAX_REQUESTS=500 \
pnpm vietmap:poi:sync --areas hcm-q1,hcm-q3,hcm-binh-thanh \
  --category 1001-1 --dry-run

# Sync thật vào môi trường đã khai báo trong DATA_IMPORT_TARGET_ENVIRONMENT
VIETMAP_POI_MAX_REQUESTS=500 \
pnpm vietmap:poi:sync --areas hcm-q1,hcm-q3,hcm-binh-thanh \
  --category 1001-1 --environment local
```

Sync tạo `places` với `is_simulated=false`, lưu `vietmap_maps` và `ref_id` trong
`place_sources`, sau đó importer tự tính membership `place_service_areas` từ
boundary hiện hành. `--dry-run` vẫn gọi live API và chỉ thực hiện các query đọc.
Search v4 trả `ref_id`/thông tin POI; sync gọi thêm Place v4 khi thiếu tọa độ,
sau đó gọi Reverse v4 khi địa chỉ chưa đủ cụ thể, lấy thêm số nhà/đường/hẻm/
phường/quận/thành phố theo tọa độ trước khi tạo canonical place. Địa chỉ sau
chuẩn hóa được lưu vào `places.address`;
district hiển thị được xác định theo boundary thực tế của tọa độ, không theo
tâm search. Production còn yêu cầu
`VIETMAP_POI_PRODUCTION_READY=true` ngoài các guard môi
trường/import hiện có. `VIETMAP_POI_MAX_REQUESTS` tính cả Search, Place,
Reverse và retry cho lỗi 429/5xx. Reverse chạy với concurrency giới hạn để
tránh burst request.
Production vẫn bị khóa bởi credential, category cafe, quota, terms, attribution
và coverage gate.
Chi tiết nằm trong [VIETMAP POI integration plan](../../docs/vietmap-poi-integration-plan.md).

## OSM opening-hours enrichment

Giờ mở cửa có thể được enrich miễn phí từ tag `opening_hours` của
OpenStreetMap qua Overpass. Lệnh chạy backend-only, tuần tự theo batch và có
request guard; không dùng Nominatim để bulk lookup. Trước khi chạy, đặt
`OSM_USER_AGENT` có thông tin liên hệ trong `apps/api/.env` và bật feature flag
chỉ cho terminal hiện tại:

```bash
OSM_OPENING_HOURS_ENABLED=true \
OSM_USER_AGENT='Chon/0.1 (contact@example.com)' \
pnpm osm:opening-hours:sync --dry-run --environment local --json
```

Khi dry-run cho thấy match hợp lệ, import local:

```bash
OSM_OPENING_HOURS_ENABLED=true \
pnpm osm:opening-hours:sync --environment local
```

Pipeline chỉ đọc place thật (`is_simulated=false`) đang published và chỉ ghi
`opening_hours` khi field còn trống. Lịch v1 chỉ nhận regular same-day rules
như `Mo-Fr 07:00-22:00; Sa-Su 08:00-23:00`; `24/7`, ngày lễ, sunrise/sunset
và giờ qua nửa đêm được báo `unsupported/invalid`, không tự suy diễn. Mỗi
match lưu `openstreetmap:<type>:<id>`, source URL, retrieved time và raw tags
tối thiểu trong `place_sources`. OSM attribution phải được hiển thị ở UI khi
hiển thị metadata này.

Các biến chính:

```ini
OSM_OPENING_HOURS_ENABLED=false
OSM_OPENING_HOURS_PRODUCTION_READY=false
OSM_OVERPASS_URL=https://overpass.openstreetmap.fr/api/interpreter
OSM_USER_AGENT=Chon/0.1 (OSM opening-hours enrichment; contact@example.com)
OSM_OPENING_HOURS_BATCH_SIZE=20
OSM_OPENING_HOURS_MAX_REQUESTS=10
OSM_OPENING_HOURS_RADIUS_METERS=100
OSM_OPENING_HOURS_TIMEOUT_MS=15000
```

Không bật production guard nếu chưa review terms, coverage, attribution và
request cadence của Overpass. Lịch phức tạp/qua nửa đêm cần mở rộng contract
trước khi hỗ trợ.

## Vibe snapshots

Snapshot là dữ liệu dẫn xuất từ các `vibe_reports` đã `approved`. Rebuild chỉ
ghi component `contribution`. API đọc snapshot contribution và provider signal
đã allowlist để tạo một kết quả `canonical`; raw provider score không được trả
về. Provider ranking mặc định tắt và chỉ có hiệu lực khi master flag, provider
ranking flag và production gate phù hợp.

```bash
# Kiểm tra số report/snapshot mà không ghi database
pnpm vibe:snapshots:rebuild --environment local --dry-run

# Rebuild idempotent trong database local
pnpm vibe:snapshots:rebuild --environment local
```

Lệnh ghi yêu cầu `DATA_IMPORT_TARGET_ENVIRONMENT` trong `apps/api/.env` khớp
với `--environment`. Production chỉ nhận report `editorial`/`community` không
mô phỏng.

Response canonical giữ `sourceDataTypes`, `sourceProviders`, `reportCount`,
`providerSignalCount`, `confidence` và `isSimulated`. Contribution mô phỏng
không được trộn với provider signal; production thiếu evidence trả trạng thái
không đủ dữ liệu thay vì tự dùng synthetic.

Explore response cũng trả `vibes` theo `place_id`/`time_bucket` trong cùng một
request. Web dùng index này để ranking và không gọi endpoint vibe riêng cho
từng địa điểm.
