# Provider response fixtures

`v1/` contains synthetic payloads used to exercise the adapter boundary before
provider credentials and live response samples are available.

These files are **not captured provider responses** and must not be treated as
evidence that a provider returns the same field names or semantics. Each
fixture is marked `isSynthetic: true` and has no endpoint or capture timestamp.

When a live sample becomes available:

1. redact tokens, personal data and unrestricted review text;
2. record provider product, endpoint, API version, field mask and capture time;
3. add a new fixture version instead of overwriting `v1`;
4. update the provider response schema and adapter contract tests;
5. keep the fixture out of production import unless terms allow it.
