# Spatial place query

## API contract

`GET /api/places` yêu cầu đúng một trong hai spatial mode:

```text
GET /api/places?bbox=west,south,east,north&limit=50
GET /api/places?lat=10.775&lng=106.700&radius=1500&limit=50
```

- `bbox` dùng EPSG:4326 theo thứ tự west, south, east, north. MVP không nhận bbox qua antimeridian và giới hạn mỗi chiều tối đa 1 độ.
- `radius` tính bằng mét, từ 50 đến 20.000; `lat`, `lng` và `radius` phải xuất hiện cùng nhau.
- `limit` mặc định 50, tối đa 100. Query lấy `limit + 1` để xác định `meta.hasMore` nhưng không trả lookahead record.
- Parameter không biết, parameter lặp, kết hợp cả hai spatial mode hoặc tọa độ ngoài phạm vi đều trả problem response `400`.

Response thành công:

```json
{
  "data": [
    {
      "id": "uuid",
      "slug": "example-place",
      "name": "Example Place",
      "latitude": 10.775,
      "longitude": 106.7,
      "distanceMeters": 125,
      "serviceArea": { "code": "hcm-q1", "name": "Quận 1" }
    }
  ],
  "meta": {
    "count": 1,
    "hasMore": false,
    "query": { "kind": "radius", "latitude": 10.775, "longitude": 106.7, "radiusMeters": 1500, "limit": 50 }
  }
}
```

`distanceMeters` là `null` với bbox và là khoảng cách làm tròn theo mét với radius.

## Quy tắc database

- Chỉ trả `places.status=published`.
- Place phải có `place_service_areas` trỏ tới đúng current boundary version của một `service_areas.status=active`.
- Nếu place thuộc nhiều active area, ưu tiên membership primary, sau đó `service_areas.priority` và code để không tạo duplicate.
- Bbox dùng geometry GiST prefilter `&&` và `ST_Covers` để bao gồm điểm nằm đúng mép bbox.
- Radius dùng `ST_DWithin(location::geography, center, radius)` để giữ đơn vị mét và GiST expression index `places_location_geography_gist_idx`.
- SQL dùng positional parameter; không nối trực tiếp query string của client.

## Đồng bộ Explore map/list

- Map phát bbox sau `load` và mỗi `moveend`; client hủy request cũ khi viewport mới xuất hiện để response đến trễ không ghi đè list hiện tại.
- Spatial API chỉ quyết định place nào nằm trong viewport. Purpose/time/district và vibe ranking vẫn được áp dụng trên Explore dataset; vì vậy marker và card giữ cùng global rank.
- Click marker chọn place và scroll card tương ứng vào vùng nhìn. Click card chọn place và `easeTo` marker trên map.
- Mobile hiển thị list như bottom sheet có vùng cuộn riêng; desktop giữ split view với map sticky.
- Trong lúc request đầu tiên chạy, list hiện tại vẫn usable. Nếu API lỗi hoặc viewport rộng hơn giới hạn, client hiển thị thông báo và fallback về danh sách đã filter thay vì làm mất toàn bộ kết quả.
- Explore dataset và spatial API cùng dùng UUID `places.id`; `internal_id` chỉ phục vụ import và không đi qua public API.

## Verification

```bash
pnpm spatial:verify
```

Command kiểm tra geography index, bbox đủ ba service area, `limit/hasMore` và radius distance/order trên PostgreSQL local. Đây là integration verification phụ thuộc fixtures và boundary đã import.
