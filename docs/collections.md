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

## Deferred

CRUD collection tùy chỉnh, public/private sharing, ghi chú, reorder và metadata
social sharing thuộc các task Sprint 6 tiếp theo. Schema đã có `visibility`,
`note` và `position`, nhưng chưa expose mutation cho các field đó.
