import { readVietmapPoiConfig, type VietmapPoiConfig } from "./config";
import { VietmapPoiClient } from "./vietmap/client";
import type { PoiProvider, PoiProviderAdapter } from "./types";

export type PoiProviderStatus = Readonly<{
  credential: "configured" | "missing";
  enabled: boolean;
  provider: PoiProvider;
}>;

export class PoiProviderRegistry {
  #adapter: PoiProviderAdapter | undefined;

  constructor(
    private readonly config: VietmapPoiConfig = readVietmapPoiConfig(),
  ) {}

  listStatuses(): readonly PoiProviderStatus[] {
    return [
      {
        credential: this.config.apiKey ? "configured" : "missing",
        enabled: this.config.enabled,
        provider: this.config.provider,
      },
    ];
  }

  getAdapter(provider: PoiProvider): PoiProviderAdapter {
    if (provider !== this.config.provider) {
      throw new Error(`Unsupported POI provider: ${provider}`);
    }
    if (!this.config.enabled) {
      throw new Error(`POI provider is disabled for ${provider}`);
    }
    return (this.#adapter ??= new VietmapPoiClient(this.config));
  }
}

export function createPoiProviderRegistry(
  config: VietmapPoiConfig = readVietmapPoiConfig(),
): PoiProviderRegistry {
  return new PoiProviderRegistry(config);
}
