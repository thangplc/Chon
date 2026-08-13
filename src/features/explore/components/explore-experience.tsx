"use client";

import { useMemo, useState } from "react";

import {
  exploreDistricts,
  purposes,
  type ExploreDataset,
  type ExploreDistrict,
  type PurposeId,
  type TimeBucket,
  type VibeDimension,
} from "../domain/explore-contract";
import { getExplorePlaces } from "../domain/explore";

const timeOptions: readonly Readonly<{
  id: TimeBucket;
  label: string;
}>[] = [
  { id: "morning", label: "Sáng · 09:00" },
  { id: "midday", label: "Trưa · 12:00" },
  { id: "afternoon", label: "Chiều · 15:00" },
  { id: "evening", label: "Tối · 19:30" },
  { id: "late", label: "Khuya · 22:30" },
];

const vibeLabels: Readonly<Record<VibeDimension, string>> = {
  crowd: "Đông",
  lighting: "Ánh sáng",
  noise: "Ồn",
  privacy: "Riêng tư",
  socialEnergy: "Sôi động",
  workability: "Làm việc",
};

const highlightedDimensions: readonly VibeDimension[] = [
  "noise",
  "privacy",
  "workability",
];

function confidenceLabel(confidence: "insufficient" | "low" | "medium") {
  if (confidence === "medium") return "Tin cậy trung bình";
  if (confidence === "low") return "Dữ liệu còn ít";
  return "Chưa có góp ý ở khung giờ này";
}

function formatPrice(
  minimum: number | null,
  maximum: number | null,
  currency: string,
): string {
  if (minimum === null && maximum === null) return "Chưa có dữ liệu giá";

  const formatter = new Intl.NumberFormat("vi-VN", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  });

  if (minimum !== null && maximum !== null) {
    return `${formatter.format(minimum)}–${formatter.format(maximum)}`;
  }
  if (minimum !== null) return `Từ ${formatter.format(minimum)}`;
  if (maximum !== null) return `Đến ${formatter.format(maximum)}`;

  return "Chưa có dữ liệu giá";
}

type ExploreExperienceProps = Readonly<{
  dataset: ExploreDataset;
}>;

