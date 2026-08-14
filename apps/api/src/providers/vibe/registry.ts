import type { ProviderVibeConfig, ProviderVibeProvider } from "./config";

export type ProviderVibeAdapter = Readonly<{
  provider: ProviderVibeProvider;
}>;

export type ProviderVibeAdapterFactory = (options: {
  credential: string;
}) => ProviderVibeAdapter;

export type ProviderVibeAdapterFactories = Readonly<
  Partial<Record<ProviderVibeProvider, ProviderVibeAdapterFactory>>
>;

export type ProviderVibeStatus = Readonly<{
  credential: "configured" | "missing";
  ingestEnabled: boolean;
  ingestRequested: boolean;
  productionReady: boolean;
  provider: ProviderVibeProvider;
  rankingEnabled: boolean;
  rankingRequested: boolean;
}>;

export class ProviderVibeRegistry {
  readonly #adapters = new Map<ProviderVibeProvider, ProviderVibeAdapter>();
  readonly #config: ProviderVibeConfig;
  readonly #factories: ProviderVibeAdapterFactories;

  constructor(
    config: ProviderVibeConfig,
    factories: ProviderVibeAdapterFactories = {},
  ) {
    this.#config = config;
    this.#factories = factories;
  }

  get enabled(): boolean {
    return this.#config.enabled;
  }

  getIngestAdapter(provider: ProviderVibeProvider): ProviderVibeAdapter {
    const providerConfig = this.#config.providers[provider];

    if (!providerConfig.ingestEnabled) {
      throw new Error(`Provider vibe ingestion is disabled for ${provider}`);
    }

    const existingAdapter = this.#adapters.get(provider);

    if (existingAdapter) {
      return existingAdapter;
    }

    const factory = this.#factories[provider];

    if (!factory) {
      throw new Error(`No provider vibe adapter is registered for ${provider}`);
    }

    if (!providerConfig.credential) {
      throw new Error(
        `${providerConfig.credentialEnvName} is required to initialize ${provider}`,
      );
    }

    const adapter = factory({ credential: providerConfig.credential });

    if (adapter.provider !== provider) {
      throw new Error(
        `Provider vibe adapter mismatch: expected ${provider}, received ${adapter.provider}`,
      );
    }

    this.#adapters.set(provider, adapter);
    return adapter;
  }

  isIngestEnabled(provider: ProviderVibeProvider): boolean {
    return this.#config.providers[provider].ingestEnabled;
  }

  isRankingEnabled(provider: ProviderVibeProvider): boolean {
    return this.#config.providers[provider].rankingEnabled;
  }

  listIngestProviders(): ProviderVibeProvider[] {
    return this.listStatuses()
      .filter(({ ingestEnabled }) => ingestEnabled)
      .map(({ provider }) => provider);
  }

  listRankingProviders(): ProviderVibeProvider[] {
    return this.listStatuses()
      .filter(({ rankingEnabled }) => rankingEnabled)
      .map(({ provider }) => provider);
  }

  listStatuses(): ProviderVibeStatus[] {
    return Object.values(this.#config.providers).map((providerConfig) => ({
      credential: providerConfig.credential ? "configured" : "missing",
      ingestEnabled: providerConfig.ingestEnabled,
      ingestRequested: providerConfig.ingestRequested,
      productionReady: providerConfig.productionReady,
      provider: providerConfig.provider,
      rankingEnabled: providerConfig.rankingEnabled,
      rankingRequested: providerConfig.rankingRequested,
    }));
  }
}

export function createProviderVibeRegistry(
  config: ProviderVibeConfig,
  factories: ProviderVibeAdapterFactories = {},
): ProviderVibeRegistry {
  return new ProviderVibeRegistry(config, factories);
}
