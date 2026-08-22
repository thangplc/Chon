# Roadmap triển khai Chốn MVP

Kế hoạch mặc định: 8 tuần cho một developer, ưu tiên responsive web. Mỗi sprint kéo dài một tuần và phải tạo được phần mềm có thể demo.

## Sprint 0 — Product definition và prototype

**Trạng thái: hoàn thành ngày 2026-08-13.** User validation được hoãn đến checkpoint trước closed beta.

### Mục tiêu

Chốt mô hình sản phẩm và tạo prototype bằng dữ liệu giả lập trước khi đầu tư backend. Product validation với người thật được chủ động hoãn lại do hạn chế thời gian.

### Công việc

- [x] Chốt sáu chiều vibe và từ ngữ tiếng Việt — taxonomy v1 approved.
- [x] Thiết kế prototype mobile, tablet và desktop cho explore, result/detail và contribution — draft đã tạo.
- [x] Chốt CSV schema và người chịu trách nhiệm review seed — data contract v1.0 approved; founder/developer giữ ba vai trò MVP.
- [x] Tạo fixtures giả lập cho prototype, bốn data workflow, ranking và edge case.

### Deferred — không chặn Sprint 0 hiện tại

- Phỏng vấn 10–15 người thuộc persona chính.
- Thu thập 20 câu tìm kiếm địa điểm thật.
- Test prototype với ít nhất 5 người.
- Curate và xác minh danh sách 50 quán thật.
- Thu 20–40 report `research` từ trải nghiệm thật của người tham gia.

Các task này chưa hoàn thành và không được ghi nhận là validation. Chúng được chuyển sang checkpoint trước closed beta.

### Gate

- Sáu chiều vibe và vocabulary v1 được chốt ở mức giả thuyết.
- Prototype có đủ ba luồng: explore, result/detail và contribution.
- CSV/data contract v1 được chốt.
- Fixtures bao phủ bốn data workflow và các edge case chính.
- Tài liệu ghi rõ product assumptions chưa được kiểm chứng với người thật.

## Sprint 1 — Foundation

Trạng thái: **engineering-complete**. Live coverage là production gate deferred cho provider vibe và không chặn Sprint 2/community-only MVP.

- [x] Thực hiện data-provider spike; chốt POI/tile/geocoding và service-area boundary architecture — FSQ OS Places + MapTiler + OSM boundary; credential coverage smoke test còn là production gate.
- [x] Khởi tạo Next.js App Router/TypeScript strict, Tailwind CSS, ESLint, Prettier và Vitest/Testing Library.
- [x] Thiết lập PostgreSQL/PostGIS và migrations — container healthy trên `5432`; migration chạy thành công và PostGIS spatial smoke test đã pass.
- [x] Tạo schema `service_areas`, `service_area_boundaries`, `place_service_areas`, `places`, `place_areas`, `vibe_reports` — migration, PostGIS indexes và integration verification đã pass.
- [x] Tạo script validate/import boundary, POI và seed CSV, có `--dry-run` — transaction, conflict summary, spatial membership và integration verification đã pass.
- [x] Lưu provenance và mapping ID của provider — `place_sources`, FSQ mapping guards, sync metadata và integration verification đã pass.
- [x] Chốt hybrid vibe architecture — report do người dùng/nhóm Chốn đóng góp và provider signals từ Foursquare Places Pro/Premium, Google Places, Yelp, Tripadvisor được lưu/hiển thị tách provenance.
- [x] Hoàn thành terms desk research, credential audit và schema/migration `provider_vibe_signals` — migration `0004` cùng integration verification đã pass; chi tiết trong `docs/provider-vibe-spike.md`.
- [ ] Chạy live coverage smoke test trên 30 quán cho từng provider — đang chờ credential/commercial hoặc partner approval; chưa provider nào production-ready.
- [x] Production importer từ chối `synthetic` và `research` — fail-closed theo record, có file/row/reason trong summary.
- [x] Production importer từ chối mọi record `is_simulated=true` — áp dụng cho place, place area và vibe report.
- [x] Test bốn `data_type` và quy tắc môi trường — unit test policy và runner production dry-run đã pass.
- [x] Thiết lập GitHub Actions CI chạy typecheck, lint và test — Node 22, pnpm lockfile cache, read-only permissions và concurrency cancellation.

### Demo

Foundation, schema, importer, environment guards và CI đã được verify. UI active đã chuyển sang vertical slice Sprint 2, đọc fixture CSV giả lập qua PostgreSQL.

## Sprint 2 — Explore map/list

Trạng thái: **hoàn thành ngày 2026-08-14** — vertical slice dùng pipeline CSV giả lập → PostgreSQL → server repository; MapLibre/geolocation, clustering, ba service-area boundary và accessible list fallback đã hoạt động; chưa gọi provider vibe.

