const defaultLocalApiUrl = "http://127.0.0.1:3001";

type Environment = Readonly<Record<string, string | undefined>>;

export type BackendConfig = Readonly<{
  baseUrl: string;
  timeoutMs: number;
}>;

export function readBackendConfig(
  environment: Environment = process.env,
): BackendConfig {
  const rawBaseUrl = environment.BACKEND_API_URL?.trim();
  if (!rawBaseUrl && environment.NODE_ENV === "production") {
    throw new Error("Missing required environment variable: BACKEND_API_URL");
  }

  const url = new URL(rawBaseUrl || defaultLocalApiUrl);
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("BACKEND_API_URL must use http or https");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("BACKEND_API_URL must not contain credentials or metadata");
  }

  const rawTimeout = environment.BACKEND_API_TIMEOUT_MS?.trim() || "5000";
  if (!/^\d+$/.test(rawTimeout)) {
    throw new Error("BACKEND_API_TIMEOUT_MS must be an integer");
  }
  const timeoutMs = Number(rawTimeout);
  if (timeoutMs < 100 || timeoutMs > 30_000) {
    throw new Error("BACKEND_API_TIMEOUT_MS must be between 100 and 30000");
  }

  return {
    baseUrl: url.toString().replace(/\/$/, ""),
    timeoutMs,
  };
}
