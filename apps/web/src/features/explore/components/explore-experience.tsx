"use client";

import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AnalyticsEventPayload } from "@chon/contracts/analytics";

import {
  exploreDistricts,
  purposes,
  type ExploreDataset,
  type ExploreDayType,
  type ExploreDistrict,
  type ExplorePriceLevel,
  type ExploreSizeCategory,
  type PurposeId,
  type TimeBucket,
  type VibeDimension,
} from "../domain/explore-contract";
import { getExplorePlaces, getExploreTimeContext } from "../domain/explore";
import type { UserLocation } from "../hooks/use-geolocation";
import { trackExploreEvent } from "../analytics/explore-analytics";
import {
  createDefaultExploreUrlState,
  parseExploreUrlState,
  serializeExploreUrlState,
  type ExploreUrlState,
} from "../state/explore-url-state";
import {
  ExploreMap,
  type ExploreMapStatus,
  type MapViewportBounds,
} from "./explore-map";

const timeOptions: readonly Readonly<{
  id: TimeBucket;
  label: string;
  time: string;
}>[] = [
  { id: "morning", label: "Sáng · 09:00", time: "09:00" },
  { id: "midday", label: "Trưa · 12:00", time: "12:00" },
  { id: "afternoon", label: "Chiều · 15:00", time: "15:00" },
  { id: "evening", label: "Tối · 19:30", time: "19:30" },
  { id: "late", label: "Khuya · 22:30", time: "22:30" },
];

const radiusOptions = [500, 1000, 1500, 3000, 5000] as const;
const durationOptions = [60, 90, 120, 180, 240] as const;

const sizeOptions: readonly Readonly<{
  id: ExploreSizeCategory;
  label: string;
}>[] = [
  { id: "small", label: "Nhỏ" },
  { id: "medium", label: "Vừa" },
  { id: "large", label: "Lớn" },
  { id: "unknown", label: "Chưa rõ" },
];

const priceLevelOptions: readonly Readonly<{
  id: ExplorePriceLevel;
  label: string;
}>[] = [
  { id: 1, label: "Tiết kiệm" },
  { id: 2, label: "Phổ thông" },
  { id: 3, label: "Khá" },
  { id: 4, label: "Cao cấp" },
];

const priceRangeOptions: readonly Readonly<{
  id: string;
  label: string;
  max: number | null;
  min: number | null;
}>[] = [
  { id: "any", label: "Mọi mức giá", max: null, min: null },
  { id: "under-50", label: "Tối đa 50.000đ", max: 50_000, min: null },
  {
    id: "50-100",
    label: "50.000–100.000đ",
    max: 100_000,
    min: 50_000,
  },
  {
    id: "100-200",
    label: "100.000–200.000đ",
    max: 200_000,
    min: 100_000,
  },
  { id: "over-200", label: "Từ 200.000đ", max: null, min: 200_000 },
];

type ExploreLocationMode = "all" | "district" | "search" | "current" | "map";
type LocationQueryStatus = "idle" | "loading" | "ready" | "error";

function getTodayDateValue(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
    })
      .formatToParts(new Date())
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDuration(durationMinutes: number): string {
  if (durationMinutes % 60 === 0) return `${durationMinutes / 60} giờ`;
  return `${Math.floor(durationMinutes / 60)} giờ ${durationMinutes % 60} phút`;
}

function formatRadius(radiusMeters: number): string {
  return radiusMeters >= 1000
    ? `${radiusMeters / 1000} km`
    : `${radiusMeters} m`;
}

