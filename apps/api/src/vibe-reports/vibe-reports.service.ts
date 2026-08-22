import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, gte, sql } from "drizzle-orm";
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
import { VibeSnapshotBuilder } from "../vibe-snapshots/vibe-snapshot-builder";
import type { AuthUser } from "../../../../packages/contracts/src/auth";
import { VibeReportAbuseService } from "./vibe-report-abuse.service";

const CHON_TIME_ZONE = "Asia/Ho_Chi_Minh";
const VERIFIED_DISTANCE_METERS = 150;
const VERIFIED_ACCURACY_METERS = 100;
const APPROXIMATE_DISTANCE_METERS = 500;
const APPROXIMATE_ACCURACY_METERS = 500;
const LOCATION_EVIDENCE_MAX_AGE_MS = 10 * 60 * 1_000;
const LOCATION_VISIT_MAX_GAP_MS = 6 * 60 * 60 * 1_000;

type LocationVerification = "none" | "recalled" | "approximate" | "verified";

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
    @Inject(VibeSnapshotBuilder)
    private readonly snapshotBuilder: VibeSnapshotBuilder,
    @Inject(VibeReportAbuseService)
    private readonly abuseService: VibeReportAbuseService,
  ) {}

  async createForPlaceSlug(
    slug: string,
    input: unknown,
    user: AuthUser,
  ): Promise<{
    id: string;
    locationVerification: LocationVerification;
    moderationStatus: "approved";
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

    const submittedAt = new Date();
    const createdResult = await this.db.transaction(async (tx) => {
      // Serialize contribution checks for one identity across API instances.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`);

      const [place] = await tx
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

      const recentReports = await tx
        .select({
          crowd: vibeReports.crowd,
          lighting: vibeReports.lighting,
          noise: vibeReports.noise,
          placeId: vibeReports.placeId,
          privacy: vibeReports.privacy,
          seatAvailability: vibeReports.seatAvailability,
          shortNote: vibeReports.shortNote,
          socialEnergy: vibeReports.socialEnergy,
          submittedAt: vibeReports.submittedAt,
          visitMode: vibeReports.visitMode,
          visitedAt: vibeReports.visitedAt,
          workability: vibeReports.workability,
        })
        .from(vibeReports)
        .where(
          and(
            eq(vibeReports.userId, user.id),
            eq(vibeReports.dataType, "community"),
            gte(
              vibeReports.submittedAt,
              new Date(submittedAt.getTime() - 24 * 60 * 60 * 1_000),
            ),
          ),
        )
        .limit(this.config.get("VIBE_REPORT_LIMIT_24_HOURS", { infer: true }));

      this.abuseService.assertAllowed(
        recentReports,
        place.id,
        { ...report, visitedAt },
        {
          limitPerDay: this.config.get("VIBE_REPORT_LIMIT_24_HOURS", {
            infer: true,
          }),
          limitPerTenMinutes: this.config.get("VIBE_REPORT_LIMIT_10_MINUTES", {
            infer: true,
          }),
          placeCooldownMinutes: this.config.get(
            "VIBE_REPORT_PLACE_COOLDOWN_MINUTES",
            { infer: true },
          ),
        },
        submittedAt,
      );

      const locationVerification =
        report.visitEvidenceMode === "recalled"
          ? "recalled"
          : isEvidenceRelevantToVisit(locationEvidence?.capturedAt, visitedAt)
            ? determineLocationVerification(
                place.distanceMeters,
                locationEvidence?.accuracyMeters,
              )
            : "none";

      const [created] = await tx
        .insert(vibeReports)
        .values({
          crowd: report.scores.crowd ?? null,
          dataType: "community",
          dayType: getDayTypeForDate(visitedAt, CHON_TIME_ZONE),
          internalId: `community_${randomUUID().replaceAll("-", "")}`,
          isSimulated: false,
          lighting: report.scores.lighting ?? null,
          locationVerification,
          moderationStatus: "approved",
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

      return { created, locationVerification };
    });

    const { created, locationVerification } = createdResult;

    if (!created) throw new Error("Vibe report insert returned no row");

    await this.snapshotBuilder.rebuildForPlace(
      created.placeId,
      this.config.get("DATA_IMPORT_TARGET_ENVIRONMENT", { infer: true }),
    );

    return {
      id: created.id,
      locationVerification,
      moderationStatus: "approved",
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
