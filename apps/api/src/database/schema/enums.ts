// Shared by the NestJS API and operator tooling.
import { pgEnum } from "drizzle-orm/pg-core";

export const dataTypeEnum = pgEnum("data_type", [
  "synthetic",
  "research",
  "editorial",
  "community",
]);

export const dayTypeEnum = pgEnum("day_type", ["weekday", "friday", "weekend"]);

export const locationVerificationEnum = pgEnum("location_verification", [
  "none",
  "recalled",
  "approximate",
  "verified",
]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  "pending",
  "approved",
  "flagged",
  "rejected",
  "archived",
]);

export const mediaRightsStatusEnum = pgEnum("media_rights_status", [
  "verified",
  "provider_allowed",
  "pending",
  "rejected",
]);

export const mediaSourceTypeEnum = pgEnum("media_source_type", [
  "provider",
  "editorial",
  "community",
  "synthetic",
]);

export const mediaTypeEnum = pgEnum("media_type", ["image"]);

export const placeStatusEnum = pgEnum("place_status", [
  "draft",
  "published",
  "archived",
]);

export const providerSignalStoragePolicyEnum = pgEnum(
  "provider_signal_storage_policy",
  ["reference_only", "ttl_cache", "persist_allowed"],
);

export const seatAvailabilityEnum = pgEnum("seat_availability", [
  "easy",
  "normal",
  "difficult",
  "unknown",
]);

export const serviceAreaStatusEnum = pgEnum("service_area_status", [
  "draft",
  "active",
  "paused",
  "archived",
]);

export const sizeCategoryEnum = pgEnum("size_category", [
  "small",
  "medium",
  "large",
  "unknown",
]);

export const timeBucketEnum = pgEnum("time_bucket", [
  "morning",
  "midday",
  "afternoon",
  "evening",
  "late",
]);

export const vibeSnapshotComponentEnum = pgEnum("vibe_snapshot_component", [
  "contribution",
  "provider",
]);

export const vibeConfidenceLevelEnum = pgEnum("vibe_confidence_level", [
  "low",
  "medium",
  "high",
]);

export const visitModeEnum = pgEnum("visit_mode", [
  "work",
  "study",
  "solo",
  "date",
  "friends",
  "business_meeting",
  "relax",
  "late_night",
]);