export function ExploreExperience({ dataset }: ExploreExperienceProps) {
  const [purpose, setPurpose] = useState<PurposeId>("work");
  const [timeBucket, setTimeBucket] = useState<TimeBucket>("morning");
  const [district, setDistrict] = useState<"all" | ExploreDistrict>("all");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const results = useMemo(
    () =>
      getExplorePlaces(dataset, {
        district,
        purpose,
        timeBucket,
      }),
    [dataset, district, purpose, timeBucket],
  );
  const selectedPurpose = purposes.find(({ id }) => id === purpose);

  return (
    <main className="min-h-screen bg-[#f3efe5] text-[#18352d]">
      <div className="border-b border-amber-900/10 bg-[#f4c96b] px-4 py-2 text-center text-xs font-bold tracking-[0.12em] text-amber-950 uppercase">
        Môi trường thử nghiệm · Vibe cộng đồng mô phỏng
      </div>

      <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-[#173f33] text-lg font-bold text-[#f8f3e8]">
              C
            </span>
            <div>
              <p className="text-xl font-bold tracking-tight">Chốn</p>
              <p className="text-xs text-[#42645a]">
                Bản đồ không khí thành phố
              </p>
            </div>
          </div>
          <div className="rounded-full border border-[#2f6555]/20 bg-white/70 px-3 py-2 text-xs font-semibold text-[#315d50]">
            Provider vibe: Tắt
          </div>
        </header>

        <section className="mt-6 rounded-[2rem] border border-[#173f33]/10 bg-[#173f33] p-5 text-[#f8f3e8] shadow-xl shadow-[#173f33]/10 sm:p-7">
          <p className="text-xs font-bold tracking-[0.16em] text-[#f4c96b] uppercase">
            TP. Hồ Chí Minh
          </p>
          <div className="mt-2 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <h1 className="max-w-3xl text-3xl leading-tight font-semibold tracking-tight sm:text-5xl">
                Hôm nay bạn cần một Chốn thế nào?
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#dce8e1] sm:text-base">
                Kết quả hiện chỉ dùng góp ý community mô phỏng. Không có tín
                hiệu vibe từ Foursquare, Google, Yelp hoặc Tripadvisor.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[430px]">
              <label className="text-xs font-semibold text-[#dce8e1]">
                Thời gian
                <select
                  aria-label="Thời gian"
                  className="mt-1 block w-full rounded-xl border border-white/15 bg-white px-3 py-2.5 text-sm font-semibold text-[#173f33]"
                  onChange={(event) =>
                    setTimeBucket(event.target.value as TimeBucket)
                  }
                  value={timeBucket}
                >
                  {timeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-[#dce8e1]">
                Khu vực
                <select
                  aria-label="Khu vực"
                  className="mt-1 block w-full rounded-xl border border-white/15 bg-white px-3 py-2.5 text-sm font-semibold text-[#173f33]"
                  onChange={(event) =>
                    setDistrict(event.target.value as "all" | ExploreDistrict)
                  }
                  value={district}
                >
                  <option value="all">Tất cả khu vực</option>
                  {exploreDistricts.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div
            aria-label="Chọn mục đích"
            className="mt-6 flex gap-2 overflow-x-auto pb-1"
            role="group"
          >
            {purposes.map((item) => {
              const selected = item.id === purpose;
              return (
                <button
                  aria-pressed={selected}
                  className={`min-w-max rounded-full border px-4 py-2 text-left text-sm transition ${
                    selected
                      ? "border-[#f4c96b] bg-[#f4c96b] font-bold text-[#173f33]"
                      : "border-white/20 bg-white/5 text-white hover:bg-white/10"
                  }`}
                  key={item.id}
                  onClick={() => setPurpose(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
          <div
            aria-label="Bản đồ mô phỏng các địa điểm"
            className="relative min-h-[340px] overflow-hidden rounded-[2rem] border border-[#173f33]/10 bg-[#d9ddc7] shadow-sm lg:min-h-[680px]"
            role="region"
          >
            <div className="absolute inset-0 [background-image:linear-gradient(32deg,transparent_43%,#fff_44%,#fff_47%,transparent_48%),linear-gradient(128deg,transparent_46%,#fff_47%,#fff_50%,transparent_51%),linear-gradient(8deg,transparent_62%,#b9c9b0_63%,#b9c9b0_67%,transparent_68%)] opacity-50" />
            <div className="absolute top-5 left-5 rounded-full bg-white/90 px-3 py-2 text-xs font-bold shadow-sm backdrop-blur">
              Bản đồ preview · MapLibre ở task kế tiếp
            </div>
            <div className="absolute right-5 bottom-5 rounded-2xl bg-white/90 p-3 text-xs leading-5 text-[#42645a] shadow-sm backdrop-blur">
              <strong className="block text-[#173f33]">Nguồn vibe</strong>
              Community giả lập · PostgreSQL
            </div>

            {results.map((place, index) => {
              const selected = selectedPlaceId === place.id;
              return (
                <button
                  aria-label={`Chọn ${place.name} trên bản đồ`}
                  className={`absolute grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white text-sm font-black shadow-lg transition hover:scale-110 focus:ring-4 focus:ring-[#f4c96b]/60 focus:outline-none ${
                    selected
                      ? "z-20 bg-[#f4c96b] text-[#173f33]"
                      : "z-10 bg-[#173f33] text-white"
                  }`}
                  key={place.id}
                  onClick={() => setSelectedPlaceId(place.id)}
                  style={{
                    left: `${place.mapPosition.x}%`,
                    top: `${place.mapPosition.y}%`,
                  }}
                  type="button"
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          <section
            aria-labelledby="result-title"
            className="rounded-[2rem] border border-[#173f33]/10 bg-white/75 p-4 shadow-sm backdrop-blur sm:p-5"
          >
            <div className="flex items-end justify-between gap-3 border-b border-[#173f33]/10 pb-4">
              <div>
                <p className="text-xs font-bold tracking-[0.12em] text-[#6b7d74] uppercase">
                  {selectedPurpose?.label} ·{" "}
                  {timeOptions.find(({ id }) => id === timeBucket)?.label}
                </p>
                <h2
                  id="result-title"
                  className="mt-1 text-2xl font-bold tracking-tight"
                >
                  {results.length} Chốn để thử
                </h2>
              </div>
              <span className="rounded-full bg-[#edf0e5] px-3 py-1 text-xs font-semibold text-[#42645a]">
                Xếp theo độ phù hợp
              </span>
            </div>

            <ol className="mt-4 space-y-3">
              {results.map((place, index) => {
                const selected = selectedPlaceId === place.id;
                const vibe = place.vibe;
                return (
                  <li key={place.id}>
                    <button
                      aria-pressed={selected}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-[#c59635] bg-[#fff8e7] shadow-md"
                          : "border-[#173f33]/10 bg-white hover:border-[#2f6555]/35"
                      }`}
                      onClick={() => setSelectedPlaceId(place.id)}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#edf0e5] text-sm font-black text-[#315d50]">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-3">
                            <span>
                              <strong className="block text-lg leading-6">
                                {place.name}
                              </strong>
                              <span className="mt-0.5 block text-xs text-[#6b7d74]">
                                {place.district} ·{" "}
                                {formatPrice(
                                  place.typicalSpendMin,
                                  place.typicalSpendMax,
                                  place.currency,
                                )}
                              </span>
                            </span>
                            {place.matchScore !== null && (
                              <span className="rounded-full bg-[#173f33] px-2.5 py-1 text-xs font-bold text-white">
                                {place.matchScore}%
                              </span>
                            )}
                          </span>

                          <span className="mt-3 flex flex-wrap gap-1.5">
                            {vibe ? (
                              highlightedDimensions.map((dimension) => (
                                <span
                                  className="rounded-lg bg-[#f0f2eb] px-2 py-1 text-xs text-[#42645a]"
                                  key={dimension}
                                >
                                  {vibeLabels[dimension]}{" "}
                                  {vibe[dimension].toFixed(1)}/5
                                </span>
                              ))
                            ) : (
                              <span className="rounded-lg bg-[#f7eee0] px-2 py-1 text-xs text-[#8b5a2b]">
                                Chưa đủ dữ liệu vibe
                              </span>
                            )}
                          </span>

                          <span className="mt-3 block text-xs font-semibold text-[#6b7d74]">
                            {confidenceLabel(place.confidence)} ·{" "}
                            {place.reportCount} góp ý mô phỏng
                          </span>
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
              {results.length === 0 && (
                <li className="rounded-2xl border border-dashed border-[#173f33]/20 bg-white p-5 text-sm leading-6 text-[#5e746a]">
                  Chưa có địa điểm giả lập trong database cho khu vực này. Hãy
                  chạy importer CSV local trước khi thử Explore.
                </li>
              )}
            </ol>
          </section>
        </section>

        <footer className="mt-5 flex flex-col justify-between gap-2 rounded-2xl border border-[#173f33]/10 bg-white/50 px-4 py-3 text-xs text-[#5e746a] sm:flex-row">
          <span>Nguồn hiện tại: CSV giả lập → PostgreSQL.</span>
          <span>Production guard chặn toàn bộ record mô phỏng.</span>
        </footer>
      </div>
    </main>
  );
}