- [x] Tích hợp bản đồ và geolocation có xin quyền rõ ràng — MapLibre + MapTiler config fail-safe, marker từ tọa độ DB và permission flow chỉ chạy sau thao tác người dùng.
- [x] Import và kích hoạt boundary Quận 1, Quận 3 và Bình Thạnh — OSM relation `2587287`/`3819816`/`3797166`, source manifest/checksum/storage key, current boundary v1 và `place_service_areas` đã verify pass 12/12 fixture (4 mỗi vùng).
- [x] Query địa điểm theo bounding box/bán kính — `GET /api/places` validate hai spatial mode, chỉ lấy published place trong active/current service area, hỗ trợ meter-accurate radius, bounded limit/`hasMore` và geography GiST index; integration verification đã pass.
- [x] Đồng bộ map và list trên mobile — `moveend` gọi bbox API để lọc list, giữ rank marker/card, marker chọn và scroll tới card, card chọn và focus map; mobile dùng bottom sheet cuộn độc lập, API lỗi fallback về danh sách accessible.
- [x] Cluster marker và tạo trạng thái loading/error/empty — GeoJSON source dùng MapLibre native clustering; cluster click để zoom, marker đơn giữ rank/selection; map và viewport list có loading, retryable error, empty state cùng fallback không làm mất dữ liệu.
- [x] Làm fallback dạng danh sách accessible — skip-link bỏ qua map, semantic result region/list, keyboard focus, trạng thái chọn không phụ thuộc màu, live announcements và tự khôi phục danh sách đầy đủ khi map thiếu cấu hình hoặc lỗi.

### Demo

Người dùng xem và chọn quán trong ba quận mục tiêu.

## Sprint 3 — Place detail và vibe data

Trạng thái: **hoàn thành ngày 2026-08-16** — toàn bộ task Sprint 3 đã được implement và quality gates đã pass; live provider coverage vẫn là production gate deferred.

- [x] Trang chi tiết địa điểm — canonical `/places/[slug]`, intercepted responsive drawer từ Explore, published-only repository, single-place map, gallery tối đa 5 ảnh có rights/provenance, simulated media CSV pipeline và loading/error/not-found/accessible focus states.
- [x] Hiển thị giờ mở cửa, giá và khu vực trong quán — API detail trả lịch thường lệ, price/size/capacity và `place_areas`; seed importer hỗ trợ update allowlist; UI có trạng thái đủ/thiếu dữ liệu và fixture synthetic end-to-end.
- [x] Implement time buckets và vibe snapshots — chuẩn hóa 5 bucket theo timezone, snapshot contribution từ report approved, migration/API/rebuild `--dry-run` và provenance data types.
- [x] Viết provider adapters và normalize signal theo field/storage allowlist của từng nguồn — bốn adapter fixture-first, provenance mapping và fail-closed storage policy đã có; live transport/coverage gate vẫn deferred.
- [x] OSM opening-hours enrichment — Overpass lookup, name/distance matching, v1 same-day normalizer, guarded `--dry-run` import và `openstreetmap` provenance đã có; calendar/overnight rules vẫn deferred.
- [x] Implement fusion policy giữa contribution component và provider component, không làm mất provenance — read-path fusion trả một `canonical` result, provider ranking flag tắt mặc định, synthetic không trộn với provider và response giữ source/provider counts.
- [x] Hiển thị vibe dimensions, report count và confidence — Explore nhận canonical snapshots theo batch; card dùng snapshot để rank/hiển thị, Place Detail hiển thị đủ sáu chiều theo khung giờ và có empty/error state.
- [x] Unit test aggregation/confidence — coverage cho grouping/median, missing dimensions, provenance, confidence thresholds, synthetic isolation và provider fusion edge cases.

Policy nguồn và nguyên tắc chỉ hiển thị một kết quả Chốn vibe được ghi tại
`docs/vibe-data-policy.md`.

### Demo

Trang quán thay đổi vibe khi chọn thời gian dự định ghé.

## Architecture interlude — Backend extraction

Trạng thái: **hoàn thành ngày 2026-08-14**.

- [x] Khởi tạo NestJS REST API trong pnpm workspace.
- [x] Giữ Drizzle ORM, PostgreSQL/PostGIS và migration history hiện tại.
- [x] Chuyển spatial places, Explore dataset và Place Detail read path sang API.
- [x] Next.js chỉ còn web rendering và same-origin API proxy, không query DB trong request path.
- [x] Bổ sung OpenAPI, API tests, CI/build và cutover verification.

Chi tiết phase, boundary và gate: `docs/backend-extraction-plan.md`.

## Sprint 4 — Discovery và ranking

Trạng thái: **hoàn thành ngày 2026-08-16** — bộ chọn khu vực, bộ lọc metadata, preference weights, explainable ranking, chia sẻ URL và analytics Explore đã hoàn thành.

