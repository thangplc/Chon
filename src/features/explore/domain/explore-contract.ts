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
export type TimeBucket =
  "morning" | "midday" | "afternoon" | "evening" | "late";

export type VibeDimension =
  "noise" | "crowd" | "lighting" | "privacy" | "workability" | "socialEnergy";

export type VibeScores = Readonly<Record<VibeDimension, number>>;

export type ExploreSourcePlace = Readonly<{
  address: string;
  currency: string;
  district: ExploreDistrict;
  id: string;
  latitude: number;
  longitude: number;
  name: string;
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
  source: "database_simulated_csv";
}>;
