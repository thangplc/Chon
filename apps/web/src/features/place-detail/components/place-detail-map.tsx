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

  const osmUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;

  return (
    <section
      aria-label={`Vị trí của ${name}`}
      className="relative min-h-64 overflow-hidden rounded-[1.5rem] border border-[#173f33]/10 bg-[#d9ddc7]"
    >
      {mapStyleUrl ? (
        <div className="absolute inset-0" ref={containerRef} />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-[#42645a]">
          Bản đồ chưa được cấu hình. Tọa độ địa điểm vẫn có thể mở bằng
          OpenStreetMap.
        </div>
      )}
      {mapStyleUrl && status === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-[#d9ddc7] text-sm font-semibold text-[#42645a]">
          Đang tải vị trí…
        </div>
      )}
      {mapStyleUrl && status === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-[#f0eadb] p-6 text-center text-sm text-[#805b39]">
          Không thể tải bản đồ. Bạn vẫn có thể mở tọa độ trên OpenStreetMap.
        </div>
      )}
      <a
        className="absolute right-3 bottom-3 rounded-xl bg-white/95 px-3 py-2 text-xs font-bold text-[#315d50] shadow-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c59635]"
        href={osmUrl}
        rel="noreferrer"
        target="_blank"
      >
        Mở trên OpenStreetMap
      </a>
    </section>
  );
}
