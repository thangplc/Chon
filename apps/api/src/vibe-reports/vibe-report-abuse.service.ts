import { Injectable } from "@nestjs/common";

type ReportScores = Readonly<{
  crowd?: number;
  lighting?: number;
  noise?: number;
  privacy?: number;
  socialEnergy?: number;
  workability?: number;
}>;

export type AbuseCandidate = Readonly<{
  scores: ReportScores;
  seatAvailability?: string;
  shortNote?: string;
  visitMode: string;
  visitedAt: Date;
}>;

export type RecentCommunityReport = Readonly<{
  crowd: number | null;
  lighting: number | null;
  noise: number | null;
  placeId: string;
  privacy: number | null;
  seatAvailability: string;
  shortNote: string | null;
  socialEnergy: number | null;
  submittedAt: Date;
  visitMode: string;
  visitedAt: Date;
  workability: number | null;
}>;

export type VibeReportAbuseLimits = Readonly<{
  limitPerDay: number;
  limitPerTenMinutes: number;
  placeCooldownMinutes: number;
}>;

export class VibeReportRateLimitError extends Error {
  constructor(
    readonly retryAfterSeconds: number,
    readonly reason: "burst" | "daily" | "place_cooldown",
  ) {
    super("Vibe report rate limit exceeded");
    this.name = "VibeReportRateLimitError";
  }
}

export class VibeReportDuplicateError extends Error {
  constructor() {
    super("An identical vibe report was already submitted");
    this.name = "VibeReportDuplicateError";
  }
}

const TEN_MINUTES_MS = 10 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const DUPLICATE_VISIT_TOLERANCE_MS = 15 * 60 * 1_000;

@Injectable()
export class VibeReportAbuseService {
  assertAllowed(
    reports: readonly RecentCommunityReport[],
    placeId: string,
    candidate: AbuseCandidate,
    limits: VibeReportAbuseLimits,
    now = new Date(),
  ): void {
    const nowMs = now.getTime();
    const recentReports = reports.filter(
      (report) => nowMs - report.submittedAt.getTime() < DAY_MS,
    );

    if (
      recentReports.some(
        (report) =>
          report.placeId === placeId && isDuplicate(report, candidate),
      )
    ) {
      throw new VibeReportDuplicateError();
    }

    const burstReports = recentReports.filter(
      (report) => nowMs - report.submittedAt.getTime() < TEN_MINUTES_MS,
    );
    if (burstReports.length >= limits.limitPerTenMinutes) {
      throw new VibeReportRateLimitError(
        retryAfterFromOldest(burstReports, TEN_MINUTES_MS, nowMs),
        "burst",
      );
    }

    if (recentReports.length >= limits.limitPerDay) {
      throw new VibeReportRateLimitError(
        retryAfterFromOldest(recentReports, DAY_MS, nowMs),
        "daily",
      );
    }

    const placeCooldownMs = limits.placeCooldownMinutes * 60 * 1_000;
    const samePlaceReports = recentReports.filter(
      (report) =>
        report.placeId === placeId &&
        nowMs - report.submittedAt.getTime() < placeCooldownMs,
    );
    if (samePlaceReports.length > 0) {
      throw new VibeReportRateLimitError(
        retryAfterFromOldest(samePlaceReports, placeCooldownMs, nowMs),
        "place_cooldown",
      );
    }
  }
}

function isDuplicate(
  report: RecentCommunityReport,
  candidate: AbuseCandidate,
): boolean {
  return (
    Math.abs(report.visitedAt.getTime() - candidate.visitedAt.getTime()) <=
      DUPLICATE_VISIT_TOLERANCE_MS &&
    report.visitMode === candidate.visitMode &&
    report.seatAvailability === (candidate.seatAvailability ?? "unknown") &&
    normalizeNote(report.shortNote) === normalizeNote(candidate.shortNote) &&
    report.noise === (candidate.scores.noise ?? null) &&
    report.crowd === (candidate.scores.crowd ?? null) &&
    report.lighting === (candidate.scores.lighting ?? null) &&
    report.privacy === (candidate.scores.privacy ?? null) &&
    report.workability === (candidate.scores.workability ?? null) &&
    report.socialEnergy === (candidate.scores.socialEnergy ?? null)
  );
}

function normalizeNote(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("vi") ?? "";
}

function retryAfterFromOldest(
  reports: readonly RecentCommunityReport[],
  windowMs: number,
  nowMs: number,
): number {
  const oldestSubmittedAt = Math.min(
    ...reports.map((report) => report.submittedAt.getTime()),
  );
  return Math.max(1, Math.ceil((oldestSubmittedAt + windowMs - nowMs) / 1_000));
}
