import { access, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const rootEnvironmentPath = `${repositoryRoot}/.env`;
const webEnvironmentPath = `${repositoryRoot}/apps/web/.env`;
const apiEnvironmentPath = `${repositoryRoot}/apps/api/.env`;

const webDefaults = new Map([
  ["BACKEND_API_URL", "http://127.0.0.1:3001"],
  ["BACKEND_API_TIMEOUT_MS", "5000"],
  ["NEXT_PUBLIC_MAPTILER_API_KEY", ""],
  ["NEXT_PUBLIC_MAPTILER_STYLE_ID", "streets-v4"],
]);

const apiDefaults = new Map([
  ["DATABASE_HOST", "127.0.0.1"],
  ["DATABASE_PORT", "5432"],
  ["DATABASE_NAME", "chon"],
  ["DATABASE_USER", "chon"],
  ["DATABASE_PASSWORD", "replace_with_a_local_password"],
  ["DATABASE_SCHEMA", "public"],
  ["DATABASE_SSL", "false"],
  ["DATABASE_POOL_MAX", "10"],
  ["API_HOST", "0.0.0.0"],
  ["API_PORT", "3001"],
  ["API_CORS_ORIGINS", "http://localhost:3000"],
  ["DATA_IMPORT_TARGET_ENVIRONMENT", "local"],
  ["DATA_OPERATOR_ID", "local-developer"],
  ["THIRD_PARTY_VIBE_ENABLED", "false"],
  ["FOURSQUARE_VIBE_INGEST_ENABLED", "false"],
  ["FOURSQUARE_VIBE_RANKING_ENABLED", "false"],
  ["FOURSQUARE_VIBE_PRODUCTION_READY", "false"],
  ["GOOGLE_VIBE_INGEST_ENABLED", "false"],
  ["GOOGLE_VIBE_RANKING_ENABLED", "false"],
  ["GOOGLE_VIBE_PRODUCTION_READY", "false"],
  ["YELP_VIBE_INGEST_ENABLED", "false"],
  ["YELP_VIBE_RANKING_ENABLED", "false"],
  ["YELP_VIBE_PRODUCTION_READY", "false"],
  ["TRIPADVISOR_VIBE_INGEST_ENABLED", "false"],
  ["TRIPADVISOR_VIBE_RANKING_ENABLED", "false"],
  ["TRIPADVISOR_VIBE_PRODUCTION_READY", "false"],
  ["FOURSQUARE_PLACES_TOKEN", ""],
  ["GOOGLE_PLACES_API_KEY", ""],
  ["YELP_PLACES_API_KEY", ""],
  ["TRIPADVISOR_CONTENT_API_KEY", ""],
]);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseAssignments(source) {
  const assignments = new Map();

  for (const [index, line] of source.split(/\r?\n/u).entries()) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u,
    );
    if (!match) continue;

    const [, key, rawValue] = match;
    if (assignments.has(key)) {
      throw new Error(`Duplicate environment key on line ${index + 1}: ${key}`);
    }
    assignments.set(key, rawValue);
  }

  return assignments;
}

function renderEnvironment(defaults, current) {
  return `${[...defaults]
    .map(([key, fallback]) => `${key}=${current.get(key) ?? fallback}`)
    .join("\n")}\n`;
}

async function main() {
  const rootExists = await exists(rootEnvironmentPath);
  const webExists = await exists(webEnvironmentPath);
  const apiExists = await exists(apiEnvironmentPath);

  if (!rootExists && webExists && apiExists) {
    console.info("Environment files are already split.");
    return;
  }

  if (!rootExists) {
    throw new Error("Root .env does not exist; nothing can be migrated.");
  }

  if (webExists || apiExists) {
    throw new Error(
      "Refusing to overwrite apps/web/.env or apps/api/.env. Remove or reconcile it manually first.",
    );
  }

  const current = parseAssignments(await readFile(rootEnvironmentPath, "utf8"));
  const knownKeys = new Set([...webDefaults.keys(), ...apiDefaults.keys()]);
  const unknownKeys = [...current.keys()].filter((key) => !knownKeys.has(key));

  if (unknownKeys.length > 0) {
    throw new Error(
      `Refusing to drop unclassified environment keys: ${unknownKeys.join(", ")}`,
    );
  }

  const webTemporaryPath = `${webEnvironmentPath}.tmp`;
  const apiTemporaryPath = `${apiEnvironmentPath}.tmp`;

  await writeFile(webTemporaryPath, renderEnvironment(webDefaults, current), {
    mode: 0o600,
  });
  await writeFile(apiTemporaryPath, renderEnvironment(apiDefaults, current), {
    mode: 0o600,
  });
  await rename(webTemporaryPath, webEnvironmentPath);
  await rename(apiTemporaryPath, apiEnvironmentPath);

  const migratedWeb = parseAssignments(
    await readFile(webEnvironmentPath, "utf8"),
  );
  const migratedApi = parseAssignments(
    await readFile(apiEnvironmentPath, "utf8"),
  );

  if (
    migratedWeb.size !== webDefaults.size ||
    migratedApi.size !== apiDefaults.size
  ) {
    throw new Error(
      "Environment migration verification failed; root .env was preserved.",
    );
  }

  await unlink(rootEnvironmentPath);
  console.info(
    `Split environment successfully (${migratedWeb.size} web keys, ${migratedApi.size} API keys). Root .env was removed.`,
  );
}

await main();
