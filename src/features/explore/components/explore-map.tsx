"use client";

import * as maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import type { ExplorePlace } from "../domain/explore";
import {
  type GeolocationStatus,
  useGeolocation,
} from "../hooks/use-geolocation";

const defaultCenter: [number, number] = [106.7009, 10.787];
const mapLoadTimeoutMs = 15_000;
const mapLibreWorkerUrl = "/maplibre/maplibre-gl-worker.mjs";
const placeSourceId = "explore-places";
const clusterLayerId = "explore-place-clusters";
const clusterCountLayerId = "explore-place-cluster-count";
const placeCircleLayerId = "explore-place-circles";
const placeRankLayerId = "explore-place-ranks";

const geolocationMessages: Readonly<Record<GeolocationStatus, string>> = {
  denied:
    "Quyền vị trí đang bị chặn. Hãy bật Location cho localhost trong biểu tượng cạnh thanh địa chỉ rồi thử lại.",
  error:
    "Không thể xác định vị trí. Hãy kiểm tra quyền trình duyệt và thử lại.",
  granted: "Đã định vị và đưa bản đồ tới vị trí của bạn.",
  idle: "Vị trí chỉ được truy cập sau khi bạn chủ động bấm nút.",
  insecure: "Vị trí chỉ hoạt động trên HTTPS hoặc localhost.",
  requesting: "Đang yêu cầu vị trí từ trình duyệt…",
  timeout: "Thiết bị phản hồi quá lâu. Hãy thử lại ở nơi có tín hiệu tốt hơn.",
  unavailable:
    "Thiết bị chưa cung cấp được vị trí. Hãy bật Dịch vụ định vị rồi thử lại.",
  unsupported: "Trình duyệt này không hỗ trợ geolocation.",
};

function geolocationButtonLabel(status: GeolocationStatus): string {
  if (status === "requesting") return "Đang xác định…";
  if (status === "granted") return "Định vị lại";
  if (
    status === "denied" ||
    status === "error" ||
    status === "timeout" ||
    status === "unavailable"
  ) {
    return "Thử lại vị trí";
  }
  return "Dùng vị trí hiện tại";
}

type ExploreMapProps = Readonly<{
  mapStyleUrl: string | null;
  onStatusChange?: (status: ExploreMapStatus) => void;
  onSelectPlace: (placeId: string) => void;
  onViewportChange?: (bounds: MapViewportBounds) => void;
  places: readonly ExplorePlace[];
  selectedPlaceId: string | null;
}>;

export type MapViewportBounds = Readonly<{
  east: number;
  north: number;
  south: number;
  west: number;
}>;

export type ExploreMapStatus = "unconfigured" | "loading" | "ready" | "error";

type MapStatus = Exclude<ExploreMapStatus, "unconfigured">;

function createPlaceFeatureCollection(
  places: readonly ExplorePlace[],
  selectedPlaceId: string | null,
) {
  return {
    features: places.map((place, index) => ({
      geometry: {
        coordinates: [place.longitude, place.latitude],
        type: "Point",
      },
      properties: {
        name: place.name,
        placeId: place.id,
        rank: index + 1,
        selected: place.id === selectedPlaceId ? 1 : 0,
      },
      type: "Feature",
    })),
    type: "FeatureCollection",
  };
}