- [x] Bộ chọn khu vực hybrid, thời gian chính xác và tám mục đích — tìm kiếm trong dataset, quick district, geolocation/radius qua spatial API, chọn tâm trên bản đồ, ngày/giờ/thời lượng và mapping về `dayType`/`timeBucket`.
- [x] Bộ lọc quy mô, tiện ích và khoảng giá — contract/API trả metadata, domain lọc deterministic (tiện ích AND, khoảng giá overlap), UI responsive có trạng thái rỗng và xóa bộ lọc.
- [x] Mapping purpose sang preference weights mặc định — tám mục đích có target score và trọng số theo sáu chiều vibe; weighted score được chuẩn hóa về 0–100.
- [x] Explainable ranking phiên bản 1 — sinh explanation deterministic từ target/weight, hiển thị tối đa hai lý do và một lưu ý theo mục đích.
- [x] Hiển thị lý do phù hợp/điểm cần lưu ý — card Explore phân biệt lý do, lưu ý và trạng thái chưa đủ dữ liệu vibe.
- [x] Lưu filter vào URL để chia sẻ và đo analytics — canonical query, Clipboard share, anonymous context events và API persistence đã có; tọa độ không lưu vì privacy.

### Demo

Người dùng nhận danh sách xếp hạng khác nhau cho làm việc, đi một mình và hẹn hò.

## Sprint 5 — Contribution

- [x] Authentication và identity foundation — Google OAuth/Auth.js JWT session, `users`/`user_identities`, signed web-to-API assertion, `/v1/auth/me` và public Explore boundary.
- [x] Luồng vibe report 3 bước, mobile-first — authenticated community submit, three purpose-aware dimensions, pending moderation và explicit success/error states.
- [x] Xác minh gần địa điểm theo lựa chọn của người dùng — geolocation chỉ chạy khi user chủ động bấm; API đối chiếu POI bằng PostGIS, chỉ lưu mức `verified`/`approximate`/`none` và không lưu tọa độ user.
- [x] Chống spam và rate limit cơ bản — PostgreSQL-backed quota theo identity,
  cooldown theo địa điểm, duplicate detection và HTTP 429 có Retry-After.
- [x] Cập nhật snapshot sau khi report được auto-publish — rebuild riêng POI sau
  transaction thành công; snapshot chỉ tổng hợp report `approved`.

### Demo

Beta user gửi report trong dưới 15 giây và thấy dữ liệu địa điểm được cập nhật.

## Sprint 6 — Collections và sharing

- [x] Lưu địa điểm — collection private mặc định, API idempotent theo identity,
  trạng thái lưu trên Explore/Place Detail và trang `/saved`.
- [ ] Tạo collection public/private.
- [ ] Trang collection có metadata chia sẻ đẹp.
- [ ] Collection editorial đầu tiên.
- [ ] Event analytics cho save, share và open directions.

### Demo

Chia sẻ được “10 quán dành cho người thích đi một mình ở Sài Gòn”.

## Sprint 7 — Beta hardening

- [ ] Hoàn thiện 50–100 địa điểm thật.
- [ ] E2E cho bốn luồng quan trọng.
- [ ] Kiểm tra accessibility và mobile performance.
- [ ] Privacy policy, terms và quy trình xóa dữ liệu.
- [ ] Error monitoring, backup và operational checklist.
- [ ] Mời 50–100 beta users theo từng cohort.

### Release gate

- Không còn lỗi blocker trong khám phá hoặc đóng góp.
- 30 địa điểm có dữ liệu vibe đủ dùng.
- P95 API read phù hợp mục tiêu đã đo trên môi trường beta.
- Có dashboard theo dõi funnel khám phá → ý định ghé → đóng góp.

## Sau MVP

Chỉ ưu tiên dựa trên dữ liệu beta:

- Natural-language search.
- “Chọn giúp tôi”.
- Vibe heatmap theo khu vực.
- Recommendation cá nhân hóa.
- Chủ địa điểm xác minh profile và xem insight.
- Admin Dashboard cho service-area/boundary, POI import và moderation, gồm thao
  tác ẩn/khôi phục report và ghi audit event.
- Mở rộng sang khu vực hoặc loại địa điểm mới.

## Backlog ưu tiên P0

| Epic | Kết quả cần đạt |
|---|---|
| POI foundation | Có 50–100 địa điểm chính xác, import được và truy vết nguồn |
| Temporal vibe | Lưu, tổng hợp và hiển thị vibe theo thời gian |
| Explore | Tìm được địa điểm theo map/list và filter |
| Ranking | Xếp hạng giải thích được theo tám mục đích |
| Contribution | Thu report nhanh, có confidence và moderation |
| Measurement | Đo được funnel và chất lượng dữ liệu |

## Quyết định còn mở sau Sprint 0

1. Tên chính thức và domain.
2. Validation sáu chiều vibe với người dùng thật.
3. Nguồn POI/tile và điều khoản sử dụng dữ liệu.
4. Ba quận thử nghiệm có đủ thuận tiện cho nhóm curate hay không.
5. Có yêu cầu xác minh vị trí cho mọi report hay chỉ tăng trọng số.
6. Tiêu chí nào chứng minh người dùng thực sự có ý định ghé.
7. Consent chi tiết và tiêu chí xác minh vận hành để chuyển `research` thành `editorial` hoặc `community`.

Các mục trên không chặn scaffold Sprint 1. Provider/tile/geocoding phải được chốt trước khi hoàn thành adapter và map integration.
