import type { AnalyticsPayloadFor } from "@chon/contracts/analytics";
import {
  getAnonymousSessionId,
  trackAnalyticsEvent,
} from "@/features/analytics/client";

export { getAnonymousSessionId };

export function trackExploreEvent(
  eventName:
    | "explore_filter_changed"
    | "explore_results_viewed"
    | "explore_share_clicked",
  payload: AnalyticsPayloadFor<"explore_results_viewed">,
): void {
  trackAnalyticsEvent(eventName, payload);
}
