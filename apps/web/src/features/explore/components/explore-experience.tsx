"use client";

import Link from "next/link";
import {
  type FormEvent,
  type ReactNode,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  authControls?: ReactNode;
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
  authControls,
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
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
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
  const resultRegionLabel =
    mapStyleUrl && viewportStatus === "ready"
      ? `${visibleResults.length} Chốn trong vùng bản đồ`
      : `${visibleResults.length} Chốn để thử`;

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
    <main className="chon-prototype-app text-[#28231f]">
      <p className="sr-only">Môi trường thử nghiệm · Vibe cộng đồng mô phỏng</p>

      <header className="grid gap-3 border-b border-[#ddd2c3] bg-[#fffdf9] px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-6 lg:grid-cols-[220px_minmax(260px,620px)_1fr] lg:gap-5 lg:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-full bg-[#c96040] text-xl font-bold text-white">
            C
          </span>
          <span className="chon-heading text-2xl font-bold">Chốn</span>
        </div>
        <form
          className="order-3 grid min-w-0 grid-cols-[1fr_auto] overflow-hidden rounded-full border border-[#ddd2c3] bg-[#f7f2eb] sm:order-none"
          onSubmit={handleSearchLocation}
        >
          <label className="sr-only" htmlFor="global-location-search">
            Tìm kiếm khu vực, tên quán hoặc một cảm giác
          </label>
          <input
            aria-label="Tìm kiếm khu vực, tên quán hoặc một cảm giác"
            className="min-w-0 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-[#756c63]"
            id="global-location-search"
            onChange={(event) => setLocationQuery(event.target.value)}
            placeholder="Tìm khu vực, tên quán hoặc một cảm giác…"
            value={locationQuery}
          />
          <Button
            className="rounded-none border-0 px-5"
            type="submit"
            variant="primary"
          >
            Tìm
          </Button>
        </form>
        <div className="flex min-w-0 items-center justify-end gap-2">
          {authControls}
          <Button
            className="hidden rounded-full lg:inline-flex"
            onClick={() => void handleShare()}
            variant="secondary"
          >
            {shareStatus === "copied" ? "Đã sao chép link" : "Chia sẻ bộ lọc"}
          </Button>
          <Badge
            aria-live="polite"
            className="hidden lg:inline-flex"
            tone="neutral"
          >
            {shareStatus === "error"
              ? "Không thể sao chép"
              : "Provider vibe: Tắt"}
          </Badge>
          <button
            className="chon-tablet-filter-trigger hidden rounded-full border border-[#ddd2c3] bg-[#fffdf9] px-3 py-2 text-xs font-extrabold text-[#28231f]"
            onClick={() => setFilterPanelOpen(true)}
            type="button"
          >
            Bộ lọc
          </button>
        </div>
      </header>

      <nav
        aria-label="Mục đích nhanh"
        className="chon-purpose-nav flex min-h-14 items-center gap-2 overflow-x-auto border-b border-[#ddd2c3] bg-[#f7f2eb] px-4 py-2 sm:px-6 lg:px-8"
      >
        <span className="mr-1 shrink-0 text-sm font-extrabold text-[#756c63]">
          Mục đích
        </span>
        {purposes.map((item) => {
          const selected = item.id === purpose;
          return (
            <button
              aria-pressed={selected}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-extrabold transition-colors ${
                selected
                  ? "border-[#c96040] bg-[#f5ddd3] text-[#963f2a]"
                  : "border-[#ddd2c3] bg-[#fffdf9] text-[#28231f] hover:border-[#c96040]"
              }`}
              key={item.id}
              onClick={() => setPurpose(item.id)}
              type="button"
            >
              <span aria-hidden="true" className="chon-purpose-icon">
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <h1 className="sr-only">Hôm nay bạn cần một Chốn thế nào?</h1>

      <div className="chon-prototype-workspace">
        <aside
          aria-label="Bộ lọc tìm kiếm"
          className="chon-filter-panel border-r p-4 sm:p-5"
          data-open={filterPanelOpen}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="chon-filter-title">Tìm một Chốn</h2>
            <div className="flex items-center gap-2">
              <button
                aria-label="Đóng bộ lọc"
                className="chon-tablet-filter-close hidden size-9 place-items-center rounded-full border border-[#ddd2c3] bg-[#fffdf9] text-lg"
                onClick={() => setFilterPanelOpen(false)}
                type="button"
              >
                ×
              </button>
              <button
                className="rounded-full border border-[#ddd2c3] bg-[#fffdf9] px-3 py-2 text-sm font-extrabold sm:hidden"
                onClick={() => setFilterPanelOpen((current) => !current)}
                type="button"
              >
                {filterPanelOpen ? "Ẩn bộ lọc" : "Mở bộ lọc"}
              </button>
            </div>
          </div>

          <div className={filterPanelOpen ? "block" : "hidden sm:block"}>
            <div className="border-t border-[#ddd2c3] pt-4">
              <span className="chon-filter-label mb-2 block">Khu vực</span>
              <div className="grid gap-2">
                <label className="sr-only" htmlFor="filter-location-search">
                  Tìm khu vực hoặc địa điểm
                </label>
                <input
                  aria-label="Tìm khu vực hoặc địa điểm"
                  className="chon-filter-control min-h-10 w-full rounded-xl border border-[#ddd2c3] bg-[#f7f2eb] px-3 outline-none focus:border-[#c96040]"
                  id="filter-location-search"
                  onChange={(event) => setLocationQuery(event.target.value)}
                  placeholder="Thảo Điền, Hồ Con Rùa…"
                  value={locationQuery}
                />
                <select
                  aria-label="Khu vực"
                  className="chon-filter-control min-h-10 w-full rounded-xl border border-[#ddd2c3] bg-[#f7f2eb] px-3 outline-none focus:border-[#c96040]"
                  onChange={(event) =>
                    handleDistrictChange(
                      event.target.value as "all" | ExploreDistrict,
                    )
                  }
                  value={district}
                >
                  <option value="all">Vị trí hiện tại / tất cả khu vực</option>
                  {exploreDistricts.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="Bán kính tìm kiếm"
                    className="chon-filter-control min-h-10 w-full rounded-xl border border-[#ddd2c3] bg-[#f7f2eb] px-3 outline-none focus:border-[#c96040]"
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
                  <button
                    aria-pressed={locationSelectionEnabled}
                    className={`chon-filter-control min-h-10 rounded-xl border px-2 font-extrabold transition-colors ${
                      locationSelectionEnabled
                        ? "border-[#c96040] bg-[#f5ddd3] text-[#963f2a]"
                        : "border-[#ddd2c3] bg-[#f7f2eb] text-[#28231f] hover:border-[#c96040]"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
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
                <p className="chon-text-meta leading-4 text-[#756c63]">
                  Khu vực: <strong>{selectedLocationLabel}</strong>
                  {(locationMode === "current" || locationMode === "map") &&
                    locationCenter &&
                    ` · Bán kính ${formatRadius(radiusMeters)}`}
                  {locationQueryStatus === "loading" && " · Đang tìm…"}
                  {locationQueryStatus === "ready" &&
                    locationMode === "search" && (
                      <span aria-live="polite">· Đã cập nhật kết quả</span>
                    )}
                  {locationError && (
                    <span
                      className="block font-semibold text-[#8c5a18]"
                      role="status"
                    >
                      {locationError}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-[#ddd2c3] pt-4">
              <span className="chon-filter-label mb-2 block">Thời gian</span>
              <div className="grid gap-2">
                <select
                  aria-label="Thời gian"
                  className="chon-filter-control min-h-10 w-full rounded-xl border border-[#ddd2c3] bg-[#f7f2eb] px-3 outline-none focus:border-[#c96040]"
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
                <div className="grid grid-cols-2 gap-2">
                  <label className="chon-filter-label text-[#756c63]">
                    Ngày ghé
                    <input
                      aria-label="Ngày ghé"
                      className="chon-filter-control mt-1 min-h-10 w-full rounded-xl border border-[#ddd2c3] bg-[#f7f2eb] px-2 outline-none focus:border-[#c96040]"
                      onChange={(event) => {
                        setDateValue(event.target.value);
                        updateExactTime(event.target.value, exactTime);
                      }}
                      type="date"
                      value={dateValue}
                    />
                  </label>
                  <label className="chon-filter-label text-[#756c63]">
                    Giờ
                    <input
                      aria-label="Giờ chính xác"
                      className="chon-filter-control mt-1 min-h-10 w-full rounded-xl border border-[#ddd2c3] bg-[#f7f2eb] px-2 outline-none focus:border-[#c96040]"
                      onChange={(event) => {
                        setExactTime(event.target.value);
                        updateExactTime(dateValue, event.target.value);
                      }}
                      type="time"
                      value={exactTime}
                    />
                  </label>
                </div>
                <label className="chon-filter-label text-[#756c63]">
                  Thời lượng ngồi
                  <select
                    aria-label="Thời lượng ngồi"
                    className="chon-filter-control mt-1 min-h-10 w-full rounded-xl border border-[#ddd2c3] bg-[#f7f2eb] px-3 outline-none focus:border-[#c96040]"
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
            </div>

            <details className="mt-4 border-t border-[#ddd2c3] pt-4" open>
              <summary className="chon-filter-label cursor-pointer list-none marker:hidden focus-visible:outline-2 focus-visible:outline-[#c96040]">
                <span className="flex items-center justify-between gap-3">
                  <span>Bộ lọc quy mô, tiện ích và giá</span>
                  <Badge
                    tone={activeMetadataFilterCount > 0 ? "accent" : "neutral"}
                  >
                    {activeMetadataFilterCount > 0
                      ? `${activeMetadataFilterCount} đang áp dụng`
                      : "Tùy chọn"}
                  </Badge>
                </span>
              </summary>
              <div className="mt-4 grid gap-4 border-t border-[#ddd2c3] pt-4">
                <fieldset>
                  <legend className="chon-filter-label">Quy mô</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sizeOptions.map(({ id, label }) => (
                      <label
                        className="chon-filter-option inline-flex cursor-pointer rounded-lg border border-[#ddd2c3] bg-[#f7f2eb] px-2.5 py-2 has-[:checked]:border-[#c96040] has-[:checked]:bg-[#f5ddd3] has-[:checked]:font-extrabold has-[:checked]:text-[#963f2a]"
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
                  <legend className="chon-filter-label">Tiện ích</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {amenityOptions.map((amenity) => (
                      <label
                        className="chon-filter-option inline-flex cursor-pointer rounded-lg border border-[#ddd2c3] bg-[#f7f2eb] px-2.5 py-2 has-[:checked]:border-[#c96040] has-[:checked]:bg-[#f5ddd3] has-[:checked]:font-extrabold has-[:checked]:text-[#963f2a]"
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
                  <legend className="chon-filter-label">Giá/người</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {priceLevelOptions.map(({ id, label }) => (
                      <label
                        className="chon-filter-option inline-flex cursor-pointer rounded-lg border border-[#ddd2c3] bg-[#f7f2eb] px-2.5 py-2 has-[:checked]:border-[#c96040] has-[:checked]:bg-[#f5ddd3] has-[:checked]:font-extrabold has-[:checked]:text-[#963f2a]"
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
                  <label className="chon-filter-label mt-3 block text-[#756c63]">
                    Khoảng chi tiêu tham khảo
                    <select
                      aria-label="Khoảng chi tiêu tham khảo"
                      className="chon-filter-control mt-1 min-h-10 w-full rounded-xl border border-[#ddd2c3] bg-[#f7f2eb] px-3 outline-none focus:border-[#c96040]"
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
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#ddd2c3] pt-3">
                  <span
                    aria-live="polite"
                    className="chon-text-meta text-[#756c63]"
                  >
                    Đang lọc theo metadata đã xác minh hoặc dữ liệu minh họa.
                  </span>
                  <Button onClick={clearMetadataFilters} variant="secondary">
                    Xóa bộ lọc
                  </Button>
                </div>
              )}
            </details>

            <Button
              className="mt-5 w-full"
              onClick={() => setFilterPanelOpen(false)}
              variant="primary"
            >
              Áp dụng bộ lọc
            </Button>
          </div>
        </aside>

        <section
          aria-describedby="explore-results-help"
          aria-labelledby="result-title"
          aria-busy={viewportStatus === "loading"}
          className="chon-results-panel relative rounded-xl border"
          id="explore-results"
          tabIndex={-1}
        >
          <p className="sr-only" id="explore-results-help">
            Danh sách này cung cấp đầy đủ kết quả thay thế cho bản đồ. Dùng phím
            Tab để di chuyển và Enter hoặc Space để chọn địa điểm.
          </p>
          <p aria-atomic="true" aria-live="polite" className="sr-only">
            {selectedPlace
              ? `${selectedPlace.name} đang được chọn.`
              : "Chưa chọn địa điểm."}
          </p>
          <div className="chon-results-header">
            <p className="chon-text-meta font-extrabold tracking-[0.08em] text-[#756c63] uppercase">
              {selectedPurpose?.label} · {selectedTimeLabel}
            </p>
            <div className="mt-1 flex min-w-0 items-end justify-between gap-3">
              <h2
                aria-atomic="true"
                aria-label={resultRegionLabel}
                aria-live="polite"
                className="chon-title min-w-0"
                id="result-title"
              >
                Chốn phù hợp
                <span className="sr-only">{resultRegionLabel}</span>
              </h2>
              <Badge className="shrink-0" tone="neutral">
                {visibleResults.length} kết quả
              </Badge>
            </div>
          </div>

          <div className="chon-results-content p-4 sm:p-5">
            <p className="chon-text-meta mb-3 text-[#756c63]">
              {visibleResults.length}{" "}
              {mapStyleUrl && viewportStatus === "ready"
                ? "địa điểm trong vùng bản đồ"
                : "địa điểm phù hợp"}
              .
            </p>

            {(mapAvailabilityStatus === "unconfigured" ||
              mapAvailabilityStatus === "error") && (
              <div
                className="mb-3 rounded-xl border border-[#426b57]/15 bg-[#deeadf] px-3 py-2 text-xs leading-5 text-[#426b57]"
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
                className={`mb-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs ${
                  viewportStatus === "error"
                    ? "bg-[#f5e8c8] text-[#8c5a18]"
                    : "bg-[#deeadf] text-[#426b57]"
                }`}
                role={viewportStatus === "error" ? "alert" : "status"}
              >
                <span className="flex items-center gap-2">
                  {viewportStatus === "loading" && (
                    <span
                      aria-hidden="true"
                      className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-[#426b57]/25 border-t-[#426b57]"
                    />
                  )}
                  {viewportStatus === "loading" &&
                    "Đang đồng bộ danh sách với vùng bản đồ…"}
                  {viewportStatus === "ready" &&
                    `${visibleResults.length} địa điểm đang nằm trong vùng xem.`}
                  {viewportStatus === "error" && viewportError}
                </span>
                {viewportStatus === "error" && latestViewport && (
                  <Button
                    className="shrink-0 px-2.5"
                    onClick={() => void queryViewport(latestViewport)}
                    variant="secondary"
                  >
                    Thử lại
                  </Button>
                )}
              </div>
            )}

            {viewportStatus === "ready" && viewportHasMore && (
              <p className="mb-3 text-xs text-[#8c5a18]">
                Vùng này có hơn 100 địa điểm. Hãy phóng to để thu hẹp kết quả.
              </p>
            )}

            <ol
              aria-busy={viewportStatus === "loading"}
              aria-label="Danh sách địa điểm phù hợp"
              className="grid gap-3"
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
                  <li className="list-none" key={place.id}>
                    <div
                      className={`rounded-xl border p-2.5 transition ${
                        selected
                          ? "border-[#c96040] bg-[#fffdf9] shadow-[0_5px_18px_rgba(69,50,37,0.1)]"
                          : "border-[#ddd2c3] bg-[#fffdf9] hover:border-[#c96040]"
                      }`}
                    >
                      <button
                        aria-current={selected ? "true" : undefined}
                        aria-describedby={`${placeMetaId} ${
                          place.matchScore === null ? "" : placeMatchId
                        } ${placeStatusId}`.replaceAll("  ", " ")}
                        aria-labelledby={`${placeRankId} ${placeNameId}`}
                        aria-pressed={selected}
                        className="grid w-full grid-cols-[88px_minmax(0,1fr)] gap-3 border-0 bg-transparent p-0 text-left transition focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[#c96040] sm:grid-cols-[104px_minmax(0,1fr)]"
                        onClick={() => setSelectedPlaceId(place.id)}
                        ref={(element) => {
                          if (element) cardRefs.current.set(place.id, element);
                          else cardRefs.current.delete(place.id);
                        }}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="relative min-h-[116px] rounded-lg bg-[linear-gradient(145deg,rgba(201,96,64,.75),transparent_58%),repeating-linear-gradient(45deg,#476f5b_0_20px,#7e9683_20px_40px)] sm:min-h-[116px]"
                        >
                          <span className="absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-[#fffdf9]/95 text-[10px] font-extrabold text-[#28231f]">
                            {rank}
                          </span>
                          {place.matchScore !== null && (
                            <span className="absolute right-1.5 bottom-1.5 rounded-full bg-[#fffdf9]/95 px-2 py-1 text-[10px] font-extrabold">
                              {place.matchScore}%
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 py-0.5">
                          <span className="sr-only" id={placeRankId}>
                            Hạng {rank}.
                          </span>
                          <span
                            className="chon-text-meta block text-[#756c63]"
                            id={placeMetaId}
                          >
                            {place.district} ·{" "}
                            {formatPrice(
                              place.typicalSpendMin,
                              place.typicalSpendMax,
                              place.currency,
                            )}
                            {place.metadata.isSimulated && " · Giá minh họa"}
                          </span>
                          <strong
                            className="chon-place-name mt-1 block"
                            id={placeNameId}
                          >
                            {place.name}
                          </strong>
                          {place.explanation.reasons[0] && (
                            <span className="chon-text-sm mt-2 block text-[#426b57]">
                              <strong>Vì sao hợp</strong> ·{" "}
                              {place.explanation.reasons[0]}
                              <span className="sr-only">
                                {place.explanation.reasons.join(" · ")}
                              </span>
                            </span>
                          )}
                          <span
                            className="chon-text-sm mt-1 block text-[#8c5a18]"
                            id={placeStatusId}
                          >
                            {place.confidence === "insufficient" ? "!" : "○"}{" "}
                            {confidenceLabel(place.confidence)} ·{" "}
                            {place.reportCount}{" "}
                            {place.vibeIsSimulated ? "góp ý mô phỏng" : "góp ý"}
                          </span>
                          {vibe && (
                            <span className="mt-2 flex flex-wrap gap-1">
                              {highlightedDimensions.map((dimension) => (
                                <span
                                  className="chon-text-meta rounded-md bg-[#eee6da] px-1.5 py-1 text-[#756c63]"
                                  key={dimension}
                                >
                                  {vibeLabels[dimension]}{" "}
                                  {vibe[dimension].toFixed(1)}/5
                                </span>
                              ))}
                            </span>
                          )}
                          {!vibe && (
                            <span className="chon-text-sm mt-2 block text-[#8c5a18]">
                              Chưa đủ dữ liệu vibe
                            </span>
                          )}
                          {place.explanation.cautions.length > 0 && (
                            <span className="chon-text-sm mt-1 block text-[#8c5a18]">
                              {place.explanation.cautions.join(" · ")}
                            </span>
                          )}
                          <span className="mt-2 flex min-h-7 items-center gap-2">
                            {place.matchScore !== null && (
                              <Badge
                                id={placeMatchId}
                                tone={selected ? "accent" : "success"}
                              >
                                {place.matchScore}% phù hợp
                              </Badge>
                            )}
                            {selected && <Badge tone="accent">Đang chọn</Badge>}
                          </span>
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
              {visibleResults.length === 0 && (
                <li className="list-none rounded-xl border border-dashed border-[#ddd2c3] bg-[#fffdf9] p-6 text-center text-sm leading-6 text-[#756c63]">
                  <strong className="block text-base text-[#28231f]">
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
                    <Button
                      className="mt-4"
                      onClick={showAllResults}
                      variant="secondary"
                    >
                      Xem toàn bộ danh sách
                    </Button>
                  )}
                </li>
              )}
            </ol>
          </div>
        </section>

        <section className="chon-map-panel self-start overflow-hidden rounded-xl border border-[#ddd2c3] bg-[#e5ded3] shadow-sm lg:sticky lg:top-4">
          <a
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-[#28231f] focus:shadow-lg"
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
          {selectedPlace && (
            <aside
              aria-label={"Địa điểm đang chọn: " + selectedPlace.name}
              className="chon-map-selection-card absolute right-3 bottom-3 z-20 w-[min(380px,calc(100%-1.5rem))] rounded-xl border border-[#ddd2c3] bg-[#fffdf9] p-3 shadow-[0_16px_40px_rgba(69,50,37,0.2)] sm:right-4 sm:bottom-4 sm:p-4"
            >
              <button
                aria-label={"Bỏ chọn " + selectedPlace.name}
                className="absolute top-3 right-3 grid size-8 place-items-center rounded-full border border-[#ddd2c3] bg-[#fffdf9]/95 text-lg leading-none text-[#28231f] shadow-sm transition hover:border-[#c96040] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c96040]"
                onClick={() => setSelectedPlaceId(null)}
                type="button"
              >
                ×
              </button>
              <div
                aria-hidden="true"
                className="relative h-28 overflow-hidden rounded-lg bg-[linear-gradient(145deg,rgba(201,96,64,.78),transparent_58%),repeating-linear-gradient(45deg,#476f5b_0_24px,#7e9683_24px_48px)] sm:h-36 lg:h-[155px]"
              >
                {selectedPlace.matchScore !== null && (
                  <span className="absolute right-2 bottom-2 rounded-full bg-[#fffdf9]/95 px-2.5 py-1 text-xs font-extrabold text-[#28231f]">
                    {selectedPlace.matchScore}% phù hợp
                  </span>
                )}
              </div>
              <div className="mt-3 pr-10">
                <p className="chon-text-meta font-extrabold tracking-[0.08em] text-[#756c63] uppercase">
                  {selectedPlace.district} ·{" "}
                  {selectedPlace.metadata.isSimulated
                    ? "Dữ liệu minh họa"
                    : "Địa điểm đã nhập"}
                </p>
                <h3 className="chon-place-name mt-1 text-[26px]">
                  {selectedPlace.name}
                </h3>
                <p className="chon-text-meta mt-1 text-[#756c63]">
                  {formatPrice(
                    selectedPlace.typicalSpendMin,
                    selectedPlace.typicalSpendMax,
                    selectedPlace.currency,
                  )}
                  {selectedPlace.vibeIsSimulated && " · Vibe mô phỏng"}
                </p>
              </div>
              {selectedPlace.explanation.reasons[0] && (
                <p className="chon-text-sm mt-2 text-[#426b57]">
                  ✓ {selectedPlace.explanation.reasons[0]}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Link
                  className="chon-text-sm inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-[#ddd2c3] px-3 font-extrabold text-[#28231f] transition hover:border-[#c96040] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c96040]"
                  href={"/places/" + selectedPlace.slug}
                >
                  Mở chi tiết
                </Link>
                <Link
                  className="chon-text-sm inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-[#c96040] px-3 font-extrabold text-white transition hover:bg-[#a94e35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c96040]"
                  href={"/places/" + selectedPlace.slug}
                >
                  Góp vibe
                </Link>
              </div>
            </aside>
          )}
        </section>
      </div>
    </main>
  );
}
