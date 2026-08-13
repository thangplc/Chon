# Sprint 1 provider spike — decision record

Trạng thái: **provider architecture approved for implementation — 2026-08-13**.

Phạm vi: quán cà phê tại Quận 1, Quận 3 và Bình Thạnh. Quyết định này cho phép scaffold Sprint 1; production launch vẫn cần credential smoke test và kiểm tra mẫu 30 POI.

## 1. Quyết định

| Capability | Chọn | Cách dùng |
|---|---|---|
| POI nền | FSQ OS Places | Import snapshot/delta theo batch, lọc ba khu vực và category café/coffee shop |
| Ranh giới `service_area` | OpenStreetMap administrative boundary | Lưu GeoJSON nguồn bất biến trong S3-compatible object storage; validate/simplify rồi lưu runtime geometry trong PostGIS |
| Map renderer | MapLibre GL JS | Renderer open-source, không gắn domain model với SDK provider |
| Tile/style | MapTiler Cloud Flex khi public beta | Client gọi trực tiếp style/vector tiles bằng browser-restricted key |
| Geocoding | MapTiler Geocoding | Forward/reverse/autocomplete, ưu tiên `language=vi`, `country=vn`, bbox TP.HCM |
| Vibe bên thứ ba | Foursquare Places Pro/Premium + Google Places + Yelp + Tripadvisor | Adapter độc lập, normalize thành provider signals; chỉ bật sau terms/coverage/credential gate |
| Fallback dữ liệu | CSV editorial của Chốn | Bổ sung/sửa POI sau review, ưu tiên hơn provider trong canonical record |

Không chọn một vendor duy nhất cho cả POI và map. POI là dữ liệu batch có provenance; tile/geocoding là dịch vụ runtime. Hai adapter phải thay được độc lập.

## 2. Vì sao chọn

### FSQ OS Places cho POI

- Dataset miễn phí, dùng thương mại theo Apache 2.0 và có hơn 20 core attributes.
- Có `fsq_place_id`, tên, tọa độ, địa chỉ, category, ngày refreshed/closed, contact và delta add/update/remove/merge.
- Portal hỗ trợ truy vấn/tải qua Iceberg bằng DuckDB, Spark hoặc PyIceberg; phù hợp import có kiểm soát thay vì gọi API theo từng page view.
- Monthly snapshot/delta đủ cho quy mô 50–100 POI; Chốn vẫn xác minh trạng thái hoạt động bằng editorial workflow.
- OS dataset không cung cấp review, tips, rating, popularity, ảnh hay rich attributes; các tín hiệu này chỉ đi qua provider-vibe adapter riêng nếu được cấp quyền.

### MapTiler cho tile và geocoding

- Tương thích trực tiếp với MapLibre GL JS.
- Geocoding hỗ trợ `vi`, country filter, bbox và proximity; kết quả tìm kiếm có thể lưu cho phần lớn use case theo terms hiện tại.
- Một vendor cho tile + geocoding giảm vận hành ở MVP nhưng adapter vẫn giữ khả năng thay thế.
- Gói Free chỉ dùng cho development/evaluation; public commercial beta dùng tối thiểu Flex.

## 3. Các phương án đã so sánh

| Phương án | POI lưu dài hạn | Tile/MapLibre | Geocoding tiếng Việt | Lock-in/terms | Kết luận |
|---|---|---|---|---|---|
| FSQ OS Places + MapTiler | Apache 2.0; snapshot/delta | Tốt | Có `vi` | POI và runtime tách rời | **Chọn** |
| Geoapify all-in-one | Cho phép lưu/reuse, dựa trên open data | Tốt | ISO 639-1, cần smoke test `vi` | Một key/credit pool; OSM attribution | **Fallback số 1** |
| Foursquare Places API PAYG + tile vendor | Cache/attribution bị ràng buộc theo API EULA | Phụ thuộc vendor khác | API có search POI | `Powered by Foursquare` trên màn hình, hạn chế bulk/crawl | Không dùng cho canonical MVP |
| OSM public tiles/Nominatim/Overpass | Open data, nhưng public services không phải production backend | Best effort, không SLA | Có dữ liệu Việt | Policy/rate limit, có thể block | Chỉ research/diagnostic |

TomTom bị loại vì terms self-service cấm lưu Results ngoài client cache theo cache-control và không phù hợp với canonical POI database của Chốn.

## 4. Chi phí ước tính

### Giả định chuẩn

Ba mức dưới đây là **map/search sessions mỗi tháng**, không phải raw page views. Một session khởi tạo một map và dùng search/geocoding trong cùng flow. POI được đọc từ PostgreSQL của Chốn nên không phát sinh API call theo người dùng.