function toggleSetValue<T>(current: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function locationModeLabel(
  mode: ExploreLocationMode,
  district: "all" | ExploreDistrict,
): string {
  if (mode === "district") return district;
  if (mode === "search") return "Khu vực tìm kiếm";
  if (mode === "current") return "Vị trí hiện tại";
  if (mode === "map") return "Điểm trên bản đồ";
  return "Tất cả khu vực";
}

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

function confidenceLabel(
  confidence: "insufficient" | "low" | "medium" | "high",
) {
  if (confidence === "high") return "Tin cậy cao";
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
  const initialDateValue = getTodayDateValue();
  const initialTimeContext = getExploreTimeContext(initialDateValue, "09:00");
  const [dayType, setDayType] = useState<ExploreDayType>(
    initialTimeContext?.dayType ?? "weekday",
  );
  const [dateValue, setDateValue] = useState(initialDateValue);
  const [exactTime, setExactTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [selectedSizes, setSelectedSizes] = useState<
    ReadonlySet<ExploreSizeCategory>
  >(new Set());
  const [selectedAmenities, setSelectedAmenities] = useState<
    ReadonlySet<string>
  >(new Set());
  const [selectedPriceLevels, setSelectedPriceLevels] = useState<
    ReadonlySet<ExplorePriceLevel>
  >(new Set());
  const [priceRangeId, setPriceRangeId] = useState("any");
  const [urlHydrated, setUrlHydrated] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [district, setDistrict] = useState<"all" | ExploreDistrict>("all");
  const [locationMode, setLocationMode] = useState<ExploreLocationMode>("all");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationPlaceIds, setLocationPlaceIds] =
    useState<ReadonlySet<string> | null>(null);
  const [locationCenter, setLocationCenter] = useState<Readonly<{
    latitude: number;
    longitude: number;
  }> | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(1500);
  const [locationQueryStatus, setLocationQueryStatus] =
    useState<LocationQueryStatus>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSelectionEnabled, setLocationSelectionEnabled] =
    useState(false);
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
  const locationRequestRef = useRef<AbortController | null>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const urlHydrationRef = useRef(false);
  const previousAnalyticsKeyRef = useRef<string | null>(null);

  const results = useMemo(
    () =>
      getExplorePlaces(dataset, {
        dayType,
        district,
        placeIds: locationPlaceIds ?? undefined,
        amenities: selectedAmenities,
        priceLevels: selectedPriceLevels,
        priceMax:
          priceRangeOptions.find(({ id }) => id === priceRangeId)?.max ?? null,
        priceMin:
          priceRangeOptions.find(({ id }) => id === priceRangeId)?.min ?? null,
        purpose,
        sizeCategories: selectedSizes,
        timeBucket,
      }),
    [
      dataset,
      dayType,
      district,
      locationPlaceIds,
      priceRangeId,
      purpose,
      selectedAmenities,
      selectedPriceLevels,
      selectedSizes,
      timeBucket,
    ],
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
  const amenityOptions = useMemo(() => {
    const options = new Set(["Wi-Fi", "Ổ cắm điện", "Điều hòa"]);
    dataset.places.forEach((place) => {
      place.amenities.forEach((amenity) => options.add(amenity));
    });
    return [...options].sort((left, right) => left.localeCompare(right, "vi"));
  }, [dataset.places]);
  const activeMetadataFilterCount =
    selectedSizes.size +
    selectedAmenities.size +
    selectedPriceLevels.size +
    (priceRangeId === "any" ? 0 : 1);

  const urlState = useMemo<ExploreUrlState>(
    () => ({
      amenities: [...selectedAmenities],
      dateValue,
      district,
      durationMinutes,
      exactTime,
      locationQuery,
      priceLevels: [...selectedPriceLevels],
      priceRangeId: priceRangeId as ExploreUrlState["priceRangeId"],
      purpose,
      sizes: [...selectedSizes],
      timeBucket,
    }),
    [
      dateValue,
      district,
      durationMinutes,
      exactTime,
      locationQuery,
      priceRangeId,
      selectedAmenities,
      selectedPriceLevels,
      selectedSizes,
      purpose,
      timeBucket,
    ],
  );
  const analyticsContext = useMemo<AnalyticsEventPayload>(
    () => ({
      amenityCount: selectedAmenities.size,
      dayType,
      district: district === "all" ? null : district,
      durationMinutes,
      priceLevelCount: selectedPriceLevels.size,
      priceRangeId: urlState.priceRangeId,
      purpose,
      resultCount: results.length,
      sizeCount: selectedSizes.size,
      timeBucket,
    }),
    [
      dayType,
      district,
      durationMinutes,
      results.length,
      selectedAmenities.size,
      selectedPriceLevels.size,
      selectedSizes.size,
      purpose,
      timeBucket,
      urlState.priceRangeId,
    ],
  );

  const clearMetadataFilters = useCallback(() => {
    setSelectedSizes(new Set());
    setSelectedAmenities(new Set());
    setSelectedPriceLevels(new Set());
    setPriceRangeId("any");
  }, []);

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") return;

    const shareUrl = `${window.location.origin}${window.location.pathname}${serializeExploreUrlState(urlState)}${window.location.hash}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("copied");
      trackExploreEvent("explore_share_clicked", analyticsContext);
    } catch {
      setShareStatus("error");
    }
  }, [analyticsContext, urlState]);

  const queryRadius = useCallback(
    async (
      center: Readonly<{ latitude: number; longitude: number }>,
      radius: number,
    ) => {
      locationRequestRef.current?.abort();
      const controller = new AbortController();
      locationRequestRef.current = controller;
      setLocationQueryStatus("loading");
      setLocationError(null);
      setVisiblePlaceIds(null);

      try {
        const searchParams = new URLSearchParams({
          lat: center.latitude.toFixed(6),
          limit: "100",
          lng: center.longitude.toFixed(6),
          radius: String(radius),
        });
        const response = await fetch(`/api/places?${searchParams}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Spatial API returned ${response.status}`);
        }

        const spatialResults = readSpatialPlaceIds(await response.json());
        if (controller.signal.aborted) return;

        setLocationPlaceIds(new Set(spatialResults.placeIds));
        setLocationQueryStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;

        setLocationPlaceIds(null);
        setLocationQueryStatus("error");
        setLocationError(
          error instanceof Error
            ? "Không thể tìm theo bán kính. Đang hiển thị danh sách dự phòng."
            : "Không thể tìm theo bán kính.",
        );
      }
    },
    [],
  );

  const applyRadiusLocation = useCallback(
    (
      center: Readonly<{ latitude: number; longitude: number }>,
      mode: Extract<ExploreLocationMode, "current" | "map"> = "map",
    ) => {
      setLocationCenter(center);
      setLocationMode(mode);
      setDistrict("all");
      setLocationQuery("");
      setLocationSelectionEnabled(false);
      setSelectedPlaceId(null);
      void queryRadius(center, radiusMeters);
    },
    [queryRadius, radiusMeters],
  );

  const handleUserLocationChange = useCallback(
    (location: UserLocation) => {
      applyRadiusLocation(location, "current");
    },
    [applyRadiusLocation],
  );

  const handleMapLocationSelect = useCallback(
    (location: Readonly<{ latitude: number; longitude: number }>) => {
      applyRadiusLocation(location, "map");
    },
    [applyRadiusLocation],
  );

  const handleRadiusChange = useCallback(
    (nextRadius: number) => {
      setRadiusMeters(nextRadius);
      if (locationCenter) void queryRadius(locationCenter, nextRadius);
    },
    [locationCenter, queryRadius],
  );

  const handleSearchLocation = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalizedQuery = locationQuery.trim().toLocaleLowerCase("vi-VN");
      if (!normalizedQuery) {
        setLocationMode("all");
        setLocationPlaceIds(null);
        setLocationQueryStatus("idle");
        setLocationError(null);
        return;
      }

      const matchingPlaceIds = dataset.places
        .filter((place) =>
          [place.name, place.address, place.district].some((value) =>
            value.toLocaleLowerCase("vi-VN").includes(normalizedQuery),
          ),
        )
        .map(({ id }) => id);
      setLocationMode("search");
      setDistrict("all");
      setLocationCenter(null);
      setLocationSelectionEnabled(false);
      setLocationPlaceIds(new Set(matchingPlaceIds));
      setLocationQueryStatus("ready");
      setLocationError(null);
      setSelectedPlaceId(null);
    },
    [dataset.places, locationQuery],
  );

  const handleDistrictChange = useCallback(
    (nextDistrict: "all" | ExploreDistrict) => {
      setDistrict(nextDistrict);
      setLocationMode(nextDistrict === "all" ? "all" : "district");
      setLocationPlaceIds(null);
      setLocationCenter(null);
      setLocationQuery("");
      setLocationQueryStatus("idle");
      setLocationError(null);
      setLocationSelectionEnabled(false);
      setSelectedPlaceId(null);
    },
    [],
  );

  const updateExactTime = useCallback((nextDate: string, nextTime: string) => {
    const context = getExploreTimeContext(nextDate, nextTime);
    if (!context) return;
    setDayType(context.dayType);
    setTimeBucket(context.timeBucket);
  }, []);

  useEffect(() => {
    if (urlHydrationRef.current || typeof window === "undefined") return;

    const fallback = createDefaultExploreUrlState(getTodayDateValue());
    const parsed = parseExploreUrlState(window.location.search, fallback);
    const timeContext = getExploreTimeContext(
      parsed.dateValue,
      parsed.exactTime,
    );
    const normalizedQuery = parsed.locationQuery
      .trim()
      .toLocaleLowerCase("vi-VN");
    const matchingPlaceIds = normalizedQuery
      ? dataset.places
          .filter((place) =>
            [place.name, place.address, place.district].some((value) =>
              value.toLocaleLowerCase("vi-VN").includes(normalizedQuery),
            ),
          )
          .map(({ id }) => id)
      : [];

    setPurpose(parsed.purpose);
    setDateValue(parsed.dateValue);
    setExactTime(parsed.exactTime);
    setDayType(timeContext?.dayType ?? "weekday");
    setTimeBucket(timeContext?.timeBucket ?? parsed.timeBucket);
    setDurationMinutes(parsed.durationMinutes);
    setSelectedSizes(new Set(parsed.sizes));
    setSelectedAmenities(new Set(parsed.amenities));
    setSelectedPriceLevels(new Set(parsed.priceLevels));
    setPriceRangeId(parsed.priceRangeId);
    setDistrict(parsed.district);
    setLocationQuery(parsed.locationQuery);
    setLocationMode(
      parsed.locationQuery
        ? "search"
        : parsed.district === "all"
          ? "all"
          : "district",
    );
    setLocationPlaceIds(
      parsed.locationQuery ? new Set(matchingPlaceIds) : null,
    );
    setLocationQueryStatus(parsed.locationQuery ? "ready" : "idle");
    setSelectedPlaceId(null);
    urlHydrationRef.current = true;
    setUrlHydrated(true);
  }, [dataset.places]);

  useEffect(() => {
    if (!urlHydrated || typeof window === "undefined") return;

    const nextSearch = serializeExploreUrlState(urlState);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [urlHydrated, urlState]);

  useEffect(() => {
    if (!urlHydrated) return;

    const analyticsKey = JSON.stringify({
      ...analyticsContext,
      dateValue,
      exactTime,
      locationQuery: Boolean(locationQuery),
    });
    if (previousAnalyticsKeyRef.current === null) {
      trackExploreEvent("explore_results_viewed", analyticsContext);
    } else if (previousAnalyticsKeyRef.current !== analyticsKey) {
      trackExploreEvent("explore_filter_changed", analyticsContext);
    }
    previousAnalyticsKeyRef.current = analyticsKey;
  }, [analyticsContext, dateValue, exactTime, locationQuery, urlHydrated]);

  const handlePresetTimeChange = useCallback(
    (nextTimeBucket: TimeBucket) => {
      const preset = timeOptions.find(({ id }) => id === nextTimeBucket);
      setTimeBucket(nextTimeBucket);
      if (!preset) return;
      setExactTime(preset.time);
      updateExactTime(dateValue, preset.time);
    },
    [dateValue, updateExactTime],
  );

  const selectedTimeLabel = dateValue
    ? `${dateValue.split("-").reverse().join("/")} · ${exactTime} · ${formatDuration(durationMinutes)}`
    : `${timeOptions.find(({ id }) => id === timeBucket)?.label} · ${formatDuration(durationMinutes)}`;
  const selectedLocationLabel = locationModeLabel(locationMode, district);

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
    setLocationSelectionEnabled(false);
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
      locationRequestRef.current?.abort();
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
          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-[#2f6555]/20 bg-white/70 px-3 py-2 text-xs font-bold text-[#315d50] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c59635]"
              onClick={() => void handleShare()}
              type="button"
            >
              Chia sẻ bộ lọc
            </button>
            <span
              aria-live="polite"
              className="hidden rounded-full border border-[#2f6555]/20 bg-white/70 px-3 py-2 text-xs font-semibold text-[#315d50] sm:inline"
            >
              {shareStatus === "copied"
                ? "Đã sao chép link"
                : shareStatus === "error"
                  ? "Không thể sao chép"
                  : "Provider vibe: Tắt"}
            </span>
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
                    handlePresetTimeChange(event.target.value as TimeBucket)
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
                    handleDistrictChange(
                      event.target.value as "all" | ExploreDistrict,
                    )
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

          <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-[#dce8e1]">
              Ngày ghé
              <input
                aria-label="Ngày ghé"
                className="mt-1 block w-full rounded-xl border border-white/15 bg-white px-3 py-2 text-sm font-semibold text-[#173f33]"
                onChange={(event) => {
                  setDateValue(event.target.value);
                  updateExactTime(event.target.value, exactTime);
                }}
                type="date"
                value={dateValue}
              />
            </label>
            <label className="text-xs font-semibold text-[#dce8e1]">
              Giờ chính xác
              <input
                aria-label="Giờ chính xác"
                className="mt-1 block w-full rounded-xl border border-white/15 bg-white px-3 py-2 text-sm font-semibold text-[#173f33]"
                onChange={(event) => {
                  setExactTime(event.target.value);
                  updateExactTime(dateValue, event.target.value);
                }}
                type="time"
                value={exactTime}
              />
            </label>
            <label className="text-xs font-semibold text-[#dce8e1]">
              Thời lượng ngồi
              <select
                aria-label="Thời lượng ngồi"
                className="mt-1 block w-full rounded-xl border border-white/15 bg-white px-3 py-2 text-sm font-semibold text-[#173f33]"
                onChange={(event) =>
                  setDurationMinutes(Number(event.target.value))
                }
                value={durationMinutes}
              >
                {durationOptions.map((duration) => (
                  <option key={duration} value={duration}>
                    {formatDuration(duration)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <form
                className="flex min-w-0 flex-1 gap-2"
                onSubmit={handleSearchLocation}
              >
                <label className="min-w-0 flex-1 text-xs font-semibold text-[#dce8e1]">
                  Tìm khu vực hoặc địa điểm
                  <input
                    aria-label="Tìm khu vực hoặc địa điểm"
                    className="mt-1 block w-full rounded-xl border border-white/15 bg-white px-3 py-2 text-sm font-semibold text-[#173f33] placeholder:text-[#6b7d74]"
                    onChange={(event) => setLocationQuery(event.target.value)}
                    placeholder="Ví dụ: Quận 1, Nguyễn Huệ, Nếp Nhỏ"
                    value={locationQuery}
                  />
                </label>
                <button
                  className="mt-5 rounded-xl bg-[#f4c96b] px-3 py-2 text-xs font-bold text-[#173f33]"
                  type="submit"
                >
                  Tìm
                </button>
              </form>
              <label className="text-xs font-semibold text-[#dce8e1]">
                Bán kính
                <select
                  aria-label="Bán kính tìm kiếm"
                  className="mt-1 block w-full rounded-xl border border-white/15 bg-white px-3 py-2 text-sm font-semibold text-[#173f33]"
                  onChange={(event) =>
                    handleRadiusChange(Number(event.target.value))
                  }
                  value={radiusMeters}
                >
                  {radiusOptions.map((radius) => (
                    <option key={radius} value={radius}>
                      {formatRadius(radius)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                aria-pressed={locationSelectionEnabled}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  locationSelectionEnabled
                    ? "bg-[#f4c96b] text-[#173f33]"
                    : "border border-white/20 bg-white/10 text-white hover:bg-white/15"
                }`}
                disabled={!mapStyleUrl}
                onClick={() =>
                  setLocationSelectionEnabled((current) => !current)
                }
                type="button"
              >
                {locationSelectionEnabled
                  ? "Đang chọn trên bản đồ"
                  : "Chọn trên bản đồ"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#dce8e1]">
              <span>
                Khu vực: <strong>{selectedLocationLabel}</strong>
              </span>
              {(locationMode === "current" || locationMode === "map") &&
                locationCenter && (
                  <span>
                    · Bán kính {formatRadius(radiusMeters)} quanh điểm đã chọn
                  </span>
                )}
              {locationQueryStatus === "loading" && (
                <span aria-live="polite">· Đang tìm…</span>
              )}
              {locationQueryStatus === "ready" && locationMode === "search" && (
                <span aria-live="polite">· Đã cập nhật kết quả</span>
              )}
              {locationError && (
                <span className="font-semibold text-[#f7d98b]" role="status">
                  · {locationError}
                </span>
              )}
            </div>
          </div>

          <details className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
            <summary className="cursor-pointer list-none text-sm font-bold text-white marker:hidden focus-visible:outline-2 focus-visible:outline-[#f4c96b]">
              <span className="flex items-center justify-between gap-3">
                <span>Bộ lọc quy mô, tiện ích và giá</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-[#dce8e1]">
                  {activeMetadataFilterCount > 0
                    ? `${activeMetadataFilterCount} đang áp dụng`
                    : "Tùy chọn"}
                </span>
              </span>
            </summary>

            <div className="mt-4 grid gap-4 border-t border-white/10 pt-4 lg:grid-cols-3">
              <fieldset>
                <legend className="text-xs font-semibold text-[#dce8e1]">
                  Quy mô không gian
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sizeOptions.map(({ id, label }) => (
                    <label
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white has-[:checked]:border-[#f4c96b] has-[:checked]:bg-[#f4c96b] has-[:checked]:font-bold has-[:checked]:text-[#173f33]"
                      key={id}
                    >
                      <input
                        aria-label={`Quy mô ${label}`}
                        checked={selectedSizes.has(id)}
                        className="sr-only"
                        onChange={() =>
                          setSelectedSizes((current) =>
                            toggleSetValue(current, id),
                          )
                        }
                        type="checkbox"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold text-[#dce8e1]">
                  Tiện ích (chọn tất cả)
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {amenityOptions.map((amenity) => (
                    <label
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white has-[:checked]:border-[#f4c96b] has-[:checked]:bg-[#f4c96b] has-[:checked]:font-bold has-[:checked]:text-[#173f33]"
                      key={amenity}
                    >
                      <input
                        aria-label={`Tiện ích ${amenity}`}
                        checked={selectedAmenities.has(amenity)}
                        className="sr-only"
                        onChange={() =>
                          setSelectedAmenities((current) =>
                            toggleSetValue(current, amenity),
                          )
                        }
                        type="checkbox"
                      />
                      {amenity}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold text-[#dce8e1]">
                  Phân khúc giá
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {priceLevelOptions.map(({ id, label }) => (
                    <label
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white has-[:checked]:border-[#f4c96b] has-[:checked]:bg-[#f4c96b] has-[:checked]:font-bold has-[:checked]:text-[#173f33]"
                      key={id}
                    >
                      <input
                        aria-label={`Phân khúc giá ${id} ${label}`}
                        checked={selectedPriceLevels.has(id)}
                        className="sr-only"
                        onChange={() =>
                          setSelectedPriceLevels((current) =>
                            toggleSetValue(current, id),
                          )
                        }
                        type="checkbox"
                      />
                      {id} · {label}
                    </label>
                  ))}
                </div>
                <label className="mt-3 block text-xs font-semibold text-[#dce8e1]">
                  Khoảng chi tiêu tham khảo
                  <select
                    aria-label="Khoảng chi tiêu tham khảo"
                    className="mt-1 block w-full rounded-xl border border-white/15 bg-white px-3 py-2 text-xs font-semibold text-[#173f33]"
                    onChange={(event) => setPriceRangeId(event.target.value)}
                    value={priceRangeId}
                  >
                    {priceRangeOptions.map(({ id, label }) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </fieldset>
            </div>

            {activeMetadataFilterCount > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                <span aria-live="polite" className="text-xs text-[#dce8e1]">
                  Đang lọc theo metadata đã xác minh hoặc dữ liệu minh họa.
                </span>
                <button
                  className="rounded-xl bg-[#f4c96b] px-3 py-2 text-xs font-bold text-[#173f33]"
                  onClick={clearMetadataFilters}
                  type="button"
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}
          </details>

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

        <section className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)] lg:gap-4">
          <div className="relative self-start overflow-hidden rounded-[2rem] border border-[#173f33]/10 bg-[#d9ddc7] shadow-sm lg:sticky lg:top-4">
            <a
              className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-[#173f33] focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-[#c59635]"
              href="#explore-results"
            >
              Bỏ qua bản đồ, đến danh sách địa điểm
            </a>
            <ExploreMap
              locationSelectionEnabled={locationSelectionEnabled}
              mapStyleUrl={mapStyleUrl}
              onSelectLocation={handleMapLocationSelect}
              onSelectPlace={setSelectedPlaceId}
              onUserLocationChange={handleUserLocationChange}
              onStatusChange={handleMapStatusChange}
              onViewportChange={handleViewportChange}
              places={results}
              selectedPlaceId={selectedPlaceId}
            />
            <aside
              aria-label="Nguồn dữ liệu"
              className="border-t border-[#173f33]/10 bg-white/90 px-4 py-3 text-xs leading-5 text-[#42645a] backdrop-blur lg:absolute lg:right-5 lg:bottom-5 lg:rounded-2xl lg:border-0 lg:p-3 lg:shadow-sm"
            >
              <strong className="block text-[#173f33]">Nguồn dữ liệu</strong>
              {dataset.source === "database_real"
                ? "Địa điểm: VIETMAP · Vibe: community đã xác minh (nếu có) · PostgreSQL"
                : dataset.source === "database_mixed"
                  ? "Địa điểm: VIETMAP + seed · Vibe: community giả lập · PostgreSQL"
                  : "Địa điểm + vibe: community giả lập · PostgreSQL"}
            </aside>
          </div>

          <section
            aria-describedby="explore-results-help"
            aria-labelledby="result-title"
            aria-busy={viewportStatus === "loading"}
            className="relative max-h-[70vh] overflow-y-auto rounded-[2rem] border border-[#173f33]/10 bg-white/90 p-4 shadow-xl backdrop-blur sm:p-5 lg:max-h-none lg:overflow-visible lg:bg-white/75 lg:shadow-sm"
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
                  {selectedPurpose?.label} · {selectedTimeLabel}
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
                  <li
                    className={`overflow-hidden rounded-2xl border transition ${
                      selected
                        ? "border-[#c59635] bg-[#fff8e7] shadow-md"
                        : "border-[#173f33]/10 bg-white hover:border-[#2f6555]/35"
                    }`}
                    key={place.id}
                  >
                    <button
                      aria-current={selected ? "true" : undefined}
                      aria-describedby={`${placeMetaId} ${
                        place.matchScore === null ? "" : placeMatchId
                      } ${placeStatusId}`.replaceAll("  ", " ")}
                      aria-labelledby={`${placeRankId} ${placeNameId}`}
                      aria-pressed={selected}
                      className="w-full p-4 text-left focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[#c59635]"
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
                                {place.metadata.isSimulated &&
                                  " · Giá minh họa"}
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

                          {place.explanation.reasons.length > 0 && (
                            <span className="mt-3 block rounded-xl bg-[#edf0e5] px-3 py-2 text-xs leading-5 text-[#42645a]">
                              <strong className="block text-[#315d50]">
                                Vì sao hợp
                              </strong>
                              {place.explanation.reasons.join(" · ")}
                            </span>
                          )}
                          {place.explanation.cautions.length > 0 && (
                            <span className="mt-2 block rounded-xl bg-[#f7eee0] px-3 py-2 text-xs leading-5 text-[#805b39]">
                              <strong className="block text-[#805b39]">
                                Lưu ý
                              </strong>
                              {place.explanation.cautions.join(" · ")}
                            </span>
                          )}

                          <span
                            className="mt-3 block text-xs font-semibold text-[#6b7d74]"
                            id={placeStatusId}
                          >
                            {confidenceLabel(place.confidence)} ·{" "}
                            {place.reportCount > 0
                              ? `${place.reportCount} ${
                                  place.vibeIsSimulated
                                    ? "góp ý mô phỏng"
                                    : "góp ý"
                                }${
                                  place.providerSignalCount > 0
                                    ? ` · ${place.providerSignalCount} nguồn bổ trợ`
                                    : ""
                                }`
                              : place.providerSignalCount > 0
                                ? `${place.providerSignalCount} nguồn bổ trợ`
                                : "0 góp ý"}
                          </span>
                        </span>
                      </div>
                    </button>
                    <div className="flex justify-end border-t border-[#173f33]/10 px-4 py-3">
                      <Link
                        aria-label={`Xem chi tiết ${place.name}`}
                        className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold text-[#315d50] transition hover:bg-[#edf0e5] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635]"
                        href={`/places/${place.slug}`}
                      >
                        Xem chi tiết
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
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
                      : activeMetadataFilterCount > 0
                        ? "Hãy bỏ bớt bộ lọc hoặc chọn lại khu vực, thời gian và mục đích."
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
