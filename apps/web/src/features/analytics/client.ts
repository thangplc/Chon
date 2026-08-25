"use client";

import type {
  AnalyticsEvent,
  AnalyticsEventName,
  AnalyticsPayloadFor,
} from "@chon/contracts/analytics";

const SESSION_STORAGE_KEY = "chon.analytics.session_id";

export function getAnonymousSessionId(): string {
  if (typeof window === "undefined") return "anon_server";

  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const generated = `anon_${
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
    }`;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `anon_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

export function trackAnalyticsEvent<TName extends AnalyticsEventName>(
  eventName: TName,
  payload: AnalyticsPayloadFor<TName>,
): void {
  if (typeof window === "undefined") return;
  const event = {
    eventName,
    payload,
    sessionId: getAnonymousSessionId(),
  } as AnalyticsEvent;
  const encoded = JSON.stringify(event);

  try {
    if (
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(
        "/api/analytics/events",
        new Blob([encoded], { type: "application/json" }),
      )
    ) {
      return;
    }
  } catch {
    // Fall back to fetch when sendBeacon is unavailable or rejected.
  }

  void fetch("/api/analytics/events", {
    body: encoded,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}
