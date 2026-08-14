import "./load-api-env.mjs";

import {
  createProviderVibeRegistry,
  readProviderVibeConfig,
} from "../src/providers/vibe";

const requireAllCredentials = process.argv.includes("--require-all");

try {
  const config = readProviderVibeConfig();
  const registry = createProviderVibeRegistry(config);
  const statuses = registry.listStatuses();

  console.table(
    statuses.map((status) => ({
      credential: status.credential,
      ingest: status.ingestEnabled ? "enabled" : "disabled",
      ingestRequested: status.ingestRequested,
      productionReady: status.productionReady,
      provider: status.provider,
      ranking: status.rankingEnabled ? "enabled" : "disabled",
      rankingRequested: status.rankingRequested,
    })),
  );
  console.log(
    `Third-party vibe master flag: ${registry.enabled ? "enabled" : "disabled"}`,
  );
  console.log(
    "Credential values were not printed and no provider API was called.",
  );

  if (
    requireAllCredentials &&
    statuses.some(({ credential }) => credential === "missing")
  ) {
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Invalid provider vibe configuration: ${message}`);
  process.exitCode = 1;
}
