import type { VibeSnapshotApiItem } from "@chon/contracts/backend";

const timeBucketLabels: Readonly<
  Record<VibeSnapshotApiItem["timeBucket"], string>
> = {
  morning: "Sáng",
  midday: "Trưa",
  afternoon: "Chiều",
  evening: "Tối",
  late: "Khuya",
};

const vibeLabels = {
  crowd: "Đông",
  lighting: "Ánh sáng",
  noise: "Ồn",
  privacy: "Riêng tư",
  socialEnergy: "Sôi động",
  workability: "Làm việc",
} as const;

const dimensions = [
  "noise",
  "crowd",
  "lighting",
  "privacy",
  "workability",
  "socialEnergy",
] as const;

function confidenceLabel(
  confidence: VibeSnapshotApiItem["confidence"]["level"],
): string {
  if (confidence === "high") return "Tin cậy cao";
  if (confidence === "medium") return "Tin cậy trung bình";
  return "Dữ liệu còn ít";
}

function selectPlaceSnapshots(
  snapshots: readonly VibeSnapshotApiItem[],
): readonly VibeSnapshotApiItem[] {
  const byTimeBucket = new Map<
    VibeSnapshotApiItem["timeBucket"],
    VibeSnapshotApiItem
  >();
  for (const snapshot of snapshots) {
    if (snapshot.placeAreaId !== null) continue;
    const current = byTimeBucket.get(snapshot.timeBucket);
    if (!current || snapshot.dayType === "weekday") {
      byTimeBucket.set(snapshot.timeBucket, snapshot);
    }
  }

  const orderedTimeBuckets: readonly VibeSnapshotApiItem["timeBucket"][] = [
    "morning",
    "midday",
    "afternoon",
    "evening",
    "late",
  ];
  return orderedTimeBuckets
    .map((timeBucket) => byTimeBucket.get(timeBucket))
    .filter(
      (snapshot): snapshot is VibeSnapshotApiItem => snapshot !== undefined,
    );
}

function evidenceLabel(snapshot: VibeSnapshotApiItem): string {
  const parts: string[] = [];
  if (snapshot.reportCount > 0) {
    parts.push(
      `${snapshot.reportCount} ${snapshot.isSimulated ? "góp ý mô phỏng" : "góp ý"}`,
    );
  }
  if (snapshot.providerSignalCount > 0) {
    parts.push(`${snapshot.providerSignalCount} nguồn bổ trợ`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Chưa có đủ bằng chứng";
}

export function PlaceVibeSummary({
  error = false,
  snapshots,
}: Readonly<{
  error?: boolean;
  snapshots: readonly VibeSnapshotApiItem[];
}>) {
  const placeSnapshots = selectPlaceSnapshots(snapshots);

  return (
    <section
      aria-labelledby="place-vibe-title"
      className="rounded-[1.5rem] border border-[#173f33]/10 bg-white/75 p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="place-vibe-title" className="text-lg font-bold">
            Chốn vibe
          </h2>
          <p className="mt-1 text-sm text-[#6b7d74]">
            Một kết quả tổng hợp theo khung giờ, không hiển thị điểm provider
            riêng lẻ.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-[#f7eee0] p-4 text-sm leading-6 text-[#8b5a2b]">
          Chưa thể tải dữ liệu vibe. Thông tin địa điểm vẫn được hiển thị.
        </p>
      ) : placeSnapshots.length === 0 ? (
        <p className="mt-4 rounded-xl bg-[#f7eee0] p-4 text-sm leading-6 text-[#8b5a2b]">
          Chưa đủ dữ liệu vibe cho địa điểm này.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 2xl:grid-cols-2">
          {placeSnapshots.map((snapshot) => (
            <article
              aria-labelledby={`place-vibe-${snapshot.timeBucket}-title`}
              className="min-w-0 rounded-xl border border-[#173f33]/10 bg-[#f8f3e8] p-4"
              key={`${snapshot.dayType}-${snapshot.timeBucket}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3
                  id={`place-vibe-${snapshot.timeBucket}-title`}
                  className="font-bold"
                >
                  {timeBucketLabels[snapshot.timeBucket]}
                </h3>
                <span className="rounded-full bg-[#e9eddc] px-2 py-1 text-xs font-bold text-[#315d50]">
                  {confidenceLabel(snapshot.confidence.level)}
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold text-[#6b7d74]">
                {evidenceLabel(snapshot)}
              </p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {dimensions.map((dimension) => {
                  const score = snapshot.scores[dimension];
                  return (
                    <div
                      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-white/75 px-2.5 py-2"
                      key={dimension}
                    >
                      <dt className="min-w-0 leading-5 break-words text-[#5e746a]">
                        {vibeLabels[dimension]}
                      </dt>
                      <dd className="text-right font-bold whitespace-nowrap text-[#18352d]">
                        {score === null ? "Chưa có" : `${score.toFixed(1)}/5`}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