| Sessions/tháng | FSQ OS Places | MapTiler | Tổng cố định dự kiến |
|---:|---:|---:|---:|
| 1.000 | $0 | Free khi development; Flex khi public commercial | $0 dev / $25 public |
| 10.000 | $0 | Flex bao gồm 25.000 sessions | $25/tháng |
| 100.000 | $0 | Flex: $25 + 75.000 overage × $2/1.000 | khoảng $175/tháng |

MapTiler Flex hiện công bố $25/tháng, gồm 25.000 API sessions và 500.000 API requests; session vượt mức là $2/1.000. Giá chưa gồm thuế và phải được kiểm tra lại trước khi mở beta.

### Fallback Geoapify

Geoapify tính credit: khoảng 50 tile mỗi interactive map session, 1 tile = 0,25 credit; mỗi geocoding/autocomplete request = 1 credit. Với giả định một geocoding request/session:

| Sessions/tháng | Credits xấp xỉ | Tier gần nhất theo quota ngày trung bình | Giá công bố |
|---:|---:|---|---:|
| 1.000 | 13.500 | Free 3.000/day | $0 |
| 10.000 | 135.000 | API 10, 10.000/day | $59/tháng |
| 100.000 | 1.350.000 | API 50, 50.000/day | $179/tháng |

Đây là mô hình định hướng, không phải báo giá. Traffic burst, nhiều autocomplete keystroke và số tile thực tế có thể làm thay đổi tier.

## 5. Field allowlist

Adapter `fsq-os-places` chỉ được đọc và persist các field sau:

| Provider field | Canonical destination | Quy tắc |
|---|---|---|
| `fsq_place_id` | `place_sources.provider_place_id` | Unique cùng `provider=fsq_os_places` |
| `name` | `places.name` | Không ghi đè editorial đã xác minh |
| `latitude`, `longitude` | `places.location` | WGS84; conflict nếu dịch chuyển bất thường |
| `address`, `locality`, `region`, `postcode`, `admin_region`, `post_town`, `country` | canonical address/source metadata | Chuẩn hóa display address; giữ raw components có provenance |
| `fsq_category_ids`, `fsq_category_labels` | source metadata/category mapping | Chỉ import café/coffee shop trong taxonomy allowlist |
| `date_created`, `date_refreshed`, `date_closed` | source freshness/status evidence | `date_closed` tạo conflict/status candidate, không xóa cứng |
| `website`, `tel` | canonical contact fields | Chỉ dùng khi hợp lệ và không có editorial mới hơn |
| `placemaker_url` | `place_sources.source_url` | Link provenance/review |
| `unresolved_flags` | source quality flags | Flag record để review; không publish tự động |
| delta `action`, `redirect` | sync audit/mapping merge | `remove` archive candidate; `merge` chuyển mapping sau review |

Adapter `fsq-os-places` không ingest/persist các rich field sau vì chúng không thuộc OS schema:

- email và social handles;
- rating, popularity, tips, tastes và review text;
- photos/media URLs;
- price, hours, popular hours, calculated/veracity scores;
- raw response ngoài allowlist.

Các field trên chỉ được lấy qua adapter Foursquare Pro/Premium riêng khi đã có quyền truy cập và field/storage allowlist. Chúng được ghi vào `provider_vibe_signals`, không ghi vào `vibe_reports`.

Category filter không hard-code ID lấy từ Places API legacy. Mỗi dataset release phải resolve ID từ chính category dataset của FSQ OS Places, với allowlist tên chuẩn ban đầu là `Café` và `Coffee Shop`; parent category chỉ tạo candidate để review, không auto-publish. Import manifest lưu category dataset checksum và mapping đã dùng.

Giờ mở cửa, giá, tiện ích, media và vibe do Chốn trực tiếp thu vẫn đi qua editorial/community contract. Rich provider content đi qua provider signal contract v1.1 và không được đổi nhãn thành dữ liệu Chốn.

## 5.1. Provider vibe architecture

| Provider | Candidate signals | Vai trò dự kiến | Gate bắt buộc |
|---|---|---|---|
| Foursquare Places Pro/Premium | tips, tastes, popular hours, popularity, rating, price, amenities, photo labels | Nguồn cold-start giàu cấu trúc nhất | Early-access/commercial access, coverage VN và quyền persist/derive |
| Google Places | rating, reviews, review summary, price, amenities, photos | Runtime evidence và summary có attribution | Mặc định `reference_only`; chỉ cache/persist/derive nếu policy/hợp đồng cho phép rõ ràng |
| Yelp | rating, price, review excerpts/highlights, photos | Evidence bổ sung khi có coverage | Coverage TP.HCM, commercial plan và display/storage terms |
| Tripadvisor | rating, ranking, review breakdown/snippets, trip type, price | Evidence bổ sung cho địa điểm có listing | Partner approval, coverage café và display/storage terms |

```text
provider place ID
  → place_sources
  → provider adapter + field allowlist
  → normalized provider_vibe_signals
  → mapping_version + confidence
  → fusion với editorial/community ở query layer
```

