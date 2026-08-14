export const timeBuckets = [
  "morning",
  "midday",
  "afternoon",
  "evening",
  "late",
] as const;

export type TimeBucket = (typeof timeBuckets)[number];

export const dayTypes = ["weekday", "friday", "weekend"] as const;

export type DayType = (typeof dayTypes)[number];

export const vibeDimensions = [
  "noise",
  "crowd",
  "lighting",
  "privacy",
  "workability",
  "socialEnergy",
] as const;

export type VibeDimension = (typeof vibeDimensions)[number];
export type VibeScoreMap = Readonly<
  Partial<Record<VibeDimension, number | null>>
>;

export const snapshotComponents = ["contribution", "provider"] as const;

export type SnapshotComponent = (typeof snapshotComponents)[number];

export type ConfidenceLevel = "low" | "medium" | "high";

export type VibeReportForAggregation = Readonly<{
  id: string;
  placeId: string;
  placeAreaId: string | null;
  dayType: DayType;
  timeBucket: TimeBucket;
  visitedAt: Date;
  scores: VibeScoreMap;
  dataType: "synthetic" | "research" | "editorial" | "community";
  isSimulated: boolean;
}>;

export type VibeSnapshot = Readonly<{
  placeId: string;
  placeAreaId: string | null;
  component: SnapshotComponent;
  dayType: DayType;
  timeBucket: TimeBucket;
  scores: VibeScoreMap;
  reportCount: number;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  lastReportAt: Date;
  sourceDataTypes: readonly VibeReportForAggregation["dataType"][];
  isSimulated: boolean;
  aggregationVersion: string;
}>;

const bucketForMinutes = (minutes: number): TimeBucket => {
  if (minutes >= 6 * 60 && minutes < 11 * 60) return "morning";
  if (minutes >= 11 * 60 && minutes < 14 * 60) return "midday";
  if (minutes >= 14 * 60 && minutes < 18 * 60) return "afternoon";
  if (minutes >= 18 * 60 && minutes < 22 * 60) return "evening";
  return "late";
};

export function getTimeBucketForLocalTime(
  hour: number,
  minute: number,
): TimeBucket {
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new RangeError("Local time must be a valid 24-hour clock value");
  }

  return bucketForMinutes(hour * 60 + minute);
}

type LocalDateParts = Readonly<{
  weekday: string;
  hour: number;
  minute: number;
}>;

function getLocalDateParts(date: Date, timeZone: string): LocalDateParts {
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date");
  if (!timeZone.trim()) throw new RangeError("Timezone must not be blank");

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    weekday: "short",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );

  return {
    hour: Number(values.hour),
    minute: Number(values.minute),
    weekday: values.weekday,
  };
}

export function getDayTypeForDate(date: Date, timeZone: string): DayType {
  const weekday = getLocalDateParts(date, timeZone).weekday;
  if (weekday === "Fri") return "friday";
  if (weekday === "Sat" || weekday === "Sun") return "weekend";
  return "weekday";
}

export function getTimeBucketForDate(date: Date, timeZone: string): TimeBucket {
  const local = getLocalDateParts(date, timeZone);
  return getTimeBucketForLocalTime(local.hour, local.minute);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const result =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  return Math.round(result * 100) / 100;
}

function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function calculateAgreement(
  reports: readonly VibeReportForAggregation[],
): number {
  const deviations = vibeDimensions.flatMap((dimension) => {
    const values = reports.flatMap((report) => {
      const value = report.scores[dimension];
      return typeof value === "number" ? [value] : [];
    });
    return values.length > 0 ? [standardDeviation(values) / 2] : [];
  });
  if (deviations.length === 0) return 0;
  const averageDeviation =
    deviations.reduce((sum, value) => sum + value, 0) / deviations.length;
  return Math.max(0, Math.min(1, 1 - averageDeviation));
}

export function getConfidenceForReports(
  reports: readonly VibeReportForAggregation[],
): Readonly<{ score: number; level: ConfidenceLevel }> {
  const reportCount = reports.length;
  const agreement = calculateAgreement(reports);
  const countScore = Math.min(1, reportCount / 8);
  const score = Math.round((countScore * 0.7 + agreement * 0.3) * 100) / 100;

  if (reportCount < 3) return { level: "low", score };
  if (reportCount >= 8 && agreement >= 0.6) return { level: "high", score };
  return { level: "medium", score };
}

export function aggregateVibeReports(
  reports: readonly VibeReportForAggregation[],
  component: SnapshotComponent = "contribution",
  aggregationVersion = "v1",
): readonly VibeSnapshot[] {
  const groups = new Map<string, VibeReportForAggregation[]>();

  for (const report of reports) {
    const key = [
      report.placeId,
      report.placeAreaId ?? "place",
      report.dayType,
      report.timeBucket,
    ].join("|");
    const group = groups.get(key);
    if (group) group.push(report);
    else groups.set(key, [report]);
  }

  return [...groups.values()]
    .map((group) => {
      const first = group[0];
      const scores = Object.fromEntries(
        vibeDimensions.map((dimension) => {
          const values = group.flatMap((report) => {
            const value = report.scores[dimension];
            return typeof value === "number" ? [value] : [];
          });
          return [dimension, values.length > 0 ? median(values) : null];
        }),
      ) as VibeScoreMap;
      const confidence = getConfidenceForReports(group);
      const sourceDataTypes = [
        ...new Set(group.map(({ dataType }) => dataType)),
      ]
        .sort()
        .filter(
          (dataType): dataType is VibeReportForAggregation["dataType"] =>
            dataType !== undefined,
        );

      return {
        aggregationVersion,
        component,
        confidenceLevel: confidence.level,
        confidenceScore: confidence.score,
        dayType: first.dayType,
        isSimulated: group.every(({ isSimulated }) => isSimulated),
        lastReportAt: new Date(
          Math.max(...group.map(({ visitedAt }) => visitedAt.getTime())),
        ),
        placeAreaId: first.placeAreaId,
        placeId: first.placeId,
        reportCount: group.length,
        scores,
        sourceDataTypes,
        timeBucket: first.timeBucket,
      } satisfies VibeSnapshot;
    })
    .sort(
      (left, right) =>
        left.placeId.localeCompare(right.placeId) ||
        (left.placeAreaId ?? "").localeCompare(right.placeAreaId ?? "") ||
        left.dayType.localeCompare(right.dayType) ||
        left.timeBucket.localeCompare(right.timeBucket),
    );
}
