import {
  normalizeVietmapSearchResponse,
  type VietmapNormalizationContext,
} from "./normalizer";
import {
  parseVietmapPlaceResponse,
  parseVietmapReverseResponse,
  parseVietmapSearchResponse,
  type VietmapPlaceResponse,
  type VietmapReverseResult,
  type VietmapSearchResult,
} from "./response-contract";
import type { VietmapPoiConfig } from "../config";
import type {
  NormalizedPoi,
  PoiProviderAdapter,
  PoiSearchArea,
} from "../types";

type Fetcher = (input: URL, init?: RequestInit) => Promise<Response>;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAddressPart(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isSpecificAddress(value: string | undefined): boolean {
  const normalized = value?.trim();
  if (!normalized) return false;
  return /(?:^(?:\d+[a-z]?(?:[/.-]\d+[a-z]?)*|[\p{L}]{1,6}\s*\d+(?:[/.-]\d+)*[a-z]?)\s+|\b(?:đường|hẻm|ngõ|ngách|quốc lộ|tỉnh lộ)\s+)/iu.test(
    normalized,
  );
}

function splitAddress(value: string | undefined): readonly string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinAddressParts(
  parts: readonly (string | undefined)[],
): string | null {
  const seen = new Set<string>();
  const normalized = parts
    .flatMap((part) => splitAddress(part))
    .filter((part) => {
      const key = part.toLocaleLowerCase("vi");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return normalized.length > 0 ? normalized.join(", ") : null;
}

function composePlaceAddress(place: VietmapPlaceResponse): string | null {
  const street = [place.hs_num, place.street]
    .map(normalizeAddressPart)
    .filter((value): value is string => value !== null)
    .join(" ");
  const parts = [
    street || normalizeAddressPart(place.address),
    normalizeAddressPart(place.ward),
    normalizeAddressPart(place.district),
    normalizeAddressPart(place.city),
  ].filter((value): value is string => value !== null);

  if (parts.length === 0) return normalizeAddressPart(place.display);

  const seen = new Set<string>();
  return parts
    .filter((part) => {
      const key = part.toLocaleLowerCase("vi");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}

function addressNeedsPlaceDetails(result: VietmapSearchResult): boolean {
  const address = result.address?.trim() ?? result.display?.trim() ?? "";
  if (!address) return true;

  const withoutName = address
    .replace(
      new RegExp(`^${escapeRegExp(result.name)}\\s*[,|-]?\\s*`, "iu"),
      "",
    )
    .trim();
  return !/^\d+[a-z]?\s/iu.test(withoutName);
}

function composeReverseAddress(result: VietmapReverseResult): string | null {
  const variants = [result.data_old, result.data_new, result].filter(
    (value): value is NonNullable<typeof value> => value != null,
  );

  for (const variant of variants) {
    const name = variant.name ?? result.name;
    if (isSpecificAddress(name) && variant.address) {
      return joinAddressParts([name, variant.address]);
    }
    if (isSpecificAddress(variant.display)) {
      return joinAddressParts([variant.display]);
    }
  }
  return null;
}

function retryDelayMs(response: Response | undefined, attempt: number): number {
  const retryAfter = Number(response?.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(Math.max(retryAfter * 1_000, 500), 30_000);
  }
  return Math.min(500 * 2 ** attempt, 30_000);
}

async function mapWithConcurrency<T, U>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(values.length);
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(concurrency, 1), values.length) },
      () => worker(),
    ),
  );
  return results;
}

export class VietmapPoiClientError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "VietmapPoiClientError";
    this.status = status;
  }
}

export class VietmapPoiClient implements PoiProviderAdapter {
  readonly provider = "vietmap_maps" as const;
  #requestCount = 0;
  #placeDetails = new Map<string, VietmapPlaceResponse>();
  #reverseDetails = new Map<string, VietmapReverseResult[]>();

