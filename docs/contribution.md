# Community vibe contribution v1

## Scope

Sprint 5.2 adds a three-step, mobile-first community report flow from both
Explore and Place Detail. Explore and Place Detail remain public; submitting a
report requires a Google-authenticated user. A guest is sent through Auth.js
and returned to the same origin URL. Explore preserves `contribute=1` and
`place=<slug>` alongside its filter query.

## API

```http
POST /v1/places/:slug/vibe-reports
Authorization: Bearer <short-lived server assertion>
```

The browser calls the same-origin Next.js proxy. The proxy creates the signed
assertion; the client never sends `user_id`, moderation or provenance fields.
The API validates the place, authenticated account, visit timestamp and the
minimum of three scores.

Server-owned report fields:

```text
data_type=community
is_simulated=false
moderation_status=approved
location_verification=none
day_type/time_bucket=derived from visited_at in Asia/Ho_Chi_Minh
user_id=authenticated users.id
```

The existing `vibe_reports.user_id` string column is intentionally retained for
fixture compatibility. Authenticated UUIDs are stored as strings until the
synthetic fixture identities are retired in a later migration.

## UI states

1. Context: visit mode, date and time.
2. Questions: ba chiều chính theo visit mode là bắt buộc; ba chiều còn lại là
   tùy chọn, kèm seat availability. Ranking dùng các chiều hiện có và chuẩn hóa
   lại trọng số; kết quả dưới 6/6 chiều phải được ghi là đánh giá tạm thời.
3. Note and submit: optional note up to 140 characters and a final summary.

Trong MVP hiện tại, report vượt qua validation được auto-publish với
`moderation_status=approved`. API rebuild snapshot riêng của POI ngay sau khi
insert để Explore và Place Detail có thể đọc contribution mới mà không cần chạy
script thủ công. Quy trình `pending`/approve/reject thủ công được hoãn sang Admin
phase 2.

## Basic abuse protection

Authenticated community submissions are serialized per `user_id` with a
PostgreSQL advisory transaction lock. The API rejects an identical report,
limits burst and daily submissions, and applies a per-place cooldown before it
writes a report or rebuilds a snapshot. Limits are configured with
`VIBE_REPORT_LIMIT_10_MINUTES`, `VIBE_REPORT_LIMIT_24_HOURS` and
`VIBE_REPORT_PLACE_COOLDOWN_MINUTES`.

Rate-limit responses use HTTP `429`, include `Retry-After` and return a
Vietnamese retry message. Exact IP addresses are not stored for this business
rule. Edge/DDoS protection, advanced reputation and moderation controls remain
deferred to production infrastructure and Admin phase 2.

## Near-place verification

Sprint 5.3 adds optional, user-triggered near-place verification. The browser
requests geolocation only after the user presses `Xác minh vị trí` and sends a
short-lived `locationEvidence` object with the report. The API uses PostGIS to
calculate the distance to the canonical POI and owns the resulting value:

- `verified`: at most 150 metres away with accuracy at most 100 metres.
- `approximate`: at most 500 metres away with accuracy at most 500 metres.
- `none`: no evidence, insufficient accuracy or outside the accepted radius.

Evidence older than ten minutes is rejected. Exact user coordinates and the
calculated distance are not persisted; only `location_verification` is stored
on `vibe_reports`. Evidence only verifies a visit within six hours of capture;
older recalled visits remain `none`. This is a proximity signal, not proof that
a user entered or purchased from the venue.

## Visit evidence modes

Contribution flow hỏi loại trải nghiệm trước khi cho chấm vibe:

1. `on_site` — “Tôi đang ở đây”: cho phép người dùng chủ động xác minh GPS.
   Backend tiếp tục tự tính `verified`, `approximate` hoặc `none`; browser không
   được tự gửi kết quả verification.
2. `recalled` — “Tôi đã ghé trước đó”: không dùng GPS hiện tại, bắt buộc chọn
   ngày và khung giờ đã ghé, sau đó backend lưu
   `location_verification=recalled`.
3. `not_visited` — “Tôi chưa ghé, chỉ chia sẻ cảm nhận”: không tạo
   `vibe_report`. UI chuyển sang suggestion flow riêng; suggestion không được
   đưa vào snapshot, confidence hoặc ranking.

`not_visited` là trạng thái điều hướng UI, không phải một giá trị mới của
`location_verification`. Report `on_site` và `recalled` hợp lệ được auto-publish
trong MVP; snapshot vẫn chỉ aggregate report `approved`.

## Community photo upload — final sprint deferred

Upload ảnh khi góp vibe được chốt cho sprint cuối sau khi visit-evidence và
moderation workflow ổn định. Dự kiến dùng S3-compatible object storage
(Cloudflare R2 ở production; local adapter hoặc MinIO khi phát triển), trong khi
PostgreSQL chỉ lưu `storage_key`, metadata, rights và moderation status.

Ảnh community không được hiển thị ngay sau upload. Chỉ media có
`rights_status=verified` và `moderation_status=approved` mới xuất hiện trong
`PlaceGallery`. Sprint cuối phải bao gồm presigned upload, validate MIME/size,
resize/thumbnail, strip EXIF, quyền sử dụng, moderation và orphan cleanup.
