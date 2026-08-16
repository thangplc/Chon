# Provider vibe spike — terms, credential và coverage

Ngày kiểm tra: **2026-08-13**.

## Kết luận

- Terms/access desk research: hoàn thành cho Foursquare, Google, Yelp và Tripadvisor.
- Credential audit tooling: hoàn thành; trạng thái presence hiện tại được đọc bằng `pnpm provider:status` và không chứng minh key hợp lệ.
- Live API coverage tại Quận 1, Quận 3 và Bình Thạnh: chưa chạy; credential, billing và quyền commercial/partner vẫn phải được xác thực trước khi gọi API.
- Schema/migration: `provider_vibe_signals` được triển khai với ba storage policy `reference_only`, `ttl_cache`, `persist_allowed`; migration `0004_create_provider_vibe_signals` và integration verification đã pass trên PostgreSQL local cổng `5432`.
- Chưa provider nào đạt production gate. Mỗi adapter phải có feature flag độc lập; provider lỗi hoặc bị tắt không được chặn contribution flow của Chốn.

## Feature flags và provider registry

Mọi provider mặc định tắt. `THIRD_PARTY_VIBE_ENABLED` là kill switch tổng; mỗi provider có hai công tắc độc lập:

- `*_VIBE_INGEST_ENABLED`: cho phép khởi tạo adapter và gọi API để lấy dữ liệu mới;
- `*_VIBE_RANKING_ENABLED`: cho phép signal đã lưu tham gia ranking/query fusion.

Tắt ingest không xóa dữ liệu đã lưu. Ranking có thể bật khi ingest tắt để dùng dữ liệu cache/persist còn hợp lệ. Khi kill switch tổng tắt, các công tắc riêng chỉ được ghi nhận là requested và không có hiệu lực.

Trong production, provider chỉ được bật nếu `*_VIBE_PRODUCTION_READY=true`. Flag này chỉ được đổi sau khi terms, coverage, attribution và cost gate đã được review; nó không tự chứng minh provider đã sẵn sàng.

Kiểm tra trạng thái hiệu lực mà không gọi API hoặc in secret:

```bash
pnpm provider:status
```

Registry tại `apps/api/src/providers/vibe/registry.ts` khởi tạo adapter theo kiểu
lazy. Provider tắt không được khởi tạo; ingest bật nhưng thiếu credential làm
config fail ngay; adapter chưa được implement/đăng ký sẽ bị từ chối thay vì âm
thầm bỏ qua.

### Adapter và normalizer hiện tại

Bốn adapter fixture-first đã được đăng ký trong provider registry:

| Provider | Product | Storage mặc định | Normalized DB input hiện tại |
|---|---|---|---|
| Foursquare | `places_premium` | `reference_only` | Chỉ provenance và signal metadata |
| Google | `places_api_new` | `reference_only` | Chỉ provenance và signal metadata |
| Yelp | `places` | `ttl_cache` | Signal value được allowlist, hết hạn sau 24 giờ |
| Tripadvisor | `content_api` | `reference_only` | Chỉ provenance và signal metadata |

Normalizer dùng allowlist theo provider/product để loại field ngoài contract,
từ chối raw payload và dimension mapping chưa được phép, bắt buộc
`place_id`/`place_source_id`/`provider_place_id`, đồng thời tạo input tương
thích với `provider_vibe_signals`. Các adapter không tự gọi mạng; command
`pnpm provider:vibe:normalize --dry-run` chỉ chạy fixture để kiểm tra mapping
và không ghi database.

Response contract `v1` còn validate kiểu/range của các field candidate trước
khi adapter đọc payload. Bộ fixture tại
`apps/api/src/providers/vibe/fixtures/v1/` có manifest ghi rõ
`isSynthetic: true`, không có endpoint và không có thời điểm capture. Vì vậy
fixture hiện tại chỉ là test boundary, không phải bằng chứng response thật.

Đây là implementation boundary, chưa phải production integration. HTTP client,
retry/quota handling, place matching, live 30-place coverage và production flag
vẫn phải chờ credential/commercial/partner approval và các gate bên dưới.

## Credential audit

Tên biến credential server-side:

```text
FOURSQUARE_PLACES_TOKEN
GOOGLE_PLACES_API_KEY
YELP_PLACES_API_KEY
TRIPADVISOR_CONTENT_API_KEY
```

Kiểm tra presence mà không in giá trị secret và không gọi API:

```bash
pnpm provider:credentials:check
```

Gate yêu cầu đủ cả bốn credential:

```bash
pnpm provider:credentials:gate
```

Key presence chỉ chứng minh secret đã được cấu hình; không chứng minh billing, scope, contract, coverage hay production readiness.

## Terms và khả năng sử dụng

