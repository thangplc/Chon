"use client";

import * as maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

const mapLibreWorkerUrl = "/maplibre/maplibre-gl-worker.mjs";
const loadTimeoutMs = 15_000;

type PlaceDetailMapProps = Readonly<{
  latitude: number;
  longitude: number;
  mapStyleUrl: string | null;
  name: string;
}>;

export function PlaceDetailMap({
  latitude,
  longitude,
  mapStyleUrl,
  name,
}: PlaceDetailMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!mapStyleUrl || !containerRef.current) return;

    let loaded = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let marker: maplibregl.Marker | undefined;

    try {
      maplibregl.setWorkerUrl(mapLibreWorkerUrl);
      const map = new maplibregl.Map({
        attributionControl: { compact: true },
        center: [longitude, latitude],
        container: containerRef.current,
        style: mapStyleUrl,
        zoom: 15,
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      map.once("load", () => {
        loaded = true;
        clearTimeout(timeout);
        const element = document.createElement("div");
        element.className = "chon-place-detail-marker";
        element.setAttribute("aria-label", `Vị trí ${name}`);
        marker = new maplibregl.Marker({ element })
          .setLngLat([longitude, latitude])
          .addTo(map);
        setStatus("ready");
      });
      map.on("error", () => {
        if (!loaded) setStatus("error");
      });
      timeout = setTimeout(() => {
        if (!loaded) setStatus("error");
      }, loadTimeoutMs);

      return () => {
        clearTimeout(timeout);
        marker?.remove();
        map.remove();
      };
    } catch {
      queueMicrotask(() => setStatus("error"));
    }
  }, [latitude, longitude, mapStyleUrl, name]);

  return (
    <section
      aria-label={`Vị trí của ${name}`}
      className="relative min-h-64 overflow-hidden rounded-[1.5rem] border border-[#c96040]/15 bg-[#eee6da]"
    >
      {mapStyleUrl ? (
        <div className="absolute inset-0" ref={containerRef} />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-[#426b57]">
          Bản đồ chưa được cấu hình. Tọa độ địa điểm vẫn có thể mở bằng
          OpenStreetMap.
        </div>
      )}
      {mapStyleUrl && status === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-[#eee6da] text-sm font-semibold text-[#426b57]">
          Đang tải vị trí…
        </div>
      )}
      {mapStyleUrl && status === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-[#f0eadb] p-6 text-center text-sm text-[#805b39]">
          Không thể tải bản đồ. Bạn vẫn có thể mở tọa độ trên OpenStreetMap.
        </div>
      )}
    </section>
  );
}
