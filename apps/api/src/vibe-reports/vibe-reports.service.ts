import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";

import {
  communityVibeReportInputSchema,
  type CommunityVibeReportInput,
} from "../../../../packages/contracts/src/vibe-report";
import {
  getDayTypeForDate,
  getTimeBucketForDate,
} from "../../../../packages/domain/src/vibe/vibe-snapshot";

import type { ApiEnvironment } from "../config/api-environment";
import { DATABASE } from "../database/database.constants";
import type { ChonDatabase } from "../database/database.module";
import { places, vibeReports } from "../database/schema";
import type { AuthUser } from "../../../../packages/contracts/src/auth";

const CHON_TIME_ZONE = "Asia/Ho_Chi_Minh";
const VERIFIED_DISTANCE_METERS = 150;
const VERIFIED_ACCURACY_METERS = 100;
const APPROXIMATE_DISTANCE_METERS = 500;
const APPROXIMATE_ACCURACY_METERS = 500;
const LOCATION_EVIDENCE_MAX_AGE_MS = 10 * 60 * 1_000;
const LOCATION_VISIT_MAX_GAP_MS = 6 * 60 * 60 * 1_000;

type LocationVerification = "none" | "approximate" | "verified";

export class VibeReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VibeReportValidationError";
  }
}

export class VibeReportPlaceNotFoundError extends Error {
  constructor() {
    super("Place is not publicly available");
    this.name = "VibeReportPlaceNotFoundError";
  }
}

@Injectable()
export class VibeReportsService {
  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<ApiEnvironment, true>,
    @Inject(DATABASE) private readonly db: ChonDatabase,
  ) {}

  async createForPlaceSlug(
    slug: string,
    input: unknown,
    user: AuthUser,
  ): Promise<{
    id: string;
    locationVerification: LocationVerification;
    moderationStatus: "pending";
    placeId: string;
    submittedAt: Date;
  }> {
    if (user.status !== "active") {
      throw new VibeReportValidationError("Active account is required");
    }

    const report = parseInput(input);
    const visitedAt = new Date(report.visitedAt);
    if (visitedAt.getTime() > Date.now()) {
      throw new VibeReportValidationError("visitedAt cannot be in the future");
    }

    const locationEvidence = report.locationEvidence;
    if (locationEvidence) validateLocationEvidence(locationEvidence.capturedAt);

    const distanceExpression = locationEvidence
      ? sql<number>`ST_Distance(
          ${places.location}::geography,
          ST_SetSRID(ST_MakePoint(${locationEvidence.longitude}, ${locationEvidence.latitude}), 4326)::geography
        )`
      : sql<null>`NULL`;

    const [place] = await this.db
      .select({
        distanceMeters: distanceExpression,
        id: places.id,
        isSimulated: places.isSimulated,
      })
      .from(places)
      .where(and(eq(places.slug, slug), eq(places.status, "published")))
      .limit(1);

    if (
      !place ||
      (place.isSimulated &&
        this.config.get("DATA_IMPORT_TARGET_ENVIRONMENT", { infer: true }) ===
          "production")
    ) {
      throw new VibeReportPlaceNotFoundError();
    }

    const locationVerification = isEvidenceRelevantToVisit(
      locationEvidence?.capturedAt,
      visitedAt,
    )
      ? determineLocationVerification(
          place.distanceMeters,
          locationEvidence?.accuracyMeters,
        )
      : "none";

    const submittedAt = new Date();
    const [created] = await this.db
      .insert(vibeReports)
      .values({
        crowd: report.scores.crowd ?? null,
        dataType: "community",
        dayType: getDayTypeForDate(visitedAt, CHON_TIME_ZONE),
        internalId: `community_${randomUUID().replaceAll("-", "")}`,
        isSimulated: false,
        lighting: report.scores.lighting ?? null,
        locationVerification,
        moderationStatus: "pending",
        noise: report.scores.noise ?? null,
        placeId: place.id,
        privacy: report.scores.privacy ?? null,
        seatAvailability: report.seatAvailability ?? "unknown",
        shortNote: report.shortNote ?? null,
        socialEnergy: report.scores.socialEnergy ?? null,
        submittedAt,
        timeBucket: getTimeBucketForDate(visitedAt, CHON_TIME_ZONE),
        userId: user.id,
        visitedAt,
        visitMode: report.visitMode,
        workability: report.scores.workability ?? null,
      })
      .returning({
        id: vibeReports.id,
        placeId: vibeReports.placeId,
        submittedAt: vibeReports.submittedAt,
      });

    if (!created) throw new Error("Vibe report insert returned no row");

    return {
      id: created.id,
      locationVerification,
      moderationStatus: "pending",
      placeId: created.placeId,
      submittedAt: created.submittedAt,
    };
  }
}

function validateLocationEvidence(capturedAtValue: string): void {
  const capturedAt = new Date(capturedAtValue).getTime();
  const age = Date.now() - capturedAt;
  if (age < -60_000 || age > LOCATION_EVIDENCE_MAX_AGE_MS) {
    throw new VibeReportValidationError(
      "locationEvidence has expired; please verify your location again",
    );
  }
}

function isEvidenceRelevantToVisit(
  capturedAtValue: string | undefined,
  visitedAt: Date,
): boolean {
  if (!capturedAtValue) return false;
  return (
    Math.abs(new Date(capturedAtValue).getTime() - visitedAt.getTime()) <=
    LOCATION_VISIT_MAX_GAP_MS
  );
}

export function determineLocationVerification(
  distanceValue: number | string | null,
  accuracyMeters?: number,
): LocationVerification {
  if (distanceValue === null || accuracyMeters === undefined) return "none";
  const distanceMeters = Number(distanceValue);
  if (!Number.isFinite(distanceMeters)) return "none";
  if (
    distanceMeters <= VERIFIED_DISTANCE_METERS &&
    accuracyMeters <= VERIFIED_ACCURACY_METERS
  ) {
    return "verified";
  }
  if (
    distanceMeters <= APPROXIMATE_DISTANCE_METERS &&
    accuracyMeters <= APPROXIMATE_ACCURACY_METERS
  ) {
    return "approximate";
  }
  return "none";
}

function parseInput(input: unknown): CommunityVibeReportInput {
  const parsed = communityVibeReportInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new VibeReportValidationError(formatValidationError(parsed.error));
  }
  return parsed.data;
}

function formatValidationError(error: ZodError): string {
  const issue = error.issues[0];
  return issue
    ? `${issue.path.join(".") || "report"}: ${issue.message}`
    : "Invalid vibe report";
}
