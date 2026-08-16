import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getExplorePlaces } from "../domain/explore";
import { exploreTestDataset } from "../testing/explore-test-dataset";
import { ExploreMap } from "./explore-map";

const maplibreMocks = vi.hoisted(() => ({
  autoLoad: true,
  mapInstances: [] as Array<{
    addLayer: ReturnType<typeof vi.fn>;
    addSource: ReturnType<typeof vi.fn>;
    easeTo: ReturnType<typeof vi.fn>;
    emit: (event: string) => void;
    fitBounds: ReturnType<typeof vi.fn>;
    flyTo: ReturnType<typeof vi.fn>;
    getBounds: ReturnType<typeof vi.fn>;
    getSource: (id: string) =>
      | {
          getClusterExpansionZoom: ReturnType<typeof vi.fn>;
          setData: ReturnType<typeof vi.fn>;
        }
      | undefined;
    getZoom: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    queryRenderedFeatures: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    unproject: ReturnType<typeof vi.fn>;
  }>,
  markerInstances: [] as Array<{
    element: HTMLElement;
    lngLat: [number, number] | null;
    remove: ReturnType<typeof vi.fn>;
  }>,
  renderedFeatures: [] as Array<{
    geometry: { coordinates: [number, number]; type: "Point" };
    properties: Record<string, unknown>;
  }>,
  setWorkerUrl: vi.fn(),
}));
const originalGeolocation = Object.getOwnPropertyDescriptor(
  navigator,
  "geolocation",
);
const originalPermissions = Object.getOwnPropertyDescriptor(
  navigator,
  "permissions",
);

vi.mock("maplibre-gl", () => {
  class MockBounds {
    extend() {
      return this;
    }
  }

  class MockMap {
    private handlers = new globalThis.Map<string, Set<() => void>>();
    private sources = new globalThis.Map<
      string,
      {
        getClusterExpansionZoom: ReturnType<typeof vi.fn>;
        setData: ReturnType<typeof vi.fn>;
      }
    >();

    addLayer = vi.fn();
    addSource = vi.fn((id: string) => {
      this.sources.set(id, {
        getClusterExpansionZoom: vi.fn().mockResolvedValue(15),
        setData: vi.fn(),
      });
    });
    easeTo = vi.fn();
    emit = (event: string) => {
      this.handlers.get(event)?.forEach((callback) => {
        if (event === "click") {
          (
            callback as unknown as (event: {
              point: { x: number; y: number };
            }) => void
          )({ point: { x: 100, y: 100 } });
        } else {
          callback();
        }
      });
    };
    fitBounds = vi.fn();
    flyTo = vi.fn();
    getBounds = vi.fn(() => ({
      getEast: () => 106.76,
      getNorth: () => 10.85,
      getSouth: () => 10.75,
      getWest: () => 106.68,
    }));
    getSource = (id: string) => this.sources.get(id);
    getZoom = vi.fn(() => 12);
    off = vi.fn((event: string, callback: () => void) => {
      this.handlers.get(event)?.delete(callback);
    });
    queryRenderedFeatures = vi.fn(() => maplibreMocks.renderedFeatures);
    remove = vi.fn();
    unproject = vi.fn(() => ({ lat: 10.79, lng: 106.71 }));

    constructor() {
      maplibreMocks.mapInstances.push(this);
    }

    addControl() {}

    on(event: string, callback: () => void) {
      const callbacks = this.handlers.get(event) ?? new Set<() => void>();
      callbacks.add(callback);
      this.handlers.set(event, callbacks);
    }

    once(event: string, callback: () => void) {
      if (event === "load" && maplibreMocks.autoLoad) callback();
      else this.on(event, callback);
    }
  }

  class MockMarker {
    element: HTMLElement;
    lngLat: [number, number] | null = null;
    remove = vi.fn();

    constructor(options: { element?: HTMLElement } = {}) {
      this.element = options.element ?? document.createElement("div");
      maplibreMocks.markerInstances.push(this);
    }

    addTo() {
      return this;
    }

    setLngLat(coordinates: [number, number]) {
      this.lngLat = coordinates;
      return this;
    }
  }

  return {
    LngLatBounds: MockBounds,
    Map: MockMap,
    Marker: MockMarker,
    NavigationControl: class {},
    setWorkerUrl: maplibreMocks.setWorkerUrl,
  };
});

const places = getExplorePlaces(exploreTestDataset, {
  district: "all",
  purpose: "work",
  timeBucket: "morning",
});

