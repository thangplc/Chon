# Collections v1

Sprint 6.1 triển khai thao tác lưu địa điểm bằng collection private mặc định
`Đã lưu`. Mô hình này tránh tạo bảng bookmark tạm và là nền cho collection tùy
chỉnh ở task tiếp theo.

## Quyền sở hữu

- Tất cả endpoint `/v1/me/saved-places` yêu cầu Google-authenticated identity.
- API lấy `user_id` từ assertion đã xác minh; client không được truyền owner.
- Collection mặc định luôn `private` và mỗi user chỉ có tối đa một collection
  mặc định.
- `PUT` và `DELETE` là idempotent; cặp collection/place không thể bị trùng.

## API

```http
GET    /v1/me/saved-places
GET    /v1/me/saved-places/:slug
PUT    /v1/me/saved-places/:slug
DELETE /v1/me/saved-places/:slug
```

Web gọi các endpoint trên qua same-origin proxy `/api/me/saved-places` để tạo
server assertion. Người chưa đăng nhập được đưa qua Google OAuth và quay lại URL
ban đầu với ý định lưu được bảo toàn.

## Collection tùy chỉnh

- `/saved` quản lý collection riêng tư/công khai của user.
- API owner `/v1/me/collections` lấy ownership từ assertion, không nhận
  `user_id` từ client.
- Public collection chỉ đọc qua `/v1/collections/:id`; private collection trả
  not-found để không làm lộ sự tồn tại.
- URL public dùng UUID bất biến, không phụ thuộc việc đổi tên collection.
- Collection mặc định không thể đổi metadata hoặc xóa.
- Public page được server-render và có title, description, canonical,
  Open Graph/Twitter metadata cùng preview image động. Cấu hình origin bằng
  `SITE_URL`; crawler không thể đọc collection private.

## Deferred

Ghi chú, reorder và metadata social sharing thuộc các task Sprint 6 tiếp theo.
Schema đã có `note` và `position`, nhưng chưa expose mutation cho các field đó.

## Collection editorial

- Collection do Chốn curate dùng `owner_type=editorial`, không gắn với tài
  khoản user giả.
- Draft không thể đọc qua public API. Chỉ record `public` + `published` mới có
  trang chia sẻ và badge `Chốn tuyển chọn`.
- Membership tham chiếu POI thật đã published; importer từ chối POI mô phỏng,
  giữ thứ tự `position` và ghi chú editorial.
- Import bằng CSV là workflow tạm thời trước Admin phase; lệnh hỗ trợ dry-run,
  khóa transaction, chạy lại idempotent và production guard.

```bash
pnpm editorial:collections:import --file data/fixtures/editorial-collections.csv --environment local --dry-run
pnpm editorial:collections:import --file data/fixtures/editorial-collections.csv --environment local
```

## Analytics

- Chỉ ghi `place_save_succeeded` sau khi API lưu vào collection thành công.
- Chỉ ghi `collection_share_clicked` sau khi URL public được sao chép thành
  công.
- Link chỉ đường ở trang chi tiết địa điểm và public collection ghi
  `directions_opened` với provider `openstreetmap`.
- Payload không chứa user identity, nội dung ghi chú, vị trí thiết bị hoặc tọa
  độ địa điểm. Lỗi analytics không chặn thao tác chính.
