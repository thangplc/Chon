import {
  parsePlaceOpeningHours,
  WEEKDAYS,
  type PlaceOpeningHours,
  type Weekday,
} from "../../../../../packages/domain/src/place-detail/place-detail";

const OSM_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
const OSM_DAY_TO_WEEKDAY: Readonly<Record<(typeof OSM_DAYS)[number], Weekday>> =
  {
    Fr: "friday",
    Mo: "monday",
    Sa: "saturday",
    Su: "sunday",
    Th: "thursday",
    Tu: "tuesday",
    We: "wednesday",
  };

export type OpeningHoursParseResult =
  | Readonly<{ openingHours: PlaceOpeningHours; ok: true }>
  | Readonly<{
      ok: false;
      reason: string;
      status: "invalid" | "unsupported";
    }>;

function emptyWeekly(): Record<
  Weekday,
  Array<{ closes: string; opens: string }>
> {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

function parseDays(value: string): readonly Weekday[] | null {
  const tokens = value.split(",").map((token) => token.trim());
  if (tokens.length === 0 || tokens.some((token) => token === "")) return null;

  const days: Weekday[] = [];
  for (const token of tokens) {
    if (token.includes("-")) {
      const range = token.split("-");
      if (range.length !== 2) return null;
      const start = OSM_DAYS.indexOf(range[0] as (typeof OSM_DAYS)[number]);
      const end = OSM_DAYS.indexOf(range[1] as (typeof OSM_DAYS)[number]);
      if (start < 0 || end < 0 || end < start) return null;
      for (let index = start; index <= end; index += 1) {
        days.push(OSM_DAY_TO_WEEKDAY[OSM_DAYS[index]]);
      }
      continue;
    }

    if (!OSM_DAYS.includes(token as (typeof OSM_DAYS)[number])) return null;
    days.push(OSM_DAY_TO_WEEKDAY[token as (typeof OSM_DAYS)[number]]);
  }

  return [...new Set(days)];
}

function parsePeriods(
  value: string,
):
  | Readonly<{ closes: string; opens: string }>[]
  | Readonly<{ reason: string; status: "invalid" | "unsupported" }> {
  const periods = value.split(",").map((period) => period.trim());
  if (periods.length === 0 || periods.some((period) => period === "")) {
    return { reason: "empty time period", status: "invalid" };
  }

  const parsed: { closes: string; opens: string }[] = [];
  for (const period of periods) {
    const match = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/u.exec(period);
    if (!match) {
      return {
        reason: `unsupported time expression '${period}'`,
        status: "unsupported",
      };
    }
    if (match[1] === "24:00" || match[2] === "24:00") {
      return {
        reason: "24:00 and 24/7 are outside opening_hours v1",
        status: "unsupported",
      };
    }
    parsed.push({ closes: match[2], opens: match[1] });
  }
  return parsed;
}

/**
 * Convert the regular, same-day subset of OSM opening_hours syntax into the
 * Chốn v1 contract. Complex calendars are reported, never guessed.
 */
export function parseOsmOpeningHours(value: string): OpeningHoursParseResult {
  const source = value.trim();
  if (!source)
    return { ok: false, reason: "empty opening_hours", status: "invalid" };
  if (source === "24/7") {
    return {
      ok: false,
      reason: "24/7 is outside opening_hours v1 because 24:00 is not allowed",
      status: "unsupported",
    };
  }

  const weekly = emptyWeekly();
  for (const rawSegment of source.split(";")) {
    const segment = rawSegment.trim();
    if (!segment) continue;
    if (/\b(?:off|closed|unknown)\b/iu.test(segment)) {
      return {
        ok: false,
        reason: `closed/unknown rules are not safely representable in '${segment}'`,
        status: "unsupported",
      };
    }
    if (/\b(?:PH|SH|sunrise|sunset|dawn|dusk)\b/iu.test(segment)) {
      return {
        ok: false,
        reason: `calendar-dependent rule is not supported in '${segment}'`,
        status: "unsupported",
      };
    }

    const separator = segment.search(/\s/u);
    const hasDayExpression = separator > 0;
    const dayExpression = hasDayExpression ? segment.slice(0, separator) : "";
    const timeExpression = hasDayExpression
      ? segment.slice(separator + 1).trim()
      : segment;
    const days = hasDayExpression ? parseDays(dayExpression) : [...WEEKDAYS];
    if (!days || days.length === 0) {
      return {
        ok: false,
        reason: `unsupported day expression '${dayExpression}'`,
        status: "unsupported",
      };
    }
    const periods = parsePeriods(timeExpression);
    if (!Array.isArray(periods)) return { ok: false, ...periods };
    for (const day of days) weekly[day].push(...periods);
  }

  try {
    return {
      ok: true,
      openingHours: parsePlaceOpeningHours({
        timezone: "Asia/Ho_Chi_Minh",
        weekly,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "invalid opening_hours",
      status: "invalid",
    };
  }
}

export function normalizePlaceName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function nameSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizePlaceName(left);
  const normalizedRight = normalizePlaceName(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  if (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return 0.94;
  }

  const leftTokens = new Set(normalizedLeft.split(" "));
  const rightTokens = new Set(normalizedRight.split(" "));
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token));
  const tokenScore =
    overlap.length / Math.max(leftTokens.size, rightTokens.size);
  const previous = Array.from(
    { length: normalizedRight.length + 1 },
    (_, index) => index,
  );
  for (let leftIndex = 1; leftIndex <= normalizedLeft.length; leftIndex += 1) {
    const current = [leftIndex];
    for (
      let rightIndex = 1;
      rightIndex <= normalizedRight.length;
      rightIndex += 1
    ) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (normalizedLeft[leftIndex - 1] === normalizedRight[rightIndex - 1]
            ? 0
            : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  const editScore =
    1 -
    previous[normalizedRight.length] /
      Math.max(normalizedLeft.length, normalizedRight.length);
  return Math.max(tokenScore, editScore);
}
