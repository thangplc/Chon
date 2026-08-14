# Chốn

**Chốn** là bản đồ khám phá quán cà phê tại TP.HCM theo tâm trạng, hoàn cảnh và thời điểm — thay vì chỉ theo tên hoặc danh mục.

Ví dụ truy vấn:

- Một quán yên tĩnh để làm việc một mình vào sáng Chủ nhật.
- Chỗ hẹn đầu tiên, ánh sáng ấm và không quá ồn.
- Quán mở muộn, có thể ngồi một mình mà không ngại.

## Trạng thái

Dự án đã hoàn thành engineering scope của Sprint 1 và Sprint 2 — Explore map/list. Vertical slice responsive hiện đọc CSV giả lập đã import vào PostgreSQL, đồng bộ map viewport với list qua spatial API, cluster marker, có trạng thái loading/error/empty và accessible list fallback; provider vibe vẫn tắt.

Tài liệu nền tảng:

- [Context sản phẩm](CONTEXT.md)
- [Plan phát triển](PLAN.md)
- [Tech stack](TECH_STACK.md)

Tài liệu chi tiết hỗ trợ:

- [Product brief](docs/product-brief.md)
- [Kiến trúc và dữ liệu](docs/architecture.md)
- [Roadmap theo sprint](ROADMAP.md)
- [Sprint 0 review pack](SPRINT-0-REVIEW.md)
- [Sprint 1 provider spike](PROVIDER-SPIKE.md)
- [Provider vibe terms/credential/coverage spike](docs/provider-vibe-spike.md)
- [Vibe taxonomy](docs/vibe-taxonomy.md)
- [Purpose profiles](docs/purpose-profiles.md)
- [Prototype specification](docs/prototype-spec.md)
- [Data contract](docs/data-contract.md)
- [Data operations](docs/data-operations.md)
- [Data importer runbook](docs/data-import.md)

Prototype để review:

- Mobile: `prototype/index.html`
- Tablet: `prototype/tablet.html`
- Desktop: `prototype/desktop.html`

## Phát triển local

Yêu cầu Node.js `>=20.9.0` và pnpm `9.10.0`.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Cấu hình bản đồ local trong `.env`:

```bash
NEXT_PUBLIC_MAPTILER_API_KEY=your_browser_key
NEXT_PUBLIC_MAPTILER_STYLE_ID=streets-v4
```

MapTiler key là browser key công khai và phải được giới hạn allowed origins trong MapTiler Cloud. Khi thiếu key, Explore fail-safe sang danh sách và không khởi tạo bản đồ.

Quality checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions chạy `typecheck`, `lint` và `test` trên mọi push, pull request và khi kích hoạt thủ công. Workflow dùng Node.js 22, pnpm `9.10.0`, frozen lockfile và cache pnpm.

Kiểm tra trạng thái feature flag, production gate và credential của các provider vibe mà không gọi API:

```bash
pnpm provider:status
```

Local database:

```bash
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm db:verify
pnpm data:import seed --dir data/fixtures --environment local --dry-run
pnpm data:import seed --dir data/fixtures --environment local
pnpm data:verify
```

Explore local không đọc CSV trực tiếp và không hard-code địa điểm/vibe trong UI. CSV trong `data/fixtures` chỉ là dữ liệu giả lập; importer validate và ghi nó vào PostgreSQL, sau đó server repository truy vấn DB để render trang.

Spatial place API:

```text
GET /api/places?bbox=106.68,10.75,106.76,10.85&limit=50
GET /api/places?lat=10.775&lng=106.700&radius=1500&limit=50
```

Chạy integration verification cho bbox/radius, service-area membership và geography index:

```bash
pnpm spatial:verify
```

Chi tiết contract và giới hạn tại [Spatial place query](docs/spatial-place-query.md).

Xem quy trình migration và nguyên tắc an toàn tại [Database runbook](docs/database.md).

## Trạng thái quyết định

Sprint 0 hoàn thành ngày 2026-08-13. Taxonomy v1 và data contract v1.0 đã được duyệt; contract hiện ở v1.1 sau addendum provider vibe. Sprint 1 đã scaffold ứng dụng, thiết lập PostgreSQL/PostGIS/Drizzle, tạo core schema, provider provenance mapping và `provider_vibe_signals`; local migration cùng integration verification đã pass trên cổng `5432`.

Các task cần collect thông tin thật đang được hoãn. Sprint 0 hiện tập trung vào product definition và technical prototype; dự án chưa được xem là đã product validation.

## Phạm vi MVP đề xuất

- Khu vực: Quận 1, Quận 3 và Bình Thạnh, TP.HCM.
- Danh mục: quán cà phê.
- Tình huống: làm việc, đi một mình và hẹn hò.
- Dữ liệu ban đầu: 50–100 địa điểm được curate.
- Nền tảng: responsive web/PWA.

## Nguồn dữ liệu MVP

- POI nền lấy từ provider bên thứ ba có điều khoản phù hợp.
- Founder/curator xác minh seed bằng CSV; developer chạy validation/import script.
- Vibe được kết hợp từ đóng góp trực tiếp trên Chốn và provider signals từ Foursquare Places Pro/Premium, Google Places, Yelp, Tripadvisor.
- Provider signals dùng cho cold-start/bổ trợ, lưu tách khỏi `vibe_reports` và chỉ bật sau gate về coverage, quyền sử dụng, attribution, credential và chi phí.
- Admin Dashboard không thuộc MVP và chỉ được cân nhắc sau beta.

| Data type | Mục đích | Môi trường |
|---|---|---|
| `synthetic` | Phát triển và kiểm thử | Local, CI, staging |
| `research` | Trải nghiệm thật trong Sprint 0 | Prototype/research |
| `editorial` | Nhóm Chốn xác minh và curate | Production |
| `community` | Người dùng đóng góp trên Chốn | Production |

Synthetic và research không được import trực tiếp vào production.

## Nguyên tắc sản phẩm

1. Vibe thay đổi theo khung giờ, không phải thuộc tính cố định.
2. Đóng góp phải hoàn thành trong khoảng 10 giây.
3. Hiển thị độ tin cậy, không giả vờ dữ liệu ít là chính xác.
4. Không bán điểm vibe hoặc thứ hạng tự nhiên cho địa điểm.
5. Bắt đầu nhỏ với dữ liệu sâu trước khi mở rộng địa lý.
