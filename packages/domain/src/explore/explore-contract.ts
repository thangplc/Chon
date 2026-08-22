// Shared Explore contract; UI labels remain part of the product taxonomy.
export const purposes = [
  { id: "work", label: "Làm việc", icon: "💼" },
  { id: "study", label: "Học/đọc", icon: "📚" },
  { id: "solo", label: "Đi một mình", icon: "🚶" },
  { id: "date", label: "Hẹn hò", icon: "♡" },
  { id: "friends", label: "Gặp bạn", icon: "👥" },
  { id: "business_meeting", label: "Họp việc", icon: "🤝" },
  { id: "relax", label: "Thư giãn", icon: "☕" },
  { id: "late_night", label: "Đi khuya", icon: "🌙" },
] as const;

export type PurposeId = (typeof purposes)[number]["id"];
export type ExploreDayType = "weekday" | "friday" | "weekend";
export type ExplorePriceLevel = 1 | 2 | 3 | 4;
export type ExploreSizeCategory = "small" | "medium" | "large" | "unknown";
export type TimeBucket =
  "morning" | "midday" | "afternoon" | "evening" | "late";

export type VibeDimension =
  "noise" | "crowd" | "lighting" | "privacy" | "workability" | "socialEnergy";

export type VibeScores = Readonly<Record<VibeDimension, number>>;

export type ExploreVibeSnapshot = Readonly<{
  confidence: Readonly<{
    level: "low" | "medium" | "high";
    score: number;
  }>;
  dayType: ExploreDayType;
  isSimulated: boolean;
  placeId: string;
  providerSignalCount: number;
  reportCount: number;
  scores: Readonly<Record<VibeDimension, number | null>>;
  sourceDataTypes: readonly (
    "synthetic" | "research" | "editorial" | "community"
  )[];
  sourceProviders: readonly string[];
  timeBucket: TimeBucket;
}>;

export type ExploreSourcePlace = Readonly<{
  address: string;
  amenities: readonly string[];
  currency: string;
  district: string;
  estimatedCapacity: number | null;
  id: string;
  latitude: number;
  longitude: number;
  metadata: Readonly<{
    isSimulated: boolean;
    label: string;
    source: "canonical" | "synthetic";
  }>;
  name: string;
  priceLevel: ExplorePriceLevel | null;
  serviceAreaCode: string;
  serviceAreaName: string;
  sizeCategory: ExploreSizeCategory;
  slug: string;
  typicalSpendMax: number | null;
  typicalSpendMin: number | null;
}>;

export type ExploreServiceArea = Readonly<{
  areaType: string;
  bounds: Readonly<{
    east: number;
    north: number;
    south: number;
    west: number;
  }>;
  code: string;
  displayName: string;
  placeCount: number;
}>;

export type ExploreCommunityReport = Readonly<{
  id: string;
  placeId: string;
  scores: VibeScores;
  timeBucket: TimeBucket;
}>;

export type ExploreDataset = Readonly<{
  places: readonly ExploreSourcePlace[];
  reports: readonly ExploreCommunityReport[];
  vibes: readonly ExploreVibeSnapshot[];
  source: "database_simulated_csv" | "database_mixed" | "database_real";
}>;
