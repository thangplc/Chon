# Authentication v1

## Boundary

Explore và Place Detail là public. Chỉ full community vibe report mới yêu cầu
đăng nhập. Web dùng Auth.js với Google OAuth và JWT session; NestJS không đọc
Auth.js cookie trực tiếp. Next.js tạo assertion ngắn hạn có chữ ký bằng
`AUTH_API_SECRET` khi gọi API same-origin, còn API verify issuer, audience,
expiry và chữ ký trước khi resolve user.

`AUTH_API_SECRET` là server-only và phải giống nhau trong `apps/web/.env` và
`apps/api/.env`. Không đặt biến này dưới dạng `NEXT_PUBLIC_*`.

## Local setup

```bash
openssl rand -base64 48
```

Điền secret vào cả hai file `.env`:

```ini
# apps/web/.env
AUTH_SECRET=<authjs-secret>
AUTH_TRUST_HOST=false
AUTH_GOOGLE_ID=<google-client-id>
AUTH_GOOGLE_SECRET=<google-client-secret>
AUTH_API_SECRET=<shared-server-secret-at-least-32-chars>
AUTH_API_ISSUER=chon-web
AUTH_API_AUDIENCE=chon-api

# apps/api/.env
AUTH_API_SECRET=<same-shared-server-secret>
AUTH_API_ISSUER=chon-web
AUTH_API_AUDIENCE=chon-api
```

Google OAuth local callback:

```text
http://localhost:3000/api/auth/callback/google
```

Production phải dùng HTTPS callback URL đúng domain triển khai, secret riêng
và `AUTH_TRUST_HOST=true` khi runtime nằm sau trusted reverse proxy.

## Routes

- `GET|POST /api/auth/*`: Auth.js OAuth handlers.
- `GET /api/auth/me`: same-origin web proxy, trả `401` nếu chưa đăng nhập.
- `GET /v1/auth/me`: NestJS endpoint nhận assertion nội bộ và upsert user.

Database migration `0010_sharp_dragon_lord` tạo `users` và
`user_identities`. Identity được định danh bởi `provider + provider_subject`;
API không trả provider subject ra response public.

## Security boundary

- Không lưu access token trong localStorage.
- API assertion hết hạn sau 60 giây.
- API kiểm tra HS256, issuer và audience.
- Production từ chối secret mặc định `dev-only`.
- User chưa đăng nhập vẫn xem được dữ liệu public.
- Authentication không chứng minh user đã ghé địa điểm; location verification
  thuộc task Sprint 5 tiếp theo.