Không cộng trung bình rating của các provider thành vibe score. Chỉ tín hiệu có evidence phù hợp mới được map sang một hoặc nhiều chiều; popular hours có thể hỗ trợ `crowd` theo thời gian, còn rating tổng hợp không chứng minh `noise`, `privacy` hoặc `workability`.

Fusion phải giữ hai component có thể giải thích:

- `contribution component`: report `editorial` và `community`, ưu tiên ngữ cảnh thời gian thực tế;
- `provider component`: tín hiệu cold-start/bổ trợ với confidence và freshness riêng.

UI phải cho biết nguồn nào đang đóng góp vào kết quả. Khi hai component mâu thuẫn hoặc provider signal quá cũ, confidence giảm thay vì âm thầm chọn một nguồn.

Terms/credential audit và live coverage protocol được ghi tại `docs/provider-vibe-spike.md`. Migration `0004_create_provider_vibe_signals` đã áp dụng và integration verification đã pass ngày 2026-08-13; live coverage vẫn chưa chạy vì credential, billing và quyền truy cập chưa được xác thực.

## 6. Geocoding allowlist và privacy

MapTiler geocoding request được phép gửi:

```text
query text do người dùng chủ động nhập
language=vi
country=vn
bbox hoặc proximity thô trong phạm vi TP.HCM
limit
```

Persist tối thiểu sau khi user chọn kết quả:

```text
provider feature id/reference
display name/address
longitude/latitude
country/region/district context
attribution/source
resolved_at
```

Không gửi user ID, session ID nội bộ, vibe preferences hay lịch sử vị trí cho geocoder. Không dùng IP bias. Tọa độ thiết bị chỉ gửi khi người dùng đã cấp quyền và thao tác cần proximity/reverse geocoding.

Tile key là public browser key có allowlist origin. Geocoding server key và provider access token chỉ nằm trong environment variables; không commit vào repository.

## 7. Attribution

- Map luôn hiển thị attribution do style cung cấp; tối thiểu gồm MapTiler và nguồn OpenStreetMap tương ứng với plan/terms.
- Geocoding record lưu attribution string/source cùng provenance.
- FSQ OS Places giữ copyright/license notice của dataset trong legal/attribution page và import manifest.
- Ranh giới `service_area` lấy từ OpenStreetMap phải giữ attribution OSM/ODbL trong source manifest và legal/attribution page.
- Không trộn attribution của FSQ OS Places với MapTiler/OSM thành một nguồn duy nhất.

## 8. Adapter boundary

```text
PoiSnapshotProvider
  readSnapshot(scope, categoryAllowlist)
  readDelta(since)
  mapSourceRecord(record)

GeocodingProvider
  search(query, locale, bounds, proximity?)
  reverse(coordinates, locale)

MapStyleProvider
  getStyleUrl()
  getAttribution()
```

Domain model chỉ nhận normalized DTO. Provider ID chỉ tồn tại trong `place_sources`; không làm `places.id`, slug hoặc public URL.

## 9. Service area boundary policy

Đã chốt mô hình **PostGIS + lưu bản nguồn**:

```text
OpenStreetMap administrative boundary
  → GeoJSON nguồn bất biến trong S3-compatible object storage
  → validate + repair có kiểm soát + simplify
  → PostGIS geometry(MultiPolygon, 4326) có spatial index
  → ST_Covers để gán POI vào service area
```

- Không commit GeoJSON ranh giới vào repository và không đọc file local trong runtime production.
- Object key phải bất biến theo `service_area code` và `boundary version`; file nguồn nên nén gzip nhưng giữ nguyên nội dung đã tải.
- Database lưu `source_storage_key`, `source_relation_id`, `source_url`, `source_license`, `retrieved_at`, `checksum`, `version` và cờ phiên bản hiện hành.
- Geometry dùng để query là bản đã validate/simplify trong PostGIS, không phải cột JSONB và không phải file GeoJSON nguồn.
- Mỗi lần cập nhật tạo boundary version mới; không ghi đè bản nguồn cũ. Chỉ một version được active cho mỗi service area và membership POI liên quan phải được tính lại khi active version thay đổi.
- Import phải hỗ trợ dry-run, kiểm tra geometry hợp lệ, xác minh CRS WGS84, giới hạn sai lệch diện tích và chuyển active version theo transaction.
- `district` từ POI provider chỉ là display/source metadata. Việc một quán thuộc khu vực nào được tính bằng `ST_Covers`, bao gồm điểm nằm trên biên.
- Public API trả danh sách khu vực active từ database. Chỉ serialize geometry sang GeoJSON khi client thực sự cần vẽ ranh giới.

## 10. Sync policy

