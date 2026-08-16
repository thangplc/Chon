import "./load-api-env.mjs";

import { parseArgs } from "node:util";

import { readVietmapPoiConfig } from "../src/providers/poi/config";
import { VietmapPoiClient } from "../src/providers/poi/vietmap/client";
import { VIETMAP_POI_FIXTURE_PAYLOADS } from "../src/providers/poi/vietmap/fixtures";
import { normalizeVietmapSearchResponse } from "../src/providers/poi/vietmap/normalizer";

const HELP = `VIETMAP POI spike (read-only)

Fixture mode (default):
  pnpm vietmap:poi:spike --fixture --json

Live mode (requires VIETMAP_POI_ENABLED=true and VIETMAP_API_KEY):
  pnpm vietmap:poi:spike --live --lat 10.78 --lng 106.69 --radius 750

Options:
  --category <code>  VIETMAP cafe category code
  --fixture          Parse the versioned local fixture
  --json             Print machine-readable output
  --lat <number>     Search center latitude (live mode)
  --live             Call VIETMAP without writing to the database
  --lng <number>     Search center longitude (live mode)
  --radius <meters>  Search radius (default: 1000)
  --text <query>     Search text (default: cafe)
`;

function numberOption(
  value: string | undefined,
  option: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`--${option} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      category: { type: "string" },
      fixture: { type: "boolean" },
      help: { short: "h", type: "boolean" },
      json: { type: "boolean" },
      lat: { type: "string" },
      live: { type: "boolean" },
      lng: { type: "string" },
      radius: { type: "string" },
      text: { type: "string" },
    },
    strict: true,
  });

  if (values.help) {
    console.log(HELP);
    return;
  }

  const live = values.live === true;
  const config = readVietmapPoiConfig();
  const retrievedAt = new Date();
  let places;
  let source: "live" | "synthetic_fixture";

  if (!live) {
    places = normalizeVietmapSearchResponse(
      VIETMAP_POI_FIXTURE_PAYLOADS.searchCafes,
      {
        retrievedAt: new Date("2026-08-15T00:00:00.000Z"),
        sourceKind: "synthetic_fixture",
        sourceUrl: config.baseUrl,
      },
    );
    source = "synthetic_fixture";
  } else {
    if (!config.enabled) {
      throw new Error(
        "Set VIETMAP_POI_ENABLED=true before running live VIETMAP spike",
      );
    }
    if (values.lat === undefined || values.lng === undefined) {
      throw new Error("Live mode requires --lat and --lng");
    }

    const client = new VietmapPoiClient(config);
    places = await client.search({
      category:
        typeof values.category === "string"
          ? values.category
          : config.categoryCafe,
      latitude: numberOption(values.lat, "lat", -90, 90),
      longitude: numberOption(values.lng, "lng", -180, 180),
      radiusMeters: numberOption(values.radius ?? "1000", "radius", 1, 50_000),
      text: values.text?.trim() || config.queryText,
    });
    source = "live";
  }

  const output = {
    count: places.length,
    isSynthetic: source === "synthetic_fixture",
    places: places.map((place) => ({
      address: place.address,
      addressCurrent: place.addressCurrent,
      addressLegacy: place.addressLegacy,
      categories: place.categories,
      latitude: place.latitude,
      longitude: place.longitude,
      name: place.name,
      provider: place.provider,
      providerPlaceId: place.providerPlaceId,
      retrievedAt: place.retrievedAt.toISOString(),
    })),
    retrievedAt: retrievedAt.toISOString(),
    source,
  };

  console.log(values.json ? JSON.stringify(output, null, 2) : output);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
