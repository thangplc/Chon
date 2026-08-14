"use client";

import { useCallback, useState } from "react";

export type GeolocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "insecure"
  | "unsupported"
  | "unavailable"
  | "timeout"
  | "error";

export type UserLocation = Readonly<{
  accuracy: number;
  latitude: number;
  longitude: number;
}>;

export type GeolocationState = Readonly<{
  location: UserLocation | null;
  status: GeolocationStatus;
}>;

const geolocationOptions: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 60_000,
  timeout: 10_000,
};

function statusFromError(error: GeolocationPositionError): GeolocationStatus {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.POSITION_UNAVAILABLE) return "unavailable";
  if (error.code === error.TIMEOUT) return "timeout";
  return "error";
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    status: "idle",
  });

  const requestLocation = useCallback(() => {
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setState({ location: null, status: "insecure" });
      return;
    }

    if (
      typeof navigator === "undefined" ||
      navigator.geolocation === undefined
    ) {
      setState({ location: null, status: "unsupported" });
      return;
    }

    setState((current) => ({
      location: current.location,
      status: "requesting",
    }));

    const locate = () => {
      try {
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            setState({
              location: {
                accuracy: coords.accuracy,
                latitude: coords.latitude,
                longitude: coords.longitude,
              },
              status: "granted",
            });
          },
          (error) => {
            setState({ location: null, status: statusFromError(error) });
          },
          geolocationOptions,
        );
      } catch {
        setState({ location: null, status: "error" });
      }
    };

    if (navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "geolocation" })
        .then((permission) => {
          if (permission.state === "denied") {
            setState({ location: null, status: "denied" });
            return;
          }
          locate();
        })
        .catch(locate);
      return;
    }

    locate();
  }, []);

  return {
    ...state,
    requestLocation,
  } as const;
}
