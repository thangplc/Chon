import "./load-api-env.mjs";

import { parseArgs } from "node:util";

import type { ProviderVibeProvider } from "../src/providers/vibe/config";
import {
  PROVIDER_VIBE_FIXTURE_MANIFEST,
  PROVIDER_VIBE_FIXTURE_PAYLOADS,
} from "../src/providers/vibe/fixtures";
import {
  createProviderVibeRegistry,
  readProviderVibeConfig,
} from "../src/providers/vibe";
import { toProviderVibeSignalInsert } from "../src/providers/vibe/persistence";
import type { ProviderVibeNormalizationContext } from "../src/providers/vibe/normalizer";
import { PROVIDER_VIBE_RESPONSE_CONTRACT_VERSION } from "../src/providers/vibe/response-contract";

const providers: readonly ProviderVibeProvider[] = [
  "foursquare_places",
  "google_places",
  "yelp",
  "tripadvisor",
];

function required(
  value: string | undefined,
  option: string,
  maximum = 255,
): string {
  const result = value?.trim();
  if (!result) throw new Error(`Missing required option --${option}`);
  if (result.length > maximum) {
    throw new Error(`--${option} must be at most ${maximum} characters`);
  }
  return result;
}

function readProvider(value: string | undefined): ProviderVibeProvider {
  const provider = required(value, "provider");
  if (!providers.includes(provider as ProviderVibeProvider)) {
    throw new Error(`Invalid --provider: ${provider}`);
  }
  return provider as ProviderVibeProvider;
}

function readTimestamp(value: string | undefined): Date {
  const raw = required(value, "retrieved-at");
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) {
    throw new Error("--retrieved-at must include a timezone");
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("--retrieved-at must be a valid ISO timestamp");
  }
  return parsed;
}

function printHelp(): void {
  console.log(`Provider vibe fixture normalizer (dry-run only)

Usage:
  pnpm provider:vibe:normalize --provider yelp --place-id <uuid>
    --place-source-id <uuid> --provider-place-id <id>
    --retrieved-at <iso-timestamp> --dry-run [--json]

The command never calls a provider API or writes to PostgreSQL.`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "attribution-text": { type: "string" },
      "dry-run": { type: "boolean" },
      help: { short: "h", type: "boolean" },
      "place-id": { type: "string" },
      "place-source-id": { type: "string" },
      "provider-place-id": { type: "string" },
      provider: { type: "string" },
      "retrieved-at": { type: "string" },
      "source-url": { type: "string" },
      json: { type: "boolean" },
    },
    strict: true,
  });
  if (values.help) {
    printHelp();
    return;
  }
  if (values["dry-run"] !== true) {
    throw new Error("This normalizer command requires --dry-run");
  }

  const provider = readProvider(values.provider);
  const config = readProviderVibeConfig();
  const adapter = createProviderVibeRegistry(config).getIngestAdapter(provider);
  const context: ProviderVibeNormalizationContext = {
    attributionText: values["attribution-text"],
    placeId: required(values["place-id"], "place-id"),
    placeSourceId: required(values["place-source-id"], "place-source-id"),
    providerPlaceId: required(values["provider-place-id"], "provider-place-id"),
    retrievedAt: readTimestamp(values["retrieved-at"]),
    sourceUrl: values["source-url"],
  };
  const fixtureManifest = PROVIDER_VIBE_FIXTURE_MANIFEST[provider];
  const normalized = adapter.normalize(
    PROVIDER_VIBE_FIXTURE_PAYLOADS[provider],
    context,
  );
  const databaseInputs = normalized.map(toProviderVibeSignalInsert);
  if (values.json) {
    console.log(
      JSON.stringify(
        {
          contractVersion: PROVIDER_VIBE_RESPONSE_CONTRACT_VERSION,
          fixture: fixtureManifest,
          signals: databaseInputs,
        },
        (_, value) => (value instanceof Date ? value.toISOString() : value),
        2,
      ),
    );
    return;
  }
  console.log(
    `Normalized ${databaseInputs.length} ${provider} ${fixtureManifest.version} fixture signals; no API call or database write performed.`,
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
