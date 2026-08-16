import type { OsmOpeningHoursConfig } from "./config";

export type OsmLookupPlace = Readonly<{
  internalId: string;
  latitude: number;
  longitude: number;
}>;

export type OsmOpeningHoursCandidate = Readonly<{
  latitude: number;
  longitude: number;
  name: string;
  openingHours: string;
  osmId: string;
  osmType: "node" | "relation" | "way";
  sourceUrl: string;
  tags: Readonly<Record<string, string>>;
}>;

type OverpassElement = Readonly<{
  center?: Readonly<{ lat: number; lon: number }>;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Readonly<Record<string, string>>;
  type: "node" | "relation" | "way";
}>;

type OverpassResponse = Readonly<{ elements?: readonly OverpassElement[] }>;

export function buildOverpassQuery(
  places: readonly OsmLookupPlace[],
  radiusMeters: number,
): string {
  const aroundQueries = places.flatMap(({ latitude, longitude }) => [
    `nwr(around:${radiusMeters},${latitude},${longitude})["amenity"="cafe"];`,
    `nwr(around:${radiusMeters},${latitude},${longitude})["shop"="coffee"];`,
  ]);
  return [
    "[out:json][timeout:30];",
    "(",
    ...aroundQueries,
    ");",
    "out center tags;",
  ].join("\n");
}

function candidateFromElement(
  element: OverpassElement,
): OsmOpeningHoursCandidate | null {
  const tags = element.tags;
  const point =
    element.lat !== undefined && element.lon !== undefined
      ? { latitude: element.lat, longitude: element.lon }
      : element.center
        ? { latitude: element.center.lat, longitude: element.center.lon }
        : undefined;
  if (!tags?.name || !tags.opening_hours || !point) return null;
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    name: tags.name,
    openingHours: tags.opening_hours,
    osmId: String(element.id),
    osmType: element.type,
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    tags,
  };
}

export class OverpassClient {
  constructor(private readonly config: OsmOpeningHoursConfig) {}

  async lookup(places: readonly OsmLookupPlace[]): Promise<
    Readonly<{
      candidates: readonly OsmOpeningHoursCandidate[];
      requests: number;
    }>
  > {
    const candidates = new Map<string, OsmOpeningHoursCandidate>();
    let requests = 0;
    for (
      let offset = 0;
      offset < places.length;
      offset += this.config.batchSize
    ) {
      if (requests >= this.config.maxRequests) {
        throw new Error(
          `OSM opening-hours request guard exceeded (${this.config.maxRequests})`,
        );
      }
      const batch = places.slice(offset, offset + this.config.batchSize);
      const response = await this.fetchBatch(batch);
      requests += 1;
      for (const element of response.elements ?? []) {
        const candidate = candidateFromElement(element);
        if (candidate) {
          candidates.set(`${candidate.osmType}:${candidate.osmId}`, candidate);
        }
      }
    }
    return { candidates: [...candidates.values()], requests };
  }

  private async fetchBatch(
    places: readonly OsmLookupPlace[],
  ): Promise<OverpassResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(this.config.overpassUrl, {
        body: new URLSearchParams({
          data: buildOverpassQuery(places, this.config.radiusMeters),
        }).toString(),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent": this.config.userAgent,
        },
        method: "POST",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Overpass returned HTTP ${response.status}`);
      }
      const payload: unknown = await response.json();
      if (
        typeof payload !== "object" ||
        payload === null ||
        !Array.isArray((payload as { elements?: unknown }).elements)
      ) {
        throw new Error("Overpass returned an invalid JSON response");
      }
      return payload as OverpassResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}
