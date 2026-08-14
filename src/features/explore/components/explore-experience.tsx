"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import {
  ExploreMap,
  type ExploreMapStatus,
  type MapViewportBounds,
} from "./explore-map";

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
  mapStyleUrl: string | null;
}>;

type ViewportQueryStatus = "idle" | "loading" | "ready" | "error";

function readSpatialPlaceIds(payload: unknown): {
  hasMore: boolean;
  placeIds: readonly string[];
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("Spatial API response must be an object");
  }

  const response = payload as {
    data?: unknown;
    meta?: { hasMore?: unknown };
  };
  if (!Array.isArray(response.data)) {
    throw new Error("Spatial API response must include a data array");
  }

  const placeIds = response.data.map((item) => {
    if (!item || typeof item !== "object" || !("id" in item)) {
      throw new Error("Spatial API place must include an id");
    }

    const id = (item as { id: unknown }).id;
    if (typeof id !== "string" || !id) {
      throw new Error("Spatial API place id must be a non-empty string");
    }
    return id;
  });

  return {
    hasMore: response.meta?.hasMore === true,
    placeIds,
  };
}

export function ExploreExperience({
  dataset,
  mapStyleUrl,
}: ExploreExperienceProps) {
  const [purpose, setPurpose] = useState<PurposeId>("work");
  const [timeBucket, setTimeBucket] = useState<TimeBucket>("morning");
  const [district, setDistrict] = useState<"all" | ExploreDistrict>("all");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [mapAvailabilityStatus, setMapAvailabilityStatus] =
    useState<ExploreMapStatus>(mapStyleUrl ? "loading" : "unconfigured");
  const [visiblePlaceIds, setVisiblePlaceIds] =
    useState<ReadonlySet<string> | null>(null);
  const [viewportHasMore, setViewportHasMore] = useState(false);
  const [viewportStatus, setViewportStatus] =
    useState<ViewportQueryStatus>("idle");
  const [viewportError, setViewportError] = useState<string | null>(null);
  const [latestViewport, setLatestViewport] =
    useState<MapViewportBounds | null>(null);
  const viewportRequestRef = useRef<AbortController | null>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const results = useMemo(
    () =>
      getExplorePlaces(dataset, {
        district,
        purpose,
        timeBucket,
      }),
    [dataset, district, purpose, timeBucket],
  );
  const visibleResults = useMemo(
    () =>
      visiblePlaceIds === null
        ? results
        : results.filter(({ id }) => visiblePlaceIds.has(id)),
    [results, visiblePlaceIds],
  );
  const rankByPlaceId = useMemo(
    () => new Map(results.map(({ id }, index) => [id, index + 1])),
    [results],
  );
  const selectedPurpose = purposes.find(({ id }) => id === purpose);
  const selectedPlace = results.find(({ id }) => id === selectedPlaceId);

  const queryViewport = useCallback(async (bounds: MapViewportBounds) => {
    setLatestViewport(bounds);
    viewportRequestRef.current?.abort();

    if (
      bounds.west >= bounds.east ||
      bounds.south >= bounds.north ||
      bounds.east - bounds.west > 1 ||
      bounds.north - bounds.south > 1
    ) {
      setVisiblePlaceIds(null);
      setViewportHasMore(false);
      setViewportStatus("error");
      setViewportError("Hãy phóng to bản đồ để tìm trong vùng nhỏ hơn.");
      return;
    }

    const controller = new AbortController();
    viewportRequestRef.current = controller;
    setViewportStatus("loading");
    setViewportError(null);

    try {
      const bbox = [bounds.west, bounds.south, bounds.east, bounds.north]
        .map((value) => value.toFixed(6))
        .join(",");
      const searchParams = new URLSearchParams({ bbox, limit: "100" });
      const response = await fetch(`/api/places?${searchParams}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Spatial API returned ${response.status}`);
      }

      const spatialResults = readSpatialPlaceIds(await response.json());
      if (controller.signal.aborted) return;

      const nextVisiblePlaceIds = new Set(spatialResults.placeIds);
      setVisiblePlaceIds(nextVisiblePlaceIds);
      setViewportHasMore(spatialResults.hasMore);
      setViewportStatus("ready");
      setSelectedPlaceId((current) =>
        current && !nextVisiblePlaceIds.has(current) ? null : current,
      );
    } catch (error) {
      if (controller.signal.aborted) return;

      setVisiblePlaceIds(null);
      setViewportHasMore(false);
      setViewportStatus("error");
      setViewportError(
        error instanceof Error
          ? "Không thể cập nhật theo vùng bản đồ. Đang hiển thị danh sách dự phòng."
          : "Không thể cập nhật theo vùng bản đồ.",
      );
    }
  }, []);

  const handleViewportChange = useCallback(
    (bounds: MapViewportBounds) => {
      void queryViewport(bounds);
    },
    [queryViewport],
  );

  const handleMapStatusChange = useCallback((status: ExploreMapStatus) => {
    setMapAvailabilityStatus(status);
    if (status !== "error" && status !== "unconfigured") return;

    viewportRequestRef.current?.abort();
    setVisiblePlaceIds(null);
    setViewportHasMore(false);
    setViewportStatus("idle");
    setViewportError(null);
  }, []);

  const showAllResults = useCallback(() => {
    viewportRequestRef.current?.abort();
    setVisiblePlaceIds(null);
    setViewportHasMore(false);
    setViewportStatus("idle");
    setViewportError(null);
  }, []);

  useEffect(
    () => () => {
      viewportRequestRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!selectedPlaceId) return;

    const selectedCard = cardRefs.current.get(selectedPlaceId);
    selectedCard?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [selectedPlaceId, visibleResults]);

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
                  onChange={(event) => {
                    setDistrict(event.target.value as "all" | ExploreDistrict);
                    setSelectedPlaceId(null);
                  }}
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

        <section className="mt-5 grid gap-0 lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)] lg:gap-4">
          <div className="relative self-start overflow-hidden rounded-[2rem] border border-[#173f33]/10 bg-[#d9ddc7] shadow-sm lg:sticky lg:top-4">
            <a
              className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-[#173f33] focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-[#c59635]"
              href="#explore-results"
            >
              Bỏ qua bản đồ, đến danh sách địa điểm
            </a>
            <ExploreMap
              mapStyleUrl={mapStyleUrl}
              onSelectPlace={setSelectedPlaceId}
              onStatusChange={handleMapStatusChange}
              onViewportChange={handleViewportChange}
              places={results}
              selectedPlaceId={selectedPlaceId}
            />
            <div className="absolute right-5 bottom-5 rounded-2xl bg-white/90 p-3 text-xs leading-5 text-[#42645a] shadow-sm backdrop-blur">
              <strong className="block text-[#173f33]">Nguồn vibe</strong>
              Community giả lập · PostgreSQL
            </div>
          </div>

          <section
            aria-describedby="explore-results-help"
            aria-labelledby="result-title"
            aria-busy={viewportStatus === "loading"}
            className="relative z-20 -mt-10 max-h-[70vh] overflow-y-auto rounded-t-[2rem] border border-[#173f33]/10 bg-white/90 p-4 shadow-xl backdrop-blur sm:p-5 lg:z-auto lg:mt-0 lg:max-h-none lg:overflow-visible lg:rounded-[2rem] lg:bg-white/75 lg:shadow-sm"
            id="explore-results"
            tabIndex={-1}
          >
            <p className="sr-only" id="explore-results-help">
              Danh sách này cung cấp đầy đủ kết quả thay thế cho bản đồ. Dùng
              phím Tab để di chuyển và Enter hoặc Space để chọn địa điểm.
            </p>
            <p aria-atomic="true" aria-live="polite" className="sr-only">
              {selectedPlace
                ? `${selectedPlace.name} đang được chọn.`
                : "Chưa chọn địa điểm."}
            </p>
            <div className="flex items-end justify-between gap-3 border-b border-[#173f33]/10 pb-4">
              <div>
                <p className="text-xs font-bold tracking-[0.12em] text-[#6b7d74] uppercase">
                  {selectedPurpose?.label} ·{" "}
                  {timeOptions.find(({ id }) => id === timeBucket)?.label}
                </p>
                <h2
                  aria-atomic="true"
                  aria-live="polite"
                  id="result-title"
                  className="mt-1 text-2xl font-bold tracking-tight"
                >
                  {visibleResults.length}{" "}
                  {mapStyleUrl && viewportStatus === "ready"
                    ? "Chốn trong vùng bản đồ"
                    : "Chốn để thử"}
                </h2>
              </div>
              <span className="rounded-full bg-[#edf0e5] px-3 py-1 text-xs font-semibold text-[#42645a]">
                Xếp theo độ phù hợp
              </span>
            </div>

            {(mapAvailabilityStatus === "unconfigured" ||
              mapAvailabilityStatus === "error") && (
              <div
                className="mt-3 rounded-xl border border-[#315d50]/15 bg-[#edf0e5] px-3 py-2 text-xs leading-5 text-[#315d50]"
                role="status"
              >
                <strong className="block">
                  {mapAvailabilityStatus === "error"
                    ? "Bản đồ đang không khả dụng"
                    : "Bản đồ chưa được cấu hình"}
                </strong>
                Danh sách bên dưới vẫn chứa đầy đủ địa điểm và có thể sử dụng
                độc lập.
              </div>
            )}

            {mapStyleUrl && viewportStatus !== "idle" && (
              <div
                aria-live="polite"
                className={`mt-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs ${
                  viewportStatus === "error"
                    ? "bg-[#f7eee0] text-[#805b39]"
                    : "bg-[#edf0e5] text-[#42645a]"
                }`}
                role={viewportStatus === "error" ? "alert" : "status"}
              >
                <span className="flex items-center gap-2">
                  {viewportStatus === "loading" && (
                    <>
                      <span
                        aria-hidden="true"
                        className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-[#42645a]/25 border-t-[#42645a]"
                      />
                      Đang đồng bộ danh sách với vùng bản đồ…
                    </>
                  )}
                  {viewportStatus === "ready" &&
                    `${visibleResults.length} địa điểm đang nằm trong vùng xem.`}
                  {viewportStatus === "error" && viewportError}
                </span>
                {viewportStatus === "error" && latestViewport && (
                  <button
                    className="shrink-0 rounded-lg border border-[#805b39]/20 bg-white px-2.5 py-1 font-bold"
                    onClick={() => {
                      if (latestViewport) {
                        void queryViewport(latestViewport);
                      }
                    }}
                    type="button"
                  >
                    Thử lại
                  </button>
                )}
              </div>
            )}

            {viewportStatus === "ready" && viewportHasMore && (
              <p className="mt-2 text-xs text-[#805b39]">
                Vùng này có hơn 100 địa điểm. Hãy phóng to để thu hẹp kết quả.
              </p>
            )}

            <ol
              aria-busy={viewportStatus === "loading"}
              aria-label="Danh sách địa điểm phù hợp"
              className="mt-4 space-y-3"
            >
              {visibleResults.map((place) => {
                const selected = selectedPlaceId === place.id;
                const vibe = place.vibe;
                const rank = rankByPlaceId.get(place.id);
                const placeRankId = `place-${place.id}-rank`;
                const placeNameId = `place-${place.id}-name`;
                const placeMetaId = `place-${place.id}-meta`;
                const placeMatchId = `place-${place.id}-match`;
                const placeStatusId = `place-${place.id}-status`;
                return (
                  <li key={place.id}>
                    <button
                      aria-current={selected ? "true" : undefined}
                      aria-describedby={`${placeMetaId} ${
                        place.matchScore === null ? "" : placeMatchId
                      } ${placeStatusId}`.replaceAll("  ", " ")}
                      aria-labelledby={`${placeRankId} ${placeNameId}`}
                      aria-pressed={selected}
                      className={`w-full rounded-2xl border p-4 text-left transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635] ${
                        selected
                          ? "border-[#c59635] bg-[#fff8e7] shadow-md"
                          : "border-[#173f33]/10 bg-white hover:border-[#2f6555]/35"
                      }`}
                      onClick={() => setSelectedPlaceId(place.id)}
                      ref={(element) => {
                        if (element) cardRefs.current.set(place.id, element);
                        else cardRefs.current.delete(place.id);
                      }}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="grid size-9 shrink-0 place-items-center rounded-full bg-[#edf0e5] text-sm font-black text-[#315d50]"
                        >
                          {rank}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="sr-only" id={placeRankId}>
                            Hạng {rank}.
                          </span>
                          <span className="flex items-start justify-between gap-3">
                            <span>
                              <strong
                                className="block text-lg leading-6"
                                id={placeNameId}
                              >
                                {place.name}
                              </strong>
                              <span
                                className="mt-0.5 block text-xs text-[#6b7d74]"
                                id={placeMetaId}
                              >
                                {place.district} ·{" "}
                                {formatPrice(
                                  place.typicalSpendMin,
                                  place.typicalSpendMax,
                                  place.currency,
                                )}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1.5">
                              {place.matchScore !== null && (
                                <span
                                  className="rounded-full bg-[#173f33] px-2.5 py-1 text-xs font-bold text-white"
                                  id={placeMatchId}
                                >
                                  {place.matchScore}% phù hợp
                                </span>
                              )}
                              {selected && (
                                <span className="rounded-full border border-[#c59635]/35 bg-[#fff8e7] px-2.5 py-1 text-[11px] font-bold text-[#805b39]">
                                  Đang chọn
                                </span>
                              )}
                            </span>
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

                          <span
                            className="mt-3 block text-xs font-semibold text-[#6b7d74]"
                            id={placeStatusId}
                          >
                            {confidenceLabel(place.confidence)} ·{" "}
                            {place.reportCount} góp ý mô phỏng
                          </span>
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
              {visibleResults.length === 0 && (
                <li className="rounded-2xl border border-dashed border-[#173f33]/20 bg-white p-6 text-center text-sm leading-6 text-[#5e746a]">
                  <strong className="block text-base text-[#173f33]">
                    {viewportStatus === "ready"
                      ? "Không có Chốn trong vùng này"
                      : "Chưa có địa điểm phù hợp"}
                  </strong>
                  <span className="mt-1 block">
                    {viewportStatus === "ready"
                      ? "Hãy di chuyển bản đồ, thu nhỏ hoặc xem lại toàn bộ danh sách."
                      : "Hãy đổi khu vực, thời gian hoặc mục đích để xem kết quả khác."}
                  </span>
                  {viewportStatus === "ready" && results.length > 0 && (
                    <button
                      className="mt-4 rounded-xl border border-[#315d50]/20 bg-[#edf0e5] px-4 py-2 font-bold text-[#315d50] transition hover:bg-[#e2e7d9]"
                      onClick={showAllResults}
                      type="button"
                    >
                      Xem toàn bộ danh sách
                    </button>
                  )}
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
