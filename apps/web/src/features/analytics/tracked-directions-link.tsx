"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";

import { trackAnalyticsEvent } from "./client";

export function TrackedDirectionsLink({
  children,
  placeSlug,
  surface,
  ...props
}: Readonly<
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    placeSlug: string;
    surface: "place_detail" | "public_collection";
  }
>) {
  return (
    <a
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          trackAnalyticsEvent("directions_opened", {
            placeSlug,
            provider: "openstreetmap",
            surface,
          });
        }
      }}
    >
      {children}
    </a>
  );
}