| Provider | Tín hiệu candidate | Kết quả terms/access | Storage policy mặc định | Trạng thái coverage |
|---|---|---|---|---|
| Foursquare Places Pro/Premium | `hours_popular`, tips, tastes, popularity, rating, price, amenities, photo labels | Pro/Premium đang Early Access; rich-data access và quyền derive/persist phụ thuộc hợp đồng. Flat-file catalog liệt kê khu vực Southeast Asia gồm Việt Nam. | `reference_only` cho tới khi hợp đồng cho phép `persist_allowed` | Có bằng chứng khu vực ở mức catalog; chưa có field-level API/export sample |
| Google Places API (New) | rating, reviews, price, amenities; review summary khi được hỗ trợ | Standard policy hạn chế prefetch/cache/store, cho phép lưu place ID; review/summary yêu cầu attribution và link. Nội dung hiển thị trên map phải tuân thủ yêu cầu Google Map; Chốn dùng MapLibre nên chỉ xem xét evidence ở detail/list ngoài map. | `reference_only` | Review summaries hiện không hỗ trợ Việt Nam; rating/review/amenity vẫn cần live sample |
| Yelp Places | rating, price, tối đa ba review excerpt, review highlights, photos | FAQ cho cache tối đa 24 giờ và lưu Business ID vô thời hạn; standard Places integration không cho commercial analysis/biến đổi thành database riêng nếu không có chấp thuận phù hợp. | `ttl_cache` tối đa 24 giờ để display; không persist dimension derivation | Không có locale `vi_VN` trong danh sách hỗ trợ; live coverage TP.HCM chưa xác minh |
| Tripadvisor Content API | rating, ranking, review breakdown/snippets, trip type, price | Cần consumer-facing B2C site/app, API key/partner approval và approval cho integration. Public Content API pages cảnh báo nội dung cũ; quyền derive/persist phải xác nhận bằng contract hiện hành. Partner FAQ khuyến nghị cache 24 giờ. | `reference_only` hoặc `ttl_cache` 24 giờ cho tới khi có contract | Có sản phẩm cho restaurant content nhưng chưa có key/mapping sample tại TP.HCM |

## Quyết định kỹ thuật theo provider

### Foursquare

- Là candidate chính cho provider component có thể persist vì có `hours_popular`, tastes và popularity giàu cấu trúc.
- Không dùng FSQ OS Places để lấy vibe; OS dataset tiếp tục chỉ làm POI nền.
- Chỉ đổi sang `persist_allowed` sau khi hợp đồng ghi rõ field được lưu và được phép tạo derived scores.

### Google

- Chỉ lưu Google place ID và provenance cần thiết trong trạng thái `reference_only`.
- Không lưu review text, review summary hoặc derived dimension scores theo mặc định.
- Không dùng Google content để tạo marker/overlay trên MapLibre. Nếu hiển thị evidence ngoài map phải đáp ứng Google logo, author/source link và disclosure tương ứng.
- `reviewSummary` không phải nguồn khả dụng cho MVP Việt Nam theo danh sách region hiện tại.

### Yelp

- Chỉ cho phép cache content tối đa 24 giờ khi integration/plan cho phép; Business ID có thể lưu lâu dài để matching.
- Không dùng Yelp content để huấn luyện mapping hoặc persist sáu chiều vibe nếu chưa có chấp thuận bằng văn bản/enterprise license phù hợp.
- Thiếu locale Việt Nam là tín hiệu coverage rủi ro cao; vẫn giữ adapter candidate nhưng feature flag mặc định off.

### Tripadvisor

- Chỉ triển khai adapter sau partner approval và nhận tài liệu/contract hiện hành.
- Dùng location ID cho matching; content cache tối đa theo contract/FAQ và luôn giữ attribution/deep link.
- Adapter candidate vẫn được giữ nhưng feature flag mặc định off cho tới khi live coverage pass.

## Live coverage protocol

Khi credential, billing và quyền truy cập đã được xác nhận, dùng cùng một tập 30 quán canonical: 10 Quận 1, 10 Quận 3 và 10 Bình Thạnh. Không chọn quán từ chính provider đang đo để tránh bias.

Mỗi provider phải xuất report chỉ chứa dữ liệu được phép lưu:

```text
provider
dataset_or_api_version
tested_at
requested_count
matched_count
match_rate
coordinate_median_error_m
rating_coverage
review_or_summary_coverage
time_signal_coverage
amenity_coverage
estimated_calls_per_sync
estimated_monthly_cost
terms_review_reference
```

Gate tối thiểu:

1. Match đúng ít nhất 80% tập tham chiếu và median coordinate error không quá 75 m.
2. Ít nhất 60% địa điểm có một tín hiệu vibe hợp lệ, có quyền sử dụng và không chỉ là overall rating.
3. Mọi field persist/TTL/reference đều khớp field allowlist và storage policy; compliance phải đạt 100%.
4. Attribution/deep link/disclosure render đúng trên mobile, tablet và desktop.
5. Có cost estimate ở 1.000, 10.000 và 100.000 place-detail fetch/tháng.
6. Không log credential, raw personal data hoặc review text ngoài policy.

Không đạt gate thì adapter vẫn tắt; không hạ tiêu chuẩn bằng cách scrape hoặc đổi provider content thành `community`/`editorial`.

## Nguồn chính thức

- Foursquare: [Places Pro/Premium schema](https://docs.foursquare.com/data-products/docs/places-pro-and-premium), [flat-file regions và rich attributes](https://docs.foursquare.com/data-products/docs/places-flat-file-overview).
- Google: [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Place fields](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places), [review-summary regions](https://developers.google.com/maps/documentation/places/web-service/review-summaries), [billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing).
- Yelp: [Places FAQ](https://docs.developer.yelp.com/docs/places-faq), [supported locales](https://docs.developer.yelp.com/docs/resources-supported-locales), [API terms](https://terms.yelp.com/developers/api_terms/20250909_en_us/).
- Tripadvisor: [Developer portal](https://developer-tripadvisor.com/), [Content API FAQ](https://developer-tripadvisor.com/content-api/FAQ/), [Partner FAQ](https://developer-tripadvisor.com/partner/faq/index.html).
