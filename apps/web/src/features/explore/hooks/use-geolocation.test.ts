import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useGeolocation } from "./use-geolocation";

const originalGeolocation = Object.getOwnPropertyDescriptor(
  navigator,
  "geolocation",
);
const originalPermissions = Object.getOwnPropertyDescriptor(
  navigator,
  "permissions",
);
const originalSecureContext = Object.getOwnPropertyDescriptor(
  window,
  "isSecureContext",
);

function installGeolocation(
  getCurrentPosition: Geolocation["getCurrentPosition"],
) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      clearWatch: vi.fn(),
      getCurrentPosition,
      watchPosition: vi.fn(),
    } satisfies Geolocation,
  });
}

function position(): GeolocationPosition {
  return {
    coords: {
      accuracy: 18,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude: 10.78,
      longitude: 106.7,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: 1,
    toJSON: () => ({}),
  };
}

function positionError(code: 1 | 2 | 3): GeolocationPositionError {
  return {
    code,
    message: "test error",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
}

afterEach(() => {
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
  if (originalSecureContext) {
    Object.defineProperty(window, "isSecureContext", originalSecureContext);
  } else {
    Reflect.deleteProperty(window, "isSecureContext");
  }
});

describe("useGeolocation", () => {
  it("does not request a position before explicit user action", () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>();
    installGeolocation(getCurrentPosition);

    const { result } = renderHook(() => useGeolocation());

    expect(result.current.status).toBe("idle");
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("returns the current coordinates after permission is granted", () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>(
      (success) => success(position()),
    );
    installGeolocation(getCurrentPosition);
    const { result } = renderHook(() => useGeolocation());

    act(() => result.current.requestLocation());

    expect(result.current).toMatchObject({
      location: {
        accuracy: 18,
        latitude: 10.78,
        longitude: 106.7,
      },
      status: "granted",
    });
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 10_000,
      },
    );
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ] as const)("maps browser error %s to %s", (code, expectedStatus) => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>(
      (_success, error) => error?.(positionError(code)),
    );
    installGeolocation(getCurrentPosition);
    const { result } = renderHook(() => useGeolocation());

    act(() => result.current.requestLocation());

    expect(result.current).toMatchObject({
      location: null,
      status: expectedStatus,
    });
  });

  it("reports unsupported browsers without throwing", () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useGeolocation());

    act(() => result.current.requestLocation());

    expect(result.current.status).toBe("unsupported");
  });

  it("reports an insecure context before requesting browser location", () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>();
    installGeolocation(getCurrentPosition);
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    const { result } = renderHook(() => useGeolocation());

    act(() => result.current.requestLocation());

    expect(result.current.status).toBe("insecure");
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("reports a blocked site permission without making a location request", async () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>();
    installGeolocation(getCurrentPosition);
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: "denied" }),
      },
    });
    const { result } = renderHook(() => useGeolocation());

    act(() => result.current.requestLocation());

    await waitFor(() => expect(result.current.status).toBe("denied"));
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
