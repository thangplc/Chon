type Environment = Readonly<Record<string, string | undefined>>;

export const PROVIDER_VIBE_DEFINITIONS = [
  {
    credentialEnvName: "FOURSQUARE_PLACES_TOKEN",
    ingestFlagEnvName: "FOURSQUARE_VIBE_INGEST_ENABLED",
    productionReadyEnvName: "FOURSQUARE_VIBE_PRODUCTION_READY",
    provider: "foursquare_places",
    rankingFlagEnvName: "FOURSQUARE_VIBE_RANKING_ENABLED",
  },
  {
    credentialEnvName: "GOOGLE_PLACES_API_KEY",
    ingestFlagEnvName: "GOOGLE_VIBE_INGEST_ENABLED",
    productionReadyEnvName: "GOOGLE_VIBE_PRODUCTION_READY",
    provider: "google_places",
    rankingFlagEnvName: "GOOGLE_VIBE_RANKING_ENABLED",
  },
  {
    credentialEnvName: "YELP_PLACES_API_KEY",
    ingestFlagEnvName: "YELP_VIBE_INGEST_ENABLED",
    productionReadyEnvName: "YELP_VIBE_PRODUCTION_READY",
    provider: "yelp",
    rankingFlagEnvName: "YELP_VIBE_RANKING_ENABLED",
  },
  {
    credentialEnvName: "TRIPADVISOR_CONTENT_API_KEY",
    ingestFlagEnvName: "TRIPADVISOR_VIBE_INGEST_ENABLED",
    productionReadyEnvName: "TRIPADVISOR_VIBE_PRODUCTION_READY",
    provider: "tripadvisor",
    rankingFlagEnvName: "TRIPADVISOR_VIBE_RANKING_ENABLED",
  },
] as const;

export const PROVIDER_VIBE_MASTER_FLAG = "THIRD_PARTY_VIBE_ENABLED";

export type ProviderVibeProvider =
  (typeof PROVIDER_VIBE_DEFINITIONS)[number]["provider"];

export type ProviderVibeProviderConfig = Readonly<{
  credential: string | undefined;
  credentialEnvName: string;
  ingestEnabled: boolean;
  ingestRequested: boolean;
  productionReady: boolean;
  provider: ProviderVibeProvider;
  rankingEnabled: boolean;
  rankingRequested: boolean;
}>;

export type ProviderVibeConfig = Readonly<{
  enabled: boolean;
  providers: Readonly<Record<ProviderVibeProvider, ProviderVibeProviderConfig>>;
  runtimeEnvironment: "development" | "production" | "test";
}>;

function parseBooleanFlag(environment: Environment, key: string): boolean {
  const value = environment[key]?.trim();

  if (!value) {
    return false;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${key} must be either true or false`);
}

function readRuntimeEnvironment(
  environment: Environment,
): ProviderVibeConfig["runtimeEnvironment"] {
  const value = environment.NODE_ENV?.trim() || "development";

  if (value === "development" || value === "production" || value === "test") {
    return value;
  }

  throw new Error(
    "NODE_ENV must be development, production or test for provider vibe config",
  );
}

export function readProviderVibeConfig(
  environment: Environment = process.env,
): ProviderVibeConfig {
  const enabled = parseBooleanFlag(environment, PROVIDER_VIBE_MASTER_FLAG);
  const runtimeEnvironment = readRuntimeEnvironment(environment);
  const providerEntries = PROVIDER_VIBE_DEFINITIONS.map((definition) => {
    const ingestRequested = parseBooleanFlag(
      environment,
      definition.ingestFlagEnvName,
    );
    const rankingRequested = parseBooleanFlag(
      environment,
      definition.rankingFlagEnvName,
    );
    const productionReady = parseBooleanFlag(
      environment,
      definition.productionReadyEnvName,
    );
    const credential =
      environment[definition.credentialEnvName]?.trim() || undefined;
    const ingestEnabled = enabled && ingestRequested;
    const rankingEnabled = enabled && rankingRequested;

    if (ingestEnabled && !credential) {
      throw new Error(
        `${definition.credentialEnvName} is required when ${definition.ingestFlagEnvName} is enabled`,
      );
    }

    if (
      runtimeEnvironment === "production" &&
      (ingestEnabled || rankingEnabled) &&
      !productionReady
    ) {
      throw new Error(
        `${definition.productionReadyEnvName} must be true before enabling ${definition.provider} in production`,
      );
    }

    const providerConfig: ProviderVibeProviderConfig = {
      credential,
      credentialEnvName: definition.credentialEnvName,
      ingestEnabled,
      ingestRequested,
      productionReady,
      provider: definition.provider,
      rankingEnabled,
      rankingRequested,
    };

    return [definition.provider, providerConfig] as const;
  });

  return {
    enabled,
    providers: Object.fromEntries(providerEntries) as Record<
      ProviderVibeProvider,
      ProviderVibeProviderConfig
    >,
    runtimeEnvironment,
  };
}