afterEach(() => {
  maplibreMocks.autoLoad = true;
  maplibreMocks.mapInstances.length = 0;
  maplibreMocks.markerInstances.length = 0;
  maplibreMocks.renderedFeatures.length = 0;
  maplibreMocks.setWorkerUrl.mockClear();
  if (originalGeolocation) {
    Object.defineProperty(navigator, "geolocation", originalGeolocation);
  } else {
    Reflect.deleteProperty(navigator, "geolocation");
  }
  if (originalPermissions) {
    Object.defineProperty(navigator, "permissions", originalPermissions);
  } else {
    Reflect.deleteProperty(navigator, "permissions");
  }
});

describe("ExploreMap", () => {
  it("keeps the list flow available when MapTiler is not configured", () => {
    const onStatusChange = vi.fn();
    render(
      <ExploreMap
        mapStyleUrl={null}
        onSelectPlace={vi.fn()}
        onStatusChange={onStatusChange}
        places={places}
        selectedPlaceId={null}
      />,
    );

    expect(screen.getByText("Chưa cấu hình bản đồ")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Đến danh sách địa điểm" }),
    ).toHaveAttribute("href", "#explore-results");
    expect(onStatusChange).toHaveBeenCalledWith("unconfigured");
    expect(maplibreMocks.mapInstances).toHaveLength(0);
  });

  it("creates a clustered source with ranked database coordinates", async () => {
    const onStatusChange = vi.fn();
    const { unmount } = render(
      <ExploreMap
        mapStyleUrl="https://example.test/style.json"
        onSelectPlace={vi.fn()}
        onStatusChange={onStatusChange}
        places={places}
        selectedPlaceId={places[0].id}
      />,
    );

    const map = maplibreMocks.mapInstances[0];
    await waitFor(() => {
      expect(map.addSource).toHaveBeenCalledWith(
        "explore-places",
        expect.objectContaining({
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 52,
          type: "geojson",
        }),
      );
    });
    expect(map.addLayer).toHaveBeenCalledTimes(4);
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "explore-place-clusters",
        paint: expect.objectContaining({
          "circle-color": "#f4c96b",
          "circle-stroke-color": "#173f33",
        }),
      }),
    );
    expect(maplibreMocks.setWorkerUrl).toHaveBeenCalledWith(
      "/maplibre/maplibre-gl-worker.mjs",
    );

    const source = map.getSource("explore-places");
    expect(source).toBeDefined();
    await waitFor(() => expect(source?.setData).toHaveBeenCalled());
    const featureCollection = source?.setData.mock.lastCall?.[0] as {
      features: Array<{
        geometry: { coordinates: [number, number] };
        properties: { placeId: string; rank: number; selected: number };
      }>;
    };
    expect(featureCollection.features[0]).toMatchObject({
      geometry: {
        coordinates: [places[0].longitude, places[0].latitude],
      },
      properties: {
        placeId: places[0].id,
        rank: 1,
        selected: 1,
      },
    });
    expect(map.fitBounds).toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenCalledWith("ready");
    expect(screen.getByText(/Nhóm địa điểm/)).toBeInTheDocument();
    expect(screen.getByText("Một địa điểm")).toBeInTheDocument();

    unmount();
    expect(map.remove).toHaveBeenCalledOnce();
  });

  it("selects a place and expands a cluster when map features are clicked", async () => {
    const onSelectPlace = vi.fn();
    render(
      <ExploreMap
        mapStyleUrl="https://example.test/style.json"
        onSelectPlace={onSelectPlace}
        places={places}
        selectedPlaceId={null}
      />,
    );
    const map = maplibreMocks.mapInstances[0];
    await waitFor(() => expect(map.addLayer).toHaveBeenCalledTimes(4));

    maplibreMocks.renderedFeatures.push({
      geometry: { coordinates: [106.7, 10.78], type: "Point" },
      properties: { placeId: places[1].id },
    });
    act(() => map.emit("click"));
    expect(onSelectPlace).toHaveBeenCalledWith(places[1].id);

    maplibreMocks.renderedFeatures.splice(0, 1, {
      geometry: { coordinates: [106.705, 10.785], type: "Point" },
      properties: { cluster_id: 7 },
    });
    act(() => map.emit("click"));
    await waitFor(() => {
      expect(map.easeTo).toHaveBeenCalledWith({
        center: [106.705, 10.785],
        duration: 450,
        zoom: 15,
      });
    });
  });

  it("emits a map coordinate when location selection mode is enabled", async () => {
    const onSelectLocation = vi.fn();
    render(
      <ExploreMap
        locationSelectionEnabled
        mapStyleUrl="https://example.test/style.json"
        onSelectLocation={onSelectLocation}
        onSelectPlace={vi.fn()}
        places={places}
        selectedPlaceId={null}
      />,
    );
    const map = maplibreMocks.mapInstances[0];
    await waitFor(() => expect(map.addLayer).toHaveBeenCalledTimes(4));

    act(() => map.emit("click"));

    expect(onSelectLocation).toHaveBeenCalledWith({
      latitude: 10.79,
      longitude: 106.71,
    });
    expect(
      screen.getByText("Bấm bản đồ để chọn tâm tìm kiếm"),
    ).toBeInTheDocument();
  });

  it("publishes the current viewport after load and map movement", async () => {
    const onViewportChange = vi.fn();
    render(
      <ExploreMap
        mapStyleUrl="https://example.test/style.json"
        onSelectPlace={vi.fn()}
        onViewportChange={onViewportChange}
        places={places}
        selectedPlaceId={null}
      />,
    );

    await waitFor(() => {
      expect(onViewportChange).toHaveBeenCalledWith({
        east: 106.76,
        north: 10.85,
        south: 10.75,
        west: 106.68,
      });
    });

    onViewportChange.mockClear();
    act(() => maplibreMocks.mapInstances[0].emit("moveend"));
    expect(onViewportChange).toHaveBeenCalledWith({
      east: 106.76,
      north: 10.85,
      south: 10.75,
      west: 106.68,
    });
  });

  it("shows a recoverable map error", async () => {
    maplibreMocks.autoLoad = false;
    const onStatusChange = vi.fn();
    render(
      <ExploreMap
        mapStyleUrl="https://example.test/style.json"
        onSelectPlace={vi.fn()}
        onStatusChange={onStatusChange}
        places={places}
        selectedPlaceId={null}
      />,
    );

    expect(screen.getByText("Đang tải bản đồ…")).toBeInTheDocument();
    act(() => maplibreMocks.mapInstances[0].emit("error"));
    expect(await screen.findByText("Không thể tải bản đồ")).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenCalledWith("error");
    expect(
      screen.getByRole("link", { name: "Đến danh sách địa điểm" }),
    ).toHaveAttribute("href", "#explore-results");

    maplibreMocks.autoLoad = true;
    fireEvent.click(screen.getByRole("button", { name: "Tải lại bản đồ" }));
    await waitFor(() => expect(maplibreMocks.mapInstances).toHaveLength(2));
    expect(await screen.findByText(/Nhóm địa điểm/)).toBeInTheDocument();
  });

  it("shows an empty state when filters leave no map places", async () => {
    render(
      <ExploreMap
        mapStyleUrl="https://example.test/style.json"
        onSelectPlace={vi.fn()}
        places={[]}
        selectedPlaceId={null}
      />,
    );

    expect(
      await screen.findByText("Không có địa điểm để hiển thị"),
    ).toBeInTheDocument();
  });

  it("requests geolocation only after the location button is pressed", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(
      <ExploreMap
        mapStyleUrl="https://example.test/style.json"
        onSelectPlace={vi.fn()}
        places={places}
        selectedPlaceId={null}
      />,
    );

    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Dùng vị trí hiện tại" }),
    );
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });

  it("explains how to recover when site location permission is blocked", async () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: "denied" }),
      },
    });

    render(
      <ExploreMap
        mapStyleUrl="https://example.test/style.json"
        onSelectPlace={vi.fn()}
        places={places}
        selectedPlaceId={null}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dùng vị trí hiện tại" }),
    );

    expect(
      await screen.findByText(/Quyền vị trí đang bị chặn/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Thử lại vị trí" }),
    ).toBeInTheDocument();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("centers the map and adds a marker after permission is granted", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: {
              accuracy: 24,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              latitude: 10.79,
              longitude: 106.71,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: 1,
            toJSON: () => ({}),
          }),
      },
    });

    render(
      <ExploreMap
        mapStyleUrl="https://example.test/style.json"
        onSelectPlace={vi.fn()}
        places={places}
        selectedPlaceId={null}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dùng vị trí hiện tại" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Đã định vị và đưa bản đồ tới vị trí của bạn."),
      ).toBeInTheDocument();
    });
    expect(maplibreMocks.markerInstances.at(-1)?.lngLat).toEqual([
      106.71, 10.79,
    ]);
    expect(maplibreMocks.mapInstances[0].flyTo).toHaveBeenCalledWith({
      center: [106.71, 10.79],
      essential: true,
      zoom: 14,
    });
  });
});