- Initial import: FSQ OS Places snapshot → scope/category filter → dry-run → conflict report → import.
- Incremental: chạy monthly theo release/delta; không cần real-time sync trong MVP.
- `add/update`: so sánh với canonical priority; editorial thắng provider.
- `remove/closed`: chuyển thành review candidate; không xóa place hoặc vibe reports.
- `merge`: giữ internal place ID, đổi/add provider mapping sau conflict review.
- Mọi run ghi dataset release, adapter version, checksum, started/completed time, counts và operator.

## 11. Coverage evidence và giới hạn spike

Một truy vấn read-only OpenStreetMap/Overpass ngày 2026-08-13 trên bounding box bao phủ ba khu vực ghi nhận 765 đối tượng `amenity=cafe`. Các bbox xấp xỉ lần lượt có 459 ở Quận 1, 231 ở Quận 3 và 177 ở Bình Thạnh; bbox chồng lấn nên không cộng các số này. Đây chỉ chứng minh open-data có đủ candidate cho mục tiêu 50–100 quán, không chứng minh ranh giới hành chính, tính chính xác hoặc độ đầy đủ field.

FSQ OS Places và MapTiler chưa được gọi trực tiếp trong spike vì chưa có access token/API key. Vì vậy chưa được tuyên bố production-ready.

## 12. Gate còn lại trước import production

1. Tạo FSQ Places Portal token và MapTiler key ngoài repository.
2. Query/export tối thiểu 30 café candidates trong ba khu vực.
3. So sánh với 30 POI tham chiếu do founder chọn:
   - recall tên/địa điểm >= 80%;
   - tọa độ median lệch <= 75 m;
   - duplicate candidate <= 5%;
   - địa chỉ hiển thị usable >= 80%;
   - thử ít nhất 10 query có dấu/không dấu với geocoder `vi`.
4. Xác nhận attribution hiển thị đúng trên mobile, tablet và desktop.
5. Kiểm tra lại pricing/terms tại ngày mở public beta.

Nếu FSQ OS không đạt coverage gate, dùng `Geoapify Places` làm candidate provider và giữ CSV editorial làm canonical correction. Nếu MapTiler geocoding không đạt truy vấn tiếng Việt, chuyển riêng `GeocodingProvider` sang Geoapify; không đổi renderer hoặc POI pipeline.

## 13. Nguồn chính thức đã kiểm tra

- Foursquare: [OS Places schema](https://docs.foursquare.com/data-products/docs/places-os-data-schema), [access guide](https://docs.foursquare.com/data-products/docs/access-fsq-os-places), [categories](https://docs.foursquare.com/data-products/docs/categories), [release notes](https://docs.foursquare.com/data-products/docs/fsq-os-places-release-notes) và [Apache 2.0 announcement](https://foursquare.com/resources/blog/products/foursquare-open-source-places-a-new-foundational-dataset-for-the-geospatial-community/).
- Foursquare rich signals: [Places Pro and Premium schema](https://docs.foursquare.com/data-products/docs/places-pro-and-premium) và [flat-file rich attributes](https://docs.foursquare.com/data-products/docs/places-flat-file-overview).
- Google Places: [Place resource fields](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places) và [Places content, cache, review, summary attribution policies](https://developers.google.com/maps/documentation/places/web-service/policies).
- Yelp: [Places API overview, business details, reviews and highlights](https://docs.developer.yelp.com/docs/places-intro).
- Tripadvisor: [Content API overview](https://developer-tripadvisor.com/content-api/) và [access/approval FAQ](https://developer-tripadvisor.com/content-api/FAQ/). Tài liệu public hiện cảnh báo một số trang cũ; contract thực tế phải được xác nhận khi xin quyền truy cập.
- MapTiler: [Cloud pricing](https://www.maptiler.com/cloud/pricing/), [Geocoding OpenAPI](https://docs.maptiler.com/cloud/api/open-api/), [MapLibre integration](https://docs.maptiler.com/maplibre/), [attribution](https://docs.maptiler.com/guides/map-design/attribution/add-attribution/) và [Cloud terms](https://www.maptiler.com/terms/cloud/).
- Geoapify: [pricing](https://www.geoapify.com/pricing/), [credit model](https://www.geoapify.com/pricing-details/), [Places API](https://apidocs.geoapify.com/docs/places/), [storage policy](https://www.geoapify.com/geocoding-api/) và [terms](https://www.geoapify.com/terms-and-conditions/).
- OpenStreetMap Foundation: [tile policy](https://operations.osmfoundation.org/policies/tiles/), [vector tile policy](https://operations.osmfoundation.org/policies/vector/), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) và [attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines).
- TomTom: [Developer Terms](https://developer.tomtom.com/terms-and-conditions), đặc biệt giới hạn cache/store Results.

Các điều khoản và giá có thể thay đổi; implementation không hard-code quyền sử dụng ngoài allowlist này.
