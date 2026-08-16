import { nameSimilarity, normalizePlaceName } from "./opening-hours";
import type { OsmOpeningHoursCandidate } from "./overpass-client";

export type OsmMatchPlace = Readonly<{
  internalId: string;
  latitude: number;
  longitude: number;
  name: string;
}>;

export type OsmMatchResult =
  | Readonly<{
      candidate: OsmOpeningHoursCandidate;
      confidence: number;
      distanceMeters: number;
      status: "matched";
    }>
  | Readonly<{ status: "ambiguous" | "unmatched" }>;

function distanceMeters(
  left: Readonly<{ latitude: number; longitude: number }>,
  right: Readonly<{ latitude: number; longitude: number }>,
): number {
  const earthRadius = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const leftLatitude = radians(left.latitude);
  const rightLatitude = radians(right.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function matchOsmOpeningHours(
  place: OsmMatchPlace,
  candidates: readonly OsmOpeningHoursCandidate[],
  radiusMeters: number,
): OsmMatchResult {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      distanceMeters: distanceMeters(place, candidate),
      nameScore: nameSimilarity(place.name, candidate.name),
    }))
    .filter(
      ({ distanceMeters: distance, nameScore }) =>
        distance <= radiusMeters && nameScore >= 0.8,
    )
    .sort(
      (left, right) =>
        right.nameScore - left.nameScore ||
        left.distanceMeters - right.distanceMeters,
    );

  const best = scored[0];
  if (!best) return { status: "unmatched" };
  const second = scored[1];
  if (
    second &&
    second.nameScore >= best.nameScore - 0.05 &&
    second.distanceMeters <= best.distanceMeters + 25
  ) {
    return { status: "ambiguous" };
  }

  const distanceConfidence = Math.max(
    0,
    1 - best.distanceMeters / radiusMeters,
  );
  const confidence = Number(
    (0.7 * best.nameScore + 0.3 * distanceConfidence).toFixed(3),
  );
  if (confidence < 0.8 || normalizePlaceName(best.candidate.name) === "") {
    return { status: "unmatched" };
  }
  return {
    candidate: best.candidate,
    confidence,
    distanceMeters: Math.round(best.distanceMeters * 10) / 10,
    status: "matched",
  };
}
