// Shared Explore contract; UI labels remain part of the product taxonomy.
export const purposes = [
  { id: "work", label: "Làm việc" },
  { id: "study", label: "Học/đọc" },
  { id: "solo", label: "Đi một mình" },
  { id: "date", label: "Hẹn hò" },
  { id: "friends", label: "Gặp bạn" },
  { id: "business_meeting", label: "Họp việc" },
  { id: "relax", label: "Thư giãn" },
  { id: "late_night", label: "Đi khuya" },
] as const;

export const exploreDistricts = ["Quận 1", "Quận 3", "Bình Thạnh"] as const;

export type ExploreDistrict = (typeof exploreDistricts)[number];
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
  district: ExploreDistrict;
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
  sizeCategory: ExploreSizeCategory;
  slug: string;
  typicalSpendMax: number | null;
  typicalSpendMin: number | null;
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
