import { z } from "zod";

import { POI_PROVIDER } from "./types";

type Environment = Readonly<Record<string, string | undefined>>;

export const VIETMAP_POI_DEFAULT_BASE_URL =
  "https://maps.vietmap.vn/api/search/v4";
export const VIETMAP_POI_DEFAULT_PLACE_BASE_URL =
  "https://maps.vietmap.vn/api/place/v4";
export const VIETMAP_POI_DEFAULT_REVERSE_BASE_URL =
  "https://maps.vietmap.vn/api/reverse/v4";

export type VietmapPoiConfig = Readonly<{
  apiKey: string | undefined;
  baseUrl: string;
  categoryCafe: string | undefined;
  enabled: boolean;
  maxRequests: number;
  placeBaseUrl: string;
  requestIntervalMs: number;
  reverseBaseUrl: string;
  productionReady: boolean;
  provider: typeof POI_PROVIDER;
  queryText: string;
  timeoutMs: number;
}>;

function parseBooleanFlag(environment: Environment, key: string): boolean {
  const value = environment[key]?.trim();
  if (!value) return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${key} must be either true or false`);
}

function parsePositiveInteger(
  environment: Environment,
  key: string,
  fallback: number,
  maximum: number,
): number {
  const value = environment[key]?.trim();
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${key} must be an integer between 1 and ${maximum}`);
  }
  return parsed;
}

function parseNonNegativeInteger(
  environment: Environment,
  key: string,
  fallback: number,
  maximum: number,
): number {
  const value = environment[key]?.trim();
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new Error(`${key} must be an integer between 0 and ${maximum}`);
  }
  return parsed;
}

function parseUrl(
  environment: Environment,
  key: string,
  fallback: string,
): string {
  const value = environment[key]?.trim() || fallback;
  z.url().parse(value);
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${key} must use http or https`);
  }
  return url.toString();
}

export function readVietmapPoiConfig(
  environment: Environment = process.env,
): VietmapPoiConfig {
  const enabled = parseBooleanFlag(environment, "VIETMAP_POI_ENABLED");
  const apiKey = environment.VIETMAP_API_KEY?.trim() || undefined;

  if (enabled && !apiKey) {
    throw new Error(
      "VIETMAP_API_KEY is required when VIETMAP_POI_ENABLED is enabled",
    );
  }

  return {
    apiKey,
    baseUrl: parseUrl(
      environment,
      "VIETMAP_POI_BASE_URL",
      VIETMAP_POI_DEFAULT_BASE_URL,
    ),
    categoryCafe: environment.VIETMAP_POI_CATEGORY_CAFE?.trim() || undefined,
    enabled,
    maxRequests: parsePositiveInteger(
      environment,
      "VIETMAP_POI_MAX_REQUESTS",
      200,
      10_000,
    ),
    placeBaseUrl: parseUrl(
      environment,
      "VIETMAP_POI_PLACE_BASE_URL",
      VIETMAP_POI_DEFAULT_PLACE_BASE_URL,
    ),
    requestIntervalMs: parseNonNegativeInteger(
      environment,
      "VIETMAP_POI_REQUEST_INTERVAL_MS",
      500,
      60_000,
    ),
    reverseBaseUrl: parseUrl(
      environment,
      "VIETMAP_POI_REVERSE_BASE_URL",
      VIETMAP_POI_DEFAULT_REVERSE_BASE_URL,
    ),
    productionReady: parseBooleanFlag(
      environment,
      "VIETMAP_POI_PRODUCTION_READY",
    ),
    provider: POI_PROVIDER,
    queryText: environment.VIETMAP_POI_QUERY_TEXT?.trim() || "cafe",
    timeoutMs: parsePositiveInteger(
      environment,
      "VIETMAP_POI_TIMEOUT_MS",
      5_000,
      60_000,
    ),
  };
}