export function ExploreMap({
  mapStyleUrl,
  onSelectPlace,
  onStatusChange,
  onViewportChange,
  places,
  selectedPlaceId,
}: ExploreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectPlaceRef = useRef(onSelectPlace);
  const onViewportChangeRef = useRef(onViewportChange);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [mapRetryKey, setMapRetryKey] = useState(0);
  const {
    location,
    requestLocation,
    status: geolocationStatus,
  } = useGeolocation();

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    onSelectPlaceRef.current = onSelectPlace;
  }, [onSelectPlace]);

  useEffect(() => {
    onStatusChange?.(mapStyleUrl ? mapStatus : "unconfigured");
  }, [mapStatus, mapStyleUrl, onStatusChange]);

  useEffect(() => {
    if (!mapStyleUrl || !containerRef.current) return;

    let loaded = false;
    let mapLoadTimeout: ReturnType<typeof setTimeout> | undefined;
    setMapStatus("loading");

    try {
      maplibregl.setWorkerUrl(mapLibreWorkerUrl);

      const map = new maplibregl.Map({
        attributionControl: { compact: true },
        center: defaultCenter,
        container: containerRef.current,
        style: mapStyleUrl,
        zoom: 12,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");
      const publishViewport = () => {
        const bounds = map.getBounds();

        onViewportChangeRef.current?.({
          east: bounds.getEast(),
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          west: bounds.getWest(),
        });
      };
      map.once("load", () => {
        loaded = true;
        clearTimeout(mapLoadTimeout);
        setMapStatus("ready");
        publishViewport();
      });
      map.on("moveend", publishViewport);
      const handleMapError = () => {
        if (!loaded) {
          clearTimeout(mapLoadTimeout);
          setMapStatus("error");
        }
      };
      map.on("error", handleMapError);
      mapLoadTimeout = setTimeout(() => {
        if (!loaded) setMapStatus("error");
      }, mapLoadTimeoutMs);
      setMapInstance(map);

      return () => {
        clearTimeout(mapLoadTimeout);
        userMarkerRef.current?.remove();
        userMarkerRef.current = null;
        setMapInstance(null);
        map.off("error", handleMapError);
        map.off("moveend", publishViewport);
        map.remove();
      };
    } catch {
      setMapStatus("error");
    }
  }, [mapRetryKey, mapStyleUrl]);

  useEffect(() => {
    if (!mapInstance || mapStatus !== "ready") return;

    if (!mapInstance.getSource(placeSourceId)) {
      mapInstance.addSource(placeSourceId, {
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 52,
        data: createPlaceFeatureCollection([], null),
        type: "geojson",
      });

      mapInstance.addLayer({
        filter: ["has", "point_count"],
        id: clusterLayerId,
        paint: {
          "circle-color": "#f4c96b",
          "circle-radius": ["step", ["get", "point_count"], 27, 10, 32, 30, 37],
          "circle-stroke-color": "#173f33",
          "circle-stroke-width": 4,
        },
        source: placeSourceId,
        type: "circle",
      });
      mapInstance.addLayer({
        filter: ["has", "point_count"],
        id: clusterCountLayerId,
        layout: {
          "text-field": [
            "format",
            ["get", "point_count_abbreviated"],
            { "font-scale": 1.25 },
            "\nCHỐN",
            { "font-scale": 0.55 },
          ],
          "text-line-height": 0.9,
          "text-size": 12,
        },
        paint: { "text-color": "#173f33" },
        source: placeSourceId,
        type: "symbol",
      });
      mapInstance.addLayer({
        filter: ["!", ["has", "point_count"]],
        id: placeCircleLayerId,
        paint: {
          "circle-color": [
            "case",
            ["==", ["get", "selected"], 1],
            "#fff8e7",
            "#173f33",
          ],
          "circle-radius": 18,
          "circle-stroke-color": [
            "case",
            ["==", ["get", "selected"], 1],
            "#c59635",
            "#ffffff",
          ],
          "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 5, 3],
        },
        source: placeSourceId,
        type: "circle",
      });
      mapInstance.addLayer({
        filter: ["!", ["has", "point_count"]],
        id: placeRankLayerId,
        layout: {
          "text-allow-overlap": true,
          "text-field": ["to-string", ["get", "rank"]],
          "text-size": 13,
        },
        paint: {
          "text-color": [
            "case",
            ["==", ["get", "selected"], 1],
            "#173f33",
            "#ffffff",
          ],
        },
        source: placeSourceId,
        type: "symbol",
      });
    }

    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      const features = mapInstance.queryRenderedFeatures(event.point, {
        layers: [
          clusterCountLayerId,
          placeRankLayerId,
          clusterLayerId,
          placeCircleLayerId,
        ],
      });
      const placeFeature = features.find(
        (feature) => typeof feature.properties?.placeId === "string",
      );
      const placeId = placeFeature?.properties?.placeId;
      if (typeof placeId === "string") {
        onSelectPlaceRef.current(placeId);
        return;
      }

      const clusterFeature = features.find(
        (feature) => feature.properties?.cluster_id !== undefined,
      );
      if (!clusterFeature || clusterFeature.geometry.type !== "Point") return;

      const clusterId = Number(clusterFeature.properties?.cluster_id);
      if (!Number.isInteger(clusterId)) return;

      const source = mapInstance.getSource(
        placeSourceId,
      ) as maplibregl.GeoJSONSource;
      void source
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          mapInstance.easeTo({
            center: clusterFeature.geometry.coordinates as [number, number],
            duration: 450,
            zoom,
          });
        })
        .catch(() => undefined);
    };
    mapInstance.on("click", handleMapClick);

    return () => {
      mapInstance.off("click", handleMapClick);
    };
  }, [mapInstance, mapStatus]);

  useEffect(() => {
    if (!mapInstance || mapStatus !== "ready") return;

    const source = mapInstance.getSource(
      placeSourceId,
    ) as maplibregl.GeoJSONSource;
    source?.setData(createPlaceFeatureCollection(places, selectedPlaceId));
  }, [mapInstance, mapStatus, places, selectedPlaceId]);

  useEffect(() => {
    if (!mapInstance || mapStatus !== "ready") return;

    const bounds = new maplibregl.LngLatBounds();
    places.forEach((place) => bounds.extend([place.longitude, place.latitude]));

    if (places.length === 1) {
      mapInstance.easeTo({
        center: [places[0].longitude, places[0].latitude],
        duration: 500,
        zoom: 14,
      });
    } else if (places.length > 1) {
      mapInstance.fitBounds(bounds, {
        duration: 500,
        maxZoom: 14,
        padding: 64,
      });
    }
  }, [mapInstance, mapStatus, places]);

  useEffect(() => {
    if (!mapInstance || !selectedPlaceId) return;

    const selectedPlace = places.find(({ id }) => id === selectedPlaceId);
    if (!selectedPlace) return;

    mapInstance.easeTo({
      center: [selectedPlace.longitude, selectedPlace.latitude],
      duration: 350,
      zoom: Math.max(mapInstance.getZoom(), 15),
    });
  }, [mapInstance, places, selectedPlaceId]);

  useEffect(() => {
    if (!location || !mapInstance) return;

    userMarkerRef.current?.remove();
    const element = document.createElement("div");
    element.className = "chon-user-location-marker";
    element.setAttribute("aria-label", "Vị trí hiện tại của bạn");
    element.setAttribute("role", "img");
    element.title = `Độ chính xác khoảng ${Math.round(location.accuracy)} m`;

    userMarkerRef.current = new maplibregl.Marker({ element })
      .setLngLat([location.longitude, location.latitude])
      .addTo(mapInstance);
    mapInstance.flyTo({
      center: [location.longitude, location.latitude],
      essential: true,
      zoom: 14,
    });
  }, [location, mapInstance]);

  if (!mapStyleUrl) {
    return (
      <section
        aria-describedby="map-fallback-description"
        aria-label="Bản đồ các địa điểm"
        className="grid min-h-[340px] place-items-center bg-[#d9ddc7] px-6 text-center lg:min-h-[680px]"
        role="region"
      >
        <div className="max-w-md rounded-2xl bg-white/90 p-5 shadow-sm">
          <p className="font-bold text-[#173f33]">Chưa cấu hình bản đồ</p>
          <p
            className="mt-2 text-sm leading-6 text-[#5e746a]"
            id="map-fallback-description"
          >
            Thêm MapTiler browser key vào environment. Danh sách địa điểm vẫn
            hoạt động bình thường.
          </p>
          <a
            className="mt-3 inline-flex rounded-lg font-bold text-[#315d50] underline decoration-[#315d50]/35 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#315d50]"
            href="#explore-results"
          >
            Đến danh sách địa điểm
          </a>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-describedby="map-accessible-description"
      aria-label="Bản đồ các địa điểm"
      aria-busy={mapStatus === "loading"}
      className="relative min-h-[340px] overflow-hidden bg-[#d9ddc7] lg:min-h-[680px]"
      role="region"
    >
      <p className="sr-only" id="map-accessible-description">
        Bản đồ là chế độ xem bổ trợ. Toàn bộ địa điểm cũng có trong danh sách
        accessible ngay sau bản đồ.
      </p>
      <div
        ref={containerRef}
        style={{
          height: "100%",
          inset: 0,
          position: "absolute",
          width: "100%",
        }}
      />

      <div className="absolute top-3 left-3 z-20 max-w-[calc(100%-5rem)] rounded-2xl border border-white/80 bg-white/95 p-2.5 shadow-md backdrop-blur">
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-[#173f33] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#245a49] disabled:cursor-wait disabled:opacity-70"
          disabled={geolocationStatus === "requesting"}
          onClick={requestLocation}
          type="button"
        >
          <span aria-hidden="true" className="text-base leading-none">
            ◎
          </span>
          {geolocationButtonLabel(geolocationStatus)}
        </button>
        <p
          aria-live={geolocationStatus === "denied" ? "assertive" : "polite"}
          className={`mt-1.5 max-w-sm text-[11px] leading-4 ${
            geolocationStatus === "granted"
              ? "font-semibold text-[#25704f]"
              : geolocationStatus === "idle" ||
                  geolocationStatus === "requesting"
                ? "text-[#5e746a]"
                : "font-semibold text-[#8b5a2b]"
          }`}
        >
          {geolocationMessages[geolocationStatus]}
        </p>
      </div>

      {mapStatus === "ready" && places.length > 0 && (
        <div
          aria-label="Chú thích ký hiệu bản đồ"
          className="absolute bottom-3 left-3 z-10 flex flex-col gap-2 rounded-xl bg-white/92 px-3 py-2 text-[11px] font-semibold text-[#42645a] shadow-sm backdrop-blur"
        >
          <span className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full border-[3px] border-[#173f33] bg-[#f4c96b] text-[9px] font-black text-[#173f33]">
              3+
            </span>
            Nhóm địa điểm · bấm để phóng to
          </span>
          <span className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full border-[3px] border-white bg-[#173f33] text-[10px] font-black text-white shadow-sm">
              1
            </span>
            Một địa điểm
          </span>
        </div>
      )}

      {mapStatus === "ready" && places.length === 0 && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#d9ddc7]/80 px-6 text-center">
          <div className="max-w-sm rounded-2xl bg-white/95 p-5 shadow-sm">
            <p className="font-bold text-[#173f33]">
              Không có địa điểm để hiển thị
            </p>
            <p className="mt-2 text-sm leading-6 text-[#5e746a]">
              Hãy đổi khu vực, thời gian hoặc mục đích để xem kết quả khác.
            </p>
          </div>
        </div>
      )}

      {mapStatus === "loading" && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#d9ddc7]/90 text-sm font-semibold text-[#315d50]">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="size-5 animate-spin rounded-full border-2 border-[#315d50]/25 border-t-[#315d50]"
            />
            Đang tải bản đồ…
          </div>
        </div>
      )}

      {mapStatus === "error" && (
        <div
          className="absolute inset-0 z-30 grid place-items-center bg-[#f7eee0]/95 px-6 text-center"
          role="alert"
        >
          <div>
            <p className="font-bold text-[#6f431e]">Không thể tải bản đồ</p>
            <p className="mt-2 text-sm text-[#805b39]">
              Kiểm tra MapTiler key hoặc kết nối mạng. Danh sách địa điểm vẫn
              hoạt động.
            </p>
            <button
              className="mt-4 rounded-xl border border-[#805b39]/20 bg-white px-4 py-2 text-sm font-bold text-[#6f431e] transition hover:bg-[#fffaf4] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#805b39]"
              onClick={() => {
                setMapStatus("loading");
                setMapRetryKey((current) => current + 1);
              }}
              type="button"
            >
              Tải lại bản đồ
            </button>
            <a
              className="mt-3 block text-sm font-bold text-[#6f431e] underline decoration-[#805b39]/35 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#805b39]"
              href="#explore-results"
            >
              Đến danh sách địa điểm
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
