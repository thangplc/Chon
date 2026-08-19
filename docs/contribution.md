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
moderation_status=pending
location_verification=none
day_type/time_bucket=derived from visited_at in Asia/Ho_Chi_Minh
user_id=authenticated users.id
```

The existing `vibe_reports.user_id` string column is intentionally retained for
fixture compatibility. Authenticated UUIDs are stored as strings until the
synthetic fixture identities are retired in a later migration.

## UI states

1. Context: visit mode, date and time.
2. Questions: three dimensions selected by visit mode, plus seat availability.
3. Note and submit: optional note up to 140 characters and a final summary.

The success state explicitly says that the report is pending moderation. It
does not update Explore ranking immediately; snapshot rebuild after approval is
the next operational task.

GPS/near-place verification, rate limiting, moderation controls, hide/restore
and immediate snapshot refresh are out of scope for this task.

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
