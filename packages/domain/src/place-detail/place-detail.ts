// Transport-agnostic Place Detail contract and media provenance helpers.
export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];
export type PriceLevel = 1 | 2 | 3 | 4;
export type SizeCategory = "small" | "medium" | "large" | "unknown";

export type OpeningHoursPeriod = Readonly<{
  closes: string;
  opens: string;
}>;

export type PlaceOpeningHours = Readonly<{
  timezone: "Asia/Ho_Chi_Minh";
  weekly: Readonly<Record<Weekday, readonly OpeningHoursPeriod[]>>;
}>;

export type PlaceMetadataSource = "canonical" | "synthetic";

export type PlaceMetadata = Readonly<{
  isSimulated: boolean;
  label: string;
  source: PlaceMetadataSource;
}>;

export type PlaceDetailArea = Readonly<{
  description: string | null;
  id: string;
  isSimulated: boolean;
  name: string;
}>;
export type PlaceDetailMedia = Readonly<{
  altText: string;
  height: number;
  id: string;
  isSimulated: boolean;
  sortOrder: number;
  sourceLabel: string;
  sourceReference: string | null;
  url: string;
  width: number;
}>;

export type PlaceDetail = Readonly<{
  address: string;
  areas: readonly PlaceDetailArea[];
  currency: string;
  description: string | null;
  district: string;
  estimatedCapacity: number | null;
  id: string;
  isSimulated: boolean;
  metadata: PlaceMetadata;
  amenities: readonly string[];
  latitude: number;
  longitude: number;
  media: readonly PlaceDetailMedia[];
  name: string;
  openingHours: PlaceOpeningHours | null;
  priceLevel: PriceLevel | null;
  sizeCategory: SizeCategory;
  spaceNote: string | null;
  slug: string;
  typicalSpendMax: number | null;
  typicalSpendMin: number | null;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTime(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value)
  ) {
    throw new Error(`${field} must use 24-hour HH:mm format`);
  }
  return value;
}

function minutesSinceMidnight(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function parsePlaceOpeningHours(input: unknown): PlaceOpeningHours {
  if (!isRecord(input)) throw new Error("opening_hours must be an object");
  if (
    Object.keys(input).length !== 2 ||
    Object.keys(input).some((key) => key !== "timezone" && key !== "weekly")
  ) {
    throw new Error("opening_hours must contain timezone and weekly");
  }
  if (input.timezone !== "Asia/Ho_Chi_Minh") {
    throw new Error("opening_hours timezone must be Asia/Ho_Chi_Minh");
  }
  if (!isRecord(input.weekly)) {
    throw new Error("opening_hours.weekly must be an object");
  }

  const weekdayKeys = Object.keys(input.weekly);
  if (
    weekdayKeys.length !== WEEKDAYS.length ||
    weekdayKeys.some((key) => !WEEKDAYS.includes(key as Weekday))
  ) {
    throw new Error("opening_hours.weekly must define exactly seven weekdays");
  }

  const weekly = {} as Record<Weekday, readonly OpeningHoursPeriod[]>;
  for (const weekday of WEEKDAYS) {
    const rawPeriods = input.weekly[weekday];
    if (!Array.isArray(rawPeriods) || rawPeriods.length > 4) {
      throw new Error(`${weekday} must contain zero to four opening periods`);
    }

    let previousClose = -1;
    weekly[weekday] = rawPeriods.map((rawPeriod, index) => {
      if (
        !isRecord(rawPeriod) ||
        Object.keys(rawPeriod).some(
          (key) => key !== "opens" && key !== "closes",
        )
      ) {
        throw new Error(`${weekday}[${index}] must contain opens and closes`);
      }

      const opens = parseTime(rawPeriod.opens, `${weekday}[${index}].opens`);
      const closes = parseTime(rawPeriod.closes, `${weekday}[${index}].closes`);
      const openMinutes = minutesSinceMidnight(opens);
      const closeMinutes = minutesSinceMidnight(closes);
      if (closeMinutes <= openMinutes) {
        throw new Error(`${weekday}[${index}] must close after it opens`);
      }
      if (openMinutes < previousClose) {
        throw new Error(`${weekday} opening periods must not overlap`);
      }
      previousClose = closeMinutes;
      return { closes, opens };
    });
  }

  return { timezone: "Asia/Ho_Chi_Minh", weekly };
}

export function openingHoursAreEqual(
  left: PlaceOpeningHours | null,
  right: PlaceOpeningHours | null,
): boolean {
  if (!left || !right) return left === right;
  if (left.timezone !== right.timezone) return false;

  return WEEKDAYS.every((weekday) => {
    const leftPeriods = left.weekly[weekday];
    const rightPeriods = right.weekly[weekday];
    return (
      leftPeriods.length === rightPeriods.length &&
      leftPeriods.every(
        (period, index) =>
          period.opens === rightPeriods[index]?.opens &&
          period.closes === rightPeriods[index]?.closes,
      )
    );
  });
}

export function parsePriceLevel(value: number | null): PriceLevel | null {
  if (value === null) return null;
  if (value === 1 || value === 2 || value === 3 || value === 4) return value;
  throw new Error("Invalid place price level");
}

export function resolvePlaceMediaUrl(input: {
  sourceUrl: string | null;
  storageKey: string | null;
}): string {
  if (input.storageKey) {
    const storageKey = input.storageKey.trim();
    if (
      storageKey.startsWith("/") ||
      storageKey.split("/").some((segment) => segment === "..")
    ) {
      throw new Error("Invalid place media storage key");
    }
    return `/${storageKey}`;
  }

  if (input.sourceUrl) return new URL(input.sourceUrl).toString();
  throw new Error("Place media has no display location");
}

export function mediaSourceLabel(sourceType: string): string {
  if (sourceType === "synthetic") return "Minh họa giả lập của Chốn";
  if (sourceType === "editorial") return "Nhóm Chốn";
  if (sourceType === "community") return "Cộng đồng Chốn";
  return "Đối tác cung cấp dữ liệu";
}
