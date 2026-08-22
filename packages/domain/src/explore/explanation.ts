import type { PurposeId, VibeDimension, VibeScores } from "./explore-contract";
import { purposePreferences } from "./purpose-preferences";

export type ExploreExplanation = Readonly<{
  cautions: readonly string[];
  reasons: readonly string[];
}>;

const dimensions: readonly VibeDimension[] = [
  "noise",
  "crowd",
  "lighting",
  "privacy",
  "workability",
  "socialEnergy",
];

const dimensionLabels: Readonly<Record<VibeDimension, string>> = {
  crowd: "Mật độ",
  lighting: "Ánh sáng",
  noise: "Mức ồn",
  privacy: "Độ riêng tư",
  socialEnergy: "Độ sôi động",
  workability: "Khả năng làm việc",
};

const valueLabels: Readonly<
  Record<VibeDimension, readonly [string, string, string, string, string]>
> = {
  crowd: ["rất thoáng", "thoáng", "vừa phải", "khá đông", "rất đông"],
  lighting: ["rất dịu", "dịu", "cân bằng", "sáng", "rất sáng"],
  noise: ["rất yên tĩnh", "yên tĩnh", "cân bằng", "khá ồn", "rất ồn"],
  privacy: [
    "ít riêng tư",
    "hơi riêng tư",
    "cân bằng",
    "khá riêng tư",
    "rất riêng tư",
  ],
  socialEnergy: [
    "rất yên ắng",
    "yên ắng",
    "cân bằng",
    "khá sôi động",
    "rất sôi động",
  ],
  workability: [
    "khó làm việc",
    "hạn chế",
    "ổn cho việc nhẹ",
    "thuận tiện",
    "rất thuận tiện",
  ],
};

type DimensionAssessment = Readonly<{
  dimension: VibeDimension;
  fitScore: number;
  weight: number;
  delta: number;
}>;

function calculateFitScore(value: number, target: number): number {
  return Math.max(0, 100 - Math.abs(value - target) * 25);
}

function formatDimension(dimension: VibeDimension, value: number): string {
  const normalizedValue = Math.max(1, Math.min(5, Math.round(value)));
  return `${dimensionLabels[dimension]}: ${valueLabels[dimension][normalizedValue - 1]}`;
}

function compareAssessments(
  left: DimensionAssessment,
  right: DimensionAssessment,
): number {
  return (
    right.weight - left.weight ||
    right.fitScore - left.fitScore ||
    left.dimension.localeCompare(right.dimension)
  );
}

export function explainPurposeMatch(
  vibe: Partial<VibeScores> | null,
  purpose: PurposeId,
): ExploreExplanation {
  if (!vibe) {
    return {
      cautions: ["Chưa đủ dữ liệu vibe để giải thích mức độ phù hợp."],
      reasons: [],
    };
  }

  const preference = purposePreferences[purpose];
  const availableDimensions = dimensions.filter(
    (dimension) => typeof vibe[dimension] === "number",
  );
  if (availableDimensions.length === 0) {
    return {
      cautions: ["Chưa đủ dữ liệu vibe để giải thích mức độ phù hợp."],
      reasons: [],
    };
  }
  const assessments = availableDimensions.map((dimension) => {
    const value = vibe[dimension] as number;
    return {
      delta: Math.abs(value - preference.targets[dimension]),
      dimension,
      fitScore: calculateFitScore(value, preference.targets[dimension]),
      weight: preference.weights[dimension],
    };
  });
  const positiveAssessments = assessments
    .filter(({ fitScore }) => fitScore >= 75)
    .sort(compareAssessments);
  const fallbackReasons = [...assessments]
    .sort((left, right) => right.fitScore - left.fitScore)
    .slice(0, 2);
  const reasonAssessments =
    positiveAssessments.length > 0
      ? positiveAssessments.slice(0, 2)
      : fallbackReasons;
  const cautions = assessments
    .filter(({ fitScore }) => fitScore < 75)
    .sort(compareAssessments)
    .slice(0, 1)
    .map(
      ({ delta, dimension }) =>
        `${formatDimension(dimension, vibe[dimension] as number)}; lệch ${delta} mức so với nhu cầu.`,
    );

  const missingDimensions = dimensions.filter(
    (dimension) => vibe[dimension] === undefined,
  );
  if (missingDimensions.length > 0) {
    cautions.push(
      `Đánh giá tạm thời; còn thiếu ${missingDimensions.map((dimension) => dimensionLabels[dimension].toLocaleLowerCase("vi-VN")).join(", ")}.`,
    );
  }

  return {
    cautions,
    reasons: reasonAssessments.map(({ dimension }) =>
      formatDimension(dimension, vibe[dimension] as number),
    ),
  };
}