  constructor(
    private readonly config: VietmapPoiConfig,
    private readonly fetcher: Fetcher = globalThis.fetch,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async #requestJson(
    url: URL,
    resource: "place" | "reverse" | "search",
  ): Promise<unknown> {
    if (!this.config.apiKey) {
      throw new VietmapPoiClientError("VIETMAP_API_KEY is not configured");
    }

    if (this.#requestCount >= this.config.maxRequests) {
      throw new VietmapPoiClientError(
        `VIETMAP request limit reached (${this.config.maxRequests})`,
      );
    }

    url.searchParams.set("apikey", this.config.apiKey);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (this.#requestCount >= this.config.maxRequests) {
        throw new VietmapPoiClientError(
          `VIETMAP request limit reached (${this.config.maxRequests})`,
        );
      }
      this.#requestCount += 1;
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs,
      );
      let response: Response;

      try {
        response = await this.fetcher(url, { signal: controller.signal });
      } catch (error) {
        clearTimeout(timeout);
        if (attempt < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelayMs(response, attempt)),
          );
          continue;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new VietmapPoiClientError(
          `VIETMAP ${resource} request failed: ${message}`,
        );
      }
      clearTimeout(timeout);

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelayMs(response, attempt)),
          );
          continue;
        }
        throw new VietmapPoiClientError(
          `VIETMAP ${resource} request failed with HTTP ${response.status}`,
          response.status,
        );
      }

      try {
        return await response.json();
      } catch {
        throw new VietmapPoiClientError(
          `VIETMAP ${resource} response was not valid JSON`,
        );
      }
    }

    throw new VietmapPoiClientError(`VIETMAP ${resource} request failed`);
  }

  async #getPlaceDetails(
    providerPlaceId: string,
  ): Promise<VietmapPlaceResponse> {
    const cached = this.#placeDetails.get(providerPlaceId);
    if (cached) return cached;

    const url = new URL(this.config.placeBaseUrl);
    url.searchParams.set("refid", providerPlaceId);
    const details = parseVietmapPlaceResponse(
      await this.#requestJson(url, "place"),
    );
    this.#placeDetails.set(providerPlaceId, details);
    return details;
  }

  async #getReverseDetails(
    latitude: number,
    longitude: number,
  ): Promise<readonly VietmapReverseResult[]> {
    const cacheKey = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
    const cached = this.#reverseDetails.get(cacheKey);
    if (cached) return cached;

    const url = new URL(this.config.reverseBaseUrl);
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lng", String(longitude));
    url.searchParams.set("display_type", "5");
    const details = parseVietmapReverseResponse(
      await this.#requestJson(url, "reverse"),
    );
    this.#reverseDetails.set(cacheKey, [...details]);
    return details;
  }

  async search(area: PoiSearchArea): Promise<readonly NormalizedPoi[]> {
    const url = new URL(this.config.baseUrl);
    url.searchParams.set("circle_center", `${area.latitude},${area.longitude}`);
    url.searchParams.set("circle_radius", String(area.radiusMeters));
    url.searchParams.set("display_type", "5");
    url.searchParams.set("layers", "POI");
    url.searchParams.set("text", area.text);
    if (area.category) url.searchParams.set("cats", area.category);

    const searchResults = parseVietmapSearchResponse(
      await this.#requestJson(url, "search"),
    );
    const enrichedResults = await mapWithConcurrency(
      searchResults,
      4,
      async (result: VietmapSearchResult) => {
        let enriched = result;
        if (result.lat === undefined || result.lng === undefined) {
          const details = await this.#getPlaceDetails(result.ref_id);
          const detailedAddress = composePlaceAddress(details);
          enriched = {
            ...enriched,
            address: detailedAddress ?? enriched.address,
            display: detailedAddress ?? enriched.display,
            lat: details.lat,
            lng: details.lng,
          };
        }

        if (
          enriched.lat !== undefined &&
          enriched.lng !== undefined &&
          addressNeedsPlaceDetails(enriched)
        ) {
          const reverseResults = await this.#getReverseDetails(
            enriched.lat,
            enriched.lng,
          );
          const reverseAddress = reverseResults
            .map(composeReverseAddress)
            .find((address): address is string => address !== null);
          if (reverseAddress) {
            enriched = {
              ...enriched,
              address: reverseAddress,
              display: reverseAddress,
            };
          }
        }

        return enriched;
      },
    );

    const context: VietmapNormalizationContext = {
      retrievedAt: this.clock(),
      sourceKind: "live",
      sourceUrl: this.config.placeBaseUrl,
    };
    return normalizeVietmapSearchResponse(enrichedResults, context);
  }
}
